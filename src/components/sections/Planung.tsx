// Planung-Sektion — Wochen-/Monats-/Jahresplanung je Führungskraft. Die
// Führungskraft-Filter oben sind optisch die Rechner-Pill-Tabs
// (Rechner.tsx:36-52), darunter die Ebenen-Pills (Woche/Monat/Jahr) im
// gleichen Stil. Wer zu wem gehört, kommt komplett aus dem Strukturbaum
// (sbSubtreeNames) — kein eigener Hierarchie-Code, siehe Team.tsx.
import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { DARK_CARD, DARK_INPUT, Pill, SectionHero } from "@/components/ui/dark"
import { SB_LEAD_ROLE_ABBR, sbLeadFrontier, sbSubtreeNames, type RosterEntry, type SbNode } from "@/lib/calc/struktur"
import { leadRosterOptions } from "@/lib/calc/team"
import type { PlanTeamGroup } from "@/lib/calc/planung"
import type { UsePlanungDocResult } from "@/hooks/usePlanungDoc"
import type { UseMonthArchiveResult } from "@/hooks/useMonthArchive"
import type { EmployeeRow } from "@/types/dashboard"
import { Wochenplanung } from "@/components/sections/planung/Wochenplanung"
import { Monatsplanung } from "@/components/sections/planung/Monatsplanung"
import { Jahresplanung } from "@/components/sections/planung/Jahresplanung"

type PlanEbene = "woche" | "monat" | "jahr"
type PlanScope = "alle" | "fuehrung" | "direkt"

const EBENEN: { id: PlanEbene; label: string }[] = [
  { id: "woche", label: "Wochenplanung" },
  { id: "monat", label: "Monatsplanung" },
  { id: "jahr", label: "Jahresplanung" },
]

export function Planung({
  roster, orgTree, planung, isEditor, rows, unitsMonthKey, archive,
}: {
  archive: UseMonthArchiveResult
  rows: EmployeeRow[]
  unitsMonthKey: string
  roster: RosterEntry[]
  orgTree: SbNode
  planung: UsePlanungDocResult
  isEditor: boolean
}) {
  const managerOptions = useMemo(() => leadRosterOptions(roster), [roster])
  const [managerFilter, setManagerFilter] = useState<string | null>(null)
  const [ebene, setEbene] = useState<PlanEbene>("woche")
  const [search, setSearch] = useState("")

  const selectedManager =
    managerOptions.some((m) => m.name === managerFilter) ? managerFilter : managerOptions[0]?.name ?? null

  const names = useMemo(
    () => (selectedManager ? sbSubtreeNames(orgTree, selectedManager) : new Set<string>()),
    [selectedManager, orgTree]
  )
  const [scope, setScope] = useState<PlanScope>("alle")
  // "Direkte Mitarbeiter": nur die unmittelbar unterstellten Personen (ohne die Führungskraft selbst und ohne
  // tiefere Ebenen) — managerName im Roster überspringt "vielleicht"-Knoten bereits.
  const people = useMemo(
    () => roster.filter((r) => (scope === "direkt" ? r.managerName === selectedManager : names.has(r.name))),
    [roster, names, scope, selectedManager]
  )
  const needle = search.trim().toLowerCase()
  const filteredPeople = useMemo(
    () => (needle ? people.filter((p) => p.name.toLowerCase().includes(needle)) : people),
    [people, needle]
  )

  // "Nach Führungskräften"-Rollup: die direkt unter selectedManager liegenden
  // Führungskräfte (siehe sbLeadFrontier), je eine Zeile/Kachel mit Team +
  // Führungskraft selbst zusammengezählt statt jeder Einzelperson.
  const leadFrontier = useMemo(
    () => (selectedManager ? sbLeadFrontier(orgTree, selectedManager) : []),
    [selectedManager, orgTree]
  )
  const teamGroups: PlanTeamGroup[] = useMemo(
    () => leadFrontier.map((lead) => ({
      name: lead.name,
      role: lead.role,
      names: [...sbSubtreeNames(orgTree, lead.name)],
    })),
    [leadFrontier, orgTree]
  )
  const filteredTeamGroups = useMemo(
    () => (needle ? teamGroups.filter((g) => g.name.toLowerCase().includes(needle)) : teamGroups),
    [teamGroups, needle]
  )
  useEffect(() => {
    if (leadFrontier.length === 0) setScope((s) => (s === "fuehrung" ? "alle" : s))
  }, [leadFrontier])
  const groupByLead = scope === "fuehrung"

  if (managerOptions.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <SectionHero eyebrow="Controlling" title="Planung" />
        <div className={cn("rounded-xl border p-12 text-center text-sm text-white/90", DARK_CARD)}>
          Noch keine Führungskräfte im Strukturbaum erfasst (ab Teamleiter aufwärts).
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHero eyebrow="Controlling" title="Planung" badge={selectedManager ?? undefined}>
        <div className="flex flex-wrap gap-2">
          {managerOptions.map((m) => (
            <Pill key={m.name} active={selectedManager === m.name} onClick={() => setManagerFilter(m.name)}>
              {m.name}
              <span className="ml-1 opacity-70">({SB_LEAD_ROLE_ABBR[m.role] ?? m.role})</span>
            </Pill>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
          {EBENEN.map((e) => (
            <Pill key={e.id} active={ebene === e.id} onClick={() => setEbene(e.id)}>{e.label}</Pill>
          ))}
          <span className="mx-1 h-5 w-px bg-white/15" />
          <Pill active={scope === "alle"} onClick={() => setScope("alle")}>Alle Mitarbeiter</Pill>
          <Pill active={scope === "direkt"} onClick={() => setScope("direkt")}>Direkte Mitarbeiter</Pill>
          {leadFrontier.length > 0 && (
            <Pill active={scope === "fuehrung"} onClick={() => setScope("fuehrung")}>Nach Führungskräften</Pill>
          )}
          <Input
            placeholder="Name suchen…"
            aria-label="Mitarbeiter nach Name suchen"
            className={cn("ml-auto w-56", DARK_INPUT)}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </SectionHero>

      {ebene === "woche" && (
        <Wochenplanung
          key={selectedManager}
          people={filteredPeople}
          managerName={selectedManager}
          planung={planung}
          isEditor={isEditor}
          monthKey={unitsMonthKey}
          teamGroups={groupByLead ? filteredTeamGroups : null}
        />
      )}
      {ebene === "monat" && (
        <Monatsplanung
          key={selectedManager}
          rows={rows}
          unitsMonthKey={unitsMonthKey}
          people={filteredPeople}
          planung={planung}
          isEditor={isEditor}
          teamGroups={groupByLead ? filteredTeamGroups : null}
        />
      )}
      {ebene === "jahr" && selectedManager && (
        // people bewusst ungefiltert: Jahresplanung zeigt keine Einzelpersonen-
        // Liste, sondern nur Team-Gesamtziele — die Namenssuche würde hier sonst
        // unsichtbar nur die Summen verändern, ohne dass sich an der Anzeige
        // etwas zeigt. Nur die "Nach Führungskräften"-Tabelle (teamGroups) hat
        // sichtbare Zeilen, die gefiltert werden können.
        <Jahresplanung
          key={selectedManager}
          archive={archive}
          rows={rows}
          unitsMonthKey={unitsMonthKey}
          managerName={selectedManager}
          people={people}
          roster={roster}
          planung={planung}
          isEditor={isEditor}
          teamGroups={groupByLead ? filteredTeamGroups : null}
        />
      )}
    </div>
  )
}
