// Wochenplanung — Karten-Grid, eine Karte je Person im Teilbaum der gewählten
// Führungskraft. Vorbild Finova_Controlling.html:1436-1514 (Feldgruppen/
// Sublabels/Reihenfolge), umgesetzt mit Card/Input statt eigener CSS-Klassen.
// Zahlenfelder nach dem NumField-Muster aus Team.tsx:21-46 (onBlur-Commit,
// key-Reset gegen State-Rückschreiben während der Eingabe).
import { useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DARK_CARD, DARK_INPUT, DARK_TILE } from "@/components/ui/dark"
import { fmt, initials } from "@/lib/calc/format"
import { aggregateByGroup, isoWeekKey, monthLabel, monthWeekKeys, sumWeekEntries, weekLabel, type PlanTeamGroup } from "@/lib/calc/planung"
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
  { label: "Wählversuche", left: { sub: "Soll", key: "atz" }, right: { sub: "Ist", key: "atg" } },
  { label: "AT", left: { sub: "Soll", key: "analysenZ" }, right: { sub: "Ist", key: "analysen" } },
  { label: "BT", left: { sub: "Soll", key: "beratungenZ" }, right: { sub: "Ist", key: "beratungen" } },
  { label: "ST", left: { sub: "Soll", key: "stz" }, right: { sub: "Ist", key: "stg" } },
  { label: "ET", left: { sub: "Soll", key: "etz" }, right: { sub: "Ist", key: "etg" } },
  { label: "Aktivitäten", left: { sub: "Soll", key: "aktivitaetenSoll" }, right: { sub: "Ist", key: "aktivitaetenIst" } },
]

const NAV_BTN = "border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"

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
        "h-8 w-full rounded-md border px-2 text-center text-sm tabular-nums outline-none",
        "focus-visible:border-[#64DDA3] focus-visible:ring-[#64DDA3]/25 focus-visible:ring-[3px]",
        "disabled:opacity-60",
        DARK_INPUT
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
    <Card className={DARK_CARD}>
      <CardHeader className="border-b border-white/10 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#64DDA3]/15 text-xs font-bold text-[#64DDA3]">
            {initials(person.name)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 truncate text-sm font-semibold">
              {person.name}
              {isFk && (
                <span className="rounded-full bg-[#E7A94C]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#E7A94C]">FK</span>
              )}
            </div>
            <div className="truncate text-xs text-white/75">{person.role}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-1">
        <div className="grid grid-cols-2 gap-2">
          {FIELD_GROUPS.map((g) => (
            <div key={g.label} className={cn(DARK_TILE, "p-2")}>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#64DDA3]">{g.label}</div>
              <div className="flex items-center gap-1.5">
                <div className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[9px] font-medium uppercase text-white/75">{g.left.sub}</span>
                  <NumField personName={person.name} field={g.left.key} value={Number(entry[g.left.key]) || 0} isEditor={isEditor} onCommit={onCommit} />
                </div>
                <span className="pt-3 text-white/55">/</span>
                <div className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[9px] font-medium uppercase text-white/75">{g.right.sub}</span>
                  <NumField personName={person.name} field={g.right.key} value={Number(entry[g.right.key]) || 0} isEditor={isEditor} onCommit={onCommit} />
                </div>
              </div>
            </div>
          ))}
        </div>
        {isEditor && (
          <div className={cn(DARK_TILE, "p-2")}>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#64DDA3]">Notizen / Feedback</div>
            <textarea
              key={`${person.name}-notes-${entry.notes}`}
              defaultValue={entry.notes}
              placeholder="Besonderheiten, offene Punkte…"
              aria-label={`Notizen – ${person.name}`}
              className={cn("min-h-16 w-full resize-y rounded-md border px-2 py-1.5 text-sm outline-none focus-visible:border-[#64DDA3] focus-visible:ring-[#64DDA3]/25 focus-visible:ring-[3px]", DARK_INPUT)}
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
    <Card className={DARK_CARD}>
      <CardHeader className="border-b border-white/10 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#64DDA3]/15 text-xs font-bold text-[#64DDA3]">
            {initials(group.name)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{group.name}</div>
            <div className="truncate text-xs text-white/75">{group.role} · Team gesamt ({group.names.length})</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-1">
        <div className="grid grid-cols-2 gap-2">
          {FIELD_GROUPS.map((g) => (
            <div key={g.label} className={cn(DARK_TILE, "p-2")}>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#64DDA3]">{g.label}</div>
              <div className="flex items-center gap-1.5">
                <div className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[9px] font-medium uppercase text-white/75">{g.left.sub}</span>
                  <div className="flex h-8 w-full items-center justify-center text-sm font-semibold tabular-nums">
                    {fmt(Number(entry[g.left.key]) || 0)}
                  </div>
                </div>
                <span className="pt-3 text-white/55">/</span>
                <div className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[9px] font-medium uppercase text-white/75">{g.right.sub}</span>
                  <div className="flex h-8 w-full items-center justify-center text-sm font-semibold tabular-nums">
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
  people, managerName, planung, isEditor, teamGroups, monthKey,
}: {
  /** Offener Monat ("YYYY-MM"): es werden nur dessen Wochen angeboten. */
  monthKey: string
  people: RosterEntry[]
  managerName: string | null
  planung: UsePlanungDocResult
  isEditor: boolean
  teamGroups?: PlanTeamGroup[] | null
}) {
  const { activeWeek, setActiveWeek, weekDoc, saveWeekEntry } = planung
  // Nur Wochen des offenen Monats (Randwochen zählen zu beiden angrenzenden Monaten). Start: die aktuelle
  // Woche, falls sie dazugehört, sonst die nächstliegende Woche des Monats.
  const weeks = useMemo(() => monthWeekKeys(monthKey), [monthKey])
  useEffect(() => {
    if (weeks.includes(activeWeek)) return
    const current = isoWeekKey(new Date())
    setActiveWeek(weeks.includes(current) ? current : current < weeks[0] ? weeks[0] : weeks[weeks.length - 1])
    // setActiveWeek ist stabil genug; nur auf Wochenwechsel/Monat reagieren.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks, activeWeek])
  const weekIdx = weeks.indexOf(activeWeek)
  const totals = useMemo(
    () => sumWeekEntries(people.map((p) => weekDoc.entries[p.name]).filter((e): e is PlanWeekEntry => !!e)),
    [people, weekDoc]
  )

  const groupEntries = useMemo(
    () => (teamGroups && teamGroups.length > 0 ? aggregateByGroup([weekDoc], teamGroups) : null),
    [teamGroups, weekDoc]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className={cn("flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3", DARK_CARD)}>
        <Button type="button" variant="ghost" size="icon" className={NAV_BTN} disabled={weekIdx <= 0} onClick={() => setActiveWeek(weeks[weekIdx - 1])} aria-label="Vorwoche">
          ‹
        </Button>
        <div className="text-sm font-bold">{weekLabel(activeWeek)}</div>
        <Button type="button" variant="ghost" size="icon" className={NAV_BTN} disabled={weekIdx < 0 || weekIdx >= weeks.length - 1} onClick={() => setActiveWeek(weeks[weekIdx + 1])} aria-label="Nächste Woche">
          ›
        </Button>
        <span className="rounded-full bg-[#64DDA3]/15 px-2.5 py-1 text-xs font-bold text-[#64DDA3]">{monthLabel(monthKey)}</span>
        <span className="text-xs text-white/75">Bitte bis Montag 10:00 Uhr abgeben</span>
        <span className="ml-auto rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold">
          Σ Verträge {totals.vertraege}
        </span>
      </div>

      {groupEntries ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {teamGroups!.map((g) => (
            <TeamGroupCard key={g.name} group={g} entry={groupEntries.get(g.name) ?? sumWeekEntries([])} />
          ))}
        </div>
      ) : people.length === 0 ? (
        <div className={cn("rounded-xl border p-12 text-center text-sm text-white/75", DARK_CARD)}>
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
