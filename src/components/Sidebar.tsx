// Hauptnavigation — Äquivalent zur .sidebar-Nav aus legacy/index.html:1571–1588.
import {
  LayoutDashboard, Users, Network, BarChart3, Calculator, TrendingUp, BookOpen, Calendar, Landmark, Link2, X,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { SectionId } from "@/hooks/useHashSection"

const NAV_ITEMS: { id: SectionId; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "team", label: "Mitarbeiter", icon: Users },
  { id: "struktur", label: "Strukturbaum", icon: Network },
  { id: "statistik", label: "Statistik", icon: BarChart3 },
  { id: "rechner", label: "Rechner", icon: Calculator },
  { id: "karriere", label: "Karrierepläne", icon: TrendingUp },
  { id: "guide", label: "Guide", icon: BookOpen },
  { id: "kalender", label: "Kalender/Anwesenheitsliste", icon: Calendar },
  { id: "finanzierungen", label: "Finanzierungen", icon: Landmark },
  { id: "partner", label: "Partner", icon: Link2 },
]

export function Sidebar({
  section,
  onNavigate,
  open,
  onClose,
}: {
  section: SectionId
  onNavigate: (section: SectionId) => void
  /** Mobil: Menü eingeblendet (off-canvas). Ab md ist die Sidebar immer sichtbar. */
  open: boolean
  onClose: () => void
}) {
  return (
    <>
      {open && (
        <div
          aria-hidden="true"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}
      <nav
        aria-label="Hauptnavigation"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 -translate-x-full flex-col gap-1 border-r bg-sidebar p-4 text-sidebar-foreground transition-transform duration-200 ease-in-out",
          "lg:static lg:z-auto lg:translate-x-0",
          open && "translate-x-0"
        )}
      >
        <div className="mb-1.5 flex items-center justify-between gap-0.5">
          <div className="flex items-baseline gap-0.5 px-1.5 text-[26px] font-extrabold">
            <span className="italic text-sidebar-primary">fi</span>
            <span>nova</span>
          </div>
          <button
            type="button"
            aria-label="Menü schließen"
            onClick={onClose}
            className="rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground lg:hidden"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
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
              onClick={() => {
                onNavigate(item.id)
                onClose()
              }}
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
    </>
  )
}
