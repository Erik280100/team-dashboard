// Hauptnavigation — Äquivalent zur .sidebar-Nav aus der früheren Einzeldatei-App.
import {
  LayoutDashboard, Users, Network, BarChart3, CalendarRange, Calculator, TrendingUp, BookOpen, Calendar, Landmark, Link2, X,
  KanbanSquare, UserCog, Settings, FilePlus2, ExternalLink, Receipt,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { SectionId } from "@/hooks/useHashSection"

const NAV_ITEMS: { id: SectionId; label: string; icon: LucideIcon; access?: "admin" | "lead" }[] = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "team", label: "Mitarbeiter", icon: Users },
  { id: "rechner", label: "Rechner", icon: Calculator },
  { id: "planung", label: "Controlling", icon: CalendarRange },
  { id: "umsatz", label: "Umsatzverfolgung", icon: Receipt },
  { id: "finanzierungen", label: "Finanzierungen", icon: Landmark },
  { id: "struktur", label: "Strukturbaum", icon: Network },
  { id: "karriere", label: "Karrierepläne", icon: TrendingUp },
  { id: "kalender", label: "Anwesenheitsliste", icon: Calendar },
  { id: "statistik", label: "Statistik", icon: BarChart3, access: "lead" },
  { id: "konten", label: "Konten", icon: UserCog, access: "admin" },
]

/** Untere Gruppe (über "Neue Analyse starten" und "Mein Board"). */
const LOWER_ITEMS: typeof NAV_ITEMS = [
  { id: "guide", label: "Guide", icon: BookOpen },
  { id: "partner", label: "Partner", icon: Link2 },
]

/** Externer Link (öffnet in neuem Tab, nie "aktive Seite"), steht unten bei "Mein Board". */
const ANALYSE_URL = "https://finova.anyconcept.ai/finanzanalyse/home"

export function Sidebar({
  section,
  onNavigate,
  open,
  onClose,
  isAdmin,
  isLead,
  boardAlert = false,
}: {
  /** Mindestens ein offenes Todo ist fällig (Datum erreicht/überschritten): rotes Ausrufezeichen bei "Mein Board". */
  boardAlert?: boolean
  section: SectionId
  onNavigate: (section: SectionId) => void
  /** Mobil: Menü eingeblendet (off-canvas). Ab md ist die Sidebar immer sichtbar. */
  open: boolean
  onClose: () => void
  /** Konten sieht nur der Admin, die Statistik Führungskräfte und Admin. */
  isAdmin: boolean
  isLead: boolean
}) {
  const navItems = NAV_ITEMS.filter(
    (item) => !item.access || isAdmin || (item.access === "lead" && isLead)
  )
  const renderItem = (item: (typeof NAV_ITEMS)[number]) => {
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
  }
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

        {navItems.map(renderItem)}

        <div className="mt-auto flex flex-col gap-1 border-t border-sidebar-foreground/10 pt-3">
          <button
            type="button"
            data-section="board"
            aria-current={section === "board" ? "page" : undefined}
            onClick={() => {
              onNavigate("board")
              onClose()
            }}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium transition-colors",
              section === "board"
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_rgba(100,221,163,.35)]"
                : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <KanbanSquare aria-hidden="true" className="size-4 shrink-0" />
            Mein Board
            {boardAlert && (
              <span
                title="offene todos"
                aria-label="offene todos"
                className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-xs font-extrabold leading-none text-white"
              >
                !
              </span>
            )}
          </button>
          <a
            href={ANALYSE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          >
            <FilePlus2 aria-hidden="true" className="size-4 shrink-0" />
            Neue Analyse starten
            <ExternalLink aria-hidden="true" className="ml-auto size-3.5 shrink-0 opacity-60" />
          </a>
          {LOWER_ITEMS.map(renderItem)}
          <button
            type="button"
            data-section="einstellungen"
            aria-current={section === "einstellungen" ? "page" : undefined}
            onClick={() => {
              onNavigate("einstellungen")
              onClose()
            }}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium transition-colors",
              section === "einstellungen"
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_rgba(100,221,163,.35)]"
                : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <Settings aria-hidden="true" className="size-4 shrink-0" />
            Einstellungen
          </button>
          <div className="px-2 pt-1 text-xs text-sidebar-foreground/60">
            <strong className="block text-sidebar-foreground">Grenzgasse 1</strong>
            8055 Seiersberg, Austria
          </div>
        </div>
      </nav>
    </>
  )
}
