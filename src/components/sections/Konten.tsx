// Konten (nur Admin) — Logins für Mitarbeiter anlegen, Rolle setzen, Konten sperren.
// Ruft die Cloud Functions inviteUser/disableUser auf (functions/src/index.ts). Ein neues Konto
// bekommt ein zufälliges Startpasswort, das hier EINMAL angezeigt wird und vom Admin an die Person
// weitergegeben werden muss; bei der ersten Anmeldung muss sie es ändern (ChangePasswordPage).
import { useState } from "react"
import { httpsCallable } from "firebase/functions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { functions } from "@/lib/firebase"
import { isLeadRole } from "@/lib/calc/struktur"
import type { EmployeeMeta } from "@/lib/calc/employees"
import type { Role } from "@/lib/calc/roles"

const ROLE_LABELS: Record<Role, string> = { admin: "Admin", lead: "Führungskraft", member: "Mitarbeiter" }

function errorText(err: unknown): string {
  const msg = typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : ""
  return msg || "Unbekannter Fehler."
}

function Row({ emp }: { emp: EmployeeMeta }) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<Role>(isLeadRole(emp.role) ? "lead" : "member")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startPw, setStartPw] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  async function invite(resetPassword = false) {
    if (!functions) return
    setBusy(true); setError(null); setStartPw(null); setSaved(false); setCopied(false)
    try {
      const res = await httpsCallable<
        { email: string; employeeId: string; role: Role; resetPassword: boolean },
        { uid: string; tempPassword: string | null }
      >(functions, "inviteUser")({ email: email.trim(), employeeId: emp.id, role, resetPassword })
      if (res.data.tempPassword) setStartPw(res.data.tempPassword)
      else setSaved(true)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    if (!functions || !window.confirm(`Konto von ${emp.name} wirklich sperren?`)) return
    setBusy(true); setError(null)
    try {
      await httpsCallable(functions, "disableUser")({ employeeId: emp.id })
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    if (!startPw) return
    try { await navigator.clipboard.writeText(startPw); setCopied(true) } catch { /* noop */ }
  }

  return (
    <tr className="border-b align-top">
      <td className="px-2 py-2 font-medium">{emp.name}</td>
      <td className="px-2 py-2 text-muted-foreground">{emp.role}</td>
      <td className="px-2 py-2">{emp.uid ? "Konto vorhanden" : "—"}</td>
      <td className="px-2 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="email" placeholder="E-Mail" aria-label={`E-Mail für ${emp.name}`} className="h-8 w-56"
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
          <select
            aria-label={`Rolle für ${emp.name}`} value={role} onChange={(e) => setRole(e.target.value as Role)}
            className="h-8 rounded-md border bg-background px-2 text-sm"
          >
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <Button size="sm" disabled={busy || !email.includes("@")} onClick={() => invite(false)}>
            {emp.uid ? "Rolle speichern" : "Einladen"}
          </Button>
          {emp.uid && (
            <Button size="sm" variant="outline" disabled={busy || !email.includes("@")} onClick={() => invite(true)}>
              Neues Startpasswort
            </Button>
          )}
          {emp.uid && <Button size="sm" variant="ghost" disabled={busy} onClick={disable}>Sperren</Button>}
        </div>
        {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
        {saved && <p role="status" className="mt-1 text-xs text-emerald-600">Gespeichert.</p>}
        {startPw && (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Startpasswort für {emp.name} (nur jetzt sichtbar, bei der ersten Anmeldung muss es geändert werden):</span>
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{startPw}</code>
            <Button size="sm" variant="outline" onClick={copy}>{copied ? "Kopiert" : "Kopieren"}</Button>
          </div>
        )}
      </td>
    </tr>
  )
}

export function Konten({ employees }: { employees: EmployeeMeta[] }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Konten</h2>
          <p className="text-sm text-muted-foreground">
            Jede Person aus dem Strukturbaum bekommt ein eigenes Login. Die Rolle bestimmt die Rechte:
            Mitarbeiter sehen nur sich selbst, Führungskräfte zusätzlich ihre Unterstruktur, Admins alles.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-muted-foreground">
                <th className="px-2 py-1">Name</th><th className="px-2 py-1">Stufe</th>
                <th className="px-2 py-1">Status</th><th className="px-2 py-1">Einladen</th>
              </tr>
            </thead>
            <tbody>{employees.map((e) => <Row key={e.id} emp={e} />)}</tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
