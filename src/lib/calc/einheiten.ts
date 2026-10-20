// Einheiten-Übersicht (Jahresplanung): Einheiten je Person für ein Jahr und insgesamt (alle Monate),
// optional mit gesamtem Team (Person + Unterstruktur). Reine Funktionen — Laden der Snapshots macht der Hook.
import { PLAN_IDS, type PlanId, type RosterEntry } from "@/lib/calc/struktur"
import { readPlanUnits } from "@/lib/calc/verguetung"
import type { EmployeeRow } from "@/types/dashboard"

export type UnitsByPlan = Record<PlanId, number>

export const emptyUnits = (): UnitsByPlan => Object.fromEntries(PLAN_IDS.map((p) => [p, 0])) as UnitsByPlan

export function addUnits(a: UnitsByPlan, b: UnitsByPlan): UnitsByPlan {
  const out = emptyUnits()
  PLAN_IDS.forEach((p) => { out[p] = (a[p] || 0) + (b[p] || 0) })
  return out
}

export function totalUnits(u: UnitsByPlan): number {
  return PLAN_IDS.reduce((s, p) => s + (u[p] || 0), 0)
}

export interface MonthRows {
  /** "YYYY-MM" */
  month: string
  rows: EmployeeRow[]
}

/**
 * Einheiten je Person (Name): `year` = nur Monate des Jahres, `total` = alle übergebenen Monate.
 * Jeder Monat darf nur einmal vorkommen (der laufende Monat nur, wenn er noch nicht archiviert ist).
 */
export function aggregateUnits(months: readonly MonthRows[], year: number): {
  year: Map<string, UnitsByPlan>
  total: Map<string, UnitsByPlan>
} {
  const byYear = new Map<string, UnitsByPlan>()
  const total = new Map<string, UnitsByPlan>()
  const add = (map: Map<string, UnitsByPlan>, name: string, u: UnitsByPlan) => {
    map.set(name, addUnits(map.get(name) ?? emptyUnits(), u))
  }
  for (const m of months) {
    const inYear = m.month.startsWith(`${year}-`)
    for (const r of m.rows) {
      const u = readPlanUnits(r)
      add(total, r.name, u)
      if (inYear) add(byYear, r.name, u)
    }
  }
  return { year: byYear, total }
}

/** Person + alle Untergebenen (über managerName im Roster, "vielleicht"-Knoten sind dort bereits übersprungen). */
export function teamNamesOf(roster: readonly RosterEntry[], name: string): string[] {
  const children = new Map<string, string[]>()
  roster.forEach((r) => {
    if (r.managerName) children.set(r.managerName, [...(children.get(r.managerName) ?? []), r.name])
  })
  const out: string[] = []
  const seen = new Set<string>()
  const walk = (n: string) => {
    if (seen.has(n)) return
    seen.add(n)
    out.push(n)
    ;(children.get(n) ?? []).forEach(walk)
  }
  walk(name)
  return out
}

export function sumFor(map: ReadonlyMap<string, UnitsByPlan>, names: readonly string[]): UnitsByPlan {
  return names.reduce((acc, n) => addUnits(acc, map.get(n) ?? emptyUnits()), emptyUnits())
}
