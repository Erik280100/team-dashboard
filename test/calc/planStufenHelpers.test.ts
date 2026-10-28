import { describe, expect, it } from "vitest"
import { basePlanOf, careerDeltaOf, careerTotal, planLadderStage } from "../../src/lib/calc/planStufen"

describe("basePlanOf", () => {
  it("investmentVb zählt auf den Investment-Zähler, unbekannte Pläne auf keinen", () => {
    expect(basePlanOf("investmentVb")).toBe("investment")
    expect(basePlanOf("insurance")).toBe("insurance")
    expect(basePlanOf("realestate")).toBe("realestate")
    expect(basePlanOf("unbekannt" as never)).toBeNull()
  })
})

describe("careerDeltaOf", () => {
  it("faltet investmentVb in investment und macht aus Nicht-Zahlen 0", () => {
    expect(careerDeltaOf({ insurance: 5, investment: 2, investmentVb: 3 })).toEqual({ insurance: 5, investment: 5, credit: 0, realestate: 0 })
    expect(careerDeltaOf({ credit: "x" as unknown as number })).toEqual({ insurance: 0, investment: 0, credit: 0, realestate: 0 })
  })
})

describe("planLadderStage", () => {
  it("wechselt genau an den Schwellen (Insurance: 0 / 1000 / 2000 / 4000)", () => {
    expect(planLadderStage("insurance", 0).step.role).toBe("FT1")
    expect(planLadderStage("insurance", 999).step.role).toBe("FT1")
    expect(planLadderStage("insurance", 1000).step.role).toBe("FT2")
    expect(planLadderStage("insurance", 3999).step.role).toBe("FT3")
    expect(planLadderStage("insurance", 4000).step.role).toBe("FT4")
  })

  it("liefert die nächste Stufe, am Ende der Leiter null", () => {
    expect(planLadderStage("insurance", 0).next?.role).toBe("FT2")
    expect(planLadderStage("insurance", 99999).next).toBeNull()
  })
})

describe("careerTotal", () => {
  it("Insurance: die Strukturbaum-Rolle ist die Untergrenze des Zählers", () => {
    expect(careerTotal({ role: "FT3", careerUnits: { insurance: 10 } }, "insurance")).toBe(2000)
    expect(careerTotal({ role: "FT1", careerUnits: { insurance: 1500 } }, "insurance")).toBe(1500)
  })

  it("andere Pläne: nur der Zähler, fehlend = 0", () => {
    expect(careerTotal({ role: "FT4", careerUnits: { credit: 7 } }, "credit")).toBe(7)
    expect(careerTotal({ role: "FT4" }, "realestate")).toBe(0)
  })
})
