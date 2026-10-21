import { describe, expect, it } from "vitest"
import { applyRoleChanges, monthInsuranceUnits, planCareerChange, type CareerShared } from "../../functions/src/careerStagePlan"
import { insuranceReconcile } from "../../src/lib/calc/planStufen"

const shared: CareerShared = { insuranceReconcile }

describe("planCareerChange", () => {
  it("Zähler über der Rolle -> Rolle anheben", () => {
    expect(planCareerChange("a", { role: "FT1", careerUnits: { insurance: 1000 } }, shared)).toEqual({ id: "a", role: "FT2" })
  })
  it("Rolle über dem Zähler -> Zähler nachziehen (Monatseinheiten aus ehByPlan, sonst ist)", () => {
    expect(planCareerChange("a", { role: "FT3", ehByPlan: { insurance: 300 } }, shared)).toEqual({ id: "a", careerInsurance: 2300 })
    expect(monthInsuranceUnits({ ist: 40 })).toBe(40)
  })
  it("Führungskräfte, inaktive und passende Mitarbeiter bleiben unberührt", () => {
    expect(planCareerChange("a", { role: "Teamleiter", careerUnits: { insurance: 99999 } }, shared)).toBeNull()
    expect(planCareerChange("a", { role: "FT1", active: false, careerUnits: { insurance: 5000 } }, shared)).toBeNull()
    expect(planCareerChange("a", { role: "FT2", careerUnits: { insurance: 1500 } }, shared)).toBeNull()
  })
})

describe("applyRoleChanges", () => {
  const tree = () => ({ id: "root", role: "Direktor", children: [
    { id: "a", role: "FT 1" }, { id: "b", role: "FT3" }, { id: "c", role: "Teamleiter" },
  ] })
  it("hebt nur FT-Rollen an und nie ab", () => {
    const t = tree()
    const changed = applyRoleChanges(t, new Map([["a", "FT2"], ["b", "FT2"], ["c", "FT4"]]))
    expect(changed).toEqual(["a"])
    expect(t.children.map((n) => n.role)).toEqual(["FT2", "FT3", "Teamleiter"])
  })
})
