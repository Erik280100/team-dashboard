// Profil — Konto-Infos, Profilbild und Passwort ändern (Layout wie die Profilseite der Finova-App).
import { useState, type ReactNode } from "react"
import { KeyRound } from "lucide-react"
import { Avatar } from "@/components/Avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { UseAuthResult } from "@/hooks/useAuth"
import { PasswordForm } from "@/components/sections/PasswordForm"
import { ProfilbildCard } from "@/components/sections/ProfilbildCard"

const ROLE_LABELS = { admin: "Admin", lead: "Führungskraft", member: "Mitarbeiter", viewer: "Nur Lesen" } as const

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="border-b border-slate-200 pb-2 text-base font-bold">{title}</h3>
      {children}
    </div>
  )
}

export function Einstellungen({ auth, name, avatarVersion }: { auth: UseAuthResult; name?: string; avatarVersion?: number }) {
  const [showPassword, setShowPassword] = useState(false)
  const fullName = (name ?? "").trim()
  const [firstName, ...rest] = fullName.split(/\s+/)
  const email = auth.user?.email ?? "—"

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <h2 className="text-2xl font-extrabold uppercase">Profil</h2>
      <Card className="py-6">
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar
                name={fullName || email}
                avatar={auth.employeeId && avatarVersion ? { id: auth.employeeId, version: avatarVersion } : undefined}
                className="size-16 bg-primary text-xl text-primary-foreground"
              />
              <div>
                <div className="text-lg font-semibold">{fullName || email}</div>
                <div className="text-sm text-slate-500">{email}</div>
              </div>
            </div>
            <Button variant="secondary" aria-expanded={showPassword} onClick={() => setShowPassword((v) => !v)}>
              Passwort ändern
            </Button>
          </div>
          <div className="grid gap-8 border-t border-slate-200 pt-6 sm:grid-cols-2">
            <Group title="Persönliche Daten">
              {fullName && <Field label="Vorname">{firstName}</Field>}
              {rest.length > 0 && <Field label="Nachname">{rest.join(" ")}</Field>}
              <Field label="E-Mail">{email}</Field>
            </Group>
            <Group title="Organisation">
              <Field label="Rolle">{ROLE_LABELS[auth.role]}</Field>
            </Group>
          </div>
        </CardContent>
      </Card>
      {auth.employeeId && <ProfilbildCard employeeId={auth.employeeId} name={name ?? ""} version={avatarVersion} />}
      {showPassword && (
        <Card>
          <CardHeader>
            <CardTitle icon={KeyRound}>Passwort ändern</CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordForm auth={auth} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
