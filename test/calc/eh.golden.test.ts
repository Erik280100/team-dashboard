import { describe, expect, it } from "vitest"
import { calcEh, EH_GROUPS, EH_ITEMS, ehFormatEH, ehFormatEUR, type EhInputs } from "../../src/lib/calc/eh"
// @ts-expect-error – plain JS fixture, keine Typen nötig
import * as legacy from "../legacy-fixtures/eh.legacy.js"

describe("eh: golden master vs. legacy", () => {
  it("item/group definitions match structurally", () => {
    // "flv-ee" ist eine bewusste Erweiterung ohne Legacy-Pendant und wird
    // aus dem Strukturvergleich ausgenommen.
    expect(EH_ITEMS.filter((i) => i.id !== "flv-ee").map((i) => i.id))
      .toEqual(legacy.EH_ITEMS.map((i: { id: string }) => i.id))
    expect(EH_GROUPS.map((g) => g.id)).toEqual(legacy.EH_GROUPS.map((g: { id: string }) => g.id))
  })

  it("flv-ee: Zuzahlungsbetrag x 5,5% / 10,5", () => {
    const item = EH_ITEMS.find((i) => i.id === "flv-ee")!
    expect(item.calc(0, 1000)).toBeCloseTo((1000 * 0.055) / 10.5)
  })

  it("froots-vv-mtl: -15% bei mtl. Prämie <= 500 €, unverändert ab 501 €", () => {
    const item = EH_ITEMS.find((i) => i.id === "froots-vv-mtl")!
    const base = (j: number) => ((j * 3) / 10.5) * 0.9
    expect(item.calc(0, 500)).toBeCloseTo(base(500) * 0.85)
    expect(item.calc(0, 200)).toBeCloseTo(base(200) * 0.85)
    expect(item.calc(0, 501)).toBeCloseTo(base(501))
    expect(item.calc(0, 1000)).toBeCloseTo(base(1000))
  })

  it("froots-vv-einmalig: -15% bei Anlagebetrag <= 10.000 €, unverändert ab 10.000,01 €", () => {
    const item = EH_ITEMS.find((i) => i.id === "froots-vv-einmalig")!
    const base = (g: number, j: number) => (j * (g / 100) * 0.9) / 10.5
    expect(item.calc(5, 10000)).toBeCloseTo(base(5, 10000) * 0.85)
    expect(item.calc(5, 10000.01)).toBeCloseTo(base(5, 10000.01))
    expect(item.calc(5, 50000)).toBeCloseTo(base(5, 50000))
  })

  const inputScenarios: EhInputs[] = [
    {
      g: { flv: 35, ableben: 40, bu: 15, "froots-vv-einmalig": 5, kredit: 3, immobilie: 3, fsp: 35 },
      j: {
        fsp: 100, flv: 150, ableben: 80, bu: 60, uv: 40, kranken: 30,
        haushalt: 20, eigenheim: 25, rechtschutz: 10, "froots-vv-mtl": 200,
        "froots-vv-einmalig": 50000, kredit: 200000, immobilie: 400000,
      },
      mult: { insurance: 2, investment: 3, credit: 1.5, realestate: 2.5 },
    },
    {
      g: {},
      j: {},
      mult: { insurance: 0, investment: 0, credit: 0, realestate: 0 },
    },
  ]

  it("calcEh matches legacy recalc() output for various inputs", () => {
    for (const inputs of inputScenarios) {
      const a = calcEh(inputs)
      const b = legacy.calcEhLegacy(inputs)
      // "flv-ee" hat kein Legacy-Pendant (siehe oben) und wird beim Vergleich ausgenommen.
      // "flv" nutzt bewusst 2,11 statt des Legacy-Faktors 2,14 und wird separat verglichen.
      // "froots-vv-mtl" bekommt bewusst -15% bei mtl. Prämie <= 500 € (siehe eigener Test
      // oben) und wird deshalb ebenfalls separat verglichen statt 1:1 mit Legacy.
      const { "flv-ee": _flvEe, flv: aFlv, "froots-vv-mtl": aFrootsMtl, ...aPerItem } = a.perItem
      const { flv: bFlv, "froots-vv-mtl": bFrootsMtl, ...bPerItem } = b.perItem
      expect(aPerItem).toEqual(bPerItem)
      expect(aFlv).toBeCloseTo((bFlv / 2.14) * 2.11)
      const mtlJ = Number(inputs.j["froots-vv-mtl"]) || 0
      expect(aFrootsMtl).toBeCloseTo(mtlJ > 500 ? bFrootsMtl : bFrootsMtl * 0.85)

      const insuranceDiff = aFlv - bFlv
      const investmentDiff = aFrootsMtl - bFrootsMtl
      const { insurance: aInsurance, investment: aInvestment, ...aGroupSums } = a.groupSums
      const { insurance: bInsurance, investment: bInvestment, ...bGroupSums } = b.groupSums
      expect(aGroupSums).toEqual(bGroupSums)
      expect(aInsurance).toBeCloseTo(bInsurance + insuranceDiff)
      expect(aInvestment).toBeCloseTo(bInvestment + investmentDiff)

      const insuranceMult = Number(inputs.mult.insurance) || 0
      const investmentMult = Number(inputs.mult.investment) || 0
      const insuranceEurDiff = insuranceDiff * insuranceMult
      const investmentEurDiff = investmentDiff * investmentMult
      const { insurance: aInsuranceEur, investment: aInvestmentEur, ...aGroupEur } = a.groupEur
      const { insurance: bInsuranceEur, investment: bInvestmentEur, ...bGroupEur } = b.groupEur
      expect(aGroupEur).toEqual(bGroupEur)
      expect(aInsuranceEur).toBeCloseTo(bInsuranceEur + insuranceEurDiff)
      expect(aInvestmentEur).toBeCloseTo(bInvestmentEur + investmentEurDiff)

      const groupDiff = insuranceDiff + investmentDiff
      const eurDiff = insuranceEurDiff + investmentEurDiff
      expect(a.grandTotal).toBeCloseTo(b.grandTotal + groupDiff)
      expect(a.grandTotalEur).toBeCloseTo(b.grandTotalEur + eurDiff)
    }
  })

  it("formatters match", () => {
    for (const n of [0, 12.4, 999.6, 1234567.891, -450]) {
      expect(ehFormatEH(n)).toBe(legacy.ehFormatEH(n))
      expect(ehFormatEUR(n)).toBe(legacy.ehFormatEUR(n))
    }
  })
})
