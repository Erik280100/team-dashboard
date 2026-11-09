// Jahresverdienst je Person (Jahresplanung): Summe der Monatsergebnisse (computeEarnings().total, also
// Eigen- + Differenzvergütung inkl. des manuell erfassten Bonus) über alle Monate eines Jahres.
// Gleiche Pipeline wie Mitarbeiterseite/Statistik: sbRoster -> mergeRosterWithRows -> computeEarnings.
import { sbRoster, type PlanId, type SbNode } from "@/lib/calc/struktur"
import { mergeRosterWithRows } from "@/lib/calc/team"
import { computeEarnings } from "@/lib/calc/verguetung"
import type { EmployeeRow } from "@/types/dashboard"

export interface MonthEarningsInput {
  /** "YYYY-MM" */
  month: string
  rows: EmployeeRow[]
  /** Strukturbaum und Sätze, die in diesem Monat galten (Snapshot bzw. live). */
  tree: SbNode
  planRates: Record<PlanId, Record<string, number>>
}

/** Verdienst (€) je Name, summiert über alle übergebenen Monate, die im `year` liegen. */
export function aggregateYearEarnings(months: readonly MonthEarningsInput[], year: number): Map<string, number> {
  const out = new Map<string, number>()
  for (const m of months) {
    if (!m.month.startsWith(`${year}-`)) continue
    const merged = mergeRosterWithRows(sbRoster(m.tree), m.rows)
    computeEarnings(merged, m.planRates).forEach((e, name) => {
      out.set(name, (out.get(name) ?? 0) + e.total)
    })
  }
  return out
}
