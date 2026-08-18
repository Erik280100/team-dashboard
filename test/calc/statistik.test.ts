import { describe, expect, it } from "vitest"
import {
  compareMonths, employeeMatrix, monthsInRange, planSplit, teamTrend,
} from "../../src/lib/calc/statistik"
import { monthLabel } from "../../src/lib/calc/archive"
import { DEFAULT_PLAN_RATES, type SbNode } from "../../src/lib/calc/struktur"
import type { ArchiveIndexEntry, MonthSnapshot, MonthTotals } from "../../src/types/archive"

const EMPTY_TOTALS: MonthTotals = {
  soll: 0, ist: 0, pct: 0, atPlan: 0, atIst: 0, btPlan: 0, btIst: 0, etPlan: 0, etIst: 0,
  ehByPlan: { insurance: 0, investment: 0, investmentVb: 0, credit: 0, realestate: 0 },
  totalEur: 0, employeeCount: 0, newHireCount: 0, recruitGoal: 0, recruitActual: 0,
}

function entry(month: string, totals: Partial<MonthTotals> = {}): ArchiveIndexEntry {
  return {
    month,
    label: monthLabel(month),
    periodStart: `${month}-01`,
    periodEnd: `${month}-28`,
    closedAt: "2026-01-01T00:00:00.000Z",
    totals: { ...EMPTY_TOTALS, ...totals, ehByPlan: { ...EMPTY_TOTALS.ehByPlan, ...totals.ehByPlan } },
  }
}

describe("monthsInRange", () => {
  const index = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"].map((m) => entry(m))

  it("ist inklusive an beiden Grenzen", () => {
    const result = monthsInRange(index, "2026-02", "2026-04")
    expect(result.map((e) => e.month)).toEqual(["2026-02", "2026-03", "2026-04"])
  })

  it("funktioniert unabhängig von der Reihenfolge der Argumente", () => {
    const result = monthsInRange(index, "2026-04", "2026-02")
    expect(result.map((e) => e.month)).toEqual(["2026-02", "2026-03", "2026-04"])
  })
})

describe("teamTrend", () => {
  it("übernimmt die Aggregate 1:1 aus dem Index", () => {
    const index = [entry("2026-01", { ist: 40, soll: 100, pct: 40 }), entry("2026-02", { ist: 80, soll: 100, pct: 80 })]
    const trend = teamTrend(index)
    expect(trend.map((t) => t.pct)).toEqual([40, 80])
    expect(trend[0].label).toBe("Jänner 2026") // de-AT nutzt "Jänner" statt "Januar"
  })
})

describe("compareMonths", () => {
  it("liefert pctChange === null, wenn a === 0", () => {
    const a = entry("2026-01", { ist: 0 })
    const b = entry("2026-02", { ist: 10 })
    const deltas = compareMonths(a, b)
    const ist = deltas.find((d) => d.key === "ist")!
    expect(ist.a).toBe(0)
    expect(ist.b).toBe(10)
    expect(ist.delta).toBe(10)
    expect(ist.pctChange).toBeNull()
  })

  it("berechnet die prozentuale Veränderung sonst korrekt", () => {
    const a = entry("2026-01", { ist: 100 })
    const b = entry("2026-02", { ist: 150 })
    const ist = compareMonths(a, b).find((d) => d.key === "ist")!
    expect(ist.delta).toBe(50)
    expect(ist.pctChange).toBe(50)
  })
})

describe("employeeMatrix", () => {
  const treeWithoutAnna: SbNode = {
    id: "root", name: "Chef", role: "Geschäftsstellenleiter", children: [],
  }
  const treeWithAnna: SbNode = {
    id: "root", name: "Chef", role: "Geschäftsstellenleiter",
    children: [{ id: "a", name: "Anna Berger", role: "FT1", children: [] }],
  }

  const juneSnapshot: MonthSnapshot = {
    version: 1, month: "2026-06", closedAt: "2026-07-01T00:00:00.000Z", closedBy: null,
    rows: [{ name: "Chef", soll: 100, ist: 40, ehByPlan: { insurance: 40, investment: 0, credit: 0, realestate: 0 } }],
    teamGoal: { note: "", recruitGoal: 0, recruitActual: null, periodStart: "2026-06-01", periodEnd: "2026-06-30" },
    history: [],
    orgChart: { tree: treeWithoutAnna, notes: {}, conns: [], rates: {}, planRates: DEFAULT_PLAN_RATES },
  }
  const julySnapshot: MonthSnapshot = {
    version: 1, month: "2026-07", closedAt: "2026-08-01T00:00:00.000Z", closedBy: null,
    rows: [
      { name: "Chef", soll: 100, ist: 60, ehByPlan: { insurance: 60, investment: 0, credit: 0, realestate: 0 } },
      { name: "Anna Berger", soll: 50, ist: 20, ehByPlan: { insurance: 20, investment: 0, credit: 0, realestate: 0 } },
    ],
    teamGoal: { note: "", recruitGoal: 0, recruitActual: null, periodStart: "2026-07-01", periodEnd: "2026-07-31" },
    history: [],
    orgChart: { tree: treeWithAnna, notes: {}, conns: [], rates: {}, planRates: DEFAULT_PLAN_RATES },
  }

  it("markiert Monate ohne die Person als present:false und rechnet Σ/Ø/Trend nur über vorhandene Monate", () => {
    const matrix = employeeMatrix([juneSnapshot, julySnapshot])
    const anna = matrix.find((e) => e.name === "Anna Berger")!
    expect(anna.cells).toHaveLength(2)
    expect(anna.cells[0]).toMatchObject({ month: "2026-06", present: false, ist: 0 })
    expect(anna.cells[1]).toMatchObject({ month: "2026-07", present: true, ist: 20 })
    expect(anna.total).toBe(20)
    expect(anna.avg).toBe(20)
    expect(anna.trend).toBe(0) // nur ein vorhandener Monat -> letzter minus erster = 0

    const chef = matrix.find((e) => e.name === "Chef")!
    expect(chef.cells.every((c) => c.present)).toBe(true)
    expect(chef.total).toBe(100)
    expect(chef.avg).toBe(50)
    expect(chef.trend).toBe(20) // 60 - 40
  })
})

describe("planSplit", () => {
  it("share summiert auf 100", () => {
    const index = [entry("2026-01", { ehByPlan: { insurance: 30, investment: 10, investmentVb: 0, credit: 0, realestate: 0 } })]
    const [point] = planSplit(index)
    expect(point.total).toBe(40)
    const sum = Object.values(point.share).reduce((s, v) => s + v, 0)
    expect(sum).toBeCloseTo(100, 6)
    expect(point.share.insurance).toBeCloseTo(75, 6)
    expect(point.share.investment).toBeCloseTo(25, 6)
  })

  it("share ist 0, wenn der Monat leer ist", () => {
    const index = [entry("2026-01")]
    const [point] = planSplit(index)
    expect(point.total).toBe(0)
    expect(Object.values(point.share).every((v) => v === 0)).toBe(true)
  })
})
