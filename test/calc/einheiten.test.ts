import { describe, expect, it } from "vitest"
import { aggregateUnits, sumFor, teamNamesOf, totalUnits } from "../../src/lib/calc/einheiten"
import type { RosterEntry } from "../../src/lib/calc/struktur"
import type { EmployeeRow } from "../../src/types/dashboard"

const row = (name: string, ehByPlan: Record<string, number>) => ({ name, ehByPlan } as unknown as EmployeeRow)
const entry = (name: string, managerName: string | null): RosterEntry => ({ name, role: "", status: null, managerName, depth: 0 })

describe("einheiten", () => {
  const months = [
    { month: "2025-12", rows: [row("A", { insurance: 100 }), row("B", { credit: 5 })] },
    { month: "2026-01", rows: [row("A", { insurance: 10, investment: 2 }), row("B", { credit: 1 })] },
    { month: "2026-02", rows: [row("A", { insurance: 20 })] },
  ]

  it("trennt Jahr und Gesamt", () => {
    const { year, total } = aggregateUnits(months, 2026)
    expect(totalUnits(year.get("A")!)).toBe(32)
    expect(totalUnits(total.get("A")!)).toBe(132)
    expect(totalUnits(year.get("B")!)).toBe(1)
    expect(totalUnits(total.get("B")!)).toBe(6)
  })
  it("Jahr ohne Daten ist leer", () => {
    expect(aggregateUnits(months, 2030).year.size).toBe(0)
  })
  it("teamNamesOf: Person plus alle Untergebenen", () => {
    const roster = [entry("L", null), entry("A", "L"), entry("B", "A"), entry("C", "L")]
    expect(teamNamesOf(roster, "A")).toEqual(["A", "B"])
    expect(new Set(teamNamesOf(roster, "L"))).toEqual(new Set(["L", "A", "B", "C"]))
    expect(teamNamesOf(roster, "B")).toEqual(["B"])
  })
  it("sumFor summiert Team, unbekannte Namen zählen 0", () => {
    const { year } = aggregateUnits(months, 2026)
    expect(totalUnits(sumFor(year, ["A", "B", "X"]))).toBe(33)
  })
})
