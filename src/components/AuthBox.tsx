// Angemeldet-Anzeige + Abmelden (Anmeldung selbst: LoginPage).
import { Button } from "@/components/ui/button"
import type { UseAuthResult } from "@/hooks/useAuth"

export function AuthBox({ auth }: { auth: UseAuthResult }) {
  if (!auth.user) return null
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
