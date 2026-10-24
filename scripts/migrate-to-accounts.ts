// Einmal-Migration finova/* -> employees/* (siehe src/lib/migration/accounts.ts).
//
//   npx tsx --tsconfig tsconfig.app.json scripts/migrate-to-accounts.ts --owner=<employeeId>            # Trockenlauf: schreibt nur migration-preview.json
//   npx tsx --tsconfig tsconfig.app.json scripts/migrate-to-accounts.ts --owner=<id> --apply --database=staging
//
// --owner     Mitarbeiter-ID (Strukturbaum-Knoten), dem das bisherige Erik-Board gehört.
// --database  Ziel-Datenbank (Default "(default)"). Zuerst gegen eine Staging-Kopie testen!
// --alias    Namenskorrekturen "Alt=Neu;Alt2=Neu2" (Tippfehler im Altbestand), z. B. --alias="Tobias Zika=Tobias Ziika"
// --apply     Wirklich schreiben. Ohne dieses Flag wird NICHTS in Firestore geschrieben.
//
// Die alten finova/*-Dokumente werden nur gelesen, nie verändert (= Backup).
// Auth: GOOGLE_APPLICATION_CREDENTIALS auf einen Service-Account-Key setzen
// (Firebase-Konsole -> Projekteinstellungen -> Dienstkonten). Key NIEMALS committen.
import { writeFileSync } from "node:fs"
import { initializeApp, applicationDefault } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"
import { migrateToAccounts, type LegacyData } from "../src/lib/migration/accounts"

const args = new Map(
  process.argv.slice(2).map((a) => {
    const s = a.replace(/^--/, "")
    const i = s.indexOf("=")
    return (i < 0 ? [s, "true"] : [s.slice(0, i), s.slice(i + 1)]) as [string, string]
  }),
)
const owner = args.get("owner")
if (!owner) {
  console.error("Fehlt: --owner=<employeeId>")
  process.exit(1)
}
const apply = args.get("apply") === "true"
const database = args.get("database") ?? "(default)"

initializeApp({ credential: applicationDefault(), projectId: "finova-team-dashboard" })
const source = getFirestore() // alte Daten liegen immer in (default)
const target = database === "(default)" ? source : getFirestore(database)

async function readLegacy(): Promise<LegacyData> {
  const snap = await source.collection("finova").get()
  const byId = new Map(snap.docs.map((d) => [d.id, d.data()]))
  const pick = <T>(id: string) => (byId.get(id) as T | undefined) ?? null
  const collect = <T>(prefix: string) => {
    const out: Record<string, T> = {}
    for (const [id, data] of byId) if (id.startsWith(prefix)) out[id.slice(prefix.length)] = data as T
    return out
  }
  return {
    dashboard: pick("dashboard"),
    orgchart: pick("orgchart"),
    attendance: pick("attendance"),
    financings: pick("financings"),
    erikTodos: pick("erik_todos"),
    archiveIndex: pick("archive_index"),
    planWeeks: collect("plan_week_"),
    planMonthNotes: collect("plan_month_notes_"),
    planAnnual: collect("plan_annual_"),
    snapshots: collect("snapshot_"),
  }
}

const legacy = await readLegacy()
const aliases = Object.fromEntries(
  (args.get("alias") ?? "").split(";").filter(Boolean).map((p) => p.split("=").map((x) => x.trim()) as [string, string]),
)
const result = migrateToAccounts(legacy, { boardOwnerId: owner, aliases })

writeFileSync("migration-preview.json", JSON.stringify(result, null, 2))
console.log(`${result.docs.length} Dokumente, ${result.accounts.length} Mitarbeiter, ${result.warnings.length} Warnungen`)
result.warnings.forEach((w) => console.warn("WARNUNG:", w))

if (!apply) {
  console.log("Trockenlauf — Vorschau in migration-preview.json. Mit --apply schreiben.")
  process.exit(0)
}

// Firestore-Batches sind auf 500 Operationen begrenzt.
for (let i = 0; i < result.docs.length; i += 400) {
  const batch = target.batch()
  for (const d of result.docs.slice(i, i + 400)) batch.set(target.doc(d.path), d.data)
  await batch.commit()
}
console.log(`Geschrieben in Datenbank "${database}".`)
