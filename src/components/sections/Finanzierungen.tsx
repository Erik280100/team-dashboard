// Finanzierungen-Sektion — Tab-Switcher analog zu Rechner.tsx: "Offene Abwicklungen"
// (ehemals alleinige Finanzierungen-Sektion, siehe finanzierungen/OffeneAbwicklungen.tsx)
// und der hierher umgesiedelte Finanzierungsrechner (ehemals Tab in Rechner.tsx).
import { useState } from "react"
import { cn } from "@/lib/utils"
import { OffeneAbwicklungen } from "@/components/sections/finanzierungen/OffeneAbwicklungen"
import { KreditRechner } from "@/components/sections/rechner/KreditRechner"
import { ImmoPortfolioRechner } from "@/components/sections/rechner/ImmoPortfolioRechner"
import type { Beschaeftigung } from "@/lib/data/finanzierung"
import type { FinanzierungArt, FinanzierungCase } from "@/types/dashboard"
import type { RosterEntry } from "@/lib/calc/struktur"

type FinanzierungenTab = "offen" | "rechner" | "immo"

const TABS: { id: FinanzierungenTab; label: string; editorOnly?: boolean }[] = [
  { id: "offen", label: "Offene Abwicklungen" },
  { id: "rechner", label: "Finanzierungsrechner", editorOnly: true },
  { id: "immo", label: "Anlegerwohnungen", editorOnly: true },
]

export function Finanzierungen({
  cases, addCase, patchCase, toggleDoc, removeCase, isEditor, canWrite, employeeRoster,
}: {
  cases: FinanzierungCase[]
  addCase: (init: { name: string; betrag: number; art: FinanzierungArt; beschaeftigung: Beschaeftigung; betreuer: string }) => void
  patchCase: (id: string, patch: Partial<FinanzierungCase>) => void
  toggleDoc: (id: string, itemId: string, checked: boolean) => void
  removeCase: (id: string) => void
  isEditor: boolean
  /** Jeder (auch ohne echten Login, via automatischem anonymem Auth) darf
   * Kreditfälle anlegen und die Checkliste/Status pflegen — siehe useAuth.ts
   * und OffeneAbwicklungen.tsx. Stammdaten bearbeiten, Archivieren und Löschen
   * bleiben isEditor vorbehalten. */
  canWrite: boolean
  /** Aktive Mitarbeiter aus dem Strukturbaum-Roster (siehe App.tsx `roster`), für die Betreuer-Auswahl. */
  employeeRoster: RosterEntry[]
}) {
  const [tab, setTab] = useState<FinanzierungenTab>("offen")
  const visibleTabs = TABS.filter((t) => !t.editorOnly || isEditor)
  const activeTab = visibleTabs.some((t) => t.id === tab) ? tab : visibleTabs[0].id

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              activeTab === t.id
                ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "offen" && (
        <OffeneAbwicklungen
          cases={cases}
          addCase={addCase}
          patchCase={patchCase}
          toggleDoc={toggleDoc}
          removeCase={removeCase}
          isEditor={isEditor}
          canWrite={canWrite}
          employeeRoster={employeeRoster}
        />
      )}
      {activeTab === "rechner" && <KreditRechner />}
      {activeTab === "immo" && <ImmoPortfolioRechner />}
    </div>
  )
}
