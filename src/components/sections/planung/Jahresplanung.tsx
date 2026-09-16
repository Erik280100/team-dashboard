// Jahresplanung — Jahresziele + Quartalsmeilensteine je Führungskraft. Vorbild
// Finova_Controlling.html:2974-3075 (renderJahresplanung), "Umsatz €" durch
// Einheiten ersetzt (siehe defaultAnnual in lib/calc/planung.ts). Die
// "Team-Bewertungsübersicht" (Ratings) wird bewusst NICHT übernommen — sie
// hängt an Mitarbeiter-Notizen außerhalb der drei Planungsbereiche.
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { fmt } from "@/lib/calc/format"
import {
  QUARTER_LIST, Q_MONTHS, quarterStatus, sumWeekEntries, yearWeekKeys, weekToQuarter, type PlanTeamGroup,
} from "@/lib/calc/planung"
import type { RosterEntry } from "@/lib/calc/struktur"
import type { UsePlanungDocResult } from "@/hooks/usePlanungDoc"
import {
  PLAN_TARGET_KEYS, PLAN_TARGET_LABELS,
  type PlanAnnualDoc, type PlanQuarter, type PlanQuarterData, type PlanTargetKey, type PlanWeekEntry,
} from "@/types/dashboard"
import { cn } from "@/lib/utils"

const STATUS_LABELS: Record<string, string> = {
  "on-track": "✓ Im Plan",
  behind: "⚠ Rückstand",
  completed: "✓ Abgeschlossen",
  upcoming: "◷ Ausstehend",
}

const STATUS_CLASSES: Record<string, string> = {
  "on-track": "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  behind: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  upcoming: "bg-muted text-muted-foreground",
}

/** Ist-Wert einer Zielkennzahl aus einer summierten Wochenzahlen-Entry. */
function actualFor(key: PlanTargetKey, entry: PlanWeekEntry): number {
  if (key === "einheiten") return entry.ehGemacht
  return entry[key]
}

function barColor(pct: number): string {
  if (pct >= 100) return "bg-emerald-500"
  if (pct >= 60) return "bg-amber-500"
  return "bg-red-500"
}

export function Jahresplanung({
  managerName, people, planung, isEditor, teamGroups,
}: {
  managerName: string
  people: RosterEntry[]
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

  const entriesFor = useMemo(() => {
    const byQuarter: Record<PlanQuarter, PlanWeekEntry[]> = { Q1: [], Q2: [], Q3: [], Q4: [] }
    const all: PlanWeekEntry[] = []
    weekDocs.forEach(({ key, doc }) => {
      if (!doc) return
      const q = weekToQuarter(key)
      Object.entries(doc.entries).forEach(([name, entry]) => {
        if (!names.has(name)) return
        all.push(entry)
        byQuarter[q].push(entry)
      })
    })
    return { all, byQuarter }
    // weekDocs wird aus weeks+loading-Zustand abgeleitet — über beide gated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks, loading, names])

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
        groupByName.get(name)?.forEach((groupKey) => byGroupEntries.get(groupKey)!.push(entry))
      })
    })
    const out = new Map<string, PlanWeekEntry>()
    teamGroups.forEach((g) => out.set(g.name, sumWeekEntries(byGroupEntries.get(g.name) ?? [])))
    return out
    // weekDocs wird aus weeks+loading-Zustand abgeleitet — über beide gated,
    // analog zu entriesFor oben.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks, loading, teamGroups])

  function commitTarget(key: PlanTargetKey, value: number) {
    setDraft((d) => ({ ...d, targets: { ...d.targets, [key]: value } }))
  }
  function commitQuarterField(q: PlanQuarter, key: PlanTargetKey | "milestone", value: number | string) {
    setDraft((d) => ({ ...d, quarters: { ...d.quarters, [q]: { ...d.quarters[q], [key]: value } } }))
  }
  function save() {
    planung.saveAnnual(year, managerName, draft)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="icon" onClick={() => setYear((y) => y - 1)} aria-label="Vorjahr">
          ◀
        </Button>
        <div className="min-w-11 text-center text-sm font-medium">{year}</div>
        <Button type="button" variant="outline" size="icon" onClick={() => setYear((y) => y + 1)} aria-label="Folgejahr">
          ▶
        </Button>
        {loading && <span className="text-xs text-muted-foreground">Lade Wochendaten…</span>}
        {isEditor && (
          <Button type="button" size="sm" className="ml-auto" onClick={save}>💾 Speichern</Button>
        )}
      </div>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">🎯 Jahresziele — {managerName}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {PLAN_TARGET_KEYS.map((k) => {
            const target = draft.targets[k] || 0
            const actual = actualFor(k, yearActual)
            const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0
            return (
              <div key={k} className="rounded-lg border bg-muted/30 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{PLAN_TARGET_LABELS[k]}</div>
                <div className="mt-1 font-mono text-xl font-medium tabular-nums">{fmt(actual)}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">Ziel: {fmt(target)} · {pct}%</div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", barColor(pct))} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {PLAN_TARGET_KEYS.map((k) => (
            <label key={k} className="flex flex-col gap-1 text-xs text-muted-foreground">
              {PLAN_TARGET_LABELS[k]} Ziel
              <input
                key={`${year}-${managerName}-${k}-target`}
                type="number"
                min={0}
                disabled={!isEditor}
                defaultValue={draft.targets[k] || 0}
                aria-label={`${PLAN_TARGET_LABELS[k]} Ziel`}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-60"
                onBlur={(e) => commitTarget(k, Number(e.target.value) || 0)}
              />
            </label>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">🏁 Quartalsmeilensteine</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {QUARTER_LIST.map((q) => {
            const qData: PlanQuarterData = draft.quarters[q]
            const actuals = quarterActuals[q]
            const target = qData.vertraege || 0
            const pct = target > 0 ? Math.min(100, Math.round((actuals.vertraege / target) * 100)) : 0
            const status = quarterStatus(q, actuals, { vertraege: target }, year)
            return (
              <div key={q} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="mb-2.5 flex items-center gap-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-extrabold text-primary-foreground">{q}</div>
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
                  className="mb-3 h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-60"
                  onBlur={(e) => commitQuarterField(q, "milestone", e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  {(["vertraege", "einheiten", "atg", "analysen"] as PlanTargetKey[]).map((k) => (
                    <label key={k} className="flex flex-col gap-1 rounded-md border bg-muted/30 p-2 text-[10px] font-semibold uppercase text-muted-foreground">
                      {PLAN_TARGET_LABELS[k]}-Ziel
                      <input
                        key={`${year}-${managerName}-${q}-${k}`}
                        type="number"
                        min={0}
                        disabled={!isEditor}
                        defaultValue={qData[k] || 0}
                        aria-label={`${PLAN_TARGET_LABELS[k]}-Ziel ${q}`}
                        className="h-7 rounded border border-input bg-background px-1.5 text-sm normal-case tabular-nums text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-60"
                        onBlur={(e) => commitQuarterField(q, k, Number(e.target.value) || 0)}
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                  <span>Verträge</span>
                  <span>{actuals.vertraege} / {target} ({pct}%)</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-3 flex flex-wrap gap-3 border-t pt-3">
                  {[
                    { label: "ATG ist", value: actuals.atg },
                    { label: "Analysen ist", value: actuals.analysen },
                    { label: "Beratungen ist", value: actuals.beratungen },
                    { label: "Einheiten ist", value: actuals.ehGemacht },
                  ].map((item) => (
                    <div key={item.label} className="flex flex-col items-center gap-0.5">
                      <div className="font-mono text-sm font-medium">{fmt(item.value)}</div>
                      <div className="text-[9px] font-semibold uppercase text-muted-foreground">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {groupYearActuals && (
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">👥 Jahres-Ist nach Führungskraft — {year}</h3>
          <div className="overflow-auto rounded-lg border">
            <table className="w-full min-w-[700px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
                  <th className="px-3 py-2">Führungskraft</th>
                  {PLAN_TARGET_KEYS.map((k) => (
                    <th key={k} className="px-3 py-2 text-right">{PLAN_TARGET_LABELS[k]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamGroups!.map((g) => {
                  const a = groupYearActuals.get(g.name) ?? sumWeekEntries([])
                  return (
                    <tr key={g.name} className="border-b border-foreground/20 last:border-0">
                      <td className="px-3 py-2">
                        <div className="truncate text-sm font-medium">{g.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{g.role} · Team gesamt ({g.names.length})</div>
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
