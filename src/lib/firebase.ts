// Firebase-Setup: App, Firestore, Auth und Cloud Functions (Region europe-west1, siehe functions/src/index.ts).
// Datenmodell: employees/*, org/*, financings, sales, snapshots (siehe firestore.rules).
import { initializeApp, type FirebaseApp } from "firebase/app"
import { getFirestore, connectFirestoreEmulator, doc, collection, type Firestore, type DocumentReference, type CollectionReference } from "firebase/firestore"
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth"
import { getStorage, connectStorageEmulator, type FirebaseStorage } from "firebase/storage"
import { getFunctions, connectFunctionsEmulator, type Functions } from "firebase/functions"

const firebaseConfig = {
  apiKey: "AIzaSyA2ZEQF5YJdHMpk2qR-L7R4tiIf1-ln71w",
  authDomain: "finova-team-dashboard.firebaseapp.com",
  projectId: "finova-team-dashboard",
  storageBucket: "finova-team-dashboard.firebasestorage.app",
  messagingSenderId: "733778579700",
  appId: "1:733778579700:web:263ea31b9e5c5980e5cea1",
}

/** Emulator-Ports (npm run emulators); abweichende Ports über VITE_EMULATOR_PORT_FIRESTORE / _AUTH / _FUNCTIONS. */
const emulatorPort = (name: string, fallback: number) => Number(import.meta.env[`VITE_EMULATOR_PORT_${name}`]) || fallback

export let app: FirebaseApp | null = null
export let firestore: Firestore | null = null
export let auth: Auth | null = null
/** Cloud Functions (Region muss zu functions/src/index.ts passen). */
export let functions: Functions | null = null
/** Cloud Storage (Profilbilder, siehe storage.rules). */
export let storage: FirebaseStorage | null = null

try {
  app = initializeApp(firebaseConfig)
  firestore = getFirestore(app)
  auth = getAuth(app)
  functions = getFunctions(app, "europe-west1")
  storage = getStorage(app)
  // Lokale Entwicklung gegen die Firebase-Emulatoren (npm run emulators): VITE_USE_EMULATORS=true.
  if (import.meta.env.VITE_USE_EMULATORS === "true") {
    connectFirestoreEmulator(firestore, "127.0.0.1", emulatorPort("FIRESTORE", 8080))
    connectAuthEmulator(auth, `http://127.0.0.1:${emulatorPort("AUTH", 9099)}`, { disableWarnings: true })
    connectFunctionsEmulator(functions, "127.0.0.1", emulatorPort("FUNCTIONS", 5001))
    connectStorageEmulator(storage, "127.0.0.1", emulatorPort("STORAGE", 9299))
  }
} catch (err) {
  console.error("Firebase-Initialisierung fehlgeschlagen", err)
}

// ---- Datenmodell (siehe firestore.rules) ----

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
