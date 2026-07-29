// Admin-Login/Logout — Äquivalent zu initAuth() aus legacy/index.html:2207–2246.
import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { useAuth } from "@/hooks/useAuth"

export function AuthBox({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (auth.user) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          Angemeldet: {auth.user.email || auth.user.uid}
        </span>
        <Button size="sm" variant="ghost" onClick={() => auth.signOut()}>
          Abmelden
        </Button>
      </div>
    )
  }

  if (!showForm) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setShowForm(true)}>
        Admin
      </Button>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const result = await auth.signIn(email, password)
    setSubmitting(false)
    if (result.ok) {
      setPassword("")
      setShowForm(false)
    } else {
      setError(result.message)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <Input
        type="email"
        placeholder="E-Mail"
        aria-label="E-Mail"
        autoComplete="username"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-8 w-40"
      />
      <Input
        type="password"
        placeholder="Passwort"
        aria-label="Passwort"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="h-8 w-32"
      />
      <Button type="submit" size="sm" disabled={submitting}>
        Anmelden
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-label="Anmeldung abbrechen"
        onClick={() => { setShowForm(false); setError(null) }}
      >
        ×
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </form>
  )
}
