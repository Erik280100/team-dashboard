// Firebase-Setup — 1:1 identisch zur Legacy-App (legacy/index.html:2163–2196),
// damit beide Frontends während der Migration dieselben Firestore-Dokumente
// lesen/schreiben. Nicht verändern, ohne die Legacy-Seite entsprechend anzupassen.
import { initializeApp, type FirebaseApp } from "firebase/app"
import { getFirestore, doc, type Firestore, type DocumentReference } from "firebase/firestore"
import { getAuth, type Auth } from "firebase/auth"

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

// Gleiche Dokumentpfade wie in der Legacy-App: finova/dashboard, finova/attendance,
// finova/orgchart.
export let stateDocRef: DocumentReference | null = null
export let attendanceDocRef: DocumentReference | null = null
export let orgChartDocRef: DocumentReference | null = null

if (CLOUD_CONFIGURED) {
  try {
    app = initializeApp(firebaseConfig)
    firestore = getFirestore(app)
    stateDocRef = doc(firestore, "finova", "dashboard")
    attendanceDocRef = doc(firestore, "finova", "attendance")
    orgChartDocRef = doc(firestore, "finova", "orgchart")
    auth = getAuth(app)
  } catch (err) {
    console.error("Firebase-Initialisierung fehlgeschlagen", err)
  }
}
