import { describe, expect, it } from "vitest"
import { calcEh, EH_GROUPS, EH_ITEMS, ehFormatEH, ehFormatEUR, type EhInputs } from "../../src/lib/calc/eh"
// @ts-expect-error – plain JS fixture, keine Typen nötig
import * as legacy from "../legacy-fixtures/eh.legacy.js"

describe("eh: golden master vs. legacy", () => {
  it("item/group definitions match structurally", () => {
    expect(EH_ITEMS.map((i) => i.id)).toEqual(legacy.EH_ITEMS.map((i: { id: string }) => i.id))
    expect(EH_GROUPS.map((g) => g.id)).toEqual(legacy.EH_GROUPS.map((g: { id: string }) => g.id))
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
      expect(a.perItem).toEqual(b.perItem)
      expect(a.groupSums).toEqual(b.groupSums)
      expect(a.groupEur).toEqual(b.groupEur)
      expect(a.grandTotal).toBe(b.grandTotal)
      expect(a.grandTotalEur).toBe(b.grandTotalEur)
    }
  })

  it("formatters match", () => {
    for (const n of [0, 12.4, 999.6, 1234567.891, -450]) {
      expect(ehFormatEH(n)).toBe(legacy.ehFormatEH(n))
      expect(ehFormatEUR(n)).toBe(legacy.ehFormatEUR(n))
    }
  })
})
