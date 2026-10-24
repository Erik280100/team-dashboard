// Finanzierungen-Sektion — Tab-Switcher analog zu Rechner.tsx: "Offene Abwicklungen"
// (ehemals alleinige Finanzierungen-Sektion, siehe finanzierungen/OffeneAbwicklungen.tsx)
// und der hierher umgesiedelte Finanzierungsrechner (ehemals Tab in Rechner.tsx).
import { useState } from "react"
import { PillTabs } from "@/components/ui/dark"
import { OffeneAbwicklungen } from "@/components/sections/finanzierungen/OffeneAbwicklungen"
import { KreditRechner } from "@/components/sections/rechner/KreditRechner"
import { ImmoPortfolioRechner } from "@/components/sections/rechner/ImmoPortfolioRechner"
import type { Beschaeftigung } from "@/lib/data/finanzierung"
import type { FinanzierungArt, FinanzierungCase } from "@/types/dashboard"
import type { RosterEntry } from "@/lib/calc/struktur"

type FinanzierungenTab = "offen" | "rechner" | "immo" | "immoGmbh"

const TABS: { id: FinanzierungenTab; label: string; editorOnly?: boolean }[] = [
  { id: "offen", label: "Offene Abwicklungen" },
  { id: "rechner", label: "Finanzierungsrechner", editorOnly: true },
  { id: "immo", label: "Anlegerwohnungen", editorOnly: true },
  { id: "immoGmbh", label: "Anlegerwohnungen GmbH", editorOnly: true },
]

export function Finanzierungen({
  cases, addCase, patchCase, toggleDoc, removeCase, isEditor, canWrite, employeeRoster, abwicklerNames,
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
  /** Namen, die als Abwickler wählbar sind (Georg/Sandro, aus dem ganzen Strukturbaum). */
  abwicklerNames: string[]
}) {
  const [tab, setTab] = useState<FinanzierungenTab>("offen")
  const visibleTabs = TABS.filter((t) => !t.editorOnly || isEditor)
  const activeTab = visibleTabs.some((t) => t.id === tab) ? tab : visibleTabs[0].id

  return (
    <div className="flex flex-col gap-4">
      <PillTabs tabs={visibleTabs} value={activeTab} onChange={setTab} />

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
          abwicklerNames={abwicklerNames}
        />
      )}
      {activeTab === "rechner" && <KreditRechner />}
      {activeTab === "immo" && <ImmoPortfolioRechner />}
      {activeTab === "immoGmbh" && <ImmoPortfolioRechner rechtsform="gmbh" />}
    </div>
  )
}
