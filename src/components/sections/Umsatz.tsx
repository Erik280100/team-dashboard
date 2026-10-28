// Umsatzverfolgung-Sektion — die im EH-Rechner gebuchten Umsätze je Führungskraft. Filter (Führungskraft,
// Umfang, Namenssuche) im gleichen Stil wie Planung.tsx; wer zu wem gehört, kommt aus dem Strukturbaum.
import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { DARK_INPUT, Pill, SectionHero } from "@/components/ui/dark"
import { SB_LEAD_ROLE_ABBR, sbSubtreeNames, type RosterEntry, type SbNode } from "@/lib/calc/struktur"
import { leadRosterOptions } from "@/lib/calc/team"
import { umsatzMatches } from "@/lib/calc/umsatz"
import { isTraineeRole } from "@/lib/calc/planStufen"
import type { UseUmsaetzeDocResult } from "@/hooks/useUmsaetzeDoc"
import { Umsatzverfolgung } from "@/components/sections/planung/Umsatzverfolgung"

type UmsatzScope = "alle" | "eigene" | "team"

export function Umsatz({
  roster, orgTree, umsaetze, isEditor,
}: {
  roster: RosterEntry[]
  orgTree: SbNode
  umsaetze: UseUmsaetzeDocResult
  isEditor: boolean
}) {
  const managerOptions = useMemo(() => leadRosterOptions(roster), [roster])
  const [managerFilter, setManagerFilter] = useState<string | null>(null)
  const [scope, setScope] = useState<UmsatzScope>("alle")
  const [search, setSearch] = useState("")

  const selectedManager =
    managerOptions.some((m) => m.name === managerFilter) ? managerFilter : managerOptions[0]?.name ?? null

  const names = useMemo(
    () => (selectedManager ? sbSubtreeNames(orgTree, selectedManager) : new Set<string>()),
    [selectedManager, orgTree]
  )
  // Nur Umsätze der aktuell gelisteten Personen (Führungskraft, Umfang, Suche).
  // Ohne Führungskräfte im sichtbaren Teilbaum (z. B. Mitarbeiter ohne Team) gibt es keine Filter: dann
  // zählen alle sichtbaren Personen, also die eigenen Umsätze.
  const hasManagers = managerOptions.length > 0
  const entries = useMemo(() => {
    const key = (n: string) => n.trim().toLowerCase()
    const own = selectedManager ? key(selectedManager) : null
    const listed = new Set(
      roster
        .filter((r) => !hasManagers || names.has(r.name))
        .filter((r) => !hasManagers || scope === "alle" || (scope === "eigene") === (key(r.name) === own))
        .map((r) => key(r.name))
    )
    return umsaetze.entries.filter((e) => listed.has(key(e.mitarbeiter)) && umsatzMatches(e, search))
  }, [roster, hasManagers, names, scope, selectedManager, search, umsaetze.entries])

  // Markierungen, damit die Führungskraft sieht, was zu ihr selbst und was zu ihren Mitarbeitern (Trainees) gehört.
  const tags = useMemo(() => {
    const out: Record<string, string> = {}
    if (!hasManagers) return out
    for (const r of roster) {
      if (!names.has(r.name)) continue
      const k = r.name.trim().toLowerCase()
      if (r.name === selectedManager) out[k] = "Eigener Umsatz"
      else if (isTraineeRole(r.role)) out[k] = "Trainee"
    }
    return out
  }, [roster, hasManagers, names, selectedManager])

  return (
    <div className="flex flex-col gap-4">
      <SectionHero eyebrow="Controlling" title="Umsatzverfolgung" badge={selectedManager ?? undefined}>
        {hasManagers && (
          <div className="flex flex-wrap gap-2">
            {managerOptions.map((m) => (
              <Pill key={m.name} active={selectedManager === m.name} onClick={() => setManagerFilter(m.name)}>
                {m.name}
                <span className="ml-1 opacity-70">({SB_LEAD_ROLE_ABBR[m.role] ?? m.role})</span>
              </Pill>
            ))}
          </div>
        )}

        <div className={cn("flex flex-wrap items-center gap-2", hasManagers && "border-t border-white/10 pt-4")}>
          {hasManagers && (
            <>
              <Pill active={scope === "alle"} onClick={() => setScope("alle")}>Alle</Pill>
              <Pill active={scope === "eigene"} onClick={() => setScope("eigene")}>Eigene</Pill>
              <Pill active={scope === "team"} onClick={() => setScope("team")}>Für meine Mitarbeiter</Pill>
            </>
          )}
          <Input
            placeholder="Kunde, Einheiten oder Prämie suchen…"
            aria-label="Umsätze nach Kunde, Einheiten oder Prämie suchen"
            className={cn("ml-auto w-72", DARK_INPUT)}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </SectionHero>

      <Umsatzverfolgung
        entries={entries}
        isEditor={isEditor}
        patchEntry={umsaetze.patchEntry}
        removeEntry={umsaetze.removeEntry}
        tags={tags}
      />
    </div>
  )
}
