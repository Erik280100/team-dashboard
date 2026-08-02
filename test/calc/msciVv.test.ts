import { describe, expect, it } from "vitest"
import {
  MSCI_MONTHLY_RETURNS, MSCI_STATS, VV_ANNUAL_RETURNS, VV_DISTRIBUTION_MIX,
  VV_DISTRIBUTION_YIELD_PCT, VV_MONTHLY_RETURNS, VV_STATS,
  cagrPct, maxDrawdownPct, paidInLine, simulateGrowth, simulateVvWithDistributions,
} from "../../src/lib/calc/msciVv"

describe("simulateGrowth", () => {
  it("repeats the monthly-return block to cover the requested horizon", () => {
    const values = simulateGrowth([10, -10], 1, 100) // +10%, -10%, +10%, -10%, ... x12 months
    expect(values).toHaveLength(13)
    expect(values[0]).toBe(100)
    // 12 months = 6 full [+10,-10] cycles -> (1.1 * 0.9)^6
    expect(values[12]).toBeCloseTo(100 * Math.pow(1.1 * 0.9, 6), 6)
  })

  it("returns just the start capital for a zero-year horizon", () => {
    expect(simulateGrowth([5, -5], 0, 1000)).toEqual([1000])
  })

  it("adds the monthly contribution before applying that month's return", () => {
    const values = simulateGrowth([10], 0.25, 0, 100) // 3 months, 0% start, +10%/mo, no growth on month 0
    // m1: (0+100)*1.1=110, m2: (110+100)*1.1=231, m3: (231+100)*1.1=364.1
    expect(values).toHaveLength(4)
    expect(values[1]).toBeCloseTo(110, 6)
    expect(values[2]).toBeCloseTo(231, 6)
    expect(values[3]).toBeCloseTo(364.1, 6)
  })

  it("is unaffected by monthlyContribution=0 (default), matching the lump-sum-only behaviour", () => {
    const withDefault = simulateGrowth([3, -2, 1], 2, 5000)
    const withExplicitZero = simulateGrowth([3, -2, 1], 2, 5000, 0)
    expect(withDefault).toEqual(withExplicitZero)
  })
})

describe("VV_DISTRIBUTION_MIX / VV_DISTRIBUTION_YIELD_PCT", () => {
  it("weights sum to 100% (the real portfolio composition supplied by the user)", () => {
    const totalWeight = VV_DISTRIBUTION_MIX.reduce((s, m) => s + m.weightPct, 0)
    expect(totalWeight).toBeCloseTo(100, 6)
  })

  it("blends to the documented ~1.99% p.a. gross distribution yield", () => {
    expect(VV_DISTRIBUTION_YIELD_PCT).toBeCloseTo(1.988, 2)
  })
})

describe("simulateVvWithDistributions", () => {
  it("matches simulateGrowth when distributionYieldPct is 0 (no distributions at all)", () => {
    const withDistributions = simulateVvWithDistributions([3, -2, 1, 4], 1, 1000, 50, 0)
    const plain = simulateGrowth([3, -2, 1, 4], 1, 1000, 50)
    expect(withDistributions).toEqual(plain)
  })

  it("adds the full distribution (no tax deduction) on top of price growth at each 12-month mark", () => {
    // flat 0% price return for 12 months, so the only change comes from the year-end
    // distribution: 1000 * 5% = 50, fully reinvested — a pure bonus the ETF doesn't get.
    const values = simulateVvWithDistributions(new Array(12).fill(0), 1, 1000, 0, 5)
    expect(values).toHaveLength(13)
    expect(values[11]).toBeCloseTo(1000, 6) // unchanged through month 11
    expect(values[12]).toBeCloseTo(1050, 6)
  })

  it("a higher distribution yield adds more, not less", () => {
    const lowYield = simulateVvWithDistributions(new Array(12).fill(0), 1, 1000, 0, 2)
    const highYield = simulateVvWithDistributions(new Array(12).fill(0), 1, 1000, 0, 5)
    expect(highYield[12]).toBeGreaterThan(lowYield[12])
  })

  it("distributes every 12 months, not just once at the very end, for multi-year horizons", () => {
    const values = simulateVvWithDistributions(new Array(12).fill(0), 3, 1000, 0, 5)
    // three separate 5% distributions, compounding once per year
    expect(values[36]).toBeCloseTo(1000 * Math.pow(1.05, 3), 6)
  })
})

describe("paidInLine", () => {
  it("tracks start capital plus cumulative monthly contributions", () => {
    const line = paidInLine(1, 1000, 100)
    expect(line).toHaveLength(13)
    expect(line[0]).toBe(1000)
    expect(line[12]).toBe(1000 + 100 * 12)
  })
})

describe("maxDrawdownPct", () => {
  it("is 0 for a monotonically rising series", () => {
    expect(maxDrawdownPct([100, 110, 120, 130])).toBe(0)
  })

  it("finds the largest peak-to-trough decline, not just the last one", () => {
    // peak 150 -> trough 90 = -40%; later peak 200 -> trough 180 = -10%
    expect(maxDrawdownPct([100, 150, 90, 200, 180])).toBeCloseTo(-40, 6)
  })
})

describe("cagrPct", () => {
  it("annualizes total growth over the given number of years", () => {
    expect(cagrPct([100, 200], 1)).toBeCloseTo(100, 6)
    expect(cagrPct([100, 121], 2)).toBeCloseTo(10, 6) // (1.1)^2 = 1.21
  })
})

describe("VV_MONTHLY_RETURNS", () => {
  it("has 72 entries (6-year repeating block, matching MSCI block length)", () => {
    expect(VV_MONTHLY_RETURNS).toHaveLength(72)
    expect(MSCI_MONTHLY_RETURNS).toHaveLength(72)
  })

  it("each calendar year compounds to the real annual VV return it was built from", () => {
    VV_ANNUAL_RETURNS.forEach((annualPct, yearIdx) => {
      const yearMonths = VV_MONTHLY_RETURNS.slice(yearIdx * 12, yearIdx * 12 + 12)
      const compounded = yearMonths.reduce((acc, r) => acc * (1 + r / 100), 1)
      expect((compounded - 1) * 100).toBeCloseTo(annualPct, 1)
    })
  })
})

describe("calibration vs. the published fund/VV fact sheets", () => {
  // One full 72-month block = 6 years; both series are engineered to reproduce the
  // headline stats from the source screenshots reasonably closely (this is a stylised
  // model, not a historical replay — see comment in src/lib/calc/msciVv.ts).
  it("MSCI block: CAGR / max drawdown land close to the factsheet figures", () => {
    const values = simulateGrowth(MSCI_MONTHLY_RETURNS, 6, 100)
    expect(cagrPct(values, 6)).toBeCloseTo(MSCI_STATS.cagr, 0)
    expect(maxDrawdownPct(values)).toBeGreaterThan(MSCI_STATS.maxDrawdown - 3)
    expect(maxDrawdownPct(values)).toBeLessThan(MSCI_STATS.maxDrawdown + 3)
  })

  it("VV block: CAGR matches the real 2021-2026 annual returns it's built from", () => {
    // VV_STATS.maxDrawdown (-28.4%) is the fund's full-history risk figure and predates
    // 2021, so it's intentionally NOT expected to match the 2021-2026-only chart block
    // (see module comment) — only CAGR, which is derived purely from VV_ANNUAL_RETURNS,
    // is checked against it here.
    const values = simulateGrowth(VV_MONTHLY_RETURNS, 6, 100)
    expect(cagrPct(values, 6)).toBeCloseTo(VV_STATS.cagr, 0)
  })

  it("MSCI swings more and draws down deeper than the VV, as intended by the sales pitch", () => {
    const msci = simulateGrowth(MSCI_MONTHLY_RETURNS, 6, 100)
    const vv = simulateGrowth(VV_MONTHLY_RETURNS, 6, 100)
    expect(maxDrawdownPct(msci)).toBeLessThan(maxDrawdownPct(vv)) // more negative
    expect(cagrPct(msci, 6)).toBeGreaterThan(cagrPct(vv, 6))
  })
})
