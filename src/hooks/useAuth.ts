// Auth-Hook — Äquivalent zu initAuth()/applyPermissions() aus
// legacy/index.html:2197–2246. isEditor === true nur für eingeloggte Nutzer
// (die drei angelegten Editor-Konten); ohne Firebase-Config bleibt die App
// dauerhaft im Read-only-Modus (wie im Original).
import { useEffect, useState } from "react"
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth"
import { auth } from "@/lib/firebase"

export interface UseAuthResult {
  user: User | null
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
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setReady(true)
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

  return { user, isEditor: !!user, ready, signIn, signOut }
}
