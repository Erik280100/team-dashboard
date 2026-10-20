// Login-Seite — Gate in App.tsx: ohne Login ist sonst nichts sichtbar.
import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { UseAuthResult } from "@/hooks/useAuth"

export function LoginPage({ auth }: { auth: UseAuthResult }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setInfo(null)
    const result = await auth.signIn(email, password)
    setSubmitting(false)
    if (!result.ok) setError(result.message)
    else setPassword("")
  }

  async function onForgot() {
    setError(null)
    setInfo(null)
    if (!email.trim()) {
      setError("Bitte zuerst die E-Mail-Adresse eingeben.")
      return
    }
    await auth.resetPassword(email)
    setInfo("Falls ein Konto zu dieser Adresse existiert, wurde ein Link zum Zurücksetzen gesendet.")
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4 text-foreground">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold">Team-Dashboard</h1>
          <p className="text-sm text-muted-foreground">Bitte melde dich an.</p>
        </div>
        <Input
          type="email"
          placeholder="E-Mail"
          aria-label="E-Mail"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          placeholder="Passwort"
          aria-label="Passwort"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        {info && <p className="text-sm text-muted-foreground">{info}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          Anmelden
        </Button>
        <Button type="button" variant="ghost" size="sm" className="w-full" onClick={onForgot}>
          Passwort vergessen?
        </Button>
      </form>
    </div>
  )
}
