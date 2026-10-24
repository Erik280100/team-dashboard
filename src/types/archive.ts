// Monats-Archiv — Typen für abgeschlossene Monate. Ergänzt DashboardDoc/OrgChartDoc
// (types/dashboard.ts) um eine Zeitdimension, ohne deren Form zu verändern: jeder
// abgeschlossene Monat wird als eigenständiges, unveränderliches Dokument
// snapshots/{YYYY-MM} (plus snapshots/{YYYY-MM}/employees/{id}) abgelegt, dazu ein einzelnes
// Index-Dokument org/archiveIndex mit vorberechneten Aggregaten (siehe src/lib/calc/archive.ts
// für die Bau-Logik, src/hooks/useMonthArchive.ts für Laden/Schreiben).
import type { PlanId, SbNode } from "@/lib/calc/struktur"
import type { EmployeeRow, HistoryEntry, TeamGoal } from "@/types/dashboard"
import type { OrgChartConn, OrgChartNote } from "@/types/dashboard"

/** "YYYY-MM" — Dokument-ID von snapshots/{month}. */
export type MonthKey = string


/** Eingefrorener Strukturbaum eines Monats — wie OrgChartDoc, aber planRates
 * aufgelöst (nie optional), damit spätere Änderungen an DEFAULT_PLAN_RATES oder
 * den gespeicherten Stufensätzen die Historie nicht rückwirkend verändern. */
export interface SnapshotOrgChart {
  tree: SbNode
  notes: Record<string, OrgChartNote[]>
  conns: OrgChartConn[]
  rates: Record<string, number>
  planRates: Record<PlanId, Record<string, number>>
}

/** snapshots/{month} — unveränderlich nach dem Schreiben. */
export interface MonthSnapshot {
  version: 1
  month: MonthKey
  /** ISO-Zeitpunkt des Abschlusses (Client-Uhr). */
  closedAt: string
  /** E-Mail des abschließenden Editors, rein informativ. */
  closedBy: string | null
  rows: EmployeeRow[]
  teamGoal: TeamGoal
  /** Nur Einträge innerhalb [periodStart, periodEnd] — timelineData() liest
   * ohnehin nur diesen Bereich, das Dokument bleibt dadurch klein. */
  history: HistoryEntry[]
  orgChart: SnapshotOrgChart
}

/** Vorberechnete Monatsaggregate — identisch berechnet wie teamTotals() +
 * computeEarnings() auf der Mitarbeiterseite (siehe monthTotals() in
 * src/lib/calc/archive.ts), damit Statistik und archivierte Mitarbeiterseite
 * nie auseinanderlaufen. Macht Dropdown/Statistik-Trend ohne Snapshot-Load möglich. */
export interface MonthTotals {
  soll: number
  ist: number
  /** round(ist / soll * 100), 0 wenn soll <= 0. */
  pct: number
  atPlan: number
  atIst: number
  btPlan: number
  btIst: number
  etPlan: number
  etIst: number
  ehByPlan: Record<PlanId, number>
  /** Summe aller computeEarnings(...).total in Euro. */
  totalEur: number
  employeeCount: number
  newHireCount: number
  recruitGoal: number
  recruitActual: number
}

export interface ArchiveIndexEntry {
  month: MonthKey
  /** "Juni 2026", de-AT, vorberechnet für Dropdown/Chart-Labels. */
  label: string
  periodStart: string
  periodEnd: string
  closedAt: string
  totals: MonthTotals
}

/** org/archiveIndex — ein Dokument, Liste aller abgeschlossenen Monate. */
export interface ArchiveIndexDoc {
  version: 1
  /** Aufsteigend nach month sortiert. */
  months: ArchiveIndexEntry[]
}
