// Karrierepläne — Äquivalent zu initCareerPlans() aus legacy/index.html:4039–4081.
// Inhalte sind clientseitig AES-GCM-verschlüsselt (siehe src/lib/data/career.ts) —
// dasselbe Passwort wie in der Legacy-App schaltet dieselben Inhalte frei.
import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { decryptCareerPlans, type CareerPlan } from "@/lib/data/career"

export function Karriere() {
  const [plans, setPlans] = useState<CareerPlan[] | null>(null)
  const [active, setActive] = useState(0)
  const [password, setPassword] = useState("")
  const [error, setError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!password) return
    setSubmitting(true)
    setError(false)
    try {
      const decrypted = await decryptCareerPlans(password)
      setPlans(decrypted)
      setActive(0)
    } catch {
      setError(true)
    } finally {
      setPassword("")
      setSubmitting(false)
    }
  }

  if (!plans) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Karrierepläne</h2>
          <p className="text-sm text-muted-foreground">Dieser Bereich ist passwortgeschützt.</p>
          <form onSubmit={onSubmit} className="flex gap-2">
            <Input
              type="password"
              placeholder="Passwort"
              aria-label="Passwort für Karrierepläne"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" disabled={submitting}>Freischalten</Button>
          </form>
          {error && <div role="alert" className="text-sm text-destructive">Falsches Passwort.</div>}
        </CardContent>
      </Card>
    )
  }

  const plan = plans[active]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {plans.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              active === i
                ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {p.title}
          </button>
        ))}
      </div>
      <Card>
        <CardContent>
          <div
            className="career-plan"
            dangerouslySetInnerHTML={{ __html: plan.html }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
