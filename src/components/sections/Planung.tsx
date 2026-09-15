// Planung-Sektion — Wochen-/Monats-/Jahresplanung je Führungskraft. Die
// Führungskraft-Filter oben sind optisch die Rechner-Pill-Tabs
// (Rechner.tsx:36-52), darunter die Ebenen-Pills (Woche/Monat/Jahr) im
// gleichen Stil. Wer zu wem gehört, kommt komplett aus dem Strukturbaum
// (sbSubtreeNames) — kein eigener Hierarchie-Code, siehe Team.tsx.
import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { SB_LEAD_ROLE_ABBR, sbSubtreeNames, type RosterEntry, type SbNode } from "@/lib/calc/struktur"
import { leadRosterOptions } from "@/lib/calc/team"
import type { UsePlanungDocResult } from "@/hooks/usePlanungDoc"
import { Wochenplanung } from "@/components/sections/planung/Wochenplanung"
import { Monatsplanung } from "@/components/sections/planung/Monatsplanung"
import { Jahresplanung } from "@/components/sections/planung/Jahresplanung"

type PlanEbene = "woche" | "monat" | "jahr"

const EBENEN: { id: PlanEbene; label: string }[] = [
  { id: "woche", label: "Wochenplanung" },
  { id: "monat", label: "Monatsplanung" },
  { id: "jahr", label: "Jahresplanung" },
]

const PILL_ACTIVE = "border-transparent bg-primary text-primary-foreground shadow-sm"
const PILL_INACTIVE = "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
const PILL_BASE = "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors"

export function Planung({
  roster, orgTree, planung, isEditor,
}: {
  roster: RosterEntry[]
  orgTree: SbNode
  planung: UsePlanungDocResult
  isEditor: boolean
}) {
  const managerOptions = useMemo(() => leadRosterOptions(roster), [roster])
  const [managerFilter, setManagerFilter] = useState<string | null>(null)
  const [ebene, setEbene] = useState<PlanEbene>("woche")

  const selectedManager =
    managerOptions.some((m) => m.name === managerFilter) ? managerFilter : managerOptions[0]?.name ?? null

  const names = useMemo(
    () => (selectedManager ? sbSubtreeNames(orgTree, selectedManager) : new Set<string>()),
    [selectedManager, orgTree]
  )
  const people = useMemo(() => roster.filter((r) => names.has(r.name)), [roster, names])

  if (managerOptions.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Planung</h2>
        <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
          Noch keine Führungskräfte im Strukturbaum erfasst (ab Teamleiter aufwärts).
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Planung</h2>

      <div className="flex flex-wrap gap-2">
        {managerOptions.map((m) => (
          <button
            key={m.name}
            type="button"
            onClick={() => setManagerFilter(m.name)}
            className={cn(PILL_BASE, selectedManager === m.name ? PILL_ACTIVE : PILL_INACTIVE)}
          >
            {m.name}
            <span className="ml-1 opacity-70">({SB_LEAD_ROLE_ABBR[m.role] ?? m.role})</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {EBENEN.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setEbene(e.id)}
            className={cn(PILL_BASE, ebene === e.id ? PILL_ACTIVE : PILL_INACTIVE)}
          >
            {e.label}
          </button>
        ))}
      </div>

      {ebene === "woche" && (
        <Wochenplanung
          key={selectedManager}
          people={people}
          managerName={selectedManager}
          planung={planung}
          isEditor={isEditor}
        />
      )}
      {ebene === "monat" && (
        <Monatsplanung key={selectedManager} people={people} planung={planung} />
      )}
      {ebene === "jahr" && selectedManager && (
        <Jahresplanung
          key={selectedManager}
          managerName={selectedManager}
          people={people}
          planung={planung}
          isEditor={isEditor}
        />
      )}
    </div>
  )
}
