import { describe, expect, it } from "vitest"
import { applyUnitDelta, unitBookingOps } from "../../src/lib/calc/verguetung"
import type { EmployeeRow } from "../../src/lib/calc/format"
import { PLAN_IDS, type PlanId } from "../../src/lib/calc/struktur"

function delta(partial: Partial<Record<PlanId, number>>): Record<PlanId, number> {
  const d = {} as Record<PlanId, number>
  PLAN_IDS.forEach((p) => (d[p] = partial[p] ?? 0))
  return d
}
const base = (over: Partial<EmployeeRow> = {}): EmployeeRow => ({
  name: "A", soll: 0, ist: 5, ehByPlan: { insurance: 3, investment: 2 }, ...over,
} as EmployeeRow)

describe("applyUnitDelta", () => {
  it("addiert je Plan und hält ist als Summe", () => {
    const r = applyUnitDelta(base(), delta({ insurance: 2, credit: 1 }))
    expect(r.ehByPlan?.insurance).toBe(5)
    expect(r.ehByPlan?.credit).toBe(1)
    expect(r.ist).toBe(8)
  })
  it("schreibt VB-Einheiten dem Abwickler zu", () => {
    const r = applyUnitDelta(base({ vbByAbwickler: { Georg: 1 } }), delta({ investmentVb: 4 }), "Georg")
    expect(r.vbByAbwickler).toEqual({ Georg: 5 })
  })
  it("Altzeile ohne ehByPlan: ist zählt als Insurance", () => {
    const r = applyUnitDelta({ name: "A", soll: 0, ist: 7 } as EmployeeRow, delta({ insurance: 3 }))
    expect(r.ehByPlan?.insurance).toBe(10)
    expect(r.ist).toBe(10)
  })
})

describe("unitBookingOps", () => {
  it("zählt nur die gebuchten Pläne und ist atomar hoch", () => {
    const { increments, absolute } = unitBookingOps(base(), delta({ insurance: 2, credit: 1 }))
    expect(increments).toEqual([
      { path: ["ehByPlan", "insurance"], by: 2 },
      { path: ["ehByPlan", "credit"], by: 1 },
      { path: ["ist"], by: 3 },
      { path: ["careerUnits", "credit"], by: 1 },
    ])
    expect(absolute).toEqual({})
  })
  it("VB: zusätzlich Abwickler-Zähler, Name mit Punkt bleibt ein einzelner Pfadteil", () => {
    const { increments } = unitBookingOps(base(), delta({ investmentVb: 2 }), "Dr. Georg K.")
    expect(increments).toContainEqual({ path: ["vbByAbwickler", "Dr. Georg K."], by: 2 })
  })
  it("Altzeile ohne ehByPlan: einmal Endwert, kein Hochzählen von ist", () => {
    const { increments, absolute } = unitBookingOps({ name: "A", soll: 0, ist: 7 } as EmployeeRow, delta({ insurance: 3 }))
    expect(increments).toEqual([])
    expect(absolute.ist).toBe(10)
    expect((absolute.ehByPlan as Record<string, number>).insurance).toBe(10)
  })
  it("nichts gebucht: keine Schreibvorgänge", () => {
    expect(unitBookingOps(base(), delta({}))).toEqual({ increments: [], absolute: {} })
  })
})
