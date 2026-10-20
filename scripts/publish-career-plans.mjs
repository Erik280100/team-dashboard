// Karrierepläne einmalig entschlüsseln und als org/careerPlans in Firestore ablegen, damit sie in der App ohne
// Passwort für alle Eingeloggten sichtbar sind (die Firestore-Regeln lassen org/* nur Admins schreiben).
//
//   node scripts/publish-career-plans.mjs [--dry]
//
// Das bisherige Passwort wird abgefragt (nicht gespeichert, nicht ins Terminal-Log geschrieben).
// Auth: gcloud application-default login (GOOGLE_APPLICATION_CREDENTIALS wie bei create-admin.mjs).
import { readFileSync } from "node:fs"
import { webcrypto } from "node:crypto"
import { createInterface } from "node:readline"
import { initializeApp, applicationDefault } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

const dry = process.argv.includes("--dry")

// CAREER_PLANS_LOCKED steht in career.ts als JSON-artiges Objektliteral (Zeile "= {" bis "};").
const src = readFileSync(new URL("../src/lib/data/career.ts", import.meta.url), "utf8")
const start = src.indexOf("{", src.indexOf("CAREER_PLANS_LOCKED:") + src.slice(src.indexOf("CAREER_PLANS_LOCKED:")).indexOf("="))
const end = src.indexOf("\n};", start)
const locked = JSON.parse(src.slice(start, end + 2).replace(/\r/g, ""))

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a) }))
}

const password = await ask("Passwort der Karrierepläne: ")
const subtle = webcrypto.subtle
const b64 = (s) => Uint8Array.from(Buffer.from(s, "base64"))
const keyMaterial = await subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"])
const key = await subtle.deriveKey(
  { name: "PBKDF2", salt: b64(locked.salt), iterations: locked.iterations, hash: "SHA-256" },
  keyMaterial, { name: "AES-GCM", length: 256 }, false, ["decrypt"],
)
const plans = []
for (const p of locked.plans) {
  const buf = await subtle.decrypt({ name: "AES-GCM", iv: b64(p.iv) }, key, b64(p.data))
  plans.push({ id: p.id, title: p.title, html: new TextDecoder().decode(buf) })
}
console.log(`Entschlüsselt: ${plans.map((p) => p.title).join(", ")}`)

if (dry) {
  console.log("Trockenlauf — nichts geschrieben.")
} else {
  initializeApp({ credential: applicationDefault(), projectId: "finova-team-dashboard" })
  await getFirestore().doc("org/careerPlans").set({ plans, updatedAt: new Date().toISOString() })
  console.log("org/careerPlans geschrieben.")
}
