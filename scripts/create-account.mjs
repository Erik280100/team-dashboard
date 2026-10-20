// Konto anlegen — wie die Cloud Function inviteUser/createAccount, aber ohne vorhandenen Admin
// (Henne-Ei beim Aufbau, und zum Testen gegen den Emulator).
//
//   node scripts/create-account.mjs --email=<mail> --employee=<knoten-id> [--role=lead|member|admin]
//   node scripts/create-account.mjs --email=<mail> --role=admin            # Admin ohne Mitarbeiter-Verknüpfung
//
// Ohne --role: "lead" bei Führungsstufe (Direktor/Regionalleiter/Geschäftsstellenleiter/Teamleiter), sonst "member".
// Das Konto bekommt ein zufälliges Einmal-Passwort (wird einmal ausgegeben); der Claim mustChangePassword erzwingt die Änderung beim
// ersten Login, employees/{id}/private/account.accountPending bleibt bis dahin gesetzt.
//
// Gegen den Emulator:  FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/create-account.mjs ...
// Gegen die Produktion: Auth wie bei create-admin.mjs (gcloud application-default login).
import { randomInt } from "node:crypto"
import { initializeApp, applicationDefault } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { FieldValue, getFirestore } from "firebase-admin/firestore"

const CHARS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const PASSWORD = Array.from({ length: 12 }, () => CHARS[randomInt(CHARS.length)]).join("") // wie generatePassword in functions/src/index.ts
const LEAD_ROLES = ["Direktor", "Regionalleiter", "Geschäftsstellenleiter", "Teamleiter"]

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? "true"] }))
const email = (args.email ?? "").trim()
if (!email.includes("@")) { console.error("Fehlt: --email=<mail>"); process.exit(1) }
if (!args.employee && args.role !== "admin") { console.error("Fehlt: --employee=<knoten-id> (oder --role=admin ohne Verknüpfung)"); process.exit(1) }

initializeApp({ credential: applicationDefault(), projectId: "finova-team-dashboard" })
const db = getFirestore()
const auth = getAuth()
const target = process.env.FIRESTORE_EMULATOR_HOST ? `Emulator (${process.env.FIRESTORE_EMULATOR_HOST})` : "PRODUKTION"

let empRef = null
let role = args.role
if (args.employee) {
  empRef = db.doc(`employees/${args.employee}`)
  const emp = await empRef.get()
  if (!emp.exists) { console.error(`Mitarbeiter ${args.employee} existiert nicht (${target}).`); process.exit(1) }
  if ((await db.doc(`employees/${args.employee}/private/account`).get()).get("uid")) { console.error(`${emp.get("name")} hat bereits ein Konto.`); process.exit(1) }
  role ??= LEAD_ROLES.includes(String(emp.get("role") ?? "")) ? "lead" : "member"
  console.log(`Mitarbeiter: ${emp.get("name")} (${emp.get("role")}) -> Rolle ${role}`)
}
if (!["admin", "lead", "member"].includes(role)) { console.error("Ungültige Rolle:", role); process.exit(1) }

const user = await auth.createUser({ email, password: PASSWORD })
await auth.setCustomUserClaims(user.uid, { role, ...(args.employee ? { employeeId: args.employee } : {}), mustChangePassword: true })
await db.doc(`users/${user.uid}`).set({ role, employeeId: args.employee ?? null, email }, { merge: true })
if (empRef) {
  await db.doc(`employees/${args.employee}/private/account`).set({ uid: user.uid, email, accountPending: true })
  await empRef.update({ uid: FieldValue.delete(), email: FieldValue.delete(), accountPending: FieldValue.delete() })
}
console.log(`Konto angelegt [${target}]: ${email} · Rolle ${role} · Einmal-Passwort ${PASSWORD} (muss beim ersten Login geändert werden)`)
