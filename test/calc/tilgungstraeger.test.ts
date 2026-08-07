import { describe, expect, it } from "vitest"
import { berechneKreditbetrag, berechneTilgungsplan } from "../../src/lib/calc/kredit"
import { berechneTilgungstraeger } from "../../src/lib/calc/tilgungstraeger"

// Standardfall: 400.000 € Kaufpreis, 80.000 € Eigenmittel, 35 Jahre, 2,85 %, mit Makler,
// Kreditnebenkosten mitfinanziert — deckt sich mit den Defaults in KreditRechner.tsx.
function standardPlan() {
  const kredit = berechneKreditbetrag({ kaufpreis: 400000, eigenmittel: 80000, mitMakler: true, nkMitfinanziert: true })
  const plan = berechneTilgungsplan(kredit.kreditbetrag, 2.85, 35)
  return { kredit, plan }
}

describe("berechneTilgungstraeger", () => {
  it("returns the empty result (no intersection) when there is no Sparrate", () => {
    const { kredit, plan } = standardPlan()
    const tt = berechneTilgungstraeger(plan, kredit.kreditbetrag, 0, 35, 0.06, 0)
    expect(tt.schnittpunktMonat).toBeNull()
    expect(tt.jahreFrueher).toBeNull()
    expect(tt.zinsersparnis).toBe(0)
    expect(tt.sparwertMonate).toHaveLength(0)
  })

  it("returns the empty result when the loan plan itself is empty", () => {
    const plan = berechneTilgungsplan(0, 2.85, 35)
    const tt = berechneTilgungstraeger(plan, 0, 300, 35, 0.06, 0)
    expect(tt.schnittpunktMonat).toBeNull()
  })

  it("finds a plausible intersection for the standard case (300 €/month, 6% p.a., no Dynamik)", () => {
    const { kredit, plan } = standardPlan()
    const tt = berechneTilgungstraeger(plan, kredit.kreditbetrag, 300, 35, 0.06, 0)

    expect(tt.schnittpunktMonat).not.toBeNull()
    expect(tt.schnittpunktMonat!).toBeGreaterThan(0)
    expect(tt.schnittpunktMonat!).toBeLessThanOrEqual(35 * 12)
    expect(tt.jahreFrueher!).toBeGreaterThanOrEqual(0)
    expect(tt.jahreFrueher!).toBeLessThanOrEqual(35)

    // Am Schnittpunkt selbst sollten Sparwert und Restschuld praktisch übereinstimmen
    // (das ist per Konstruktion der lineare Interpolationspunkt).
    expect(tt.sparwertImSchnittpunkt).toBeCloseTo(tt.restschuldImSchnittpunkt!, 0)
  })

  it("sparwertMonate has length laufzeitJahre*12 + 1 and starts at 0", () => {
    const { kredit, plan } = standardPlan()
    const tt = berechneTilgungstraeger(plan, kredit.kreditbetrag, 300, 35, 0.06, 0)
    expect(tt.sparwertMonate).toHaveLength(35 * 12 + 1)
    expect(tt.sparwertMonate[0]).toBe(0)
  })

  it("zinsersparnis equals the sum of interest for all months from the ceiling of the intersection onward", () => {
    const { kredit, plan } = standardPlan()
    const tt = berechneTilgungstraeger(plan, kredit.kreditbetrag, 300, 35, 0.06, 0)
    const abIndex = Math.ceil(tt.schnittpunktMonat!)
    const erwartet = plan.monate.slice(abIndex).reduce((s, m) => s + m.zins, 0)
    expect(tt.zinsersparnis).toBeCloseTo(erwartet, 6)
  })

  it("a higher Sparrate reaches the intersection earlier (or equal)", () => {
    const { kredit, plan } = standardPlan()
    const klein = berechneTilgungstraeger(plan, kredit.kreditbetrag, 200, 35, 0.06, 0)
    const gross = berechneTilgungstraeger(plan, kredit.kreditbetrag, 500, 35, 0.06, 0)
    expect(gross.schnittpunktMonat!).toBeLessThan(klein.schnittpunktMonat!)
    expect(gross.jahreFrueher!).toBeGreaterThan(klein.jahreFrueher!)
  })

  it("enabling Dynamik moves the intersection earlier (or equal), never later", () => {
    const { kredit, plan } = standardPlan()
    const ohneDynamik = berechneTilgungstraeger(plan, kredit.kreditbetrag, 300, 35, 0.06, 0)
    const mitDynamik = berechneTilgungstraeger(plan, kredit.kreditbetrag, 300, 35, 0.06, 0.03)
    expect(mitDynamik.schnittpunktMonat!).toBeLessThanOrEqual(ohneDynamik.schnittpunktMonat!)
  })

  it("a higher assumed performance moves the intersection earlier (or equal)", () => {
    const { kredit, plan } = standardPlan()
    const niedrig = berechneTilgungstraeger(plan, kredit.kreditbetrag, 300, 35, 0.03, 0)
    const hoch = berechneTilgungstraeger(plan, kredit.kreditbetrag, 300, 35, 0.09, 0)
    expect(hoch.schnittpunktMonat!).toBeLessThan(niedrig.schnittpunktMonat!)
  })
})
