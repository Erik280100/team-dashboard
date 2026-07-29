import { describe, expect, it } from "vitest"
import {
  getFilteredSorted, getMergedFilteredSorted, mergeRosterWithRows, rowHighlight, teamTotals,
  type TeamFilter, type TeamSort,
} from "../../src/lib/calc/team"
import { sbRoster, type SbNode } from "../../src/lib/calc/struktur"
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

describe("mergeRosterWithRows / getMergedFilteredSorted", () => {
  function hierarchyTree(): SbNode {
    // Erik → Noah, David → (unter David) Josef, Nico
    return {
      id: "erik", name: "Erik Bindar", role: "Geschäftsstellenleiter",
      children: [
        { id: "noah", name: "Noah Vanek", role: "Mitarbeiter", children: [] },
        {
          id: "david", name: "David Schrey", role: "Teamleiter",
          children: [
            { id: "josef", name: "Josef Nagel", role: "FT1", children: [] },
            { id: "nico", name: "Nico Kiem", role: "FT1", children: [] },
          ],
        },
      ],
    }
  }

  it("'manager' sort keeps the tree pre-order (Erik → Noah, David → Josef, Nico)", () => {
    const roster = sbRoster(hierarchyTree())
    const merged = mergeRosterWithRows(roster, [])
    const list = getMergedFilteredSorted(merged, "", "all", "manager")
    expect(list.map((r) => r.name)).toEqual([
      "Erik Bindar", "Noah Vanek", "David Schrey", "Josef Nagel", "Nico Kiem",
    ])
  })

  it("excludes tree nodes with status 'vielleicht' from the mirrored list", () => {
    const tree = hierarchyTree()
    tree.children![1].status = "vielleicht" // David kommt vielleicht
    const roster = sbRoster(tree)
    const merged = mergeRosterWithRows(roster, [])
    expect(merged.map((r) => r.name)).toEqual(["Erik Bindar", "Noah Vanek", "Josef Nagel", "Nico Kiem"])
  })

  it("assigns numeric fields from dashboard.rows by exact name, falling back to last-name match", () => {
    const roster = sbRoster(hierarchyTree())
    const rows: EmployeeRow[] = [
      { name: "Erik Bindar", soll: 100, ist: 80, isNew: true },
      { name: "Vanek", soll: 40, ist: 20, isNew: false }, // Nachname-Fallback -> Noah Vanek
    ]
    const merged = mergeRosterWithRows(roster, rows)
    const erik = merged.find((r) => r.name === "Erik Bindar")
    const noah = merged.find((r) => r.name === "Noah Vanek")
    const david = merged.find((r) => r.name === "David Schrey")
    expect(erik?.soll).toBe(100)
    expect(erik?.rowIndex).toBe(0)
    expect(noah?.soll).toBe(40)
    expect(noah?.rowIndex).toBe(1)
    expect(david?.rowIndex).toBeNull()
    expect(david?.soll).toBe(0)
  })

  it("does not assign the same rows entry to two different roster entries", () => {
    const tree: SbNode = {
      id: "a", name: "Anna Weber", role: "",
      children: [{ id: "b", name: "Weber", role: "", children: [] }], // gleicher Nachname
    }
    const roster = sbRoster(tree)
    const rows: EmployeeRow[] = [{ name: "Anna Weber", soll: 10, ist: 5 }]
    const merged = mergeRosterWithRows(roster, rows)
    const [first, second] = merged
    expect(first.rowIndex).toBe(0)
    expect(second.rowIndex).toBeNull()
    expect(second.soll).toBe(0)
  })
})
