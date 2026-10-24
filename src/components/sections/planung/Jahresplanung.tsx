// Jahresplanung — Jahresziele + Quartalsmeilensteine je Führungskraft. Vorbild
// Finova_Controlling.html:2974-3075 (renderJahresplanung), "Umsatz €" durch
// Einheiten ersetzt (siehe defaultAnnual in lib/calc/planung.ts). Die
// "Team-Bewertungsübersicht" (Ratings) wird bewusst NICHT übernommen — sie
// hängt an Mitarbeiter-Notizen außerhalb der drei Planungsbereiche.
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { DARK_CARD, DARK_INPUT, DARK_TABLE, DARK_TILE, MintBar } from "@/components/ui/dark"
import { fmt } from "@/lib/calc/format"
import {
  QUARTER_LIST, Q_MONTHS, emptyWeekEntry, quarterStatus, sumWeekEntries, yearWeekKeys, weekToQuarter, type PlanTeamGroup,
} from "@/lib/calc/planung"
import type { RosterEntry } from "@/lib/calc/struktur"
import type { UseMonthArchiveResult } from "@/hooks/useMonthArchive"
import type { UsePlanungDocResult } from "@/hooks/usePlanungDoc"
import { EinheitenUebersicht } from "@/components/sections/planung/EinheitenUebersicht"
import { readPlanUnits, sumPlanUnits } from "@/lib/calc/verguetung"
import {
  PLAN_TARGET_KEYS, PLAN_TARGET_LABELS,
  type EmployeeRow, type PlanAnnualDoc, type PlanQuarter, type PlanQuarterData, type PlanTargetKey, type PlanWeekEntry,
} from "@/types/dashboard"
import { cn } from "@/lib/utils"

const STATUS_LABELS: Record<string, string> = {
  "on-track": "✓ Im Plan",
  behind: "⚠ Rückstand",
  completed: "✓ Abgeschlossen",
  upcoming: "◷ Ausstehend",
}

const STATUS_CLASSES: Record<string, string> = {
  "on-track": "bg-[#64DDA3]/15 text-[#64DDA3]",
  behind: "bg-[#e2685b]/15 text-[#f0948a]",
  completed: "bg-[#64DDA3]/15 text-[#64DDA3]",
  upcoming: "bg-white/10 text-white/85",
}

/** Ist-Wert einer Zielkennzahl aus einer summierten Wochenzahlen-Entry. */
function actualFor(key: PlanTargetKey, entry: PlanWeekEntry): number {
  if (key === "einheiten") return entry.ehGemacht
  return entry[key]
}

function barColor(pct: number): string {
  if (pct >= 100) return "bg-[#64DDA3]"
  if (pct >= 60) return "bg-[#E7A94C]"
  return "bg-[#e2685b]"
}

const NAV_BTN = "border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
const INP = "rounded-md border outline-none focus-visible:border-[#64DDA3] focus-visible:ring-[#64DDA3]/25 focus-visible:ring-[3px] disabled:opacity-60"

export function Jahresplanung({
  managerName, people, roster, planung, isEditor, teamGroups, rows, unitsMonthKey, archive,
}: {
  archive: UseMonthArchiveResult
  /** Mitarbeiterseite (dashboard.rows): dort werden ALLE Einheiten erfasst. */
  rows: EmployeeRow[]
  /** Umsatzmonat ("YYYY-MM"), auf den sich die Einheiten in rows beziehen. */
  unitsMonthKey: string
  managerName: string
  people: RosterEntry[]
  /** Gesamter Strukturbaum (für die Team-Summen in der Einheiten-Übersicht). */
  roster: RosterEntry[]
  planung: UsePlanungDocResult
  isEditor: boolean
  teamGroups?: PlanTeamGroup[] | null
}) {
  const [year, setYear] = useState<number>(() => new Date().getFullYear())
  const stored = planung.annual(year, managerName)
  const [draft, setDraft] = useState<PlanAnnualDoc>(stored)

  // Entwurf neu aufsetzen, wenn Jahr oder Führungskraft wechselt (nicht bei
  // jedem stored-Update, sonst würden Tastatureingaben überschrieben —
  // gleiches Muster wie EmployeeEarningsDialog.tsx).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setDraft(stored) }, [year, managerName])

  const names = useMemo(() => new Set(people.map((p) => p.name)), [people])
  const weeks = useMemo(() => yearWeekKeys(year), [year])

  useEffect(() => {
    void planung.loadWeeks(weeks)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks])

  const weekDocs = weeks.map((w) => ({ key: w, doc: planung.getWeek(w) }))
  const loading = weekDocs.some((w) => w.doc === null)

  // Einheiten gemacht: nicht aus den (nur sporadisch gepflegten) Wochenplänen,
  // sondern wie auf der Mitarbeiterseite/Statistik: abgeschlossene Monate des
  // Jahres aus den Archiv-Snapshots, der laufende Umsatzmonat aus rows.
  const yearMonths = useMemo(
    () => archive.index.map((e) => e.month).filter((m) => m.startsWith(`${year}-`)),
    [archive.index, year]
  )
  useEffect(() => {
    if (yearMonths.length > 0) void archive.loadSnapshots(yearMonths)
    // archive ist je Render ein neues Objekt — nur bei Monatswechsel nachladen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearMonths])

  const unitSources = yearMonths.map((m) => ({ month: m, rows: archive.getSnapshot(m)?.rows ?? null }))
  const unitsLoading = unitSources.some((s) => s.rows === null)
  const unitEntries = useMemo(() => {
    const out: { name: string; quarter: PlanQuarter; entry: PlanWeekEntry }[] = []
    const add = (month: string, srcRows: EmployeeRow[]) => {
      const quarter = QUARTER_LIST[Math.floor((Number(month.slice(5, 7)) - 1) / 3)]
      srcRows.forEach((r) => {
        out.push({ name: r.name, quarter, entry: { ...emptyWeekEntry(), ehGemacht: sumPlanUnits(readPlanUnits(r)) } })
      })
    }
    unitSources.forEach((s) => { if (s.rows) add(s.month, s.rows) })
    if (unitsMonthKey.startsWith(`${year}-`) && !yearMonths.includes(unitsMonthKey)) add(unitsMonthKey, rows)
    return out
    // unitSources wird aus yearMonths+Snapshot-Cache abgeleitet — über unitsLoading gated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearMonths, unitsLoading, unitsMonthKey, year, rows])

  const zeroUnits = (entry: PlanWeekEntry): PlanWeekEntry => ({ ...entry, ehGemacht: 0 })

  const entriesFor = useMemo(() => {
    const byQuarter: Record<PlanQuarter, PlanWeekEntry[]> = { Q1: [], Q2: [], Q3: [], Q4: [] }
    const all: PlanWeekEntry[] = []
    weekDocs.forEach(({ key, doc }) => {
      if (!doc) return
      const q = weekToQuarter(key)
      Object.entries(doc.entries).forEach(([name, entry]) => {
        if (!names.has(name)) return
        const e = zeroUnits(entry)
        all.push(e)
        byQuarter[q].push(e)
      })
    })
    unitEntries.forEach(({ name, quarter, entry }) => {
      if (!names.has(name)) return
      all.push(entry)
      byQuarter[quarter].push(entry)
    })
    return { all, byQuarter }
    // weekDocs wird aus weeks+loading-Zustand abgeleitet — über beide gated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks, loading, names, unitEntries])

  const yearActual = useMemo(() => sumWeekEntries(entriesFor.all), [entriesFor])
  const quarterActuals = useMemo(() => {
    const out = {} as Record<PlanQuarter, PlanWeekEntry>
    QUARTER_LIST.forEach((q) => { out[q] = sumWeekEntries(entriesFor.byQuarter[q]) })
    return out
  }, [entriesFor])

  // "Nach Führungskräften"-Rollup: Jahres-Ist je Führungskraft (Team + sie
  // selbst), ergänzend zur Jahreszielsetzung oben (die bleibt an managerName
  // als Ganzes gebunden — es gibt keine eigenen Jahresziele je Unterführungskraft).
  const groupYearActuals = useMemo(() => {
    if (!teamGroups || teamGroups.length === 0) return null
    const byGroupEntries = new Map<string, PlanWeekEntry[]>(teamGroups.map((g) => [g.name, []]))
    const groupByName = new Map<string, string[]>()
    teamGroups.forEach((g) => { g.names.forEach((n) => groupByName.set(n, [...(groupByName.get(n) ?? []), g.name])) })
    weekDocs.forEach(({ doc }) => {
      if (!doc) return
      Object.entries(doc.entries).forEach(([name, entry]) => {
        const e = zeroUnits(entry)
        groupByName.get(name)?.forEach((groupKey) => byGroupEntries.get(groupKey)!.push(e))
      })
    })
    unitEntries.forEach(({ name, entry }) => {
      groupByName.get(name)?.forEach((groupKey) => byGroupEntries.get(groupKey)!.push(entry))
    })
    const out = new Map<string, PlanWeekEntry>()
    teamGroups.forEach((g) => out.set(g.name, sumWeekEntries(byGroupEntries.get(g.name) ?? [])))
    return out
    // weekDocs wird aus weeks+loading-Zustand abgeleitet — über beide gated,
    // analog zu entriesFor oben.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks, loading, teamGroups, unitEntries])

  // Änderungen werden beim Verlassen des Feldes direkt gespeichert.
  function commitTarget(key: PlanTargetKey, value: number) {
    const next = { ...draft, targets: { ...draft.targets, [key]: value } }
    setDraft(next)
    planung.saveAnnual(year, managerName, next)
  }
  function commitQuarterField(q: PlanQuarter, key: PlanTargetKey | "milestone", value: number | string) {
    const next = { ...draft, quarters: { ...draft.quarters, [q]: { ...draft.quarters[q], [key]: value } } }
    setDraft(next)
    planung.saveAnnual(year, managerName, next)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className={cn("flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3", DARK_CARD)}>
        <Button type="button" variant="ghost" size="icon" className={NAV_BTN} onClick={() => setYear((y) => y - 1)} aria-label="Vorjahr">
          ◀
        </Button>
        <div className="min-w-11 text-center text-sm font-bold">{year}</div>
        <Button type="button" variant="ghost" size="icon" className={NAV_BTN} onClick={() => setYear((y) => y + 1)} aria-label="Folgejahr">
          ▶
        </Button>
        {(loading || unitsLoading) && <span className="text-xs text-white/90">Lade Wochendaten…</span>}
      </div>

      <section className={cn("rounded-xl border p-5 shadow-sm", DARK_CARD)}>
        <h3 className="mb-4 text-xs font-bold uppercase tracking-wide text-[#64DDA3]">🎯 Jahresziele — {managerName}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {PLAN_TARGET_KEYS.map((k) => {
            const target = draft.targets[k] || 0
            const actual = actualFor(k, yearActual)
            const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0
            return (
              <div key={k} className={cn(DARK_TILE, "p-3")}>
                <div className="text-[11px] font-bold uppercase tracking-wide text-white/90">{PLAN_TARGET_LABELS[k]} Ist</div>
                <div className="mt-1 text-xl font-extrabold tabular-nums">{fmt(actual)}</div>
                <div className="mt-0.5 text-xs text-white/90">Soll: {fmt(target)} · {pct}%</div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div className={cn("h-full rounded-full", barColor(pct))} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {PLAN_TARGET_KEYS.map((k) => (
            <label key={k} className="flex flex-col gap-1 text-xs text-white/90">
              {PLAN_TARGET_LABELS[k]} Soll
              <input
                key={`${year}-${managerName}-${k}-target`}
                type="number"
                min={0}
                disabled={!isEditor}
                defaultValue={draft.targets[k] || 0}
                aria-label={`${PLAN_TARGET_LABELS[k]} Soll`}
                className={cn("h-8 px-2 text-sm tabular-nums", INP, DARK_INPUT)}
                onBlur={(e) => commitTarget(k, Number(e.target.value) || 0)}
              />
            </label>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-white/85">🏁 Quartalsmeilensteine</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {QUARTER_LIST.map((q) => {
            const qData: PlanQuarterData = draft.quarters[q]
            const actuals = quarterActuals[q]
            const target = qData.vertraege || 0
            const pct = target > 0 ? Math.min(100, Math.round((actuals.vertraege / target) * 100)) : 0
            const status = quarterStatus(q, actuals, { vertraege: target }, year)
            return (
              <div key={q} className={cn("rounded-xl border p-4 shadow-sm", DARK_CARD)}>
                <div className="mb-2.5 flex items-center gap-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#64DDA3,#3FCB8E)] text-xs font-extrabold text-[#0b1f2a]">{q}</div>
                  <div>
                    <div className="text-xs font-semibold">{Q_MONTHS[q]}</div>
                    <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_CLASSES[status])}>
                      {STATUS_LABELS[status]}
                    </span>
                  </div>
                </div>
                <input
                  key={`${year}-${managerName}-${q}-ms`}
                  type="text"
                  disabled={!isEditor}
                  defaultValue={qData.milestone || ""}
                  placeholder="Meilenstein / Schwerpunkt…"
                  aria-label={`Meilenstein ${q}`}
                  className={cn("mb-3 h-8 w-full px-2 text-sm", INP, DARK_INPUT)}
                  onBlur={(e) => commitQuarterField(q, "milestone", e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  {(["vertraege", "einheiten", "atg", "analysen"] as PlanTargetKey[]).map((k) => (
                    <label key={k} className={cn(DARK_TILE, "flex flex-col gap-1 p-2 text-[10px] font-semibold uppercase text-white/90")}>
                      {PLAN_TARGET_LABELS[k]} Soll
                      <input
                        key={`${year}-${managerName}-${q}-${k}`}
                        type="number"
                        min={0}
                        disabled={!isEditor}
                        defaultValue={qData[k] || 0}
                        aria-label={`${PLAN_TARGET_LABELS[k]} Soll ${q}`}
                        className={cn("h-7 px-1.5 text-sm normal-case tabular-nums", INP, DARK_INPUT)}
                        onBlur={(e) => commitQuarterField(q, k, Number(e.target.value) || 0)}
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-white/90">
                  <span>Verträge</span>
                  <span>{actuals.vertraege} / {target} ({pct}%)</span>
                </div>
                <MintBar pct={pct} className="mt-1" />
                <div className="mt-3 flex flex-wrap gap-3 border-t border-white/10 pt-3">
                  {[
                    { label: "Wählversuche Ist", value: actuals.atg },
                    { label: "AT Ist", value: actuals.analysen },
                    { label: "BT Ist", value: actuals.beratungen },
                    { label: "Einheiten Ist", value: actuals.ehGemacht },
                  ].map((item) => (
                    <div key={item.label} className="flex flex-col items-center gap-0.5">
                      <div className="text-sm font-bold tabular-nums">{fmt(item.value)}</div>
                      <div className="text-[9px] font-semibold uppercase text-white/90">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <EinheitenUebersicht
        managerName={managerName}
        people={people}
        roster={roster}
        year={year}
        archive={archive}
        rows={rows}
        unitsMonthKey={unitsMonthKey}
      />

      {groupYearActuals && (
        <section>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-white/85">👥 Jahres-Ist nach Führungskraft — {year}</h3>
          <div className={cn(DARK_TABLE.wrap, DARK_CARD)}>
            <table className={cn("min-w-[700px]", DARK_TABLE.table)}>
              <thead>
                <tr>
                  <th className={DARK_TABLE.head}>Führungskraft</th>
                  {PLAN_TARGET_KEYS.map((k) => (
                    <th key={k} className={cn(DARK_TABLE.head, "text-right")}>{PLAN_TARGET_LABELS[k]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamGroups!.map((g) => {
                  const a = groupYearActuals.get(g.name) ?? sumWeekEntries([])
                  return (
                    <tr key={g.name} className={DARK_TABLE.row}>
                      <td className="px-3 py-2">
                        <div className="truncate text-sm font-semibold">{g.name}</div>
                        <div className="truncate text-xs text-white/90">{g.role} · Team gesamt ({g.names.length})</div>
                      </td>
                      {PLAN_TARGET_KEYS.map((k) => (
                        <td key={k} className="px-3 py-2 text-right tabular-nums">{fmt(actualFor(k, a))}</td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
