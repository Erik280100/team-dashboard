// Mitarbeiter-Tabelle — reine Ableitungsfunktionen, 1:1 portiert aus
// der früheren Einzeldatei-App (getFilteredSorted, renderTable: Zeilen-Highlight
// und Summenzeile). Golden-Master-Test: test/calc/team.golden.test.ts.
import { pctOf, type EmployeeRow, type MonthWeekProgress } from "@/lib/calc/format"
import { isLeadRole, SB_LEAD_ROLES, type RosterEntry } from "@/lib/calc/struktur"

export type TeamFilter = "all" | "new" | "existing"
export type TeamSort = "name" | "progress-desc" | "progress-asc" | "einheiten-desc" | "manager"

/** Baseline-Zeile für eine Strukturbaum-Person, die noch keine Zahlen in
 * dashboard.rows hat (Upsert beim ersten Bearbeiten eines Felds/Buchen von
 * Einheiten — siehe Team.tsx commitField/commitPlanUnits und App.tsx
 * applyUnitsToEmployee). */
export function newRowFor(name: string): EmployeeRow {
  return {
    name,
    isNew: false,
    atPlan: 0, atIst: 0, btPlan: 0, btIst: 0, stPlan: 0, stIst: 0, etPlan: 0, etIst: 0,
    soll: 0, ist: 0,
    joinDate: "",
    bonus: 0,
  }
}

/**
 * Zahlen für Personen, deren Controlling-Daten der Betrachter nicht lesen darf (außerhalb der eigenen
 * Unterstruktur): AT/BT/ST/ET und Soll kommen aus den vom Server berechneten Monatssummen
 * (employees/{id}.monthStats), sofern sie zum eingestellten Umsatzmonat passen, sonst 0.
 * `canSeeLive` = Betrachter darf die Planung der Person lesen (dann gelten die Live-Werte unverändert).
 */
export function applyMonthStats<T extends EmployeeRow>(rows: T[], monthKey: string, canSeeLive: (name: string) => boolean): T[] {
  return rows.map((r) => {
    if (canSeeLive(r.name)) return r
    const s = r.monthStats && r.monthStats.month === monthKey ? r.monthStats : null
    return {
      ...r,
      atPlan: s?.atPlan ?? 0, atIst: s?.atIst ?? 0, btPlan: s?.btPlan ?? 0, btIst: s?.btIst ?? 0,
      stPlan: s?.stPlan ?? 0, stIst: s?.stIst ?? 0, etPlan: s?.etPlan ?? 0, etIst: s?.etIst ?? 0,
      soll: s?.soll ?? 0,
    }
  })
}

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
      stPlan: Number(row?.stPlan) || 0,
      stIst: Number(row?.stIst) || 0,
      etPlan: Number(row?.etPlan) || 0,
      etIst: Number(row?.etIst) || 0,
      soll: Number(row?.soll) || 0,
      ist: Number(row?.ist) || 0,
      ehByPlan: row?.ehByPlan,
      vbByAbwickler: row?.vbByAbwickler,
      careerUnits: row?.careerUnits,
      bonus: Number(row?.bonus) || 0,
      monthStats: row?.monthStats,
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

export interface ManagerOption {
  name: string
  role: string
}

const LEAD_ROLE_RANK: Record<string, number> = Object.fromEntries(
  SB_LEAD_ROLES.map((role, i) => [role, i])
)

/**
 * Führungskräfte (ab Teamleiter aufwärts) für die Schnellfilter-Chips auf der
 * Mitarbeiterseite, gruppiert nach Führungsstufe (Geschäftsstellenleiter vor
 * Teamleiter, siehe SB_LEAD_ROLES) und innerhalb der Stufe alphabetisch.
 */
export function leadRosterOptions(roster: RosterEntry[]): ManagerOption[] {
  return roster
    .filter((r) => isLeadRole(r.role))
    .map((r) => ({ name: r.name, role: r.role }))
    .sort((a, b) => {
      const rank = (LEAD_ROLE_RANK[a.role] ?? 999) - (LEAD_ROLE_RANK[b.role] ?? 999)
      return rank !== 0 ? rank : a.name.localeCompare(b.name, "de")
    })
}

export type RowHighlight = "at-above" | "at-below" | ""

/**
 * Rot/Grün-Einfärbung nach AT-Fortschritt relativ zum wochenanteiligen Plan.
 * Sind die Umsatz-Einheiten (Soll/Ist) bereits erreicht, ist die Zeile auch
 * dann grün, wenn der AT-Fortschritt für sich genommen noch unter der
 * Wochen-Schwelle liegt.
 */
export function rowHighlight(row: Pick<EmployeeRow, "atPlan" | "atIst" | "soll" | "ist">, wp: MonthWeekProgress): RowHighlight {
  const soll = Number(row.soll || 0)
  if (soll > 0 && Number(row.ist || 0) >= soll) return "at-above"
  const atPlan = Number(row.atPlan || 0)
  if (!wp.active || atPlan <= 0) return ""
  const schwelle = 0.8 * atPlan * wp.fraction
  return Number(row.atIst || 0) >= schwelle ? "at-above" : "at-below"
}

const TOTAL_FIELDS = ["atPlan", "btPlan", "stPlan", "etPlan", "atIst", "btIst", "stIst", "etIst", "soll", "ist"] as const

export type TeamTotals = Record<(typeof TOTAL_FIELDS)[number], number>

export function teamTotals(list: EmployeeRow[]): TeamTotals {
  const sum = (field: string) => list.reduce((s, r) => s + Number(r[field] || 0), 0)
  return {
    atPlan: sum("atPlan"), btPlan: sum("btPlan"), stPlan: sum("stPlan"), etPlan: sum("etPlan"),
    atIst: sum("atIst"), btIst: sum("btIst"), stIst: sum("stIst"), etIst: sum("etIst"),
    soll: sum("soll"), ist: sum("ist"),
  }
}

/**
 * Setzt in den rows die Namen auf die Schreibweise des Strukturbaums (Quelle der
 * Wahrheit für Namen). Zuordnung wie in mergeRosterWithRows; nicht zugeordnete
 * Zeilen bleiben unverändert. Reihenfolge/Indizes bleiben erhalten.
 */
/** Nur Zeilen, die einem Strukturbaum-Mitarbeiter zugeordnet sind (verwaiste
 * Zeilen mit alten/falsch geschriebenen Namen fallen raus). Leerer Baum → alle. */
export function rowsMatchedToRoster(roster: RosterEntry[], rows: EmployeeRow[]): EmployeeRow[] {
  if (roster.length === 0) return rows
  const matched = new Set<number>()
  mergeRosterWithRows(roster, rows).forEach((m) => {
    if (m.rowIndex !== null) matched.add(m.rowIndex)
  })
  return relabelRowsByRoster(roster, rows).filter((_, i) => matched.has(i))
}

export function relabelRowsByRoster(roster: RosterEntry[], rows: EmployeeRow[]): EmployeeRow[] {
  const nameByIndex = new Map<number, string>()
  mergeRosterWithRows(roster, rows).forEach((m) => {
    if (m.rowIndex !== null) nameByIndex.set(m.rowIndex, m.name)
  })
  return rows.map((r, i) => {
    const name = nameByIndex.get(i)
    return name !== undefined && name !== r.name ? { ...r, name } : r
  })
}
