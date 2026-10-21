import { describe, expect, it } from "vitest"
import { computePlanStandings } from "../../src/lib/calc/befoerderung"
import { insuranceReconcile, planStageOf, stageSegments } from "../../src/lib/calc/planStufen"
import { applyUnitDelta, computeEarnings, unitBookingOps, withUnitsAdjustingCareer } from "../../src/lib/calc/verguetung"
import { resetRowsForNewMonth } from "../../src/lib/calc/archive"
import { DEFAULT_PLAN_RATES, PLAN_IDS, type PlanId } from "../../src/lib/calc/struktur"
import type { EmployeeRow } from "../../src/lib/calc/format"
import type { MergedRow } from "../../src/lib/calc/team"

const cu = (investment = 0, credit = 0, realestate = 0, insurance = 0) => ({ insurance, investment, credit, realestate })
const delta = (partial: Partial<Record<PlanId, number>>) => {
  const d = {} as Record<PlanId, number>
  PLAN_IDS.forEach((p) => (d[p] = partial[p] ?? 0))
  return d
}
function merged(name: string, role: string, managerName: string | null, over: Partial<MergedRow> = {}): MergedRow {
  return { name, role, managerName, depth: 0, rowIndex: null, soll: 0, ist: 0, ...over }
}

describe("planStageOf", () => {
  it("Trainee FT4 ohne Kredite ist im Credit-Plan FT1", () => {
    expect(planStageOf({ role: "FT4" }, "credit")).toBe("FT1")
  })
  it("Insurance folgt der Strukturbaum-Rolle", () => {
    expect(planStageOf({ role: "FT4", careerUnits: cu(5000, 5000, 5000) }, "insurance")).toBe("FT4")
  })
  it("Credit: 1.999 -> FT1, 2.000 -> FT2, 4.000 -> FT3 (Ende)", () => {
    expect(planStageOf({ role: "FT1", careerUnits: cu(0, 1999) }, "credit")).toBe("FT1")
    expect(planStageOf({ role: "FT1", careerUnits: cu(0, 2000) }, "credit")).toBe("FT2")
    expect(planStageOf({ role: "FT1", careerUnits: cu(0, 4000) }, "credit")).toBe("FT3")
    expect(planStageOf({ role: "FT1", careerUnits: cu(0, 99999) }, "credit")).toBe("FT3")
  })
  it("Real Estate endet bei FT2", () => {
    expect(planStageOf({ role: "FT1", careerUnits: cu(0, 0, 999) }, "realestate")).toBe("FT1")
    expect(planStageOf({ role: "FT1", careerUnits: cu(0, 0, 1000) }, "realestate")).toBe("FT2")
    expect(planStageOf({ role: "FT1", careerUnits: cu(0, 0, 50000) }, "realestate")).toBe("FT2")
  })
  it("Investment: 1.000 -> FT2, 2.000 -> FT3; investmentVb nutzt dieselbe Stufe", () => {
    expect(planStageOf({ role: "FT1", careerUnits: cu(1000) }, "investment")).toBe("FT2")
    expect(planStageOf({ role: "FT1", careerUnits: cu(2000) }, "investment")).toBe("FT3")
    expect(planStageOf({ role: "FT1", careerUnits: cu(1000) }, "investmentVb")).toBe("FT2")
  })
  it("ab Teamleiter gilt die Rolle in allen Plänen", () => {
    PLAN_IDS.forEach((p) => expect(planStageOf({ role: "Teamleiter" }, p)).toBe("Teamleiter"))
  })
})

describe("computePlanStandings", () => {
  it("zeigt, was bis zur nächsten Stufe fehlt", () => {
    const s = computePlanStandings({ role: "FT3", careerUnits: cu(0, 2500) })!
    const credit = s.find((x) => x.planId === "credit")!
    expect(credit).toMatchObject({ role: "FT2", nextRole: "FT3", have: 2500, need: 4000, missing: 1500 })
    const re = s.find((x) => x.planId === "realestate")!
    expect(re).toMatchObject({ role: "FT1", nextRole: "FT2", missing: 1000 })
  })
  it("Ende der Leiter hat keine nächste Stufe; Führungskräfte haben keine Plan-Stufen", () => {
    expect(computePlanStandings({ role: "FT1", careerUnits: cu(0, 0, 1000) })!.find((x) => x.planId === "realestate")!.nextRole).toBeNull()
    expect(computePlanStandings({ role: "Teamleiter" })).toBeNull()
  })
})

describe("Vergütung nach Plan-Stufe", () => {
  it("FT4-Trainee bekommt im Credit-Plan den FT1-Satz, der Teamleiter die Differenz dazu", () => {
    const rows = [
      merged("TL", "Teamleiter", null),
      merged("T", "FT4", "TL", { ehByPlan: { credit: 100 } }),
    ]
    const e = computeEarnings(rows, DEFAULT_PLAN_RATES)
    expect(e.get("T")!.own.credit.rate).toBe(DEFAULT_PLAN_RATES.credit.FT1)
    expect(e.get("TL")!.diff.credit.amount).toBe(100 * (DEFAULT_PLAN_RATES.credit.Teamleiter - DEFAULT_PLAN_RATES.credit.FT1))
  })
  it("ab der Schwelle gilt der FT2-Satz", () => {
    const rows = [merged("T", "FT1", null, { ehByPlan: { credit: 10 }, careerUnits: cu(0, 2010) })]
    expect(computeEarnings(rows, DEFAULT_PLAN_RATES).get("T")!.own.credit.rate).toBe(2)
  })
  it("Investment mit VB: FT2 1,50 / FT3 2,00; ohne VB: FT2 2,00 / FT3 2,50", () => {
    const t2 = merged("T2", "FT1", null, { ehByPlan: { investment: 1, investmentVb: 1 }, careerUnits: cu(1002) })
    const e2 = computeEarnings([t2], DEFAULT_PLAN_RATES).get("T2")!
    expect(e2.own.investment.rate).toBe(2)
    expect(e2.own.investmentVb.rate).toBe(1.5)
    const t3 = merged("T3", "FT1", null, { ehByPlan: { investment: 1, investmentVb: 1 }, careerUnits: cu(2002) })
    const e3 = computeEarnings([t3], DEFAULT_PLAN_RATES).get("T3")!
    expect(e3.own.investment.rate).toBe(2.5)
    expect(e3.own.investmentVb.rate).toBe(2)
  })
  it("Trainee FT1 bekommt in Investment immer 1 €; Führungskraft bekommt die Differenz, Abwickler ebenfalls", () => {
    expect(DEFAULT_PLAN_RATES.investment.FT1).toBe(1)
    expect(DEFAULT_PLAN_RATES.investmentVb.FT1).toBe(1)
    const rows = [
      merged("TL", "Teamleiter", null),
      merged("T", "FT1", "TL", { ehByPlan: { investment: 10, investmentVb: 10 } }),
    ]
    const e = computeEarnings(rows, DEFAULT_PLAN_RATES)
    expect(e.get("T")!.own.investment.rate).toBe(1)
    expect(e.get("T")!.own.investmentVb.rate).toBe(1)
    expect(e.get("TL")!.diff.investment.amount).toBe(10 * (DEFAULT_PLAN_RATES.investment.Teamleiter - 1))
    expect(e.get("TL")!.diff.investmentVb.amount).toBe(10 * (DEFAULT_PLAN_RATES.investmentVb.Teamleiter - 1))
  })
})

describe("Karrierezähler beim Buchen", () => {
  const base = (over: Partial<EmployeeRow> = {}): EmployeeRow => ({ name: "A", soll: 0, ist: 0, ehByPlan: { insurance: 1 }, ...over } as EmployeeRow)
  it("applyUnitDelta zählt Insurance, Investment (inkl. VB), Credit und Real Estate mit", () => {
    const r = applyUnitDelta(base({ careerUnits: cu(10) }), delta({ insurance: 5, investment: 2, investmentVb: 3, credit: 4, realestate: 1 }))
    expect(r.careerUnits).toEqual(cu(15, 4, 1, 5))
  })
  it("unitBookingOps erhöht careerUnits atomar", () => {
    const { increments } = unitBookingOps(base(), delta({ investmentVb: 3, credit: 4 }))
    expect(increments).toContainEqual({ path: ["careerUnits", "investment"], by: 3 })
    expect(increments).toContainEqual({ path: ["careerUnits", "credit"], by: 4 })
    expect(increments.some((i) => i.path[1] === "realestate")).toBe(false)
  })
  it("Altzeile ohne ehByPlan setzt careerUnits als Endwert", () => {
    const { absolute } = unitBookingOps({ name: "A", soll: 0, ist: 3 } as EmployeeRow, delta({ credit: 4 }))
    expect(absolute.careerUnits).toEqual(cu(0, 4, 0))
  })
  it("Monatsabschluss setzt careerUnits nicht zurück", () => {
    const [r] = resetRowsForNewMonth([base({ careerUnits: cu(7, 8, 9) })])
    expect(r.careerUnits).toEqual(cu(7, 8, 9))
  })
})

describe("Aufstieg mitten im Monat (stageSegments)", () => {
  const units = (p: Partial<Record<PlanId, number>>) => {
    const u = {} as Record<PlanId, number>
    PLAN_IDS.forEach((id) => (u[id] = p[id] ?? 0))
    return u
  }
  const row = (careerUnits: ReturnType<typeof cu>, role = "FT1") => ({ role, careerUnits })

  it("Neuling mit 1.200 Credit-EH, Schwelle FT2 bei 1.000 (Real Estate): 1.000 zu FT1 + 200 zu FT2", () => {
    expect(stageSegments(row(cu(0, 0, 1200)), "realestate", units({ realestate: 1200 }))).toEqual([
      { role: "FT1", units: 1000 }, { role: "FT2", units: 200 },
    ])
  })
  it("zwei Schwellen im selben Monat", () => {
    expect(stageSegments(row(cu(0, 4500)), "credit", units({ credit: 4500 }))).toEqual([
      { role: "FT1", units: 2000 }, { role: "FT2", units: 2000 }, { role: "FT3", units: 500 },
    ])
  })
  it("Folgemonat: Zähler schon über der Schwelle, alles zur aktuellen Stufe", () => {
    expect(stageSegments(row(cu(0, 3000)), "credit", units({ credit: 500 }))).toEqual([{ role: "FT2", units: 500 }])
  })
  it("exakt auf der Schwelle: nichts zur neuen Stufe", () => {
    expect(stageSegments(row(cu(0, 2000)), "credit", units({ credit: 2000 }))).toEqual([{ role: "FT1", units: 2000 }])
  })
  it("Investment und Investment mit VB teilen sich den Zähler, Anteile proportional", () => {
    const segs = stageSegments(row(cu(1200)), "investmentVb", units({ investment: 600, investmentVb: 600 }))
    expect(segs).toEqual([{ role: "FT1", units: 500 }, { role: "FT2", units: 100 }])
  })
  it("Insurance: Rolle weiter als Zähler (noch nicht nachgezogen) rechnet nichts rückwirkend billiger", () => {
    expect(stageSegments({ role: "FT3", careerUnits: cu() }, "insurance", units({ insurance: 300 }))).toEqual([{ role: "FT3", units: 300 }])
  })
  it("Insurance: Rolle wurde schon angehoben, der Zähler hat die Schwelle im Monat überschritten", () => {
    expect(stageSegments({ role: "FT2", careerUnits: { insurance: 1200 } }, "insurance", units({ insurance: 1200 }))).toEqual([
      { role: "FT1", units: 1000 }, { role: "FT2", units: 200 },
    ])
  })
  it("Führungskräfte: ein Segment mit der Rolle", () => {
    expect(stageSegments({ role: "Teamleiter" }, "credit", units({ credit: 50 }))).toEqual([{ role: "Teamleiter", units: 50 }])
  })

  it("Nutzerbeispiel: 1.000 × 1 € + 200 × 2 € = 1.400 €", () => {
    const rates = { ...DEFAULT_PLAN_RATES, realestate: { FT1: 1, FT2: 2 } }
    const rows = [merged("N", "FT1", null, { ehByPlan: { realestate: 1200 }, careerUnits: cu(0, 0, 1200) })]
    const e = computeEarnings(rows, rates).get("N")!
    expect(e.own.realestate.amount).toBe(1400)
    expect(e.own.realestate.segments).toEqual([{ units: 1000, rate: 1 }, { units: 200, rate: 2 }])
  })
  it("Teamleiter bekommt die Differenz je Segment", () => {
    const rates = { ...DEFAULT_PLAN_RATES, credit: { FT1: 1, FT2: 2, FT3: 2.5, Teamleiter: 3 } }
    const rows = [
      merged("TL", "Teamleiter", null),
      merged("T", "FT1", "TL", { ehByPlan: { credit: 2100 }, careerUnits: cu(0, 2100) }),
    ]
    const e = computeEarnings(rows, rates)
    expect(e.get("T")!.own.credit.amount).toBe(2000 * 1 + 100 * 2)
    expect(e.get("TL")!.diff.credit.amount).toBe(2000 * (3 - 1) + 100 * (3 - 2))
  })
  it("manuelle Einheiten-Korrektur zieht den Zähler mit", () => {
    const r = withUnitsAdjustingCareer({ name: "A", soll: 0, ist: 10, ehByPlan: { credit: 10 }, careerUnits: cu(0, 10) } as EmployeeRow,
      { insurance: 0, investment: 0, investmentVb: 0, credit: 4, realestate: 0 })
    expect(r.careerUnits?.credit).toBe(4)
  })
})

describe("insuranceReconcile", () => {
  it("Zähler über der Rolle: Rolle anheben", () => {
    expect(insuranceReconcile("FT1", 1000, 1000)).toEqual({ role: "FT2" })
    expect(insuranceReconcile("FT2", 4500, 0)).toEqual({ role: "FT4" })
  })
  it("Rolle über dem Zähler: Zähler auf Schwelle + Monatseinheiten", () => {
    expect(insuranceReconcile("FT3", 0, 300)).toEqual({ careerInsurance: 2300 })
  })
  it("passt es schon, passiert nichts; Führungskräfte werden ignoriert; schreibt nie abwärts", () => {
    expect(insuranceReconcile("FT2", 1500, 100)).toEqual({})
    expect(insuranceReconcile("Teamleiter", 50000, 0)).toEqual({})
    expect(insuranceReconcile("FT 2", 1000, 0)).toEqual({})
  })
})
