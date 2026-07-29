// Mitarbeiter-Tabelle — reine Ableitungsfunktionen, 1:1 portiert aus
// legacy/index.html:2636–2772 (getFilteredSorted, renderTable: Zeilen-Highlight
// und Summenzeile). Golden-Master-Test: test/calc/team.golden.test.ts.
import { pctOf, type EmployeeRow, type MonthWeekProgress } from "@/lib/calc/format"

export type TeamFilter = "all" | "new" | "existing"
export type TeamSort = "name" | "progress-desc" | "progress-asc" | "einheiten-desc"

export interface IndexedRow extends EmployeeRow {
  _idx: number
}

export function getFilteredSorted(
  rows: EmployeeRow[],
  search: string,
  filter: TeamFilter,
  sort: TeamSort
): IndexedRow[] {
  const needle = search.toLowerCase()
  let list: IndexedRow[] = rows
    .map((r, i) => ({ ...r, _idx: i }))
    .filter((r) => r.name.toLowerCase().includes(needle))
  if (filter === "new") list = list.filter((r) => r.isNew)
  if (filter === "existing") list = list.filter((r) => !r.isNew)

  if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "de"))
  if (sort === "progress-desc") list.sort((a, b) => pctOf(b) - pctOf(a))
  if (sort === "progress-asc") list.sort((a, b) => pctOf(a) - pctOf(b))
  if (sort === "einheiten-desc") list.sort((a, b) => Number(b.ist) - Number(a.ist))
  return list
}

export type RowHighlight = "at-above" | "at-below" | ""

/** Rot/Grün-Einfärbung nach AT-Fortschritt relativ zum wochenanteiligen Plan. */
export function rowHighlight(row: Pick<EmployeeRow, "atPlan" | "atIst">, wp: MonthWeekProgress): RowHighlight {
  const atPlan = Number(row.atPlan || 0)
  if (!wp.active || atPlan <= 0) return ""
  const schwelle = 0.8 * atPlan * wp.fraction
  return Number(row.atIst || 0) >= schwelle ? "at-above" : "at-below"
}

const TOTAL_FIELDS = ["atPlan", "btPlan", "etPlan", "atIst", "btIst", "etIst", "soll", "ist"] as const

export type TeamTotals = Record<(typeof TOTAL_FIELDS)[number], number>

export function teamTotals(list: EmployeeRow[]): TeamTotals {
  const sum = (field: string) => list.reduce((s, r) => s + Number(r[field] || 0), 0)
  return {
    atPlan: sum("atPlan"), btPlan: sum("btPlan"), etPlan: sum("etPlan"),
    atIst: sum("atIst"), btIst: sum("btIst"), etIst: sum("etIst"),
    soll: sum("soll"), ist: sum("ist"),
  }
}
