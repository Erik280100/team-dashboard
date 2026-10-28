// Automatischer Monatsabschluss: täglich kurz nach Mitternacht (Wien) prüfen, ob der offene Monat
// (org/teamGoal) vorbei ist. Wenn ja: Backup, Snapshot ins Archiv, Index, Ist-Werte zurücksetzen und auf den
// nächsten Kalendermonat umstellen. Die Reihenfolge macht den Lauf wiederholbar (siehe closeOne).
import { getFirestore, type Firestore } from "firebase-admin/firestore"
import { onSchedule } from "firebase-functions/v2/scheduler"
import { monthWeekKeys } from "./planStats"
import { exportFirestore } from "./backup"
import { planClose, type EmployeeInput, type Shared } from "./closePlan"

const REGION = "europe-west1" // wie in index.ts

// eslint-disable-next-line @typescript-eslint/no-require-imports
const loadShared = (): Shared => require("./shared.cjs") as Shared

/** Aktueller Kalendermonat "YYYY-MM" in Wien. */
export function viennaMonth(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna", year: "numeric", month: "2-digit" }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  return `${get("year")}-${get("month")}`
}

async function closeOne(db: Firestore, shared: Shared, month: string, goalData: Record<string, unknown>) {
  const teamGoal = goalData.teamGoal as Record<string, unknown>
  const history = (Array.isArray(goalData.history) ? goalData.history : []) as { date: string; ist: number }[]

  const [orgSnap, indexSnap, empSnap] = await Promise.all([
    db.doc("org/structure").get(),
    db.doc("org/archiveIndex").get(),
    db.collection("employees").get(),
  ])
  const weekKeys = monthWeekKeys(month)
  const employees: EmployeeInput[] = await Promise.all(
    empSnap.docs.map(async (d) => {
      const [weekSnaps, noteSnap] = await Promise.all([
        Promise.all(weekKeys.map((w) => d.ref.collection("planWeeks").doc(w).get())),
        d.ref.collection("planMonthNotes").doc(month).get(),
      ])
      return {
        id: d.id,
        data: d.data(),
        weeks: weekSnaps.filter((w) => w.exists).map((w) => w.data() as Record<string, unknown>),
        monthNote: noteSnap.exists ? (noteSnap.data() as Record<string, unknown>) : undefined,
      }
    }),
  )
  const index = ((indexSnap.get("months") as unknown[] | undefined) ?? []) as (Record<string, unknown> & { month: string })[]

  const plan = planClose(
    {
      teamGoal, history, org: orgSnap.data() ?? {}, employees, index,
      closedBy: "automatisch", now: new Date(),
    },
    shared,
  )

  const snapRef = db.doc(`snapshots/${month}`)
  const alreadyArchived = (await snapRef.get()).exists

  if (!alreadyArchived) {
    // Sicherung vor dem riskantesten Schritt; schlägt sie fehl, bleibt alles unverändert (nächster Lauf versucht es neu).
    await exportFirestore("pre-close")
    for (let i = 0; i < plan.snapshotEmployees.length; i += 400) {
      const batch = db.batch()
      for (const e of plan.snapshotEmployees.slice(i, i + 400)) batch.set(db.doc(`snapshots/${month}/employees/${e.id}`), e.data)
      await batch.commit()
    }
    // Meta zuletzt: sie gilt als "Snapshot ist vollständig" (Wiederholung nach Absturz schreibt sonst neu).
    await snapRef.set(plan.snapshotMeta)
  }
  if (!index.some((e) => e.month === month)) {
    await db.doc("org/archiveIndex").set({ version: 1, months: plan.indexMonths })
  }

  // Ist-Werte zurücksetzen (idempotent), erst danach den Monat umstellen.
  for (let i = 0; i < plan.resetWrites.length; i += 400) {
    const batch = db.batch()
    for (const w of plan.resetWrites.slice(i, i + 400)) batch.update(db.doc(`employees/${w.id}`), w.data)
    await batch.commit()
  }
  await db.doc("org/teamGoal").set(plan.next)
  return plan.next
}

/** Schließt alle vergangenen Monate (normalerweise genau einen), bis der offene Monat der aktuelle ist. */
export async function closePastMonths(db: Firestore, now = new Date()): Promise<string[]> {
  const shared = loadShared()
  const closed: string[] = []
  for (let guard = 0; guard < 12; guard++) {
    const goalSnap = await db.doc("org/teamGoal").get()
    const goalData = goalSnap.data()
    if (!goalData || typeof goalData.teamGoal !== "object" || !goalData.teamGoal) return closed
    const month = shared.monthKeyOf(goalData.teamGoal as Record<string, unknown>)
    const current = viennaMonth(now)
    if (!(month < current)) return closed
    // Nur der unmittelbare Vormonat wird automatisch abgeschlossen. Steht das Teamziel weiter zurück (z. B. nach
    // einer Pause), wären alle übersprungenen Monate mit denselben aktuellen Zahlen archiviert — das muss der
    // Admin bewusst von Hand klären.
    const [cy, cm] = current.split("-").map(Number)
    const prev = new Date(cy, cm - 2, 1)
    const previousMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`
    if (month < previousMonth) {
      console.error(`Automatischer Abschluss übersprungen: offener Monat ${month} liegt mehr als einen Monat zurück (aktuell ${current}). Bitte von Hand abschließen.`)
      return closed
    }
    await closeOne(db, shared, month, goalData)
    closed.push(month)
  }
  return closed
}

export const closeMonthAuto = onSchedule(
  { schedule: "10 0 * * *", timeZone: "Europe/Vienna", region: REGION, timeoutSeconds: 540, memory: "512MiB" },
  async () => {
    const closed = await closePastMonths(getFirestore())
    if (closed.length) console.log("Monate abgeschlossen:", closed.join(", "))
  },
)
