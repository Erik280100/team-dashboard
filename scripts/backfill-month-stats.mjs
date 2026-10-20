// Monatssummen (employees/{id}.monthStats) für alle Mitarbeiter einmalig berechnen — danach hält die Cloud
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
