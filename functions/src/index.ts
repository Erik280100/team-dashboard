// Cloud Functions für das Team-Dashboard (Konten, Struktur-Sync, Backups).
// Einrichtung/Berechtigungen: siehe ../README.md.
import { randomInt } from "node:crypto"
import { initializeApp } from "firebase-admin/app"
import { getAuth, type UserRecord } from "firebase-admin/auth"
import { FieldValue, getFirestore, type DocumentSnapshot, type WriteBatch } from "firebase-admin/firestore"
import { HttpsError, onCall } from "firebase-functions/v2/https"
import { onDocumentWritten } from "firebase-functions/v2/firestore"
import { onSchedule } from "firebase-functions/v2/scheduler"
import { collectPeople, isLeadRole, type SbNode } from "./structure"
import { exportFirestore } from "./backup"
import { applySubtreeUpdate, isValidId, SubtreeError, type OrgStructure, type SubtreeInput } from "./subtree"
import { computeMonthStats, monthKeyFromGoal, monthWeekKeys } from "./planStats"

initializeApp()
const db = getFirestore()
const REGION = "europe-west1" // muss zur Client-Konfiguration passen (src/lib/firebase.ts)

type Role = "admin" | "lead" | "member"
const isRole = (v: unknown): v is Role => v === "admin" || v === "lead" || v === "member"

function requireAdmin(token: Record<string, unknown> | undefined) {
  if (token?.role !== "admin") throw new HttpsError("permission-denied", "Nur für Admins.")
}

/** IDs landen in Dokumentpfaden (employees/{id}) — nur das erlaubte Muster zulassen (verhindert Pfad-Einschleusung). */
function requireValidId(id: unknown): string {
  if (!isValidId(id)) throw new HttpsError("invalid-argument", "Ungültige Mitarbeiter-ID.")
  return id
}

/** Einmal-Passwort für neue Konten: zufällig, ohne verwechselbare Zeichen. Gilt nur bis zur ersten Anmeldung. */
const PASSWORD_CHARS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
function generatePassword(length = 12): string {
  let out = ""
  for (let i = 0; i < length; i++) out += PASSWORD_CHARS[randomInt(PASSWORD_CHARS.length)]
  return out
}

/**
 * Kontodaten eines Mitarbeiters (uid, E-Mail, Status "wartet auf erste Anmeldung") liegen NICHT im Mitarbeiter-
 * Dokument (das lesen alle Eingeloggten), sondern in employees/{id}/private/account — lesbar nur für den
 * Mitarbeiter selbst, Vorgesetzte und Admin, geschrieben nur von diesen Functions (firestore.rules).
 */
const accountRef = (empId: string) => db.doc(`employees/${empId}/private/account`)

async function writeAccount(empId: string, data: { uid: string; email: string; accountPending: boolean }) {
  await accountRef(empId).set(data)
  // Altbestand: frühere Versionen haben diese Felder im öffentlich lesbaren Mitarbeiter-Dokument abgelegt.
  await db.doc(`employees/${empId}`).update({
    uid: FieldValue.delete(), email: FieldValue.delete(), accountPending: FieldValue.delete(),
  })
}

const errorCode = (err: unknown) => (typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "")

/**
 * Konto für einen Mitarbeiter anlegen/aktualisieren (Admin).
 * Neues Konto: ein zufälliges Einmal-Passwort wird gesetzt (und einmalig zurückgegeben), der Claim
 * mustChangePassword erzwingt die Änderung bei der ersten Anmeldung (firestore.rules sperrt bis dahin
 * jeden Datenzugriff). Bestehendes Konto: Rolle wird aktualisiert; mit resetPassword=true gibt es
 * ein neues Einmal-Passwort (und wieder Änderungspflicht). Ein Auth-Konto, das nicht von uns stammt
 * (keine Rolle im Token, z. B. vorab selbst registriert), bekommt immer ein neues Einmal-Passwort.
 * Setzt die Custom Claims (role, employeeId) und verknüpft das Konto in employees/{id}/private/account.
 */
export const inviteUser = onCall({ region: REGION }, async (req) => {
  requireAdmin(req.auth?.token)
  const { email: rawEmail, employeeId: rawId, role, resetPassword } = (req.data ?? {}) as {
    email?: string; employeeId?: string; role?: string; resetPassword?: boolean
  }
  const email = (rawEmail ?? "").trim()
  if (!email.includes("@") || !rawId || !isRole(role)) {
    throw new HttpsError("invalid-argument", "email, employeeId und role (admin|lead|member) sind nötig.")
  }
  const employeeId = requireValidId(rawId)

  const emp = await db.doc(`employees/${employeeId}`).get()
  if (!emp.exists) throw new HttpsError("not-found", `Mitarbeiter ${employeeId} existiert nicht.`)
  const existingUid = (await accountRef(employeeId).get()).get("uid") as string | null | undefined

  const auth = getAuth()
  let user: UserRecord | null = null
  try {
    user = await auth.getUserByEmail(email)
  } catch (err) {
    if (errorCode(err) !== "auth/user-not-found") throw err
  }

  let uid: string
  let mustChange = false
  let password: string | null = null
  if (user) {
    if (existingUid && existingUid !== user.uid) {
      throw new HttpsError("already-exists", "Dieser Mitarbeiter ist bereits mit einem anderen Konto verknüpft.")
    }
    const linkedTo = user.customClaims?.employeeId
    if (typeof linkedTo === "string" && linkedTo !== employeeId) {
      throw new HttpsError("already-exists", "Diese E-Mail-Adresse gehört bereits zu einem anderen Mitarbeiter.")
    }
    uid = user.uid
    mustChange = user.customClaims?.mustChangePassword === true
    const foreign = !isRole(user.customClaims?.role) // nicht von uns angelegt (z. B. vorab selbst registriert)
    if (resetPassword || foreign) {
      password = generatePassword()
      await auth.updateUser(uid, { password, disabled: false })
      mustChange = true
    }
  } else {
    if (existingUid) {
      throw new HttpsError("already-exists", "Dieser Mitarbeiter hat bereits ein Konto mit einer anderen E-Mail-Adresse.")
    }
    password = generatePassword()
    uid = (await auth.createUser({ email, password })).uid
    mustChange = true
  }

  await auth.setCustomUserClaims(uid, { role, employeeId, ...(mustChange ? { mustChangePassword: true } : {}) })
  await db.doc(`users/${uid}`).set({ role, employeeId, email }, { merge: true })
  await writeAccount(employeeId, { uid, email, accountPending: mustChange })
  // Bei einer Rollenänderung sollen laufende Sitzungen die neuen Claims bald übernehmen.
  await auth.revokeRefreshTokens(uid)
  return { uid, tempPassword: password }
})

/**
 * Konto für einen Mitarbeiter aus dem Strukturbaum erstellen: Admin für jeden, sonst nur für Personen
 * in der eigenen Unterstruktur (der Aufrufer steht in employees/{id}.ancestors). Die Rolle ergibt sich
 * aus der Stufe (Führungsstufe -> lead, sonst member) — admin vergibt nur inviteUser. Das zufällige
 * Einmal-Passwort wird einmalig an den Aufrufer zurückgegeben; accountPending (private/account) steht bis zur
 * ersten Passwortänderung (setInitialPassword) und steuert den Button im Strukturbaum.
 */
export const createAccount = onCall({ region: REGION }, async (req) => {
  const token = req.auth?.token
  if (!token) throw new HttpsError("unauthenticated", "Bitte anmelden.")
  if (token.mustChangePassword === true) throw new HttpsError("permission-denied", "Bitte zuerst das Passwort ändern.")
  const { employeeId: rawId, email: rawEmail } = (req.data ?? {}) as { employeeId?: string; email?: string }
  const email = (rawEmail ?? "").trim()
  if (!rawId || !email.includes("@")) {
    throw new HttpsError("invalid-argument", "employeeId und eine gültige E-Mail-Adresse sind nötig.")
  }
  const employeeId = requireValidId(rawId)

  const emp = await db.doc(`employees/${employeeId}`).get()
  if (!emp.exists) throw new HttpsError("not-found", "Mitarbeiter existiert nicht.")
  const ancestors = (emp.get("ancestors") as string[] | undefined) ?? []
  const allowed = token.role === "admin" || (typeof token.employeeId === "string" && ancestors.includes(token.employeeId))
  if (!allowed) throw new HttpsError("permission-denied", "Du darfst nur für Personen deiner Unterstruktur ein Konto erstellen.")
  if (emp.get("active") === false) throw new HttpsError("failed-precondition", "Dieser Mitarbeiter ist nicht mehr aktiv.")
  if ((await accountRef(employeeId).get()).get("uid")) throw new HttpsError("already-exists", "Dieser Mitarbeiter hat bereits ein Konto.")

  const auth = getAuth()
  const password = generatePassword()
  let uid: string
  try {
    uid = (await auth.createUser({ email, password })).uid
  } catch (err) {
    const code = errorCode(err)
    if (code.includes("email-already-exists")) throw new HttpsError("already-exists", "Diese E-Mail-Adresse ist bereits vergeben.")
    if (code.includes("invalid-email")) throw new HttpsError("invalid-argument", "Ungültige E-Mail-Adresse.")
    throw err
  }
  const role: Role = isLeadRole(String(emp.get("role") ?? "")) ? "lead" : "member"
  await auth.setCustomUserClaims(uid, { role, employeeId, mustChangePassword: true })
  await db.doc(`users/${uid}`).set({ role, employeeId, email }, { merge: true })
  await writeAccount(employeeId, { uid, email, accountPending: true })
  return { uid, tempPassword: password }
})

/**
 * Erste Anmeldung: Das Passwort wird HIER gesetzt (nicht im Client), und erst danach fällt der Claim
 * mustChangePassword weg. So kann niemand die Sperre aufheben, ohne ein eigenes Passwort zu vergeben.
 * Der Client meldet sich danach mit dem neuen Passwort neu an (ein Passwortwechsel beendet alle Sitzungen).
 */
export const setInitialPassword = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid
  if (!uid) throw new HttpsError("unauthenticated", "Bitte anmelden.")
  const { newPassword } = (req.data ?? {}) as { newPassword?: unknown }
  if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 128) {
    throw new HttpsError("invalid-argument", "Das neue Passwort muss mindestens 8 Zeichen haben.")
  }
  const authTime = Number(req.auth?.token.auth_time ?? 0)
  if (Date.now() / 1000 - authTime > 15 * 60) {
    throw new HttpsError("failed-precondition", "Bitte erneut anmelden und das Passwort noch einmal ändern.")
  }
  const auth = getAuth()
  const user = await auth.getUser(uid)
  if (user.customClaims?.mustChangePassword !== true) {
    throw new HttpsError("failed-precondition", "Es ist keine Passwortänderung ausstehend.")
  }
  const { mustChangePassword: _drop, ...claims } = user.customClaims
  await auth.updateUser(uid, { password: newPassword })
  await auth.setCustomUserClaims(uid, claims)
  await auth.revokeRefreshTokens(uid)
  if (typeof claims.employeeId === "string" && isValidId(claims.employeeId)) {
    await accountRef(claims.employeeId).set({ accountPending: false }, { merge: true })
  }
  return { ok: true }
})

/** Konto sperren (Admin): Login wird deaktiviert, Daten bleiben erhalten. */
export const disableUser = onCall({ region: REGION }, async (req) => {
  requireAdmin(req.auth?.token)
  const employeeId = requireValidId((req.data as { employeeId?: unknown } | undefined)?.employeeId)
  const uid = (await accountRef(employeeId).get()).get("uid") as string | null | undefined
  if (!uid) throw new HttpsError("not-found", "Kein Konto verknüpft.")
  await getAuth().updateUser(uid, { disabled: true })
  await getAuth().revokeRefreshTokens(uid)
  return { ok: true }
})

/**
 * Strukturbaum geändert -> employees/{id} (name, role, managerId, ancestors) nachziehen,
 * fehlende Mitarbeiter anlegen, entfernte deaktivieren (Daten bleiben, Login wird gesperrt),
 * ancestors der Finanzierungsfälle aktualisieren. Geschrieben wird nur, was sich wirklich geändert hat
 * (jede Änderung an einem Mitarbeiter-Dokument kostet bei jedem offenen Dashboard einen Lesezugriff).
 */
export const onStructureChange = onDocumentWritten({ document: "org/structure", region: REGION }, async (event) => {
  const tree = event.data?.after.get("tree") as SbNode | undefined
  if (!tree) return
  const people = collectPeople(tree).filter((p) => isValidId(p.id))
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

  const known = new Map(existing.docs.map((d) => [d.id, d]))
  for (const p of people) {
    const ref = db.doc(`employees/${p.id}`)
    const structure = { name: p.name, role: p.role, managerId: p.managerId, ancestors: p.ancestors, active: true }
    const doc = known.get(p.id)
    if (doc) {
      if (!sameStructure(doc, structure)) op((b) => b.update(ref, structure))
    } else {
      // Neuer Mitarbeiter: Leerzeile wie newRowFor() (src/lib/calc/team.ts).
      op((b) =>
        b.set(ref, {
          ...structure, isNew: true, joinDate: new Date().toISOString().slice(0, 10),
          atPlan: 0, atIst: 0, btPlan: 0, btIst: 0, stPlan: 0, stIst: 0, etPlan: 0, etIst: 0, soll: 0, ist: 0,
          createdAt: FieldValue.serverTimestamp(),
        }),
      )
    }
  }
  const nowInactive: string[] = []
  for (const d of existing.docs) {
    if (byId.has(d.id)) continue
    if (d.get("active") !== false) nowInactive.push(d.id)
    if (d.get("active") !== false || d.get("managerId") != null || (d.get("ancestors") ?? []).length > 0) {
      op((b) => b.update(d.ref, { active: false, managerId: null, ancestors: [] }))
    }
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

  // Wer aus dem Baum entfernt wurde, verliert den Login (Daten bleiben erhalten; Wiederfreischalten: inviteUser).
  for (const id of nowInactive) await disableAccountOf(id)
})

function sameStructure(doc: DocumentSnapshot, s: { name: string; role: string; managerId: string | null; ancestors: string[]; active: boolean }) {
  return doc.get("name") === s.name && doc.get("role") === s.role && (doc.get("managerId") ?? null) === s.managerId
    && JSON.stringify(doc.get("ancestors") ?? []) === JSON.stringify(s.ancestors) && doc.get("active") === s.active
}

async function disableAccountOf(empId: string) {
  try {
    const uid = (await accountRef(empId).get()).get("uid") as string | null | undefined
    if (!uid) return
    await getAuth().updateUser(uid, { disabled: true })
    await getAuth().revokeRefreshTokens(uid)
  } catch (err) {
    console.error(`Konto von ${empId} konnte nicht gesperrt werden`, err)
  }
}

/**
 * Strukturbaum ändern (jedes Konto mit verknüpftem Mitarbeiter): erlaubt sind nur Änderungen UNTERHALB des
 * eigenen Knotens (hinzufügen, ändern, verschieben, entfernen). Der Client schickt die Kinder des eigenen
 * Knotens samt Notizen/Verbindungen; der Rest von org/structure (andere Äste, Stufensätze) bleibt unangetastet.
 * onStructureChange zieht danach employees/ancestors/Finanzierungen nach.
 */
export const updateSubtree = onCall({ region: REGION }, async (req) => {
  const token = req.auth?.token
  if (!token) throw new HttpsError("unauthenticated", "Bitte anmelden.")
  if (token.mustChangePassword === true) throw new HttpsError("permission-denied", "Bitte zuerst das Passwort ändern.")
  const employeeId = token.employeeId
  if (typeof employeeId !== "string" || !employeeId) {
    throw new HttpsError("permission-denied", "Dein Konto ist mit keinem Mitarbeiter verknüpft.")
  }
  const input = (req.data ?? {}) as SubtreeInput
  const ref = db.doc("org/structure")
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new SubtreeError("Strukturbaum fehlt.")
      // Bereits vergebene IDs (auch inaktive, nicht mehr im Baum stehende) dürfen nicht übernommen werden.
      const employeeIds = new Set((await tx.get(db.collection("employees").select())).docs.map((d) => d.id))
      const next = applySubtreeUpdate(snap.data() as OrgStructure, employeeId, input, employeeIds)
      tx.update(ref, { tree: next.tree, notes: next.notes, conns: next.conns })
    })
  } catch (err) {
    if (err instanceof SubtreeError) throw new HttpsError("failed-precondition", err.message)
    throw err
  }
  return { ok: true }
})

/**
 * Monatssummen (AT/BT/ST/ET, Soll) eines Mitarbeiters aus seiner Controlling-Planung berechnen und als
 * employees/{id}.monthStats ablegen — damit sie für alle sichtbar sind, ohne die Planung selbst freizugeben.
 */
async function refreshMonthStats(empId: string, month: string) {
  const ref = db.doc(`employees/${empId}`)
  const [empSnap, note, ...weekSnaps] = await Promise.all([
    ref.get(),
    db.doc(`employees/${empId}/planMonthNotes/${month}`).get(),
    ...monthWeekKeys(month).map((w) => db.doc(`employees/${empId}/planWeeks/${w}`).get()),
  ])
  if (!empSnap.exists) return
  const stats = computeMonthStats(
    month,
    weekSnaps.filter((w) => w.exists).map((w) => w.data() as Record<string, unknown>),
    note.exists ? (note.data() as Record<string, unknown>) : undefined,
  )
  if (JSON.stringify(empSnap.get("monthStats")) === JSON.stringify(stats)) return
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
  for (let i = 0; i < emps.docs.length; i += 10) {
    await Promise.all(emps.docs.slice(i, i + 10).map((e) => refreshMonthStats(e.id, after)))
  }
})

/** Sofort-Backup (Admin) — der Client ruft das vor jedem Monatsabschluss auf. */
export const backupNow = onCall({ region: REGION, timeoutSeconds: 300 }, async (req) => {
  requireAdmin(req.auth?.token)
  const prefix = await exportFirestore("pre-close")
  return { prefix }
})

/** Automatischer Monatsabschluss (täglich 00:10 Wien, schließt den Vormonat), siehe monthClose.ts. */
export { closeMonthAuto } from "./monthClose"
/** Gesamtzahlen der Finanzierungen für die Dashboard-Ansicht "Gesamt", siehe financingStats.ts. */
export { onFinancingChange } from "./financingStats"

/** Wöchentlicher Export in den eigenen Bucket (Lebenszyklusregel löscht nach 90 Tagen). */
export const weeklyBackup = onSchedule(
  { schedule: "every sunday 03:00", timeZone: "Europe/Vienna", region: REGION, timeoutSeconds: 540 },
  async () => {
    await exportFirestore("weekly")
  },
)
