// Firebase-Setup — 1:1 identisch zur Legacy-App (legacy/index.html:2163–2196),
// damit beide Frontends während der Migration dieselben Firestore-Dokumente
// lesen/schreiben. Nicht verändern, ohne die Legacy-Seite entsprechend anzupassen.
import { initializeApp, type FirebaseApp } from "firebase/app"
import { getFirestore, connectFirestoreEmulator, doc, collection, type Firestore, type DocumentReference, type CollectionReference } from "firebase/firestore"
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth"
import { getFunctions, connectFunctionsEmulator, type Functions } from "firebase/functions"

const firebaseConfig = {
  apiKey: "AIzaSyA2ZEQF5YJdHMpk2qR-L7R4tiIf1-ln71w",
  authDomain: "finova-team-dashboard.firebaseapp.com",
  projectId: "finova-team-dashboard",
  storageBucket: "finova-team-dashboard.firebasestorage.app",
  messagingSenderId: "733778579700",
  appId: "1:733778579700:web:263ea31b9e5c5980e5cea1",
}

export const CLOUD_CONFIGURED = firebaseConfig.apiKey !== "YOUR_API_KEY"

export let app: FirebaseApp | null = null
export let firestore: Firestore | null = null
export let auth: Auth | null = null
/** Cloud Functions (Region muss zu functions/src/index.ts passen). */
export let functions: Functions | null = null

// Gleiche Dokumentpfade wie in der Legacy-App: finova/dashboard, finova/attendance,
// finova/orgchart.
export let stateDocRef: DocumentReference | null = null
export let attendanceDocRef: DocumentReference | null = null
export let orgChartDocRef: DocumentReference | null = null

// Monats-Archiv (siehe src/hooks/useMonthArchive.ts) — neue Dokumente in derselben
// finova-Collection, von der Legacy-App unbenutzt (sie greift nur die drei Pfade
// oben direkt an und listet die Collection nie), daher hier ohne Rückwirkung.
export let archiveIndexDocRef: DocumentReference | null = null

// Finanzierungen/Kreditfälle (siehe src/hooks/useFinanzierungenDoc.ts) — ebenfalls
// ein neues Dokument in derselben Collection, das die Legacy-Seite nicht kennt.
export let financingsDocRef: DocumentReference | null = null

// Erik-Dashboard / persönliches Kanban-Board (siehe src/hooks/useErikTodosDoc.ts) —
// ebenfalls ein neues Dokument in derselben Collection, das die Legacy-Seite nicht kennt.
export let erikTodosDocRef: DocumentReference | null = null

// Planung (siehe src/hooks/usePlanungDoc.ts) — ebenfalls neue Dokumente in
// derselben Collection, von der Legacy-Seite unbenutzt. Ein Dokument je
// ISO-Woche (planWeekDocRef) statt eines Sammeldokuments, damit es bei ~25
// Personen × 52 Wochen nicht Richtung Firestore-Dokumentlimit (1 MiB) läuft —
// analog zu snapshotDocRef unten.

if (CLOUD_CONFIGURED) {
  try {
    app = initializeApp(firebaseConfig)
    firestore = getFirestore(app)
    stateDocRef = doc(firestore, "finova", "dashboard")
    attendanceDocRef = doc(firestore, "finova", "attendance")
    orgChartDocRef = doc(firestore, "finova", "orgchart")
    archiveIndexDocRef = doc(firestore, "finova", "archive_index")
    financingsDocRef = doc(firestore, "finova", "financings")
    erikTodosDocRef = doc(firestore, "finova", "erik_todos")
    auth = getAuth(app)
    functions = getFunctions(app, "europe-west1")
    // Lokale Entwicklung gegen die Firebase-Emulatoren (npm run emulators): VITE_USE_EMULATORS=true.
    if (import.meta.env.VITE_USE_EMULATORS === "true") {
      connectFirestoreEmulator(firestore, "127.0.0.1", 8080)
      connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true })
      connectFunctionsEmulator(functions, "127.0.0.1", 5001)
    }
  } catch (err) {
    console.error("Firebase-Initialisierung fehlgeschlagen", err)
  }
}

/** Dokument-Referenz für einen archivierten Monat (finova/snapshot_<YYYY-MM>). */
export function snapshotDocRef(month: string): DocumentReference | null {
  return firestore ? doc(firestore, "finova", `snapshot_${month}`) : null
}

/** Dokument-Referenz für eine Planungswoche (finova/plan_week_<YYYY-Www>). */
export function planWeekDocRef(week: string): DocumentReference | null {
  return firestore ? doc(firestore, "finova", `plan_week_${week}`) : null
}

/** Dokument-Referenz für die Jahresplanung einer Führungskraft (finova/plan_annual_<YYYY>_<managerKey>). */
export function planAnnualDocRef(year: number, managerKey: string): DocumentReference | null {
  return firestore ? doc(firestore, "finova", `plan_annual_${year}_${managerKey}`) : null
}

/** Dokument-Referenz für die Monats-Notizen (AT/BT/ST-Kacheln, finova/plan_month_notes_<YYYY-MM>). */
export function planMonthNotesDocRef(month: string): DocumentReference | null {
  return firestore ? doc(firestore, "finova", `plan_month_notes_${month}`) : null
}

// ---- Neues Datenmodell (User-Accounts, siehe firestore.rules) ----

/** employees — ein Dokument je Mitarbeiter. */
export function employeesCollection(): CollectionReference | null {
  return firestore ? collection(firestore, "employees") : null
}
/** employees/{id} */
export function employeeDocRef(id: string): DocumentReference | null {
  return firestore ? doc(firestore, "employees", id) : null
}
/** org/{name}: structure | teamGoal | archiveIndex */
export function orgDocRef(name: string): DocumentReference | null {
  return firestore ? doc(firestore, "org", name) : null
}
