// Mitarbeiter-Sektion — Äquivalent zu section-team aus legacy/index.html:1721–1764.
// Die Personenliste wird seit dem Strukturbaum-Umbau vollständig aus dem
// Strukturbaum gespiegelt (analog zur Anwesenheitsliste, die sbAll(orgTree)
// nutzt) — Anlegen/Entfernen von Personen passiert nur noch im Strukturbaum.
// Leistungszahlen bleiben in dashboard.rows (localStorage + Cloud-Push wie im
// Original, siehe useDashboardDoc) und werden per Name mit dem Baum verknüpft
// (mergeRosterWithRows aus src/lib/calc/team.ts, golden-master-getestet).
import { useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { fmt, fmtEur, initials, monthWeekProgress, pctOf, progressClass, type EmployeeRow, type TeamGoal } from "@/lib/calc/format"
import {
  getMergedFilteredSorted, leadRosterOptions, mergeRosterWithRows, newRowFor, rowHighlight, teamTotals,
  type MergedRow, type TeamFilter, type TeamSort,
} from "@/lib/calc/team"
import { aggregateByName, periodWeekKeys } from "@/lib/calc/planung"
import { SB_LEAD_ROLE_ABBR, sbRoster, sbSubtreeNames, type PlanId, type SbNode } from "@/lib/calc/struktur"
import { computeEarnings, stornoreserveAmount, withPlanUnits } from "@/lib/calc/verguetung"
import { EmployeeEarningsDialog } from "@/components/sections/team/EmployeeEarningsDialog"
import type { UsePlanungDocResult } from "@/hooks/usePlanungDoc"
import type { PlanWeekDoc } from "@/types/dashboard"
import { cn } from "@/lib/utils"

/** Anteil der Vergütung, der als Stornoreserve einbehalten und nicht ausgezahlt wird. */
const STORNORESERVE_RATE = 0.15

function NumField({
  row, field, wide, isEditor, onCommit,
}: {
  row: MergedRow
  field: "atPlan" | "btPlan" | "stPlan" | "etPlan" | "soll"
  wide?: boolean
  isEditor: boolean
  onCommit: (row: MergedRow, field: string, value: number) => void
}) {
  return (
    <input
      key={`${row.rowIndex}-${row.name}-${field}-${row[field]}`}
      type="number"
      disabled={!isEditor}
      defaultValue={Number(row[field] || 0)}
      aria-label={`${String(field)} – ${row.name}`}
      className={cn(
        "h-8 rounded-md border border-input bg-background px-2 text-sm tabular-nums shadow-xs outline-none",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "disabled:opacity-60",
        wide ? "w-20" : "w-16"
      )}
      onBlur={(e) => onCommit(row, field, Number(e.target.value) || 0)}
    />
  )
}

/** Read-only Anzeige für Ist AT/BT/ET — seit der Wochenplanung-Automatik (siehe
 * Team.tsx planByName unten) keine Eingabefelder mehr, damit Werte nicht
 * doppelt (händisch + Wochenplanung) erfasst werden. */
function ComputedField({ value }: { value: number | undefined; wide?: boolean; narrow?: boolean }) {
  return (
    <div
      className="text-center text-sm tabular-nums"
      title="Automatisch aus der Wochenplanung übernommen (Summe der Wochen im aktuellen Umsatzmonat)"
    >
      {fmt(value)}
    </div>
  )
}

export function Team({
  rows,
  saveRows,
  teamGoal,
  orgTree,
  orgPlanRates,
  isEditor,
  now,
  planung,
}: {
  rows: EmployeeRow[]
  saveRows: (next: EmployeeRow[]) => void
  teamGoal: TeamGoal
  orgTree: SbNode
  orgPlanRates: Record<PlanId, Record<string, number>>
  isEditor: boolean
  /** Referenzzeitpunkt für monthWeekProgress — im Archiv-Modus ein Tag nach
   * periodEnd (siehe archiveNow() in lib/calc/archive.ts), damit die
   * Rot/Grün-Einfärbung gegen den vollen Monatsplan bewertet statt gegen einen
   * wochenanteiligen Stand zum heutigen Datum. Live per Default new Date(). */
  now?: Date
  /** Wochenplanung-Zugriff für die automatische Ist-AT/BT/ET-Übernahme.
   * undefined im Archiv-Modus — dort bleiben die eingefrorenen Row-Werte
   * (Stand Monatsabschluss) sichtbar statt einer Live-Neuberechnung. */
  planung?: UsePlanungDocResult
}) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<TeamFilter>("all")
  const [sort, setSort] = useState<TeamSort>("name")
  const [detailName, setDetailName] = useState<string | null>(null)
  const [stornoreserve, setStornoreserve] = useState(false)
  const reserveRate = stornoreserve ? STORNORESERVE_RATE : 0
  const [managerFilter, setManagerFilter] = useState<string | null>(null)

  const roster = useMemo(() => sbRoster(orgTree), [orgTree])
  const rosterMerged = useMemo(() => mergeRosterWithRows(roster, rows), [roster, rows])

  // Ist AT/BT/ET automatisch aus der Wochenplanung übernehmen (Summe der
  // Gemacht-Werte "analysen"/"beratungen"/"etg" über alle Wochen des aktuell
  // eingestellten Umsatzmonats — AT=Analysen, BT=Beratungen, ET=Einstellungs-
  // termine, siehe Nutzerangabe) — dadurch entfällt die doppelte Erfassung
  // auf der Mitarbeiterseite. Nur live (planung gesetzt); im Archiv-Modus
  // bleiben die zum Monatsabschluss eingefrorenen Row-Werte unverändert.
  //
  // Bewusst ohne useMemo für planByName/merged: Team.tsx bleibt (anders als
  // z.B. Monatsplanung.tsx) dauerhaft gemountet, auch während auf der
  // Controlling-Seite Wochenplanung-Werte eingegeben werden (App.tsx zeigt
  // Sektionen nur per CSS "hidden" an/aus, unmountet sie nicht). Ein
  // useMemo mit fester Dependency-Liste hätte hier den ersten (meist noch
  // ungeladenen) Stand eingefroren und nie neu aus dem Wochenplanung-Cache
  // nachgezogen — die Berechnung ist für die paar Personen/Wochen aber
  // billig genug, um bei jedem Render einfach neu zu laufen.
  const planWeeks = planung ? periodWeekKeys(teamGoal.periodStart, teamGoal.periodEnd) : []
  useEffect(() => {
    if (!planung || planWeeks.length === 0) return
    void planung.loadWeeks(planWeeks)
    // planWeeks ist ein neues Array je Render — über die Key-Liste gated,
    // damit loadWeeks nicht bei jedem Render erneut angestoßen wird.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planung, planWeeks.join(",")])
  const planByName = planung
    ? aggregateByName(
        planWeeks.map((w) => planung.getWeek(w)).filter((d): d is PlanWeekDoc => d !== null),
        roster.map((r) => r.name)
      )
    : null
  const merged = planByName
    ? rosterMerged.map((r) => {
        const p = planByName.get(r.name)
        // Zuordnung nach Nutzerangabe: AT = Analysen, BT = Beratungen, ST = Strukturtermine, ET = Einstellungstermine (jeweils "Gemacht").
        return { ...r, atPlan: p?.analysenZ ?? 0, btPlan: p?.beratungenZ ?? 0, stPlan: p?.stz ?? 0, etPlan: p?.etz ?? 0, atIst: p?.analysen ?? 0, btIst: p?.beratungen ?? 0, stIst: p?.stg ?? 0, etIst: p?.etg ?? 0 }
      })
    : rosterMerged
  const managerOptions = useMemo(() => leadRosterOptions(roster), [roster])
  const managerNames = useMemo(
    () => (managerFilter ? sbSubtreeNames(orgTree, managerFilter) : null),
    [managerFilter, orgTree]
  )
  const list = useMemo(() => {
    const base = getMergedFilteredSorted(merged, search, filter, sort)
    return managerNames ? base.filter((r) => managerNames.has(r.name)) : base
  }, [merged, search, filter, sort, managerNames])
  const wp = monthWeekProgress(teamGoal, now ?? new Date())
  const totals = teamTotals(list)
  const earnings = useMemo(() => computeEarnings(merged, orgPlanRates), [merged, orgPlanRates])
  const grandTotalEur = useMemo(
    () => list.reduce((s, r) => {
      const e = earnings.get(r.name)
      return s + (e ? e.total - stornoreserveAmount(e, reserveRate) : 0)
    }, 0),
    [list, earnings, reserveRate]
  )
  const detailEntry = detailName ? merged.find((r) => r.name === detailName) ?? null : null
  const detailEarnings = detailName ? earnings.get(detailName) ?? null : null

  function commitField(entry: MergedRow, field: string, value: number | string) {
    if (entry.rowIndex !== null) {
      const next = rows.map((r, i) => (i === entry.rowIndex ? { ...r, [field]: value } : r))
      saveRows(next)
    } else {
      saveRows([...rows, { ...newRowFor(entry.name), [field]: value }])
    }
  }

  function saveEarnings(entry: MergedRow, units: Record<PlanId, number>, bonus: number) {
    if (entry.rowIndex !== null) {
      const next = rows.map((r, i) => (i === entry.rowIndex ? { ...withPlanUnits(r, units), bonus } : r))
      saveRows(next)
    } else {
      saveRows([...rows, { ...withPlanUnits(newRowFor(entry.name), units), bonus }])
    }
  }

  function toggleNew(entry: MergedRow) {
    if (entry.rowIndex !== null) {
      const next = rows.map((r, i) => {
        if (i !== entry.rowIndex) return r
        const isNew = !r.isNew
        const joinDate = isNew && !r.joinDate ? new Date().toISOString().slice(0, 10) : r.joinDate
        return { ...r, isNew, joinDate }
      })
      saveRows(next)
    } else {
      saveRows([...rows, { ...newRowFor(entry.name), isNew: true, joinDate: new Date().toISOString().slice(0, 10) }])
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Mitarbeiter-Übersicht{" "}
          <span className="ml-2 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {list.length === merged.length ? `${merged.length} Mitarbeiter` : `${list.length} von ${merged.length} Mitarbeitern`}
          </span>
        </h2>
      </div>

      <p className="text-xs text-muted-foreground">
        Die Liste wird aus dem Strukturbaum gespiegelt (Personen mit Status „Kommt vielleicht" werden ausgeblendet).
        Personen fügst du im Strukturbaum hinzu oder entfernst sie dort. Ist AT/BT/ET wird automatisch aus der
        Wochenplanung des aktuellen Umsatzmonats übernommen — keine doppelte Eingabe mehr nötig.
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={stornoreserve}
          onClick={() => setStornoreserve((v) => !v)}
          className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs"
          title="Zieht 15 % Stornoreserve von der Insurance-Vergütung ab (Investment, Kredit, Immobilien sind stornofrei)"
        >
          <span className={cn("relative inline-block h-5 w-9 rounded-full transition-colors", stornoreserve ? "bg-primary" : "bg-muted-foreground/30")}>
            <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", stornoreserve ? "left-[18px]" : "left-0.5")} />
          </span>
          Stornoreserve (15 %)
        </button>
        <Input
          placeholder="Name suchen…"
          aria-label="Mitarbeiter nach Name suchen"
          className="w-56"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select aria-label="Mitarbeiter filtern" value={filter} onChange={(e) => setFilter(e.target.value as TeamFilter)} className="w-48">
          <option value="all">Alle Mitarbeiter</option>
          <option value="new">Nur neue MA</option>
          <option value="existing">Nur bestehendes Team</option>
        </Select>
        <Select aria-label="Mitarbeiter sortieren" value={sort} onChange={(e) => setSort(e.target.value as TeamSort)} className="w-64">
          <option value="name">Sortieren: Name (A–Z)</option>
          <option value="manager">Nach Führungskraft (Struktur)</option>
          <option value="progress-desc">Fortschritt (hoch → niedrig)</option>
          <option value="progress-asc">Fortschritt (niedrig → hoch)</option>
          <option value="einheiten-desc">Einheiten Ist (absteigend)</option>
        </Select>
      </div>

      {managerOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Schnellfilter Führungskraft:</span>
          <button
            type="button"
            onClick={() => setManagerFilter(null)}
            aria-pressed={managerFilter === null}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
              managerFilter === null ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
            )}
          >
            Alle
          </button>
          {managerOptions.map((m) => (
            <button
              key={m.name}
              type="button"
              onClick={() => setManagerFilter((cur) => (cur === m.name ? null : m.name))}
              aria-pressed={managerFilter === m.name}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
                managerFilter === m.name ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
              )}
            >
              {m.name}
              <span className="ml-1 opacity-70">({SB_LEAD_ROLE_ABBR[m.role] ?? m.role})</span>
            </button>
          ))}
        </div>
      )}

      <div className="max-h-[65vh] overflow-auto rounded-lg border">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
              <th className="sticky top-0 z-10 min-w-[300px] bg-muted/95 px-3 py-2 backdrop-blur">Name</th>
              <th className="sticky top-0 z-10 bg-muted/95 px-3 py-2 backdrop-blur border-l border-foreground/20">Status</th>
              {(["Plan", "Ist"] as const).flatMap((g) =>
                (["AT", "BT", "ST", "ET"] as const).map((k) => (
                  <th
                    key={`${g}-${k}`}
                    className={`sticky top-0 z-10 ${g === "Plan" ? "bg-sky-200 dark:bg-sky-900" : "bg-amber-200 dark:bg-amber-900"} px-1 py-1.5 text-center leading-tight backdrop-blur border-l border-foreground/20`}
                    title={g === "Ist" ? "Wird automatisch aus der Wochenplanung übernommen" : undefined}
                  >
                    {g}<br />{k}
                  </th>
                )),
              )}
              <th className="sticky top-0 z-10 bg-muted/95 px-3 py-2 backdrop-blur border-l border-foreground/20">Soll</th>
              <th className="sticky top-0 z-10 bg-muted/95 px-3 py-2 backdrop-blur border-l border-foreground/20">Ist</th>
              <th className="sticky top-0 z-10 bg-muted/95 px-3 py-2 backdrop-blur border-l border-foreground/20">Fortschritt</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {merged.length === 0 ? "Noch keine Personen im Strukturbaum erfasst." : "Keine Mitarbeiter entsprechen der Suche/Filterung."}
                </td>
              </tr>
            ) : (
              list.map((r) => {
                const pct = pctOf(r)
                const highlight = rowHighlight(r, wp)
                const rowEarnings = earnings.get(r.name)
                const indent = sort === "manager" ? r.depth * 14 : 0
                return (
                  <tr
                    key={`${r.rowIndex}-${r.name}`}
                    className={cn(
                      "border-b border-foreground/20 last:border-0",
                      highlight === "at-above" && "bg-emerald-50 dark:bg-emerald-950/30",
                      highlight === "at-below" && "bg-red-50 dark:bg-red-950/30"
                    )}
                  >
                    <td className="px-3 py-2" style={{ paddingLeft: 12 + indent }}>
                      <div className="flex items-center gap-3">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold">
                          {initials(r.name as string)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{r.name}</div>
                          {(r.role || r.managerName) && (
                            <div className="truncate text-xs text-muted-foreground">
                              {r.role}
                              {r.managerName ? ` · unter ${r.managerName}` : ""}
                            </div>
                          )}
                        </div>
                        {rowEarnings && rowEarnings.total > 0 ? (
                          <button
                            type="button"
                            onClick={() => setDetailName(r.name)}
                            aria-label={`Verdienst-Details – ${r.name}`}
                            className="shrink-0 whitespace-nowrap text-sm font-medium tabular-nums underline decoration-dotted underline-offset-2 hover:text-foreground"
                          >
                            {fmtEur(rowEarnings.total - stornoreserveAmount(rowEarnings, reserveRate))} €
                          </button>
                        ) : (
                          <span className="shrink-0 text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="border-l border-foreground/20 px-3 py-2">
                      <button
                        type="button"
                        disabled={!isEditor}
                        onClick={() => toggleNew(r)}
                        aria-pressed={!!r.isNew}
                        aria-label={`Status ${r.name}: ${r.isNew ? "Neu" : "Bestand"}, umschalten`}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-60",
                          r.isNew ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {r.isNew ? "NEU" : "Bestand"}
                      </button>
                    </td>
                    <td className="bg-sky-100 dark:bg-sky-950 border-l border-foreground/20 px-1 py-2 text-center"><ComputedField narrow value={r.atPlan} /></td>
                    <td className="bg-sky-100 dark:bg-sky-950 border-l border-foreground/20 px-1 py-2 text-center"><ComputedField narrow value={r.btPlan} /></td>
                    <td className="bg-sky-100 dark:bg-sky-950 border-l border-foreground/20 px-1 py-2 text-center"><ComputedField narrow value={r.stPlan} /></td>
                    <td className="bg-sky-100 dark:bg-sky-950 border-l border-foreground/20 px-1 py-2 text-center"><ComputedField narrow value={r.etPlan} /></td>
                    <td className="bg-amber-100 dark:bg-amber-950 border-l border-foreground/20 px-1 py-2 text-center"><ComputedField narrow value={r.atIst} /></td>
                    <td className="bg-amber-100 dark:bg-amber-950 border-l border-foreground/20 px-1 py-2 text-center"><ComputedField narrow value={r.btIst} /></td>
                    <td className="bg-amber-100 dark:bg-amber-950 border-l border-foreground/20 px-1 py-2 text-center"><ComputedField narrow value={r.stIst} /></td>
                    <td className="bg-amber-100 dark:bg-amber-950 border-l border-foreground/20 px-1 py-2 text-center"><ComputedField narrow value={r.etIst} /></td>
                    <td className="border-l border-foreground/20 px-2 py-2"><NumField row={r} field="soll" wide isEditor={isEditor} onCommit={commitField} /></td>
                    <td className="border-l border-foreground/20 px-2 py-2">
                      <button
                        type="button"
                        onClick={() => setDetailName(r.name)}
                        aria-label={`Einheiten-Details – ${r.name}`}
                        className="h-8 w-20 rounded-md border border-transparent px-2 text-right text-sm font-medium tabular-nums underline decoration-dotted underline-offset-2 hover:border-input hover:bg-muted"
                      >
                        {fmt(r.ist)}
                      </button>
                    </td>
                    <td className="border-l border-foreground/20 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              progressClass(pct) === "low" ? "bg-red-500" : progressClass(pct) === "high" ? "bg-emerald-500" : "bg-primary"
                            )}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium tabular-nums">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
          {list.length > 0 && (
            <tfoot>
              <tr className="text-sm">
                {(() => {
                  const cell = "sticky bottom-0 z-10 border-t-2 border-t-foreground/70 bg-[#DFF7EC] px-2 py-2.5 font-bold tabular-nums"
                  return (
                    <>
                      <td className={cn(cell, "px-3")}>
                        <div className="flex items-center justify-between gap-3">
                          <span>Summe</span>
                          <span className="whitespace-nowrap">{fmtEur(grandTotalEur)} €</span>
                        </div>
                      </td>
                      <td className={cn(cell, "border-l border-foreground/20")} />
                      <td className={cn(cell, "bg-sky-100 dark:bg-sky-950 text-center border-l border-foreground/20")}>{fmt(totals.atPlan)}</td>
                      <td className={cn(cell, "bg-sky-100 dark:bg-sky-950 text-center border-l border-foreground/20")}>{fmt(totals.btPlan)}</td>
                      <td className={cn(cell, "bg-sky-100 dark:bg-sky-950 text-center border-l border-foreground/20")}>{fmt(totals.stPlan)}</td>
                      <td className={cn(cell, "bg-sky-100 dark:bg-sky-950 text-center border-l border-foreground/20")}>{fmt(totals.etPlan)}</td>
                      <td className={cn(cell, "bg-amber-100 dark:bg-amber-950 text-center border-l border-foreground/20")}>{fmt(totals.atIst)}</td>
                      <td className={cn(cell, "bg-amber-100 dark:bg-amber-950 text-center border-l border-foreground/20")}>{fmt(totals.btIst)}</td>
                      <td className={cn(cell, "bg-amber-100 dark:bg-amber-950 text-center border-l border-foreground/20")}>{fmt(totals.stIst)}</td>
                      <td className={cn(cell, "bg-amber-100 dark:bg-amber-950 text-center border-l border-foreground/20")}>{fmt(totals.etIst)}</td>
                      <td className={cn(cell, "border-l border-foreground/20")}>{fmt(totals.soll)}</td>
                      <td className={cn(cell, "border-l border-foreground/20")}>{fmt(totals.ist)}</td>
                      <td className={cn(cell, "border-l border-foreground/20")} />
                    </>
                  )
                })()}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {detailEntry && detailEarnings && (
        <EmployeeEarningsDialog
          open={!!detailName}
          onOpenChange={(open) => !open && setDetailName(null)}
          name={detailEntry.name}
          role={detailEntry.role}
          earnings={detailEarnings}
          stornoreserveRate={reserveRate}
          isEditor={isEditor}
          onSave={(units, bonus) => saveEarnings(detailEntry, units, bonus)}
        />
      )}
    </div>
  )
}
