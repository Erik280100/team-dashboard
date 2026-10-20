// Konten (nur Admin) — Logins für Mitarbeiter anlegen, Rolle setzen, Konten sperren.
// Ruft die Cloud Functions inviteUser/disableUser auf (functions/src/index.ts). Firebase
// verschickt über das Admin SDK keine E-Mail: Der Link zum Passwort-Setzen wird hier
// angezeigt und muss vom Admin an die Person weitergegeben werden.
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
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function invite() {
    if (!functions) return
    setBusy(true); setError(null); setLink(null); setCopied(false)
    try {
      const res = await httpsCallable<{ email: string; employeeId: string; role: Role }, { uid: string; resetLink: string }>(
        functions, "inviteUser",
      )({ email: email.trim(), employeeId: emp.id, role })
      setLink(res.data.resetLink)
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
    if (!link) return
    try { await navigator.clipboard.writeText(link); setCopied(true) } catch { /* noop */ }
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
          <Button size="sm" disabled={busy || !email.includes("@")} onClick={invite}>
            {emp.uid ? "Rolle/Link erneuern" : "Einladen"}
          </Button>
          {emp.uid && <Button size="sm" variant="ghost" disabled={busy} onClick={disable}>Sperren</Button>}
        </div>
        {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
        {link && (
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Link zum Passwort-Setzen (an {emp.name} weitergeben):</span>
            <Button size="sm" variant="outline" onClick={copy}>{copied ? "Kopiert" : "Link kopieren"}</Button>
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
