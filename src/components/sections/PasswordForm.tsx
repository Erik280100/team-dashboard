// Formular zum Ändern des Passworts — genutzt von der Einstellungen-Seite und der Pflicht-Seite beim ersten Login.
import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { UseAuthResult } from "@/hooks/useAuth"

export function PasswordForm({ auth, currentLabel = "Aktuelles Passwort" }: { auth: UseAuthResult; currentLabel?: string }) {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [repeat, setRepeat] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setDone(false)
    if (next !== repeat) {
      setError("Die beiden neuen Passwörter stimmen nicht überein.")
      return
    }
    setBusy(true)
    const result = await auth.changePassword(current, next)
    setBusy(false)
    if (result.ok) {
      setDone(true)
      setCurrent("")
      setNext("")
      setRepeat("")
    } else {
      setError(result.message)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-sm flex-col gap-3">
      <Input
        type="password" placeholder={currentLabel} aria-label={currentLabel} autoComplete="current-password"
        required value={current} onChange={(e) => setCurrent(e.target.value)}
      />
      <Input
        type="password" placeholder="Neues Passwort (mind. 8 Zeichen)" aria-label="Neues Passwort" autoComplete="new-password"
        required minLength={8} value={next} onChange={(e) => setNext(e.target.value)}
      />
      <Input
        type="password" placeholder="Neues Passwort wiederholen" aria-label="Neues Passwort wiederholen" autoComplete="new-password"
        required minLength={8} value={repeat} onChange={(e) => setRepeat(e.target.value)}
      />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {done && <p role="status" className="text-sm text-emerald-600">Passwort geändert.</p>}
      <Button type="submit" disabled={busy}>Passwort ändern</Button>
    </form>
  )
}
