// Pflicht-Seite beim ersten Login: Das vom Admin vergebene Startpasswort muss geändert werden.
// Bis dahin sperrt firestore.rules jeden Datenzugriff (Claim mustChangePassword) — dies ist also keine reine UI-Sperre.
import { Button } from "@/components/ui/button"
import type { UseAuthResult } from "@/hooks/useAuth"
import { PasswordForm } from "@/components/sections/PasswordForm"

export function ChangePasswordPage({ auth }: { auth: UseAuthResult }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4 text-foreground">
      <div className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold">Neues Passwort festlegen</h1>
          <p className="text-sm text-muted-foreground">
            Willkommen{auth.user?.email ? `, ${auth.user.email}` : ""}! Aus Sicherheitsgründen musst du das Startpasswort
            jetzt durch ein eigenes ersetzen.
          </p>
        </div>
        <PasswordForm auth={auth} currentLabel="Startpasswort" />
        <Button variant="ghost" size="sm" className="w-full" onClick={() => auth.signOut()}>Abmelden</Button>
      </div>
    </div>
  )
}
