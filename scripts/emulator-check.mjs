// Sicherheits- und Lasttest gegen die lokalen Emulatoren (Testdaten: scripts/seed-test-data.mjs).
// Meldet sich wie der Browser mit E-Mail/Passwort an (Firebase-Client-SDK, also mit den echten Regeln).
//
//   node scripts/emulator-check.mjs security
//   node scripts/emulator-check.mjs load [--users=40] [--seconds=30]
//
// Ports: --firestore=8180 --auth=9199 --functions=5101 (Standard wie in den Beispielen oben).
import { initializeApp, deleteApp } from "firebase/app"
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from "firebase/auth"
import {
  getFirestore, connectFirestoreEmulator, doc, collection, getDoc, getDocs, setDoc, updateDoc, onSnapshot, query, where,
  terminate,
} from "firebase/firestore"
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions"

const args = Object.fromEntries(process.argv.slice(3).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? "true"] }))
const mode = process.argv[2]
const P = { firestore: Number(args.firestore ?? 8180), auth: Number(args.auth ?? 9199), functions: Number(args.functions ?? 5101) }
const PASSWORD = args.password ?? "Test1234!"
let counter = 0

async function login(id) {
  const app = initializeApp({ apiKey: "demo", projectId: "finova-team-dashboard", authDomain: "localhost" }, `u${id}-${counter++}`)
  const auth = getAuth(app)
  connectAuthEmulator(auth, `http://127.0.0.1:${P.auth}`, { disableWarnings: true })
  const db = getFirestore(app)
  connectFirestoreEmulator(db, "127.0.0.1", P.firestore)
  const fns = getFunctions(app, "europe-west1")
  connectFunctionsEmulator(fns, "127.0.0.1", P.functions)
  await signInWithEmailAndPassword(auth, `${id}@example.test`, PASSWORD)
  return { app, db, fns, id, close: async () => { await terminate(db); await deleteApp(app) } }
}

// ------------------------------------------------------------------ Sicherheit
async function security() {
  let failures = 0
  const expectDenied = async (label, fn) => {
    try { await fn(); failures++; console.log(`  FEHLER  (erlaubt, sollte verboten sein): ${label}`) }
    catch (e) { console.log(`  ok      verboten: ${label}  [${e.code ?? e.message}]`) }
  }
  const expectAllowed = async (label, fn) => {
    try { await fn(); console.log(`  ok      erlaubt:  ${label}`) }
    catch (e) { failures++; console.log(`  FEHLER  (verboten, sollte erlaubt sein): ${label}  [${e.code ?? e.message}]`) }
  }

  // ---- Mitarbeiter m1_1 (Team von Lead 1) ----
  const m = await login("m1_1")
  console.log("\nMitarbeiter m1_1:")
  await expectAllowed("eigenes Mitarbeiter-Dokument", () => getDoc(doc(m.db, "employees", "m1_1")))
  await expectAllowed("fremdes Mitarbeiter-Dokument (Zahlen sind öffentlich)", () => getDoc(doc(m.db, "employees", "m2_3")))
  await expectAllowed("alle Mitarbeiter-Dokumente auflisten", () => getDocs(collection(m.db, "employees")))
  await expectAllowed("org/structure und org/teamGoal", async () => { await getDoc(doc(m.db, "org", "structure")); await getDoc(doc(m.db, "org", "teamGoal")) })
  await expectAllowed("eigene Wochenplanung", () => getDoc(doc(m.db, "employees", "m1_1", "planWeeks", "2026-W43")))
  await expectAllowed("eigenes Todo", () => getDoc(doc(m.db, "employees", "m1_1", "todos", "t1")))
  await expectAllowed("eigene Konto-Daten", () => getDoc(doc(m.db, "employees", "m1_1", "private", "account")))
  await expectDenied("Wochenplanung Kollege m1_2", () => getDoc(doc(m.db, "employees", "m1_2", "planWeeks", "2026-W43")))
  await expectDenied("Wochenplanung Vorgesetzte l1", () => getDoc(doc(m.db, "employees", "l1", "planWeeks", "2026-W43")))
  await expectDenied("Wochenplanung fremdes Team m2_3", () => getDoc(doc(m.db, "employees", "m2_3", "planWeeks", "2026-W43")))
  await expectDenied("Wochen-Liste Kollege (Bereichsabfrage)", () => getDocs(collection(m.db, "employees", "m1_2", "planWeeks")))
  await expectDenied("Monatsnotizen Kollege", () => getDoc(doc(m.db, "employees", "m1_2", "planMonthNotes", "2026-10")))
  await expectDenied("Anwesenheit Kollege", () => getDoc(doc(m.db, "employees", "m1_2", "attendance", "current")))
  await expectDenied("Todos Kollege", () => getDoc(doc(m.db, "employees", "m1_2", "todos", "t1")))
  await expectDenied("Todos Vorgesetzte l1", () => getDoc(doc(m.db, "employees", "l1", "todos", "t1")))
  await expectDenied("Konto-Daten (E-Mail) Kollege", () => getDoc(doc(m.db, "employees", "m1_2", "private", "account")))
  await expectDenied("Konto-Daten Vorgesetzte", () => getDoc(doc(m.db, "employees", "l1", "private", "account")))
  await expectDenied("alle Finanzierungen ohne Filter", () => getDocs(collection(m.db, "financings")))
  await expectAllowed("eigene Finanzierungen (Filter ownerId)", () => getDocs(query(collection(m.db, "financings"), where("ownerId", "==", "m1_1"))))
  await expectDenied("Finanzierungen eines Kollegen per Filter", () => getDocs(query(collection(m.db, "financings"), where("ownerId", "==", "m1_2"))))
  await expectDenied("Fremdes Mitarbeiter-Dokument schreiben", () => updateDoc(doc(m.db, "employees", "m1_2"), { atIst: 99 }))
  await expectDenied("eigenen Bonus ändern", () => updateDoc(doc(m.db, "employees", "m1_1"), { bonus: 99999 }))
  await expectDenied("eigene Rolle/Struktur ändern", () => updateDoc(doc(m.db, "employees", "m1_1"), { ancestors: [] }))
  await expectDenied("eigene Konto-Daten schreiben", () => setDoc(doc(m.db, "employees", "m1_1", "private", "account"), { accountPending: false }))
  await expectDenied("Planung Kollege schreiben", () => setDoc(doc(m.db, "employees", "m1_2", "planWeeks", "2026-W44"), { x: 1 }))
  await expectDenied("org/structure schreiben", () => updateDoc(doc(m.db, "org", "structure"), { notes: {} }))
  await expectDenied("Snapshot anlegen", () => setDoc(doc(m.db, "snapshots", "2020-01"), { x: 1 }))
  await expectDenied("Konto für Kollegen erstellen (createAccount)", () => httpsCallable(m.fns, "createAccount")({ employeeId: "m1_2", email: "x@example.test" }))
  await expectDenied("Fremde Person übernehmen (updateSubtree)", () => httpsCallable(m.fns, "updateSubtree")({
    children: [{ id: "m2_3", name: "Übernommen", role: "FT 1", children: [] }], notes: {}, conns: [],
  }))
  await expectDenied("Pfad-Einschleusung per ID (updateSubtree)", () => httpsCallable(m.fns, "updateSubtree")({
    children: [{ id: "m2_3/planWeeks/2026-W43", name: "X", role: "FT 1", children: [] }], notes: {}, conns: [],
  }))
  await expectDenied("inviteUser (nur Admin)", () => httpsCallable(m.fns, "inviteUser")({ email: "y@example.test", employeeId: "m1_2", role: "admin" }))
  await expectDenied("setInitialPassword ohne Pflicht-Claim", () => httpsCallable(m.fns, "setInitialPassword")({ newPassword: "irgendwas123" }))
  await m.close()

  // ---- Führungskraft l1 ----
  const l = await login("l1")
  console.log("\nFührungskraft l1:")
  await expectAllowed("Wochenplanung Mitarbeiter m1_1", () => getDoc(doc(l.db, "employees", "m1_1", "planWeeks", "2026-W43")))
  await expectAllowed("Konto-Daten Mitarbeiter m1_1", () => getDoc(doc(l.db, "employees", "m1_1", "private", "account")))
  await expectAllowed("Finanzierungen der Unterstruktur (array-contains)", () => getDocs(query(collection(l.db, "financings"), where("ancestors", "array-contains", "l1"))))
  await expectAllowed("Bonus eines Mitarbeiters setzen", () => updateDoc(doc(l.db, "employees", "m1_1"), { bonus: 123 }))
  await expectDenied("eigenen Bonus setzen", () => updateDoc(doc(l.db, "employees", "l1"), { bonus: 99999 }))
  await expectDenied("Wochenplanung fremdes Team m2_3", () => getDoc(doc(l.db, "employees", "m2_3", "planWeeks", "2026-W43")))
  await expectDenied("Wochenplanung Kollegin Lead 2", () => getDoc(doc(l.db, "employees", "l2", "planWeeks", "2026-W43")))
  await expectDenied("Wochenplanung Vorgesetzter boss", () => getDoc(doc(l.db, "employees", "boss", "planWeeks", "2026-W43")))
  await expectDenied("Todos Mitarbeiter m1_1 (nur der Besitzer)", () => getDoc(doc(l.db, "employees", "m1_1", "todos", "t1")))
  await expectDenied("Konto-Daten fremdes Team", () => getDoc(doc(l.db, "employees", "m2_3", "private", "account")))
  await expectDenied("Konto für fremdes Team erstellen", () => httpsCallable(l.fns, "createAccount")({ employeeId: "m2_3", email: "z@example.test" }))
  await expectDenied("alle Finanzierungen ohne Filter", () => getDocs(collection(l.db, "financings")))
  await l.close()

  // ---- Admin ----
  const a = await login("boss")
  console.log("\nAdmin boss:")
  await expectAllowed("alles lesen (Todos ausgenommen): Planung fremdes Team", () => getDoc(doc(a.db, "employees", "m2_3", "planWeeks", "2026-W43")))
  await expectAllowed("alle Finanzierungen", () => getDocs(collection(a.db, "financings")))
  await expectDenied("Todos anderer (auch Admin nicht)", () => getDoc(doc(a.db, "employees", "m1_1", "todos", "t1")))
  await a.close()

  // ---- Kein Login ----
  const app = initializeApp({ apiKey: "demo", projectId: "finova-team-dashboard" }, "anon")
  const adb = getFirestore(app)
  connectFirestoreEmulator(adb, "127.0.0.1", P.firestore)
  console.log("\nOhne Login:")
  await expectDenied("Mitarbeiter lesen", () => getDoc(doc(adb, "employees", "m1_1")))
  await expectDenied("org/structure lesen", () => getDoc(doc(adb, "org", "structure")))
  await terminate(adb); await deleteApp(app)

  console.log(failures === 0 ? "\nALLE SICHERHEITSPRÜFUNGEN BESTANDEN" : `\n${failures} FEHLER`)
  process.exit(failures === 0 ? 0 : 1)
}

// ------------------------------------------------------------------ Kontofluss
async function flow() {
  let failures = 0
  const check = (label, cond, extra = "") => { if (!cond) failures++; console.log(`  ${cond ? "ok    " : "FEHLER"}  ${label}${extra ? `  [${extra}]` : ""}`) }
  const code = async (fn) => { try { await fn(); return "erlaubt" } catch (e) { return e.code ?? e.message } }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const waitFor = async (fn, ms = 15000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await sleep(500) } return false }
  const NEW = `neu_${Date.now() % 100000}`

  const lead = await login("l1")
  const structure = (await getDoc(doc(lead.db, "org", "structure"))).data()
  const children = structure.tree.children.find((c) => c.id === "l1").children
  console.log("Führungskraft legt Person an und erstellt Konto:")
  const add = [...children, { id: NEW, name: "Neue Person", role: "FT 1", children: [] }]
  check("updateSubtree: neue Person unter l1", (await code(() => httpsCallable(lead.fns, "updateSubtree")({ children: add, notes: {}, conns: [] }))) === "erlaubt")
  check("onStructureChange legt employees/" + NEW + " an", await waitFor(async () => (await getDoc(doc(lead.db, "employees", NEW))).exists()))
  const created = await httpsCallable(lead.fns, "createAccount")({ employeeId: NEW, email: `${NEW}@example.test` })
  const temp = created.data.tempPassword
  check("Einmal-Passwort ist zufällig (12 Zeichen, nicht start1234)", typeof temp === "string" && temp.length === 12 && temp !== "start1234", temp)
  check("zweites createAccount für dieselbe Person wird abgelehnt", (await code(() => httpsCallable(lead.fns, "createAccount")({ employeeId: NEW, email: `x${NEW}@example.test` }))) === "functions/already-exists")
  const acct = (await getDoc(doc(lead.db, "employees", NEW, "private", "account"))).data()
  check("Vorgesetzte sieht Kontostatus 'wartet' in private/account", acct?.accountPending === true && acct?.email === `${NEW}@example.test`)
  const pub = (await getDoc(doc(lead.db, "employees", NEW))).data()
  check("öffentliches Dokument enthält weder E-Mail noch uid noch Kontostatus", !("email" in pub) && !("uid" in pub) && !("accountPending" in pub), Object.keys(pub).join(","))

  console.log("\nErstanmeldung:")
  const app = initializeApp({ apiKey: "demo", projectId: "finova-team-dashboard" }, `new${counter++}`)
  const auth = getAuth(app); connectAuthEmulator(auth, `http://127.0.0.1:${P.auth}`, { disableWarnings: true })
  const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", P.firestore)
  const fns = getFunctions(app, "europe-west1"); connectFunctionsEmulator(fns, "127.0.0.1", P.functions)
  await signInWithEmailAndPassword(auth, `${NEW}@example.test`, temp)
  await auth.currentUser.getIdToken(true)
  check("vor der Passwortänderung ist jeder Datenzugriff gesperrt", (await code(() => getDoc(doc(db, "employees", NEW)))) === "permission-denied")
  check("updateSubtree vor der Passwortänderung gesperrt", (await code(() => httpsCallable(fns, "updateSubtree")({ children: [], notes: {}, conns: [] }))) === "functions/permission-denied")
  check("zu kurzes Passwort wird abgelehnt", (await code(() => httpsCallable(fns, "setInitialPassword")({ newPassword: "kurz" }))) === "functions/invalid-argument")
  check("Sperre bleibt nach abgelehntem Versuch bestehen", (await code(() => getDoc(doc(db, "employees", NEW)))) === "permission-denied")
  check("setInitialPassword mit gutem Passwort", (await code(() => httpsCallable(fns, "setInitialPassword")({ newPassword: "MeinNeuesPasswort1" }))) === "erlaubt")
  { const r = await code(() => signInWithEmailAndPassword(auth, `${NEW}@example.test`, temp)); check("altes Einmal-Passwort funktioniert nicht mehr", r !== "erlaubt" && /credential|password/.test(r), r) }
  await signInWithEmailAndPassword(auth, `${NEW}@example.test`, "MeinNeuesPasswort1")
  await auth.currentUser.getIdToken(true)
  check("nach der Änderung: eigene Daten lesbar", (await code(() => getDoc(doc(db, "employees", NEW)))) === "erlaubt")
  check("nach der Änderung: setInitialPassword nicht mehr nutzbar", (await code(() => httpsCallable(fns, "setInitialPassword")({ newPassword: "NochEinPasswort12" }))) === "functions/failed-precondition")
  check("Kollege sieht das Konto nicht", (await code(async () => { const k = await login("m1_2"); try { await getDoc(doc(k.db, "employees", NEW, "private", "account")) } finally { await k.close() } })) === "permission-denied")

  console.log("\nID-Wiederverwendung (Angriff) und Entfernen:")
  const member = await login("m1_1")
  check("Mitarbeiter kann die ID der neuen Person nicht für sich beanspruchen", (await code(() => httpsCallable(member.fns, "updateSubtree")({
    children: [{ id: NEW, name: "Angreifer", role: "FT 1", children: [] }], notes: {}, conns: [] }))) === "functions/failed-precondition")
  check("Führungskraft entfernt die Person", (await code(() => httpsCallable(lead.fns, "updateSubtree")({ children, notes: {}, conns: [] }))) === "erlaubt")
  check("Mitarbeiter-Dokument wird inaktiv", await waitFor(async () => (await getDoc(doc(lead.db, "employees", NEW))).get("active") === false))
  check("Login der entfernten Person wird gesperrt", await waitFor(async () => (await code(() => signInWithEmailAndPassword(auth, `${NEW}@example.test`, "MeinNeuesPasswort1"))).includes("user-disabled")))
  check("entfernte ID bleibt für Mitarbeiter gesperrt (kein Übernehmen)", (await code(() => httpsCallable(member.fns, "updateSubtree")({
    children: [{ id: NEW, name: "Angreifer", role: "FT 1", children: [] }], notes: {}, conns: [] }))) === "functions/failed-precondition")
  await member.close(); await lead.close(); await terminate(db); await deleteApp(app)
  console.log(failures === 0 ? "\nKONTOFLUSS OK" : `\n${failures} FEHLER`)
  process.exit(failures === 0 ? 0 : 1)
}

// ------------------------------------------------------------------ Last
async function load() {
  const users = Number(args.users ?? 40)
  const seconds = Number(args.seconds ?? 30)
  const ids = ["boss", ...Array.from({ length: 4 }, (_, i) => `l${i + 1}`), ...Array.from({ length: 36 }, (_, i) => `m${Math.floor(i / 9) + 1}_${(i % 9) + 1}`)].slice(0, users)
  const week = args.week ?? "2026-W43"
  const month = args.month ?? "2026-10"
  console.log(`Melde ${ids.length} Nutzer an ...`)
  const t0 = Date.now()
  const sessions = []
  for (let i = 0; i < ids.length; i += 10) sessions.push(...await Promise.all(ids.slice(i, i + 10).map(login)))
  console.log(`Anmeldung: ${Date.now() - t0} ms`)

  const stats = { docsDelivered: 0, listeners: 0, errors: 0, writes: 0, writeMs: [], fanoutMs: [] }
  const startupMs = []
  const lastSeen = new Map() // sessionId -> Zeitpunkt des letzten employees-Updates

  // Wie der Browser beim Start: alle Listener der App (Dashboard, Struktur, Planung, Anwesenheit, Todos, Finanzierungen).
  async function startup(s) {
    const begin = Date.now()
    const pending = []
    const listen = (ref, onDoc) => {
      stats.listeners++
      pending.push(new Promise((resolve) => {
        let first = true
        onSnapshot(ref, (snap) => {
          stats.docsDelivered += snap.docChanges ? snap.docChanges().length : 1
          onDoc?.(snap)
          if (first) { first = false; resolve() }
        }, (err) => { stats.errors++; if (first) { first = false; resolve() } if (args.verbose) console.log(s.id, "Listener-Fehler", err.code) })
      }))
    }
    listen(collection(s.db, "employees"), () => lastSeen.set(s.id, Date.now()))
    for (const name of ["structure", "teamGoal", "archiveIndex", "financingStats"]) listen(doc(s.db, "org", name))
    listen(collection(s.db, "employees", s.id, "todos"))
    const admin = s.id === "boss"
    if (admin) listen(collection(s.db, "financings"))
    else {
      listen(query(collection(s.db, "financings"), where("ownerId", "==", s.id)))
      listen(query(collection(s.db, "financings"), where("ancestors", "array-contains", s.id)))
      listen(query(collection(s.db, "financings"), where("abwicklerId", "==", s.id)))
    }
    // sichtbare Mitarbeiter: Admin alle, Führungskraft ihr Team + sich, Mitarbeiter nur sich
    const visible = admin ? ids : s.id.startsWith("l") ? ids.filter((x) => x === s.id || x.startsWith(`m${s.id.slice(1)}_`)) : [s.id]
    for (const v of visible) {
      listen(doc(s.db, "employees", v, "attendance", "current"))
      listen(doc(s.db, "employees", v, "planWeeks", week))
      listen(doc(s.db, "employees", v, "planMonthNotes", month))
    }
    await Promise.all(pending)
    startupMs.push(Date.now() - begin)
    return visible.length
  }
  const t1 = Date.now()
  const visibleCounts = await Promise.all(sessions.map(startup))
  console.log(`Start aller Sitzungen (parallel): ${Date.now() - t1} ms, je Sitzung im Mittel ${(startupMs.reduce((a, b) => a + b, 0) / startupMs.length).toFixed(0)} ms (max ${Math.max(...startupMs)} ms)`)
  console.log(`Listener gesamt: ${stats.listeners}, ausgelieferte Dokumente beim Start: ${stats.docsDelivered}, Fehler: ${stats.errors}`)
  console.log(`Sichtbare Mitarbeiter je Sitzung: Admin ${visibleCounts[0]}, Mittel ${(visibleCounts.reduce((a, b) => a + b, 0) / visibleCounts.length).toFixed(1)}`)

  // Betrieb: Jeder ändert regelmäßig eigene Planwerte (wie Feld-Blur), alle Dashboards hören mit.
  const docsBefore = stats.docsDelivered
  const end = Date.now() + seconds * 1000
  await Promise.all(sessions.map(async (s) => {
    while (Date.now() < end) {
      await new Promise((r) => setTimeout(r, 2000 + Math.random() * 3000))
      const t = Date.now()
      try {
        await updateDoc(doc(s.db, "employees", s.id, "planWeeks", week), { atg: Math.floor(Math.random() * 10), analysen: Math.floor(Math.random() * 5) })
        stats.writes++; stats.writeMs.push(Date.now() - t)
      } catch (e) { stats.errors++ }
    }
  }))
  await new Promise((r) => setTimeout(r, 3000)) // Trigger (monthStats) auslaufen lassen
  const pct = (a, p) => a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : 0
  console.log(`\nBetrieb ${seconds}s: ${stats.writes} Schreibvorgänge (Median ${pct(stats.writeMs, 0.5)} ms, p95 ${pct(stats.writeMs, 0.95)} ms), Fehler: ${stats.errors}`)
  console.log(`Zusätzlich ausgelieferte Dokumente: ${stats.docsDelivered - docsBefore} (${((stats.docsDelivered - docsBefore) / ids.length).toFixed(1)} je Sitzung, ${((stats.docsDelivered - docsBefore) / Math.max(1, stats.writes)).toFixed(1)} je Schreibvorgang)`)
  for (const s of sessions) await s.close()
  process.exit(stats.errors === 0 ? 0 : 1)
}

if (mode === "security") await security()
else if (mode === "load") await load()
else if (mode === "flow") await flow()
else { console.error("Aufruf: node scripts/emulator-check.mjs security|flow|load"); process.exit(1) }
