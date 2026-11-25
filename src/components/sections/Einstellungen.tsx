// Einstellungen — Konto-Infos und Passwort ändern.
import { Card, CardContent } from "@/components/ui/card"
import type { UseAuthResult } from "@/hooks/useAuth"
import { PasswordForm } from "@/components/sections/PasswordForm"
import { ProfilbildCard } from "@/components/sections/ProfilbildCard"
import { Konten } from "@/components/sections/Konten"
import type { EmployeeMeta } from "@/lib/calc/employees"

const ROLE_LABELS = { admin: "Admin", lead: "Führungskraft", member: "Mitarbeiter", viewer: "Nur Lesen" } as const

export function Einstellungen({ auth, name, avatarVersion, employees, showKonten = false }: {
  auth: UseAuthResult; name?: string; avatarVersion?: number
  /** Nur für Admin (und Lesemodus): Konten-Verwaltung am Ende der Seite. */
  employees?: EmployeeMeta[]; showKonten?: boolean
}) {
  return (
    <div className={`flex flex-col gap-4 ${showKonten ? "max-w-3xl" : "max-w-xl"}`}>
      <Card>
        <CardContent className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Konto</h2>
          <p className="text-sm text-muted-foreground">E-Mail: {auth.user?.email ?? "—"}</p>
          <p className="text-sm text-muted-foreground">Rolle: {ROLE_LABELS[auth.role]}</p>
        </CardContent>
      </Card>
      {auth.employeeId && <ProfilbildCard employeeId={auth.employeeId} name={name ?? ""} version={avatarVersion} />}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Passwort ändern</h2>
          <PasswordForm auth={auth} />
        </CardContent>
      </Card>
      {showKonten && employees && <Konten employees={employees} readOnly={auth.isViewer} />}
    </div>
  )
}
