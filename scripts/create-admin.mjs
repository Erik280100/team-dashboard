// Erstes Admin-Konto anlegen (Henne-Ei-Problem: inviteUser verlangt schon einen Admin).
//
//   node scripts/create-admin.mjs --email=<mail> --employee=<knoten-id>
//
// Legt den Auth-Nutzer an (falls er fehlt), setzt die Custom Claims { role: "admin", employeeId }
// und gibt einen Link zum Passwort-Setzen aus. Auth: gcloud application-default login
// (GOOGLE_APPLICATION_CREDENTIALS auf application_default_credentials.json setzen).
// Verknüpft employees/{id}.uid NICHT — das passiert, wenn der Mitarbeiter-Datensatz nach der
// Migration existiert (dann einmal "Rolle/Link erneuern" auf der Konten-Seite oder inviteUser).
import { initializeApp, applicationDefault } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=")
    return [k, v ?? "true"]
  }),
)
if (!args.email || !args.employee) {
  console.error("Fehlt: --email=<mail> --employee=<knoten-id>")
  process.exit(1)
}

initializeApp({ credential: applicationDefault(), projectId: "finova-team-dashboard" })
const auth = getAuth()

let user
try {
  user = await auth.getUserByEmail(args.email)
  console.log("Konto existiert bereits:", user.uid)
} catch {
  user = await auth.createUser({ email: args.email })
  console.log("Konto angelegt:", user.uid)
}
await auth.setCustomUserClaims(user.uid, { role: "admin", employeeId: args.employee })
console.log(`Claims gesetzt: role=admin, employeeId=${args.employee}`)
console.log("Link zum Passwort-Setzen:")
console.log(await auth.generatePasswordResetLink(args.email))
