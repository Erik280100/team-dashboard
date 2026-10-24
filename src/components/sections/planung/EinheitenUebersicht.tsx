// Einheiten je Person im Jahr (und insgesamt seit Beginn) — in der Jahresplanung. Die Führungskraft sieht sich
// selbst, jede einzelne Person und (Umschalter "Inkl. Team") auch ganze Teams: Person + Unterstruktur.
// Quelle wie auf der Mitarbeiterseite/Statistik: abgeschlossene Monate aus den Archiv-Snapshots, der
// laufende Umsatzmonat aus rows. Alle Eingeloggten dürfen die Einheiten aller Mitarbeiter lesen.
import { useEffect, useMemo, useState } from "react"
import { fmt } from "@/lib/calc/format"
import { aggregateUnits, sumFor, teamNamesOf, totalUnits } from "@/lib/calc/einheiten"
import { PLAN_IDS, PLAN_LABELS, type RosterEntry } from "@/lib/calc/struktur"
import type { UseMonthArchiveResult } from "@/hooks/useMonthArchive"
import type { EmployeeRow } from "@/types/dashboard"
import { cn } from "@/lib/utils"
import { DARK_CARD, DARK_TABLE, Pill } from "@/components/ui/dark"

export function EinheitenUebersicht({
  managerName, people, roster, year, archive, rows, unitsMonthKey,
}: {
  managerName: string
  /** Personen der aktuellen Auswahl (Alle / Direkte Mitarbeiter); die Führungskraft selbst wird immer ergänzt. */
  people: RosterEntry[]
  /** Gesamter Strukturbaum (für die Teams). */
  roster: RosterEntry[]
  year: number
  archive: UseMonthArchiveResult
  rows: EmployeeRow[]
  unitsMonthKey: string
}) {
  const [withTeam, setWithTeam] = useState(false)

  const allMonths = useMemo(() => archive.index.map((e) => e.month), [archive.index])
  useEffect(() => {
    if (allMonths.length > 0) void archive.loadSnapshots(allMonths)
    // archive ist je Render ein neues Objekt — nur bei Änderung der Monatsliste nachladen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMonths])

  const sources = allMonths.map((m) => ({ month: m, rows: archive.getSnapshot(m)?.rows ?? null }))
  const loading = sources.some((s) => s.rows === null && archive.snapshotStatus[s.month] !== "error")
  const { year: yearUnits, total: totalUnitsMap } = useMemo(() => {
    const months = sources.flatMap((s) => (s.rows ? [{ month: s.month, rows: s.rows }] : []))
    if (!allMonths.includes(unitsMonthKey)) months.push({ month: unitsMonthKey, rows })
    return aggregateUnits(months, year)
    // sources wird aus allMonths+Snapshot-Cache abgeleitet — über loading gated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMonths, loading, unitsMonthKey, rows, year])

  const list = useMemo(() => {
    const self = roster.find((r) => r.name === managerName)
    const others = people.filter((p) => p.name !== managerName)
    return self ? [self, ...others] : others
  }, [roster, people, managerName])
  const hasTeams = useMemo(() => list.some((p) => teamNamesOf(roster, p.name).length > 1), [list, roster])

  const lines = list.map((p) => {
    const names = withTeam ? teamNamesOf(roster, p.name) : [p.name]
    return {
      entry: p,
      teamSize: names.length,
      year: sumFor(yearUnits, names),
      total: sumFor(totalUnitsMap, names),
    }
  })
  const sumYear = lines.reduce((s, l) => s + totalUnits(l.year), 0)
  const sumTotal = lines.reduce((s, l) => s + totalUnits(l.total), 0)

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-white/85">⚡ Einheiten je Person — {year}</h3>
        {hasTeams && (
          <div className="flex gap-2">
            <Pill active={!withTeam} onClick={() => setWithTeam(false)} className="px-3 py-1 text-xs">Einzelperson</Pill>
            <Pill active={withTeam} onClick={() => setWithTeam(true)} className="px-3 py-1 text-xs">Inkl. Team</Pill>
          </div>
        )}
        {loading && <span className="text-xs text-muted-foreground">Lade Archiv…</span>}
      </div>
      <div className={cn(DARK_TABLE.wrap, DARK_CARD)}>
        <table className={cn("min-w-[820px]", DARK_TABLE.table)}>
          <thead>
            <tr>
              <th className={DARK_TABLE.head}>{withTeam ? "Person · Team" : "Person"}</th>
              {PLAN_IDS.map((p) => <th key={p} className={cn(DARK_TABLE.head, "text-right")}>{PLAN_LABELS[p]}</th>)}
              <th className={cn(DARK_TABLE.head, "text-right")}>Einheiten {year}</th>
              <th className={cn(DARK_TABLE.head, "text-right")}>Gesamt seit Beginn</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.entry.name} className={DARK_TABLE.row}>
                <td className="px-3 py-2">
                  <div className="truncate text-sm font-semibold">
                    {l.entry.name}
                    {l.entry.name === managerName && <span className="ml-1 text-xs font-normal text-white/90">(du / Führungskraft)</span>}
                  </div>
                  <div className="truncate text-xs text-white/90">
                    {l.entry.role}{withTeam && l.teamSize > 1 ? ` · Team gesamt (${l.teamSize})` : ""}
                  </div>
                </td>
                {PLAN_IDS.map((p) => <td key={p} className="px-3 py-2 text-right tabular-nums">{fmt(l.year[p])}</td>)}
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmt(totalUnits(l.year))}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(totalUnits(l.total))}</td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr><td colSpan={PLAN_IDS.length + 3} className="px-3 py-6 text-center text-white/90">Keine Personen.</td></tr>
            )}
          </tbody>
          {!withTeam && lines.length > 1 && (
            <tfoot>
              <tr className="bg-[#12372f] font-semibold">
                <td className="px-3 py-2" colSpan={PLAN_IDS.length + 1}>Summe ({lines.length} Personen)</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(sumYear)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(sumTotal)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {withTeam && (
        <p className="mt-2 text-xs text-muted-foreground">
          „Inkl. Team“ zählt jede Person mit ihrer gesamten Unterstruktur — Teams überschneiden sich, deshalb gibt es hier keine Gesamtsumme.
        </p>
      )}
    </section>
  )
}
