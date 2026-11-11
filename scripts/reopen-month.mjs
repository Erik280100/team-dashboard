// Einen bereits abgeschlossenen Umsatzmonat wieder öffnen (Notfall-Werkzeug, Admin SDK, umgeht die Regeln).
//
//   node scripts/reopen-month.mjs <YYYY-MM> <periodStart> <periodEnd> [--apply]
//   z. B.: node scripts/reopen-month.mjs 2026-10 2026-10-07 2026-11-03
//
// Ohne --apply nur Trockenlauf: zeigt, was geschrieben würde. Mit --apply passiert alles in EINEM atomaren Batch
// (entweder komplett oder gar nicht):
//   - Ist-Werte der Mitarbeiter = Stand aus dem Archiv + alles, was seit dem Abschluss neu gebucht wurde
//   - org/teamGoal = wieder der alte Monat mit dem neuen Zeitraum, Verlauf = Archiv-Verlauf + neuerer Verlauf
//   - Archiv-Snapshot des Monats und sein Eintrag im Archivindex werden gelöscht (der Monat lässt sich danach
//     wieder regulär abschließen, automatisch nach periodEnd oder von Hand)
// Vor dem Schreiben wird alles, was überschrieben oder gelöscht wird, als JSON gesichert (Pfad wird ausgegeben).
//
// Auth: gcloud application-default login (wie bei den anderen Skripten).
import { writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { initializeApp, applicationDefault } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

const [month, periodStart, periodEnd] = process.argv.slice(2).filter((a) => !a.startsWith("--"))
const apply = process.argv.includes("--apply")
const iso = /^\d{4}-\d{2}-\d{2}$/
if (!/^\d{4}-\d{2}$/.test(month ?? "") || !iso.test(periodStart ?? "") || !iso.test(periodEnd ?? "") || periodEnd < periodStart) {
  console.error("Aufruf: node scripts/reopen-month.mjs <YYYY-MM> <periodStart> <periodEnd> [--apply]")
  process.exit(1)
}
if (periodStart.slice(0, 7) !== month) {
  console.error(`Der Start (${periodStart}) muss im Monat ${month} liegen — der Monatsname richtet sich nach dem Starttag.`)
  process.exit(1)
}

initializeApp({ credential: applicationDefault(), projectId: "finova-team-dashboard" })
const db = getFirestore()

const num = (v) => Number(v) || 0
const addMaps = (a = {}, b = {}) => {
  const out = {}
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = num(a[k]) + num(b[k])
  return out
}

// ---- Vorbedingungen ----
const snapRef = db.doc(`snapshots/${month}`)
const snapMeta = await snapRef.get()
if (!snapMeta.exists) { console.error(`Kein Archiv für ${month} vorhanden — nichts zu öffnen.`); process.exit(1) }

const goalSnap = await db.doc("org/teamGoal").get()
const goalDoc = goalSnap.data()
const curGoal = goalDoc?.teamGoal
const curMonth = String(curGoal?.periodStart ?? "").slice(0, 7)
const [y, m] = month.split("-").map(Number)
const following = `${new Date(y, m, 1).getFullYear()}-${String(new Date(y, m, 1).getMonth() + 1).padStart(2, "0")}`
if (curMonth !== following) {
  console.error(`Abbruch: laufender Monat ist ${curMonth || "?"}, erwartet wird der direkte Folgemonat ${following}. Es wird nur der zuletzt abgeschlossene Monat geöffnet.`)
  process.exit(1)
}

const [snapEmps, empDocs, indexSnap] = await Promise.all([
  snapRef.collection("employees").get(),
  db.collection("employees").get(),
  db.doc("org/archiveIndex").get(),
])
const empById = new Map(empDocs.docs.map((d) => [d.id, d]))
const index = indexSnap.get("months") ?? []

// ---- Mitarbeiter: Archiv-Stand + Neubuchungen seit dem Abschluss ----
const empWrites = []
for (const s of snapEmps.docs) {
  const cur = empById.get(s.id)
  if (!cur) { console.warn("Übersprungen (Mitarbeiter existiert nicht mehr):", s.get("name")); continue }
  const a = s.data()
  const c = cur.data()
  const data = {
    ist: num(a.ist) + num(c.ist),
    bonus: num(a.bonus) + num(c.bonus),
    atIst: num(a.atIst), btIst: num(a.btIst), stIst: num(a.stIst), etIst: num(a.etIst),
  }
  if (a.ehByPlan || c.ehByPlan) data.ehByPlan = addMaps(a.ehByPlan, c.ehByPlan)
  if (a.vbByAbwickler || c.vbByAbwickler) data.vbByAbwickler = addMaps(a.vbByAbwickler, c.vbByAbwickler)
  empWrites.push({ ref: cur.ref, data, name: a.name, before: { ist: c.ist, bonus: c.bonus, ehByPlan: c.ehByPlan } })
}

// ---- Teamziel/Verlauf ----
const snapGoal = snapMeta.get("teamGoal") ?? {}
const nextGoal = { ...curGoal, recruitActual: snapGoal.recruitActual ?? null, periodStart, periodEnd }
const byDate = new Map()
for (const h of [...(snapMeta.get("history") ?? []), ...(goalDoc.history ?? [])]) byDate.set(h.date, h)
const history = [...byDate.values()].sort((x, y2) => x.date.localeCompare(y2.date))

const nextIndex = index.filter((e) => e.month !== month)
const ops = empWrites.length + snapEmps.size + 3
console.log(`Monat ${month} wieder öffnen: ${periodStart} – ${periodEnd}`)
console.log(`  Mitarbeiter zurückgeschrieben: ${empWrites.length}, Archiv-Dokumente gelöscht: ${snapEmps.size + 1}, Indexeintrag entfernt: ${index.length - nextIndex.length}`)
for (const w of empWrites) {
  if (num(w.data.ist) || num(w.before.ist)) console.log(`  ${w.name}: ist ${num(w.before.ist)} -> ${w.data.ist}`)
}
console.log(`  Teamziel: ${curGoal.periodStart} – ${curGoal.periodEnd}  ->  ${periodStart} – ${periodEnd}; Verlauf ${(goalDoc.history ?? []).length} -> ${history.length} Einträge`)
if (ops > 500) { console.error(`Zu viele Schreibvorgänge (${ops}) für einen atomaren Batch — Abbruch.`); process.exit(1) }

if (!apply) { console.log("\nTrockenlauf — nichts geschrieben. Mit --apply ausführen."); process.exit(0) }

// ---- Sicherung, dann atomar schreiben ----
const backupPath = join(tmpdir(), `reopen-${month}-${Date.now()}.json`)
writeFileSync(backupPath, JSON.stringify({
  teamGoalDoc: goalDoc,
  archiveIndex: indexSnap.data(),
  snapshotMeta: snapMeta.data(),
  snapshotEmployees: Object.fromEntries(snapEmps.docs.map((d) => [d.id, d.data()])),
  employees: Object.fromEntries(empWrites.map((w) => [w.ref.id, empById.get(w.ref.id).data()])),
}, null, 2))
console.log("Sicherung:", backupPath)

const batch = db.batch()
for (const w of empWrites) batch.update(w.ref, w.data)
batch.set(db.doc("org/teamGoal"), { ...goalDoc, teamGoal: nextGoal, history })
batch.set(db.doc("org/archiveIndex"), { ...indexSnap.data(), months: nextIndex })
for (const s of snapEmps.docs) batch.delete(s.ref)
batch.delete(snapRef)
await batch.commit()
console.log("Fertig. Der Monat ist wieder offen; die Cloud Function rechnet die Monatssummen für den neuen Zeitraum automatisch neu.")
