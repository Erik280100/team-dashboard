// Auth-Hook — Äquivalent zu initAuth()/applyPermissions() aus
// legacy/index.html:2197–2246. isEditor === true nur für eingeloggte Nutzer
// (die drei angelegten Editor-Konten); ohne Firebase-Config bleibt die App
// dauerhaft im Read-only-Modus (wie im Original).
//
// Besucher ohne echten Login werden im Hintergrund automatisch anonym
// angemeldet (Firestore-Regel verlangt nur request.auth != null zum
// Schreiben, siehe firestore.rules in der Firebase-Console). Das gibt jedem
// ein gültiges Auth-Token, ohne dass ein sichtbarer Login nötig ist — genutzt
// vom EH-Rechner ("Auf Mitarbeiter buchen", siehe App.tsx canBookUnits).
// isEditor bleibt bewusst an einen echten (nicht-anonymen) Account gebunden,
// damit Team-Seite/Struktur/Monatsabschluss weiterhin gesperrt sind.
import { useEffect, useState } from "react"
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth"
import { auth } from "@/lib/firebase"

export interface UseAuthResult {
  user: User | null
  /** Echter Login (E-Mail/Passwort) — nicht der automatische anonyme Login. */
  isEditor: boolean
  /** Bekannt erst nachdem der erste Auth-State empfangen wurde (verhindert Flackern). */
  ready: boolean
  signIn: (email: string, password: string) => Promise<{ ok: true } | { ok: false; message: string }>
  signOut: () => Promise<void>
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(!auth)

  useEffect(() => {
    if (!auth) return
    const authInstance = auth
    const unsub = onAuthStateChanged(authInstance, (u) => {
      setUser(u)
      setReady(true)
      if (!u) {
        signInAnonymously(authInstance).catch((err) => {
          console.error("Anonyme Anmeldung fehlgeschlagen", err)
        })
      }
    })
    return unsub
  }, [])

  async function signIn(email: string, password: string) {
    if (!auth) return { ok: false as const, message: "Cloud-Anmeldung nicht konfiguriert." }
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
      return { ok: true as const }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false as const, message: "Anmeldung fehlgeschlagen: " + message }
    }
  }

  async function signOut() {
    if (!auth) return
    await firebaseSignOut(auth)
  }

  return { user, isEditor: !!user && !user.isAnonymous, ready, signIn, signOut }
}
