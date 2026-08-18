import { describe, expect, it } from "vitest"
import { DEFAULT_PLAN_RATES, PLAN_IDS, withDefaultPlanRates } from "../../src/lib/calc/struktur"

describe("withDefaultPlanRates", () => {
  it("füllt einen komplett fehlenden Plan (z. B. investmentVb bei Altbeständen) aus DEFAULT_PLAN_RATES auf", () => {
    const stored = {
      insurance: { Direktor: 9 }, investment: { Direktor: 6.5 }, credit: {}, realestate: {},
    }
    const result = withDefaultPlanRates(stored)
    expect(result.investmentVb).toEqual(DEFAULT_PLAN_RATES.investmentVb)
    expect(result.insurance).toEqual({ Direktor: 9 })
  })

  it("reichert einen vorhandenen Plan NICHT rollenweise mit Defaults an", () => {
    const stored = { insurance: { Direktor: 9 } }
    const result = withDefaultPlanRates(stored)
    expect(result.insurance).toEqual({ Direktor: 9 })
    expect(result.insurance.Regionalleiter).toBeUndefined()
  })

  it("ein bewusst geleertes Plan-Objekt ({}) bleibt leer statt auf Defaults zurückzufallen", () => {
    const result = withDefaultPlanRates({ investmentVb: {} })
    expect(result.investmentVb).toEqual({})
  })

  it("undefined/null liefert vollständige Defaults für alle PLAN_IDS", () => {
    expect(withDefaultPlanRates(undefined)).toEqual(DEFAULT_PLAN_RATES)
    expect(withDefaultPlanRates(null)).toEqual(DEFAULT_PLAN_RATES)
  })

  it("liefert immer frische Objekte, nie Referenzen auf DEFAULT_PLAN_RATES", () => {
    const result = withDefaultPlanRates()
    result.insurance.Direktor = 999
    expect(DEFAULT_PLAN_RATES.insurance.Direktor).not.toBe(999)
  })

  it("deckt alle PLAN_IDS ab", () => {
    const result = withDefaultPlanRates()
    PLAN_IDS.forEach((p) => expect(result[p]).toBeDefined())
  })
})
