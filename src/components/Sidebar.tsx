// Hauptnavigation — Äquivalent zur .sidebar-Nav aus legacy/index.html:1571–1588.
import { cn } from "@/lib/utils"
import type { SectionId } from "@/hooks/useHashSection"

const NAV_ITEMS: { id: SectionId; label: string; icon: string }[] = [
  { id: "overview", label: "Übersicht", icon: "◈" },
  { id: "team", label: "Mitarbeiter", icon: "◎" },
  { id: "struktur", label: "Strukturbaum", icon: "🌳" },
  { id: "rechner", label: "Rechner", icon: "∑" },
  { id: "karriere", label: "Karrierepläne", icon: "↗" },
  { id: "guide", label: "Guide", icon: "▤" },
  { id: "kalender", label: "Kalender/Anwesenheitsliste", icon: "▦" },
  { id: "partner", label: "Partnerportale", icon: "🔗" },
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
        <span className="text-primary">fi</span>
        <span>nova</span>
      </div>
      <div className="mb-4 px-2 text-xs text-muted-foreground">
        Direktion KKB · Team Dashboard
      </div>

      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          data-section={item.id}
          aria-current={section === item.id ? "page" : undefined}
          onClick={() => onNavigate(item.id)}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium transition-colors",
            section === item.id
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
          )}
        >
          <span aria-hidden="true" className="w-5 text-center">{item.icon}</span>
          {item.label}
        </button>
      ))}

      <div className="mt-auto px-2 pt-4 text-xs text-muted-foreground">
        <strong className="block text-foreground">Grenzgasse 1</strong>
        8055 Seiersberg, Austria
      </div>
    </nav>
  )
}
