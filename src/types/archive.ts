// Monats-Archiv — Typen für abgeschlossene Monate. Ergänzt DashboardDoc/OrgChartDoc
// (types/dashboard.ts) um eine Zeitdimension, ohne deren Form zu verändern: jeder
// abgeschlossene Monat wird als eigenständiges, unveränderliches Dokument
// finova/snapshot_<YYYY-MM> abgelegt, dazu ein einzelnes Index-Dokument
// finova/archive_index mit vorberechneten Aggregaten (siehe src/lib/calc/archive.ts
// für die Bau-Logik, src/hooks/useMonthArchive.ts für Laden/Schreiben).
import type { PlanId, SbNode } from "@/lib/calc/struktur"
import type { EmployeeRow, HistoryEntry, TeamGoal } from "@/types/dashboard"
import type { OrgChartConn, OrgChartNote } from "@/types/dashboard"

/** "YYYY-MM" — Dokumentsuffix von finova/snapshot_<month>. */
export type MonthKey = string

export const ARCHIVE_INDEX_KEY = "finova_archive_index_v1"
export const snapshotStorageKey = (m: MonthKey) => `finova_snapshot_${m}_v1`
export const snapshotDocId = (m: MonthKey) => `snapshot_${m}`

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

/** finova/snapshot_<month> — unveränderlich nach dem Schreiben. */
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

/** finova/archive_index — ein Dokument, Liste aller abgeschlossenen Monate. */
export interface ArchiveIndexDoc {
  version: 1
  /** Aufsteigend nach month sortiert. */
  months: ArchiveIndexEntry[]
}
