import { describe, expect, it } from "vitest"
import { computeFinancingStats } from "../../functions/src/financingStats"

describe("computeFinancingStats", () => {
  it("zählt nur offene Fälle und summiert die Kreditsummen", () => {
    expect(computeFinancingStats([
      { betrag: 100000, art: "anlegerwohnung", archived: false },
      { betrag: 250000, art: "eigenheim" },
      { betrag: "50000", art: "anlegerwohnung", archived: true },
      { betrag: 1, art: "anlegerwohnung", archived: false },
    ])).toEqual({ openCount: 3, openVolume: 350001, anlegerwohnungen: 2 })
  })
  it("leer", () => {
    expect(computeFinancingStats([])).toEqual({ openCount: 0, openVolume: 0, anlegerwohnungen: 0 })
  })
})
