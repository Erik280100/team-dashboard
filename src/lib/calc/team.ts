// Mitarbeiter-Tabelle — reine Ableitungsfunktionen, 1:1 portiert aus
// legacy/index.html:2636–2772 (getFilteredSorted, renderTable: Zeilen-Highlight
// und Summenzeile). Golden-Master-Test: test/calc/team.golden.test.ts.
import { pctOf, type EmployeeRow, type MonthWeekProgress } from "@/lib/calc/format"
import type { RosterEntry } from "@/lib/calc/struktur"

export type TeamFilter = "all" | "new" | "existing"
export type TeamSort = "name" | "progress-desc" | "progress-asc" | "einheiten-desc" | "manager"

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

/** Mitarbeiterzeile, die im Strukturbaum geführt wird, gemergt mit ihren
 * Leistungszahlen aus dashboard.rows (falls dort schon eine Zeile existiert). */
export interface MergedRow extends EmployeeRow {
  /** Rolle aus dem Strukturbaum-Knoten (Quelle der Wahrheit, nicht aus rows). */
  role: string
  managerName: string | null
  depth: number
  /** Index in dashboard.rows, oder null wenn für diese Person noch keine Zeile existiert. */
  rowIndex: number | null
}

function normName(s: string): string {
  return (s || "").trim().toLowerCase()
}
function lastWord(s: string): string {
  const parts = (s || "").trim().split(/\s+/)
  return parts[parts.length - 1].toLowerCase()
}

/**
 * Verknüpft die Strukturbaum-Personenliste (Quelle der Wahrheit für Name/Rolle/
 * Hierarchie) mit den Leistungszahlen aus dashboard.rows. Zuordnung per exaktem
 * Namensabgleich, sonst Fallback über den Nachnamen — analog zu
 * sbGetRoleForName/sbFindByLastName. Jede rows-Zeile wird höchstens einmal
 * zugeordnet, damit zwei Personen nicht dieselben Zahlen teilen.
 */
export function mergeRosterWithRows(roster: RosterEntry[], rows: EmployeeRow[]): MergedRow[] {
  const byExact = new Map<string, number>()
  const byLast = new Map<string, number>()
  rows.forEach((r, i) => {
    const n = normName(r.name)
    if (!byExact.has(n)) byExact.set(n, i)
    const lw = lastWord(r.name)
    if (!byLast.has(lw)) byLast.set(lw, i)
  })
  const usedIdx = new Set<number>()
  return roster.map((entry) => {
    const n = normName(entry.name)
    let idx = byExact.get(n)
    if (idx === undefined || usedIdx.has(idx)) {
      const candidate = byLast.get(lastWord(entry.name))
      if (candidate !== undefined && !usedIdx.has(candidate)) idx = candidate
    }
    if (idx !== undefined) usedIdx.add(idx)
    const row = idx !== undefined ? rows[idx] : null
    return {
      name: entry.name,
      isNew: row?.isNew ?? false,
      joinDate: row?.joinDate ?? "",
      atPlan: Number(row?.atPlan) || 0,
      atIst: Number(row?.atIst) || 0,
      btPlan: Number(row?.btPlan) || 0,
      btIst: Number(row?.btIst) || 0,
      etPlan: Number(row?.etPlan) || 0,
      etIst: Number(row?.etIst) || 0,
      soll: Number(row?.soll) || 0,
      ist: Number(row?.ist) || 0,
      role: entry.role,
      managerName: entry.managerName,
      depth: entry.depth,
      rowIndex: idx ?? null,
    }
  })
}

/**
 * Filtert/sortiert die gemergte Strukturbaum-Mitarbeiterliste. Bei sort ===
 * "manager" bleibt die Baum-Vorordnung (Führungskraft vor Untergebenen)
 * erhalten, da die Roster-Reihenfolge bereits so aufgebaut ist.
 */
export function getMergedFilteredSorted(
  merged: MergedRow[],
  search: string,
  filter: TeamFilter,
  sort: TeamSort
): MergedRow[] {
  const needle = search.toLowerCase()
  let list = merged.filter((r) => r.name.toLowerCase().includes(needle))
  if (filter === "new") list = list.filter((r) => r.isNew)
  if (filter === "existing") list = list.filter((r) => !r.isNew)

  if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name, "de"))
  if (sort === "progress-desc") list = [...list].sort((a, b) => pctOf(b) - pctOf(a))
  if (sort === "progress-asc") list = [...list].sort((a, b) => pctOf(a) - pctOf(b))
  if (sort === "einheiten-desc") list = [...list].sort((a, b) => Number(b.ist) - Number(a.ist))
  // sort === "manager": Roster-Vorordnung unverändert lassen
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
