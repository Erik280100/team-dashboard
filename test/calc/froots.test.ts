import { describe, expect, it } from "vitest"
import { simulateFrootsVerlauf, wachstumsfaktoren } from "../../src/lib/calc/froots"

describe("froots-Modell (gemeinsame Basis Pensions-/Renditerechner)", () => {
  it("Einmalerlag ohne agE entspricht den Wachstumsfaktoren des Pensionsrechners (vor KESt)", () => {
    const v = simulateFrootsVerlauf(0, 10000, 20, 0.06, 0)
    const cum = wachstumsfaktoren(240, 0.06)
    expect(v.values[240]).toBeGreaterThan(0)
    expect(v.valuesVorKest![240]).toBeCloseTo(10000 * cum[240], 4)
  })

  it("Sparplan entspricht der Summe der Einzahlungen × Wachstum (Einzahlung zu Monatsbeginn)", () => {
    const v = simulateFrootsVerlauf(200, 0, 10, 0.06, 0)
    const cum = wachstumsfaktoren(120, 0.06)
    let erwartet = 0
    for (let m = 0; m < 120; m++) erwartet += 200 * cum[120] / cum[m]
    expect(v.valuesVorKest![120]).toBeCloseTo(erwartet, 4)
  })
})
