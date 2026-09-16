// Wochenplanung — Karten-Grid, eine Karte je Person im Teilbaum der gewählten
// Führungskraft. Vorbild Finova_Controlling.html:1436-1514 (Feldgruppen/
// Sublabels/Reihenfolge), umgesetzt mit Card/Input statt eigener CSS-Klassen.
// Zahlenfelder nach dem NumField-Muster aus Team.tsx:21-46 (onBlur-Commit,
// key-Reset gegen State-Rückschreiben während der Eingabe).
import { useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { fmt, initials, type TeamGoal } from "@/lib/calc/format"
import { aggregateByGroup, periodWeekKeys, sumWeekEntries, weekLabel, shiftWeek, type PlanTeamGroup } from "@/lib/calc/planung"
import type { RosterEntry } from "@/lib/calc/struktur"
import type { UsePlanungDocResult } from "@/hooks/usePlanungDoc"
import type { PlanWeekEntry } from "@/types/dashboard"
import { cn } from "@/lib/utils"

interface FieldGroup {
  label: string
  left: { sub: string; key: keyof PlanWeekEntry }
  right: { sub: string; key: keyof PlanWeekEntry }
}

const FIELD_GROUPS: FieldGroup[] = [
  { label: "Wählversuche", left: { sub: "Ziel", key: "atz" }, right: { sub: "Gemacht", key: "atg" } },
  { label: "Analysen", left: { sub: "Ausgemacht", key: "analysenZ" }, right: { sub: "Stattgefunden", key: "analysen" } },
  { label: "Beratungen", left: { sub: "Ausgemacht", key: "beratungenZ" }, right: { sub: "Stattgefunden", key: "beratungen" } },
  { label: "Servicetermine", left: { sub: "Ziel", key: "stz" }, right: { sub: "Gemacht", key: "stg" } },
  { label: "Einstellungstermine", left: { sub: "Ziel", key: "etz" }, right: { sub: "Gemacht", key: "etg" } },
  { label: "Einheiten", left: { sub: "Offen", key: "ehOffen" }, right: { sub: "Gemacht", key: "ehGemacht" } },
  { label: "Aktivitäten", left: { sub: "Soll", key: "aktivitaetenSoll" }, right: { sub: "Ist", key: "aktivitaetenIst" } },
]

type CommitFn = (field: keyof PlanWeekEntry, value: number | string) => void

function NumField({
  personName, field, value, isEditor, onCommit,
}: {
  personName: string
  field: keyof PlanWeekEntry
  value: number
  isEditor: boolean
  onCommit: CommitFn
}) {
  return (
    <input
      key={`${personName}-${String(field)}-${value}`}
      type="number"
      disabled={!isEditor}
      defaultValue={value}
      aria-label={`${String(field)} – ${personName}`}
      className={cn(
        "h-8 w-full rounded-md border border-input bg-background px-2 text-center text-sm tabular-nums shadow-xs outline-none",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "disabled:opacity-60"
      )}
      onBlur={(e) => onCommit(field, Number(e.target.value) || 0)}
    />
  )
}

function PersonCard({
  person, isFk, entry, isEditor, onCommit,
}: {
  person: RosterEntry
  isFk: boolean
  entry: PlanWeekEntry
  isEditor: boolean
  onCommit: CommitFn
}) {
  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold">
            {initials(person.name)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 truncate text-sm font-medium">
              {person.name}
              {isFk && (
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">FK</span>
              )}
            </div>
            <div className="truncate text-xs text-muted-foreground">{person.role}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-1">
        <div className="grid grid-cols-2 gap-2">
          {FIELD_GROUPS.map((g) => (
            <div key={g.label} className="rounded-md border bg-muted/30 p-2">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</div>
              <div className="flex items-center gap-1.5">
                <div className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[9px] font-medium uppercase text-muted-foreground">{g.left.sub}</span>
                  <NumField personName={person.name} field={g.left.key} value={Number(entry[g.left.key]) || 0} isEditor={isEditor} onCommit={onCommit} />
                </div>
                <span className="pt-3 text-muted-foreground">/</span>
                <div className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[9px] font-medium uppercase text-muted-foreground">{g.right.sub}</span>
                  <NumField personName={person.name} field={g.right.key} value={Number(entry[g.right.key]) || 0} isEditor={isEditor} onCommit={onCommit} />
                </div>
              </div>
            </div>
          ))}
        </div>
        {isEditor && (
          <div className="rounded-md border bg-muted/30 p-2">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Notizen / Feedback</div>
            <textarea
              key={`${person.name}-notes-${entry.notes}`}
              defaultValue={entry.notes}
              placeholder="Besonderheiten, offene Punkte…"
              aria-label={`Notizen – ${person.name}`}
              className="min-h-16 w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              onBlur={(e) => onCommit("notes", e.target.value)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TeamGroupCard({ group, entry }: { group: PlanTeamGroup; entry: PlanWeekEntry }) {
  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold">
            {initials(group.name)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{group.name}</div>
            <div className="truncate text-xs text-muted-foreground">{group.role} · Team gesamt ({group.names.length})</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-1">
        <div className="grid grid-cols-2 gap-2">
          {FIELD_GROUPS.map((g) => (
            <div key={g.label} className="rounded-md border bg-muted/30 p-2">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</div>
              <div className="flex items-center gap-1.5">
                <div className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[9px] font-medium uppercase text-muted-foreground">{g.left.sub}</span>
                  <div className="flex h-8 w-full items-center justify-center rounded-md border border-input bg-background text-sm tabular-nums">
                    {fmt(Number(entry[g.left.key]) || 0)}
                  </div>
                </div>
                <span className="pt-3 text-muted-foreground">/</span>
                <div className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[9px] font-medium uppercase text-muted-foreground">{g.right.sub}</span>
                  <div className="flex h-8 w-full items-center justify-center rounded-md border border-input bg-background text-sm tabular-nums">
                    {fmt(Number(entry[g.right.key]) || 0)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function Wochenplanung({
  people, managerName, planung, isEditor, teamGoal, teamGroups,
}: {
  people: RosterEntry[]
  managerName: string | null
  planung: UsePlanungDocResult
  isEditor: boolean
  teamGoal: Pick<TeamGoal, "periodStart" | "periodEnd">
  teamGroups?: PlanTeamGroup[] | null
}) {
  const { activeWeek, setActiveWeek, weekDoc, saveWeekEntry } = planung
  const totals = useMemo(
    () => sumWeekEntries(people.map((p) => weekDoc.entries[p.name]).filter((e): e is PlanWeekEntry => !!e)),
    [people, weekDoc]
  )

  // Nur Wochen des aktuell eingestellten Umsatzmonats (periodStart..periodEnd,
  // Dashboard-Definition — kein Kalendermonat) sind zur Wochenplanung
  // freigeschaltet. Liegt die aktive Woche außerhalb (z.B. weil sie noch auf
  // der echten Kalenderwoche von heute steht), auf die erste erlaubte Woche
  // springen.
  const allowedWeeks = useMemo(
    () => periodWeekKeys(teamGoal.periodStart, teamGoal.periodEnd),
    [teamGoal.periodStart, teamGoal.periodEnd]
  )
  const firstAllowed = allowedWeeks[0]
  const lastAllowed = allowedWeeks[allowedWeeks.length - 1]
  useEffect(() => {
    if (!firstAllowed) return
    if (!allowedWeeks.includes(activeWeek)) {
      setActiveWeek(activeWeek < firstAllowed ? firstAllowed : lastAllowed)
    }
  }, [allowedWeeks, activeWeek, firstAllowed, lastAllowed, setActiveWeek])

  const canGoPrev = !!firstAllowed && activeWeek > firstAllowed
  const canGoNext = !!lastAllowed && activeWeek < lastAllowed

  const groupEntries = useMemo(
    () => (teamGroups && teamGroups.length > 0 ? aggregateByGroup([weekDoc], teamGroups) : null),
    [teamGroups, weekDoc]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="icon" disabled={!canGoPrev} onClick={() => setActiveWeek(shiftWeek(activeWeek, -1))} aria-label="Vorwoche">
          ‹
        </Button>
        <div className="text-sm font-medium">{weekLabel(activeWeek)}</div>
        <Button type="button" variant="outline" size="icon" disabled={!canGoNext} onClick={() => setActiveWeek(shiftWeek(activeWeek, 1))} aria-label="Nächste Woche">
          ›
        </Button>
        <span className="text-xs text-muted-foreground">Nur Wochen des laufenden Umsatzmonats wählbar · Bitte bis Montag 10:00 Uhr abgeben</span>
        <span className="ml-auto text-xs text-muted-foreground">
          Σ Einheiten gemacht {totals.ehGemacht} · Verträge {totals.vertraege}
        </span>
      </div>

      {groupEntries ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {teamGroups!.map((g) => (
            <TeamGroupCard key={g.name} group={g} entry={groupEntries.get(g.name) ?? sumWeekEntries([])} />
          ))}
        </div>
      ) : people.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
          Keine Personen für {managerName ?? "diese Führungskraft"} im Strukturbaum.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {people.map((p) => (
            <PersonCard
              key={p.name}
              person={p}
              isFk={p.name === managerName}
              entry={weekDoc.entries[p.name] ?? {
                atz: 0, atg: 0, analysenZ: 0, analysen: 0, beratungenZ: 0, beratungen: 0,
                vertraege: 0, pg: 0, stz: 0, stg: 0, etz: 0, etg: 0, ehOffen: 0, ehGemacht: 0,
                aktivitaetenSoll: 0, aktivitaetenIst: 0,
                notes: "", submitted: false,
              }}
              isEditor={isEditor}
              onCommit={(field, value) => saveWeekEntry(p.name, { [field]: value } as unknown as Partial<PlanWeekEntry>)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
