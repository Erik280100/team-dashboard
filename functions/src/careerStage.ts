// Automatische Insurance-Stufe für Trainees: Erreicht der Karrierezähler (employees/{id}.careerUnits.insurance)
// die nächste Schwelle, wird die Rolle im Strukturbaum (org/structure) angehoben; wurde ein Trainee von Hand
// befördert, zieht der Zähler nach. onStructureChange spiegelt die Rolle danach auf employees/{id}.
// Investment, Credit und Real Estate sind rein abgeleitet und brauchen kein Schreiben. Führungskräfte (ab
// Teamleiter) bleiben unberührt. Logik: careerStagePlan.ts / src/lib/calc/planStufen.ts.
import { getFirestore, type Firestore } from "firebase-admin/firestore"
import { HttpsError, onCall } from "firebase-functions/v2/https"
import { onDocumentWritten } from "firebase-functions/v2/firestore"
import { applyRoleChanges, planCareerChange, type CareerChange, type CareerShared } from "./careerStagePlan"

const REGION = "europe-west1" // wie in index.ts

// eslint-disable-next-line @typescript-eslint/no-require-imports
const loadShared = (): CareerShared => require("./shared.cjs") as CareerShared

async function applyChanges(db: Firestore, changes: CareerChange[]) {
  const roles = new Map(changes.filter((c) => c.role !== undefined).map((c) => [c.id, c.role as string]))
  if (roles.size > 0) {
    const ref = db.doc("org/structure")
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const tree = snap.get("tree")
      if (!tree) return
      const next = JSON.parse(JSON.stringify(tree))
      if (applyRoleChanges(next, roles).length > 0) tx.update(ref, { tree: next })
    })
  }
  for (const c of changes) {
    if (c.careerInsurance !== undefined) await db.doc(`employees/${c.id}`).update({ "careerUnits.insurance": c.careerInsurance })
  }
}

/** Reagiert nur, wenn sich Zähler oder Rolle geändert haben — jede andere Änderung am Dokument endet sofort. */
export const onCareerStageChange = onDocumentWritten({ document: "employees/{id}", region: REGION }, async (event) => {
  const after = event.data?.after
  if (!after?.exists) return
  const before = event.data?.before
  const key = (d: typeof after | undefined) => `${d?.get("role") ?? ""}|${d?.get("careerUnits.insurance") ?? ""}`
  if (before?.exists && key(before) === key(after)) return
  const change = planCareerChange(event.params.id, after.data() ?? {}, loadShared())
  if (change) await applyChanges(getFirestore(), [change])
})

/** Einmaliger Abgleich aller Trainees (Admin), z. B. beim Ausrollen: setzt Zähler und Rollen nach (nur aufwärts). */
export const reconcileCareerStages = onCall({ region: REGION, timeoutSeconds: 300 }, async (req) => {
  const token = req.auth?.token
  if (token?.role !== "admin" || token.mustChangePassword === true) throw new HttpsError("permission-denied", "Nur für Admins.")
  const db = getFirestore()
  const shared = loadShared()
  const docs = (await db.collection("employees").get()).docs
  const changes = docs
    .map((d) => planCareerChange(d.id, d.data(), shared))
    .filter((c): c is CareerChange => c !== null)
  await applyChanges(db, changes)
  return { changed: changes.length }
})
