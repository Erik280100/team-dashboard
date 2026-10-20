// Monatssummen (employees/{id}.monthStats) und Finanzierungs-Gesamtzahlen (org/financingStats) einmalig berechnen — danach hält die Cloud
// Function onPlanWeekChange/onPlanMonthChange sie aktuell. Nötig nach dem Deploy, damit Bestandsdaten sofort
// sichtbar sind.
//
//   (cd functions && npm run build)   # erzeugt functions/lib/planStats.js
//   node scripts/backfill-month-stats.mjs [--dry]
//
// Auth: gcloud application-default login (GOOGLE_APPLICATION_CREDENTIALS wie bei create-admin.mjs).
import { initializeApp, applicationDefault } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"
import { computeMonthStats, monthKeyFromGoal, monthWeekKeys } from "../functions/lib/planStats.js"

const dry = process.argv.includes("--dry")
initializeApp({ credential: applicationDefault(), projectId: "finova-team-dashboard" })
const db = getFirestore()

const goal = (await db.doc("org/teamGoal").get()).get("teamGoal")
const month = monthKeyFromGoal(goal)
console.log("Umsatzmonat:", month)

const emps = await db.collection("employees").get()
for (const e of emps.docs) {
  const weeks = (await Promise.all(monthWeekKeys(month).map((w) => e.ref.collection("planWeeks").doc(w).get())))
    .filter((w) => w.exists)
    .map((w) => w.data())
  const note = await e.ref.collection("planMonthNotes").doc(month).get()
  const stats = computeMonthStats(month, weeks, note.exists ? note.data() : undefined)
  console.log(e.get("name"), JSON.stringify(stats))
  if (!dry) await e.ref.update({ monthStats: stats })
}
console.log(dry ? "Trockenlauf — nichts geschrieben." : "Fertig.")

// Gesamtzahlen der Finanzierungen (org/financingStats) einmalig füllen — danach hält onFinancingChange sie aktuell.
const cases = (await db.collection("financings").get()).docs.map((d) => d.data())
const open = cases.filter((c) => !c.archived)
const fin = {
  openCount: open.length,
  openVolume: open.reduce((s, c) => s + (Number(c.betrag) || 0), 0),
  anlegerwohnungen: open.filter((c) => c.art === "anlegerwohnung").length,
}
console.log("Finanzierungen gesamt:", JSON.stringify(fin))
if (!dry) await db.doc("org/financingStats").set({ ...fin, updatedAt: new Date().toISOString() })
