import { describe, expect, it } from "vitest"
import { getFilteredSorted, rowHighlight, teamTotals, type TeamFilter, type TeamSort } from "../../src/lib/calc/team"
import type { EmployeeRow } from "../../src/lib/calc/format"
// @ts-expect-error – plain JS fixture, keine Typen nötig
import * as legacy from "../legacy-fixtures/team.legacy.js"

function sampleRows(): EmployeeRow[] {
  return [
    { name: "Bernd Zach", soll: 100, ist: 90, isNew: false, atPlan: 10, atIst: 9 },
    { name: "Anna Muster", soll: 50, ist: 10, isNew: true, atPlan: 5, atIst: 0 },
    { name: "Clara Öfele", soll: 0, ist: 0, isNew: false, atPlan: 0, atIst: 0 },
    { name: "David Weber", soll: 200, ist: 150, isNew: true, atPlan: 20, atIst: 20 },
  ]
}

describe("team: golden master vs. legacy", () => {
  it("getFilteredSorted matches across search/filter/sort combos", () => {
    const filters: TeamFilter[] = ["all", "new", "existing"]
    const sorts: TeamSort[] = ["name", "progress-desc", "progress-asc", "einheiten-desc"]
    for (const filter of filters) {
      for (const sort of sorts) {
        for (const search of ["", "a", "weber"]) {
          expect(getFilteredSorted(sampleRows(), search, filter, sort)).toEqual(
            legacy.getFilteredSorted(sampleRows(), search, filter, sort)
          )
        }
      }
    }
  })

  it("rowHighlight matches", () => {
    const wpActive = { active: true, fraction: 0.5 }
    const wpInactive = { active: false, fraction: 0 }
    for (const row of sampleRows()) {
      expect(rowHighlight(row, wpActive)).toBe(legacy.rowHighlight(row, wpActive))
      expect(rowHighlight(row, wpInactive)).toBe(legacy.rowHighlight(row, wpInactive))
    }
  })

  it("teamTotals matches", () => {
    expect(teamTotals(sampleRows())).toEqual(legacy.teamTotals(sampleRows()))
    expect(teamTotals([])).toEqual(legacy.teamTotals([]))
  })
})
