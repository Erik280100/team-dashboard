// Cloud Functions für das Team-Dashboard (Konten, Struktur-Sync, Backups).
// Einrichtung/Berechtigungen: siehe ../README.md.
import { randomInt } from "node:crypto"
import { initializeApp } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { FieldValue, getFirestore, type WriteBatch } from "firebase-admin/firestore"
import { HttpsError, onCall } from "firebase-functions/v2/https"
import { onDocumentWritten } from "firebase-functions/v2/firestore"
import { onSchedule } from "firebase-functions/v2/scheduler"
import { collectPeople, type SbNode } from "./structure"
import { exportFirestore } from "./backup"
import { computeMonthStats, monthKeyFromGoal, monthWeekKeys } from "./planStats"

initializeApp()
const db = getFirestore()
const REGION = "europe-west1" // muss zur Client-Konfiguration passen (src/lib/firebase.ts)

type Role = "admin" | "lead" | "member"
const isRole = (v: unknown): v is Role => v === "admin" || v === "lead" || v === "member"

function requireAdmin(token: Record<string, unknown> | undefined) {
  if (token?.role !== "admin") throw new HttpsError("permission-denied", "Nur für Admins.")
}

/** Zufälliges Startpasswort (ohne verwechselbare Zeichen). Gilt nur bis zur ersten Anmeldung. */
function tempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
  return Array.from({ length: 14 }, () => chars[randomInt(chars.length)]).join("")
}

/**
 * Konto für einen Mitarbeiter anlegen/aktualisieren (Admin).
 * Neues Konto: Startpasswort wird erzeugt und einmalig zurückgegeben, der Claim
 * mustChangePassword erzwingt die Änderung bei der ersten Anmeldung (firestore.rules sperrt bis dahin
 * jeden Datenzugriff). Bestehendes Konto: Rolle wird aktualisiert; mit resetPassword=true gibt es
 * ein neues Startpasswort (und wieder Änderungspflicht).
 * Setzt die Custom Claims (role, employeeId) und verknüpft employees/{id}.uid.
 */
export const inviteUser = onCall({ region: REGION }, async (req) => {
  requireAdmin(req.auth?.token)
  const { email, employeeId, role, resetPassword } = (req.data ?? {}) as {
    email?: string; employeeId?: string; role?: string; resetPassword?: boolean
  }
  if (!email || !employeeId || !isRole(role)) {
    throw new HttpsError("invalid-argument", "email, employeeId und role (admin|lead|member) sind nötig.")
  }

  const empRef = db.doc(`employees/${employeeId}`)
  const emp = await empRef.get()
  if (!emp.exists) throw new HttpsError("not-found", `Mitarbeiter ${employeeId} existiert nicht.`)
  const existingUid = emp.get("uid") as string | null

  const auth = getAuth()
  let uid: string
  let mustChange = false
  let password: string | null = null
  try {
    const user = await auth.getUserByEmail(email)
    if (existingUid && existingUid !== user.uid) {
      throw new HttpsError("already-exists", "Dieser Mitarbeiter ist bereits mit einem anderen Konto verknüpft.")
    }
    uid = user.uid
    mustChange = user.customClaims?.mustChangePassword === true
    if (resetPassword) {
      password = tempPassword()
      await auth.updateUser(uid, { password, disabled: false })
      mustChange = true
    }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    if (existingUid) {
      throw new HttpsError("already-exists", "Dieser Mitarbeiter hat bereits ein Konto mit einer anderen E-Mail-Adresse.")
    }
    password = tempPassword()
    uid = (await auth.createUser({ email, password })).uid
    mustChange = true
  }

  await auth.setCustomUserClaims(uid, { role, employeeId, ...(mustChange ? { mustChangePassword: true } : {}) })
  await db.doc(`users/${uid}`).set({ role, employeeId, email }, { merge: true })
  await empRef.update({ uid, email })
  // Bei einer Rollenänderung sollen laufende Sitzungen die neuen Claims bald übernehmen.
  await auth.revokeRefreshTokens(uid)
  return { uid, tempPassword: password }
})

/**
 * Angemeldeter Nutzer hat sein Passwort geändert -> Pflicht-Claim entfernen.
 * Prüft, dass die Anmeldung frisch ist (Passwort wurde gerade eingegeben).
 */
export const completePasswordChange = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid
  if (!uid) throw new HttpsError("unauthenticated", "Bitte anmelden.")
  const authTime = Number(req.auth?.token.auth_time ?? 0)
  if (Date.now() / 1000 - authTime > 15 * 60) {
    throw new HttpsError("failed-precondition", "Bitte erneut anmelden und das Passwort noch einmal ändern.")
  }
  const user = await getAuth().getUser(uid)
  const { mustChangePassword: _drop, ...claims } = user.customClaims ?? {}
  await getAuth().setCustomUserClaims(uid, claims)
  return { ok: true }
})

/** Konto sperren (Admin): Login wird deaktiviert, Daten bleiben erhalten. */
export const disableUser = onCall({ region: REGION }, async (req) => {
  requireAdmin(req.auth?.token)
  const { employeeId } = (req.data ?? {}) as { employeeId?: string }
  if (!employeeId) throw new HttpsError("invalid-argument", "employeeId fehlt.")
  const uid = (await db.doc(`employees/${employeeId}`).get()).get("uid") as string | null
  if (!uid) throw new HttpsError("not-found", "Kein Konto verknüpft.")
  await getAuth().updateUser(uid, { disabled: true })
  await getAuth().revokeRefreshTokens(uid)
  return { ok: true }
})

/**
 * Strukturbaum geändert -> employees/{id} (name, role, managerId, ancestors) nachziehen,
 * fehlende Mitarbeiter anlegen, entfernte deaktivieren (Daten bleiben), ancestors der
 * Finanzierungsfälle aktualisieren.
 */
export const onStructureChange = onDocumentWritten({ document: "org/structure", region: REGION }, async (event) => {
  const tree = event.data?.after.get("tree") as SbNode | undefined
  if (!tree) return
  const people = collectPeople(tree)
  const byId = new Map(people.map((p) => [p.id, p]))

  const existing = await db.collection("employees").get()
  const batches: WriteBatch[] = []
  let batch = db.batch()
  let n = 0
  const op = (fn: (b: WriteBatch) => void) => {
    fn(batch)
    if (++n >= 400) {
      batches.push(batch)
      batch = db.batch()
      n = 0
    }
  }

  const known = new Set(existing.docs.map((d) => d.id))
  for (const p of people) {
    const ref = db.doc(`employees/${p.id}`)
    const structure = { name: p.name, role: p.role, managerId: p.managerId, ancestors: p.ancestors, active: true }
    if (known.has(p.id)) {
      op((b) => b.update(ref, structure))
    } else {
      // Neuer Mitarbeiter: Leerzeile wie newRowFor() (src/lib/calc/team.ts).
      op((b) =>
        b.set(ref, {
          ...structure, uid: null, isNew: true, joinDate: new Date().toISOString().slice(0, 10),
          atPlan: 0, atIst: 0, btPlan: 0, btIst: 0, stPlan: 0, stIst: 0, etPlan: 0, etIst: 0, soll: 0, ist: 0,
          createdAt: FieldValue.serverTimestamp(),
        }),
      )
    }
  }
  for (const d of existing.docs) {
    if (!byId.has(d.id)) op((b) => b.update(d.ref, { active: false, managerId: null, ancestors: [] }))
  }

  const financings = await db.collection("financings").get()
  for (const f of financings.docs) {
    const owner = byId.get(f.get("ownerId") as string)
    if (owner && JSON.stringify(f.get("ancestors")) !== JSON.stringify(owner.ancestors)) {
      op((b) => b.update(f.ref, { ancestors: owner.ancestors }))
    }
  }
  batches.push(batch)
  for (const b of batches) await b.commit()
})

/**
 * Monatssummen (AT/BT/ST/ET, Soll) eines Mitarbeiters aus seiner Controlling-Planung berechnen und als
 * employees/{id}.monthStats ablegen — damit sie für alle sichtbar sind, ohne die Planung selbst freizugeben.
 */
async function refreshMonthStats(empId: string, month: string) {
  const ref = db.doc(`employees/${empId}`)
  if (!(await ref.get()).exists) return
  const weekSnaps = await Promise.all(monthWeekKeys(month).map((w) => db.doc(`employees/${empId}/planWeeks/${w}`).get()))
  const note = await db.doc(`employees/${empId}/planMonthNotes/${month}`).get()
  const stats = computeMonthStats(
    month,
    weekSnaps.filter((w) => w.exists).map((w) => w.data() as Record<string, unknown>),
    note.exists ? (note.data() as Record<string, unknown>) : undefined,
  )
  if (JSON.stringify((await ref.get()).get("monthStats")) === JSON.stringify(stats)) return
  await ref.update({ monthStats: stats })
}

async function currentMonth(): Promise<string> {
  const goal = (await db.doc("org/teamGoal").get()).get("teamGoal") as { periodStart?: string } | undefined
  return monthKeyFromGoal(goal)
}

export const onPlanWeekChange = onDocumentWritten(
  { document: "employees/{empId}/planWeeks/{week}", region: REGION },
  async (event) => refreshMonthStats(event.params.empId, await currentMonth()),
)

export const onPlanMonthChange = onDocumentWritten(
  { document: "employees/{empId}/planMonthNotes/{month}", region: REGION },
  async (event) => refreshMonthStats(event.params.empId, await currentMonth()),
)

/** Umsatzmonat umgestellt (Monatsabschluss) -> Summen aller Mitarbeiter neu berechnen. */
export const onTeamGoalChange = onDocumentWritten({ document: "org/teamGoal", region: REGION }, async (event) => {
  const before = monthKeyFromGoal(event.data?.before.get("teamGoal"))
  const after = monthKeyFromGoal(event.data?.after.get("teamGoal"))
  if (before === after) return
  const emps = await db.collection("employees").get()
  for (const e of emps.docs) await refreshMonthStats(e.id, after)
})

/** Sofort-Backup (Admin) — der Client ruft das vor jedem Monatsabschluss auf. */
export const backupNow = onCall({ region: REGION, timeoutSeconds: 300 }, async (req) => {
  requireAdmin(req.auth?.token)
  const prefix = await exportFirestore("pre-close")
  return { prefix }
})

/** Wöchentlicher Export in den eigenen Bucket (Lebenszyklusregel löscht nach 90 Tagen). */
export const weeklyBackup = onSchedule(
  { schedule: "every sunday 03:00", timeZone: "Europe/Vienna", region: REGION, timeoutSeconds: 540 },
  async () => {
    await exportFirestore("weekly")
  },
)
