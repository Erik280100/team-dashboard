import { describe, expect, it } from "vitest"
import * as ts from "../../src/lib/calc/overview"
import type { EmployeeRow, HistoryEntry, TeamGoal } from "../../src/lib/calc/format"
// @ts-expect-error – plain JS fixture, keine Typen nötig
import * as legacy from "../legacy-fixtures/overview.legacy.js"

function sampleRows(): EmployeeRow[] {
  return [
    { name: "Anna Muster", soll: 100, ist: 80, isNew: false, atIst: 12 },
    { name: "Bernd Beispiel", soll: 50, ist: 50, isNew: true, joinDate: "2026-07-10", atIst: 30 },
    { name: "Clara Schmidt", soll: 0, ist: 0, isNew: true, atIst: 0 },
    { name: "David Weber", soll: 200, ist: 10, isNew: false, atIst: 5 },
  ]
}

const goal: TeamGoal = {
  note: "",
  recruitGoal: 3,
  recruitActual: null,
  periodStart: "2026-07-01",
  periodEnd: "2026-07-31",
}

describe("overview: golden master vs. legacy", () => {
  it("summaryKpis matches", () => {
    expect(ts.summaryKpis(sampleRows())).toEqual(legacy.summaryKpis(sampleRows()))
  })

  it("goalProgress matches", () => {
    expect(ts.goalProgress(sampleRows())).toEqual(legacy.goalProgress(sampleRows()))
    expect(ts.goalProgress([])).toEqual(legacy.goalProgress([]))
  })

  it("recruitProgress matches (with and without recruitActual override)", () => {
    expect(ts.recruitProgress(sampleRows(), goal)).toEqual(
      legacy.recruitProgress(sampleRows(), goal)
    )
    const goalOverride = { ...goal, recruitActual: 1 }
    expect(ts.recruitProgress(sampleRows(), goalOverride)).toEqual(
      legacy.recruitProgress(sampleRows(), goalOverride)
    )
  })

  it("barChartData / doughnutData / revenueShareData / leaderboardData match", () => {
    expect(ts.barChartData(sampleRows())).toEqual(legacy.barChartData(sampleRows()))
    expect(ts.doughnutData(sampleRows())).toEqual(legacy.doughnutData(sampleRows()))
    expect(ts.doughnutData([])).toEqual(legacy.doughnutData([]))
    expect(ts.revenueShareData(sampleRows())).toEqual(legacy.revenueShareData(sampleRows()))
    expect(ts.leaderboardData(sampleRows())).toEqual(legacy.leaderboardData(sampleRows()))
  })

  it("timelineData matches across scenarios (valid range, invalid range, various 'now')", () => {
    const history: HistoryEntry[] = [
      { date: "2026-07-01", ist: 10 },
      { date: "2026-07-10", ist: 60 },
      { date: "2026-07-20", ist: 90 },
    ]
    for (const day of ["2026-06-15", "2026-07-01", "2026-07-15", "2026-07-31", "2026-08-05"]) {
      const now = new Date(day)
      expect(ts.timelineData(goal, sampleRows(), history, now)).toEqual(
        legacy.timelineData(goal, sampleRows(), history, day)
      )
    }

    // invalid range: end before start
    const badGoal = { ...goal, periodStart: "2026-07-31", periodEnd: "2026-07-01" }
    expect(ts.timelineData(badGoal, sampleRows(), history)).toEqual(
      legacy.timelineData(badGoal, sampleRows(), history)
    )

    // no history yet
    expect(ts.timelineData(goal, sampleRows(), [], new Date("2026-07-15"))).toEqual(
      legacy.timelineData(goal, sampleRows(), [], "2026-07-15")
    )
  })
})
