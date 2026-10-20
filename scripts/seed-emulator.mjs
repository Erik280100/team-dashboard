// Kopiert eine echte Datenbank (Standard: staging) in den lokalen Firestore-Emulator und
// legt Testkonten im Auth-Emulator an — für Browser-Tests der neuen Rollen/Regeln.
//
//   (Emulatoren laufen:  npm run emulators)
//   node scripts/seed-emulator.mjs --source=staging --admin=bindlar --lead=<knoten-id> --member=<knoten-id>
//
// Passwort der Testkonten: --password=<...> (nur lokal im Emulator gültig).
import { initializeApp, applicationDefault } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"
import { getAuth } from "firebase-admin/auth"

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? "true"] }))
const PROJECT = "finova-team-dashboard"
const srcApp = initializeApp({ credential: applicationDefault(), projectId: PROJECT }, "src")
const src = getFirestore(srcApp, args.source ?? "staging")

// Emulator-Instanz getrennt konfigurieren (Env-Variablen würden sonst auch die Quelle umbiegen).
const emuApp = initializeApp({ projectId: PROJECT }, "emu")
const emu = getFirestore(emuApp)
emu.settings({ host: "127.0.0.1:8080", ssl: false })

async function copyDoc(ref) {
  const snap = await ref.get()
  if (snap.exists) await emu.doc(ref.path).set(snap.data())
  for (const sub of await ref.listCollections()) await copyCol(sub)
}
async function copyCol(col) {
  const refs = await col.listDocuments() // enthält auch "leere" Elterndokumente mit Unterkollektionen
  let n = 0
  for (const r of refs) { await copyDoc(r); n++ }
  return n
}

let total = 0
for (const col of await src.listCollections()) { total += await copyCol(col); console.log("kopiert:", col.id) }
console.log("Dokumente (oberste Ebene):", total)

if (args.password) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099"
  const auth = getAuth(emuApp)
  for (const [role, employeeId] of [["admin", args.admin], ["lead", args.lead], ["member", args.member]]) {
    if (!employeeId) continue
    const email = `test-${role}@example.test`
    const user = await auth.createUser({ email, password: args.password })
    await auth.setCustomUserClaims(user.uid, { role, employeeId })
    console.log("Testkonto:", email, `(${role}, ${employeeId})`)
  }
}
