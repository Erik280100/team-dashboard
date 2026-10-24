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
import {
  DARK_CARD, DARK_INPUT, DARK_OPTION, DARK_SELECT, DARK_TABLE, MintBar, Pill, SectionHero, Switch,
} from "@/components/ui/dark"
import { Avatar } from "@/components/Avatar"
import { fmt, fmtEur, monthWeekProgress, pctOf, progressClass, type EmployeeRow, type TeamGoal } from "@/lib/calc/format"
import {
  getMergedFilteredSorted, leadRosterOptions, mergeRosterWithRows, newRowFor, rowHighlight, teamTotals,
  type MergedRow, type TeamFilter, type TeamSort,
} from "@/lib/calc/team"
import { aggregateByName, monthWeekKeys } from "@/lib/calc/planung"
import { monthKeyOf } from "@/lib/calc/archive"
import { SB_LEAD_ROLE_ABBR, sbRoster, sbSubtreeNames, type PlanId, type SbNode } from "@/lib/calc/struktur"
import { computeEarnings, stornoreserveAmount, withUnitsAdjustingCareer } from "@/lib/calc/verguetung"
import { EmployeeEarningsDialog } from "@/components/sections/team/EmployeeEarningsDialog"
import type { UsePlanungDocResult } from "@/hooks/usePlanungDoc"
import type { PlanWeekDoc } from "@/types/dashboard"
import { cn } from "@/lib/utils"

/** Anteil der Vergütung, der als Stornoreserve einbehalten und nicht ausgezahlt wird. */
const STORNORESERVE_RATE = 0.15

/** Read-only Anzeige für Ist AT/BT/ET — seit der Wochenplanung-Automatik (siehe
 * Team.tsx planByName unten) keine Eingabefelder mehr, damit Werte nicht
 * doppelt (händisch + Wochenplanung) erfasst werden. */
function ComputedField({ value, title }: { value: number | undefined; title?: string }) {
  return (
    <div
      className="text-center text-sm tabular-nums"
      title={title ?? "Automatisch aus der Wochenplanung übernommen (Summe der Wochen im aktuellen Monat)"}
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
  canEditRow = () => true,
  noBonusFor,
  now,
  planung,
  avatars,
  myName,
}: {
  /** Name des eingeloggten Nutzers — Führungskräfte werden darauf vorgefiltert. */
  myName?: string
  rows: EmployeeRow[]
  saveRows: (next: EmployeeRow[]) => void
  teamGoal: TeamGoal
  orgTree: SbNode
  orgPlanRates: Record<PlanId, Record<string, number>>
  isEditor: boolean
  /** Darf der Betrachter die Daten dieser Person bearbeiten (sie selbst oder Vorgesetzte)? Alle anderen Zeilen
   * sind schreibgeschützt und zeigen AT/BT/ST/ET aus den Monatssummen statt aus der (nicht lesbaren) Planung. */
  canEditRow?: (name: string) => boolean
  /** Profilbilder je Name (nur Personen mit Bild); alle anderen zeigen ihre Initialen. */
  avatars?: Record<string, { id: string; version: number }>
  /** Person, deren Bonus der Betrachter nicht setzen darf (er selbst, ausser Admin) — firestore.rules. */
  noBonusFor?: string
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
  const planWeeks = planung ? monthWeekKeys(monthKeyOf(teamGoal)) : []
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
  // Soll (Einheiten) = Einheitenziel aus den Monatsplanung-Kacheln des Umsatzmonats.
  const zielDoc = planung ? planung.getMonthNotes(monthKeyOf(teamGoal)) : null
  const merged = planByName
    ? rosterMerged.map((r) => {
        if (!canEditRow(r.name)) return r // fremde Person: Werte stammen aus den Monatssummen (App.tsx)
        const p = planByName.get(r.name)
        // Zuordnung nach Nutzerangabe: AT = Analysen, BT = Beratungen, ST = Strukturtermine, ET = Einstellungstermine (jeweils "Gemacht").
        return { ...r, soll: Number(zielDoc?.entries[r.name]?.ehZiel) || 0, atPlan: p?.analysenZ ?? 0, btPlan: p?.beratungenZ ?? 0, stPlan: p?.stz ?? 0, etPlan: p?.etz ?? 0, atIst: p?.analysen ?? 0, btIst: p?.beratungen ?? 0, stIst: p?.stg ?? 0, etIst: p?.etg ?? 0 }
      })
    : rosterMerged
  const managerOptions = useMemo(() => leadRosterOptions(roster), [roster])
  // Führungskräfte landen direkt auf ihrem eigenen Filter; Trainees (und alle
  // anderen) sehen "Alle". Einmalig, sobald Name und Strukturbaum geladen sind,
  // damit eine spätere manuelle Auswahl nicht überschrieben wird.
  const [defaultFilterApplied, setDefaultFilterApplied] = useState(false)
  useEffect(() => {
    if (defaultFilterApplied || !myName || managerOptions.length === 0) return
    setDefaultFilterApplied(true)
    if (managerOptions.some((m) => m.name === myName)) setManagerFilter(myName)
  }, [defaultFilterApplied, myName, managerOptions])
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

  function saveEarnings(entry: MergedRow, units: Record<PlanId, number>, bonus?: number) {
    const bonusPart = bonus === undefined ? {} : { bonus }
    if (entry.rowIndex !== null) {
      const next = rows.map((r, i) => (i === entry.rowIndex ? { ...withUnitsAdjustingCareer(r, units), ...bonusPart } : r))
      saveRows(next)
    } else {
      saveRows([...rows, { ...withUnitsAdjustingCareer(newRowFor(entry.name), units), ...bonusPart }])
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

  const th = DARK_TABLE.head
  const groupHead = "px-1 py-1.5 text-center text-[11px] font-bold uppercase leading-tight tracking-wide"

  return (
    <div className="flex flex-col gap-4">
      <SectionHero
        eyebrow="Team"
        title="Mitarbeiter-Übersicht"
        badge={list.length === merged.length ? `${merged.length} Mitarbeiter` : `${list.length} von ${merged.length}`}
        description={
          <>
            Die Liste wird aus dem Strukturbaum gespiegelt (Personen mit Status „Kommt vielleicht" werden ausgeblendet).
            Personen fügst du im Strukturbaum hinzu oder entfernst sie dort. Ist AT/BT/ET wird automatisch aus der
            Wochenplanung des aktuellen Monats übernommen — keine doppelte Eingabe mehr nötig.
          </>
        }
      />

      <div className={cn("flex flex-col gap-3 rounded-xl border p-4", DARK_CARD)}>
        <div className="flex flex-wrap gap-3">
          <Switch
            checked={stornoreserve}
            onChange={setStornoreserve}
            title="Zieht 15 % Stornoreserve von der Insurance-Vergütung ab (Investment, Kredit, Immobilien sind stornofrei)"
          >
            Stornoreserve (15 %)
          </Switch>
          <Input
            placeholder="Name suchen…"
            aria-label="Mitarbeiter nach Name suchen"
            className={cn("w-56", DARK_INPUT)}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select aria-label="Mitarbeiter filtern" value={filter} onChange={(e) => setFilter(e.target.value as TeamFilter)} className={cn("w-48", DARK_SELECT)}>
            <option className={DARK_OPTION} value="all">Alle Mitarbeiter</option>
            <option className={DARK_OPTION} value="new">Nur neue MA</option>
            <option className={DARK_OPTION} value="existing">Nur bestehendes Team</option>
          </Select>
          <Select aria-label="Mitarbeiter sortieren" value={sort} onChange={(e) => setSort(e.target.value as TeamSort)} className={cn("w-64", DARK_SELECT)}>
            <option className={DARK_OPTION} value="name">Sortieren: Name (A–Z)</option>
            <option className={DARK_OPTION} value="manager">Nach Führungskraft (Struktur)</option>
            <option className={DARK_OPTION} value="progress-desc">Fortschritt (hoch → niedrig)</option>
            <option className={DARK_OPTION} value="progress-asc">Fortschritt (niedrig → hoch)</option>
            <option className={DARK_OPTION} value="einheiten-desc">Einheiten Ist (absteigend)</option>
          </Select>
        </div>

        {managerOptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-white/75">Schnellfilter Führungskraft:</span>
            <Pill active={managerFilter === null} onClick={() => setManagerFilter(null)} className="px-3 py-1 text-xs">Alle</Pill>
            {managerOptions.map((m) => (
              <Pill
                key={m.name}
                active={managerFilter === m.name}
                onClick={() => setManagerFilter((cur) => (cur === m.name ? null : m.name))}
                className="px-3 py-1 text-xs"
              >
                {m.name}
                <span className="ml-1 opacity-70">({SB_LEAD_ROLE_ABBR[m.role] ?? m.role})</span>
              </Pill>
            ))}
          </div>
        )}
      </div>

      <div className={cn("max-h-[65vh]", DARK_TABLE.wrap, DARK_CARD)}>
        <table className={cn("min-w-[900px]", DARK_TABLE.table)}>
          <thead>
            <tr>
              <th rowSpan={2} className={cn(th, "min-w-[300px]")}>Name</th>
              <th rowSpan={2} className={cn(th, "border-l border-white/10")}>Status</th>
              <th colSpan={4} className={cn(groupHead, "sticky top-0 z-10 border-l border-white/10 bg-[#13384a] text-sky-300")}>Plan</th>
              <th colSpan={4} className={cn(groupHead, "sticky top-0 z-10 border-l border-white/10 bg-[#3a3320] text-amber-300")}>Ist</th>
              <th rowSpan={2} className={cn(th, "border-l border-white/10")}>Soll</th>
              <th rowSpan={2} className={cn(th, "border-l border-white/10")}>Ist</th>
              <th rowSpan={2} className={cn(th, "border-l border-white/10")}>Fortschritt</th>
            </tr>
            <tr>
              {(["Plan", "Ist"] as const).flatMap((g) =>
                (["AT", "BT", "ST", "ET"] as const).map((k, i) => (
                  <th
                    key={`${g}-${k}`}
                    className={cn(
                      "sticky top-[30px] z-10 px-1 py-1 text-center text-[11px] font-semibold text-white/75",
                      g === "Plan" ? "bg-[#0f2f3e]" : "bg-[#2c2819]",
                      i === 0 && "border-l border-white/10"
                    )}
                    title={g === "Ist" ? "Wird automatisch aus der Wochenplanung übernommen" : undefined}
                  >
                    {k}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-3 py-8 text-center text-sm text-white/75">
                  {merged.length === 0 ? "Noch keine Personen im Strukturbaum erfasst." : "Keine Mitarbeiter entsprechen der Suche/Filterung."}
                </td>
              </tr>
            ) : (
              list.map((r) => {
                const pct = pctOf(r)
                const highlight = rowHighlight(r, wp)
                const rowEarnings = earnings.get(r.name)
                const indent = sort === "manager" ? r.depth * 14 : 0
                const tone = progressClass(pct) === "low" ? "red" : "mint"
                const num = "px-1 py-2 text-center"
                return (
                  <tr
                    key={`${r.rowIndex}-${r.name}`}
                    className={cn(
                      DARK_TABLE.row,
                      highlight === "at-above" && "bg-[#64DDA3]/[.06] shadow-[inset_3px_0_0_#64DDA3]",
                      highlight === "at-below" && "bg-[#e2685b]/[.08] shadow-[inset_3px_0_0_#e2685b]"
                    )}
                  >
                    <td className="px-3 py-2" style={{ paddingLeft: 12 + indent }}>
                      <div className="flex items-center gap-3">
                        <Avatar name={r.name as string} avatar={avatars?.[r.name as string]} zoomable className="size-7 text-xs" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{r.name}</div>
                          {(r.role || r.managerName) && (
                            <div className="truncate text-xs text-white/75">
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
                            className="shrink-0 whitespace-nowrap rounded-full bg-[#64DDA3]/10 px-2.5 py-1 text-sm font-bold tabular-nums text-[#64DDA3] transition-colors hover:bg-[#64DDA3]/20"
                          >
                            {fmtEur(rowEarnings.total - stornoreserveAmount(rowEarnings, reserveRate))} €
                          </button>
                        ) : (
                          <span className="shrink-0 text-white/55">—</span>
                        )}
                      </div>
                    </td>
                    <td className="border-l border-white/10 px-3 py-2">
                      <button
                        type="button"
                        disabled={!isEditor || !canEditRow(r.name as string)}
                        onClick={() => toggleNew(r)}
                        aria-pressed={!!r.isNew}
                        aria-label={`Status ${r.name}: ${r.isNew ? "Neu" : "Bestand"}, umschalten`}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-bold transition-colors disabled:opacity-60",
                          r.isNew ? "bg-[#64DDA3]/15 text-[#64DDA3]" : "bg-white/10 text-white/85"
                        )}
                      >
                        {r.isNew ? "NEU" : "Bestand"}
                      </button>
                    </td>
                    <td className={cn(num, "border-l border-white/10 bg-sky-400/[.06]")}><ComputedField value={r.atPlan} /></td>
                    <td className={cn(num, "bg-sky-400/[.06]")}><ComputedField value={r.btPlan} /></td>
                    <td className={cn(num, "bg-sky-400/[.06]")}><ComputedField value={r.stPlan} /></td>
                    <td className={cn(num, "bg-sky-400/[.06]")}><ComputedField value={r.etPlan} /></td>
                    <td className={cn(num, "border-l border-white/10 bg-amber-400/[.06]")}><ComputedField value={r.atIst} /></td>
                    <td className={cn(num, "bg-amber-400/[.06]")}><ComputedField value={r.btIst} /></td>
                    <td className={cn(num, "bg-amber-400/[.06]")}><ComputedField value={r.stIst} /></td>
                    <td className={cn(num, "bg-amber-400/[.06]")}><ComputedField value={r.etIst} /></td>
                    <td className="border-l border-white/10 px-2 py-2"><ComputedField value={r.soll} title="Einheitenziel aus der Monatsplanung" /></td>
                    <td className="border-l border-white/10 px-2 py-2">
                      <button
                        type="button"
                        onClick={() => setDetailName(r.name)}
                        aria-label={`Einheiten-Details – ${r.name}`}
                        className="h-8 w-20 rounded-md border border-transparent px-2 text-right text-sm font-bold tabular-nums transition-colors hover:border-white/20 hover:bg-white/10"
                      >
                        {fmt(r.ist)}
                      </button>
                    </td>
                    <td className="border-l border-white/10 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <MintBar pct={pct} tone={tone} className="w-16" />
                        <span className="text-xs font-semibold tabular-nums">{pct}%</span>
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
                  const cell = DARK_TABLE.foot
                  return (
                    <>
                      <td className={cell}>
                        <div className="flex items-center justify-between gap-3">
                          <span>Summe</span>
                          <span className="whitespace-nowrap text-[#64DDA3]">{fmtEur(grandTotalEur)} €</span>
                        </div>
                      </td>
                      <td className={cn(cell, "border-l border-white/10")} />
                      <td className={cn(cell, "border-l border-white/10 text-center")}>{fmt(totals.atPlan)}</td>
                      <td className={cn(cell, "text-center")}>{fmt(totals.btPlan)}</td>
                      <td className={cn(cell, "text-center")}>{fmt(totals.stPlan)}</td>
                      <td className={cn(cell, "text-center")}>{fmt(totals.etPlan)}</td>
                      <td className={cn(cell, "border-l border-white/10 text-center")}>{fmt(totals.atIst)}</td>
                      <td className={cn(cell, "text-center")}>{fmt(totals.btIst)}</td>
                      <td className={cn(cell, "text-center")}>{fmt(totals.stIst)}</td>
                      <td className={cn(cell, "text-center")}>{fmt(totals.etIst)}</td>
                      <td className={cn(cell, "border-l border-white/10")}>{fmt(totals.soll)}</td>
                      <td className={cn(cell, "border-l border-white/10")}>{fmt(totals.ist)}</td>
                      <td className={cn(cell, "border-l border-white/10")} />
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
          isEditor={isEditor && canEditRow(detailEntry.name)}
          canEditBonus={detailEntry.name !== noBonusFor}
          onSave={(units, bonus) => saveEarnings(detailEntry, units, bonus)}
        />
      )}
    </div>
  )
}
