// Künstliche Testdaten NUR für die lokalen Emulatoren (Browser-/Lasttests der Rollen und Regeln).
// Legt eine Struktur mit 1 Admin (boss), 4 Führungskräften und 9 Mitarbeitern je Führungskraft an (41 Personen),
// je Person ein Konto (E-Mail <id>@example.test, gleiches Passwort), Planung, Anwesenheit, Todos und Finanzierungsfälle.
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8180 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9199 node scripts/seed-test-data.mjs [--password=Test1234!]
//
// Bricht ab, wenn die Emulator-Variablen fehlen (schreibt nie in die Produktion).
import { initializeApp } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore } from "firebase-admin/firestore"

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("FIRESTORE_EMULATOR_HOST und FIREBASE_AUTH_EMULATOR_HOST müssen gesetzt sein (nur Emulator).")
  process.exit(1)
}
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? "true"] }))
const PASSWORD = args.password ?? "Test1234!"
initializeApp({ projectId: "finova-team-dashboard" })
const db = getFirestore()
const auth = getAuth()

function isoWeekKey(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const year = t.getUTCFullYear()
  const week = Math.ceil(((t - new Date(Date.UTC(year, 0, 1))) / 86400000 + 1) / 7)
  return `${year}-W${String(week).padStart(2, "0")}`
}
const today = new Date()
const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
const weeks = [0, 1, 2, 3].map((i) => isoWeekKey(new Date(today.getTime() - i * 7 * 86400000)))

// ---- Struktur ----
const people = []
const tree = { id: "boss", name: "Boss Test", role: "Direktor", children: [] }
people.push({ id: "boss", name: "Boss Test", role: "Direktor", managerId: null, ancestors: [], account: "admin" })
for (let l = 1; l <= 4; l++) {
  const lead = { id: `l${l}`, name: `Lead ${l}`, role: "Teamleiter", children: [] }
  tree.children.push(lead)
  people.push({ id: lead.id, name: lead.name, role: lead.role, managerId: "boss", ancestors: ["boss"], account: "lead" })
  for (let m = 1; m <= 9; m++) {
    const id = `m${l}_${m}`
    lead.children.push({ id, name: `Mitarbeiter ${l}.${m}`, role: "FT 1", children: [] })
    people.push({ id, name: `Mitarbeiter ${l}.${m}`, role: "FT 1", managerId: lead.id, ancestors: [lead.id, "boss"], account: "member" })
  }
}

const rnd = (n) => Math.floor(Math.random() * n)
const writer = db.bulkWriter()
const set = (path, data) => writer.set(db.doc(path), data)

set("org/structure", { tree, notes: {}, conns: [], rates: {}, planRates: {} })
set("org/teamGoal", {
  teamGoal: { note: "", recruitGoal: 5, recruitActual: null, periodStart: `${month}-01`, periodEnd: `${month}-${lastDay}` },
  history: [],
})
set("org/archiveIndex", { months: [] })

for (const p of people) {
  set(`employees/${p.id}`, {
    name: p.name, role: p.role, managerId: p.managerId, ancestors: p.ancestors, active: true,
    isNew: false, joinDate: "2024-01-01", soll: 20, ist: rnd(20), bonus: rnd(300),
    ehByPlan: { insurance: rnd(10), investment: rnd(5), credit: rnd(5) },
    atPlan: 10, atIst: rnd(10), btPlan: 8, btIst: rnd(8), stPlan: 4, stIst: rnd(4), etPlan: 3, etIst: rnd(3),
  })
  set(`employees/${p.id}/attendance/current`, { entries: {} })
  set(`employees/${p.id}/todos/t1`, { title: `Privates Todo von ${p.name}`, done: false })
  for (const w of weeks) {
    set(`employees/${p.id}/planWeeks/${w}`, {
      week: w, atz: 5, atg: rnd(5), analysenZ: 3, analysen: rnd(3), beratungenZ: 2, beratungen: rnd(2),
      vertraege: rnd(3), pg: rnd(3), stz: 2, stg: rnd(2), etz: 1, etg: rnd(2), ehOffen: 4, ehGemacht: rnd(4),
      aktivitaetenSoll: 10, aktivitaetenIst: rnd(10), notes: `Geheime Notiz von ${p.name}`, submitted: false,
    })
  }
  set(`employees/${p.id}/planMonthNotes/${month}`, { month, ehZiel: 20, notes: "" })
}
for (let i = 0; i < 12; i++) {
  const owner = people[1 + rnd(people.length - 1)]
  set(`financings/f${i}`, {
    ownerId: owner.id, ancestors: owner.ancestors, kunde: `Kunde ${i}`, betrag: 100000 + i * 5000,
    art: i % 3 === 0 ? "anlegerwohnung" : "hauskauf", archived: false,
  })
}
await writer.close()

for (const p of people) {
  const email = `${p.id}@example.test`
  const user = await auth.createUser({ email, password: PASSWORD })
  await auth.setCustomUserClaims(user.uid, { role: p.account, employeeId: p.id })
  await db.doc(`users/${user.uid}`).set({ role: p.account, employeeId: p.id, email })
  await db.doc(`employees/${p.id}/private/account`).set({ uid: user.uid, email, accountPending: false })
}
console.log(`Fertig: ${people.length} Personen, Konten <id>@example.test, Passwort ${PASSWORD}, Woche(n) ${weeks.join(", ")}, Monat ${month}`)
