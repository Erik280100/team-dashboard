// Auth-Hook — E-Mail/Passwort-Login (Firebase Auth). Es gibt keinen anonymen
// Zugang mehr: ohne Login zeigt App.tsx nur die LoginPage.
//
// Rolle und Mitarbeiter-ID kommen aus den Custom Claims des ID-Tokens
// (siehe lib/calc/roles.ts, firestore.rules). Ohne Firebase-Config bleibt die
// App im lokalen Modus (wie bisher), dann gibt es keinen Login.
import { useEffect, useState } from "react"
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth"
import { auth } from "@/lib/firebase"
import { accountFromClaims, type AccountInfo } from "@/lib/calc/roles"

type Result = { ok: true } | { ok: false; message: string }

export interface UseAuthResult extends AccountInfo {
  user: User | null
  /** Eingeloggt: darf die Daten bearbeiten, die ihm angezeigt werden (App.tsx beschneidet den Baum auf die eigene
   * Unterstruktur, firestore.rules erzwingt es). Admin-Funktionen (Struktur, Monatsabschluss, Teamziel): isAdmin. */
  isEditor: boolean
  isAdmin: boolean
  /** Bekannt erst nachdem der erste Auth-State (inkl. Claims) empfangen wurde (verhindert Flackern). */
  ready: boolean
  signIn: (email: string, password: string) => Promise<Result>
  resetPassword: (email: string) => Promise<Result>
  signOut: () => Promise<void>
}

const NO_ACCOUNT: AccountInfo = { role: "member", employeeId: null }

function loginErrorMessage(err: unknown): string {
  const code = typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : ""
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "E-Mail oder Passwort falsch."
  }
  if (code.includes("too-many-requests")) return "Zu viele Versuche — bitte kurz warten."
  if (code.includes("network")) return "Keine Verbindung zum Server."
  return "Anmeldung fehlgeschlagen."
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<User | null>(null)
  const [account, setAccount] = useState<AccountInfo>(NO_ACCOUNT)
  const [ready, setReady] = useState(!auth)

  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const token = await u.getIdTokenResult()
          setAccount(accountFromClaims(token.claims))
        } catch (err) {
          console.error("Claims konnten nicht geladen werden", err)
          setAccount(NO_ACCOUNT)
        }
      } else {
        setAccount(NO_ACCOUNT)
      }
      setUser(u)
      setReady(true)
    })
  }, [])

  async function signIn(email: string, password: string): Promise<Result> {
    if (!auth) return { ok: false, message: "Cloud-Anmeldung nicht konfiguriert." }
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
      return { ok: true }
    } catch (err) {
      return { ok: false, message: loginErrorMessage(err) }
    }
  }

  async function resetPassword(email: string): Promise<Result> {
    if (!auth) return { ok: false, message: "Cloud-Anmeldung nicht konfiguriert." }
    try {
      await sendPasswordResetEmail(auth, email.trim())
    } catch (err) {
      // Bewusst keine Unterscheidung "Konto existiert nicht", um keine Konten preiszugeben.
      console.error("Passwort-Reset fehlgeschlagen", err)
    }
    return { ok: true }
  }

  async function signOut() {
    if (!auth) return
    await firebaseSignOut(auth)
    // Seite komplett neu laden: wirft alle Daten des bisherigen Kontos aus dem Speicher (Datenschutz) und
    // vermeidet, dass der Firestore-Client nach dem Kontowechsel mit altem Zustand hängen bleibt.
    window.location.reload()
  }

  const isAdmin = !!user && account.role === "admin"
  return {
    user,
    ...account,
    isAdmin,
    isEditor: !!user,
    ready,
    signIn,
    resetPassword,
    signOut,
  }
}
