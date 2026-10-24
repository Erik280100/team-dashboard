// Auth-Hook — E-Mail/Passwort-Login (Firebase Auth). Es gibt keinen anonymen
// Zugang mehr: ohne Login zeigt App.tsx nur die LoginPage.
//
// Rolle und Mitarbeiter-ID kommen aus den Custom Claims des ID-Tokens
// (siehe lib/calc/roles.ts, firestore.rules).
import { useEffect, useState } from "react"
import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  updatePassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth"
import { httpsCallable } from "firebase/functions"
import { auth, functions } from "@/lib/firebase"
import { accountFromClaims, type AccountInfo } from "@/lib/calc/roles"

type Result = { ok: true } | { ok: false; message: string }

export interface UseAuthResult extends AccountInfo {
  user: User | null
  /** Eingeloggt: darf die Daten bearbeiten, die ihm angezeigt werden (App.tsx beschneidet den Baum auf die eigene
   * Unterstruktur, firestore.rules erzwingt es). Admin-Funktionen (Struktur, Monatsabschluss, Teamziel): isAdmin. */
  isEditor: boolean
  isAdmin: boolean
  /** Führungskraft (Claim role "lead"): sieht zusätzlich die Statistik. */
  isLead: boolean
  /** Bekannt erst nachdem der erste Auth-State (inkl. Claims) empfangen wurde (verhindert Flackern). */
  ready: boolean
  signIn: (email: string, password: string) => Promise<Result>
  resetPassword: (email: string) => Promise<Result>
  /** Passwort ändern (mit Bestätigung des aktuellen). Hebt bei Erstanmeldung die Änderungspflicht auf. */
  changePassword: (current: string, next: string) => Promise<Result>
  signOut: () => Promise<void>
}

const NO_ACCOUNT: AccountInfo = { role: "member", employeeId: null, mustChangePassword: false }

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

  async function changePassword(current: string, next: string): Promise<Result> {
    const a = auth
    const u = a?.currentUser
    if (!a || !u || !u.email) return { ok: false, message: "Nicht angemeldet." }
    if (next.length < 8) return { ok: false, message: "Das neue Passwort muss mindestens 8 Zeichen haben." }
    if (next === current) return { ok: false, message: "Das neue Passwort muss sich vom alten unterscheiden." }
    try {
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, current))
    } catch {
      return { ok: false, message: "Das aktuelle Passwort ist nicht korrekt." }
    }
    if (account.mustChangePassword) {
      // Erstanmeldung: der Server setzt das Passwort und hebt erst dann die Sperre auf (setInitialPassword);
      // danach sind alle Sitzungen beendet, also mit dem neuen Passwort neu anmelden.
      try {
        if (!functions) throw new Error("Functions nicht verfügbar")
        await httpsCallable(functions, "setInitialPassword")({ newPassword: next })
        await signInWithEmailAndPassword(a, u.email, next)
      } catch (err) {
        console.error("Erstes Passwort konnte nicht gesetzt werden", err)
        return { ok: false, message: "Das Passwort konnte nicht geändert werden. Bitte neu anmelden und erneut versuchen." }
      }
    } else {
      try {
        await updatePassword(u, next)
      } catch (err) {
        const code = typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : ""
        const weak = code.includes("weak-password")
        return { ok: false, message: weak ? "Das neue Passwort ist zu schwach." : "Das Passwort konnte nicht geändert werden." }
      }
    }
    // Neue Claims (ohne Pflicht) übernehmen.
    try {
      const token = await (a.currentUser ?? u).getIdTokenResult(true)
      setAccount(accountFromClaims(token.claims))
    } catch (err) {
      console.error("Token konnte nicht erneuert werden", err)
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
  const isLead = !!user && account.role === "lead"
  return {
    user,
    ...account,
    isAdmin,
    isLead,
    isEditor: !!user,
    ready,
    signIn,
    resetPassword,
    changePassword,
    signOut,
  }
}
