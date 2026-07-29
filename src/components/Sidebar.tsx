// Hauptnavigation — Äquivalent zur .sidebar-Nav aus legacy/index.html:1571–1588.
import {
  LayoutDashboard, Users, Network, Calculator, TrendingUp, BookOpen, Calendar, Link2,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { SectionId } from "@/hooks/useHashSection"

const NAV_ITEMS: { id: SectionId; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Übersicht", icon: LayoutDashboard },
  { id: "team", label: "Mitarbeiter", icon: Users },
  { id: "struktur", label: "Strukturbaum", icon: Network },
  { id: "rechner", label: "Rechner", icon: Calculator },
  { id: "karriere", label: "Karrierepläne", icon: TrendingUp },
  { id: "guide", label: "Guide", icon: BookOpen },
  { id: "kalender", label: "Kalender/Anwesenheitsliste", icon: Calendar },
  { id: "partner", label: "Partnerportale", icon: Link2 },
]

export function Sidebar({
  section,
  onNavigate,
}: {
  section: SectionId
  onNavigate: (section: SectionId) => void
}) {
  return (
    <nav
      aria-label="Hauptnavigation"
      className="flex w-64 shrink-0 flex-col gap-1 border-r bg-sidebar p-4 text-sidebar-foreground"
    >
      <div className="mb-1 flex items-baseline gap-1 px-2 text-xl font-bold">
        <span className="text-sidebar-primary">fi</span>
        <span>nova</span>
      </div>
      <div className="mb-4 px-2 text-xs text-sidebar-foreground/60">
        Direktion KKB · Team Dashboard
      </div>

      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const active = section === item.id
        return (
          <button
            key={item.id}
            type="button"
            data-section={item.id}
            aria-current={active ? "page" : undefined}
            onClick={() => onNavigate(item.id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_rgba(100,221,163,.35)]"
                : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            {item.label}
          </button>
        )
      })}

      <div className="mt-auto px-2 pt-4 text-xs text-sidebar-foreground/60">
        <strong className="block text-sidebar-foreground">Grenzgasse 1</strong>
        8055 Seiersberg, Austria
      </div>
    </nav>
  )
}
