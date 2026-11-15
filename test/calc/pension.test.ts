import { describe, expect, it } from "vitest"
import { berechnePension, bruttoAusNetto, nettoAusBrutto } from "../../src/lib/calc/pension"

const BASE = {
  alter: 30, pensionsalter: 65, nettoMonat: 3000, wunschPension: 4000,
  inflation: 0.02, profil: "gewinnorientiert" as const,
}

describe("Pensionsrechner", () => {
  it("Brutto/Netto-Umrechnung ist umkehrbar", () => {
    expect(nettoAusBrutto(bruttoAusNetto(3000))).toBeCloseTo(3000, 1)
  })

  it("Beispiel 30/65/3.000/4.000/2 %/7,5 % mit 2,09 % Kosten p.a. (quartalsweise)", () => {
    const r = berechnePension(BASE)
    expect(r.staatNetto).toBeGreaterThan(2200)
    expect(r.staatNetto).toBeLessThan(2600)
    expect(r.einmalerlag).toBeGreaterThan(90000)
    expect(r.einmalerlag).toBeLessThan(110000)
    expect(r.sparplanStart).toBeGreaterThan(360)
    expect(r.sparplanStart).toBeLessThan(440)
  })

  it("höhere Rendite senkt Einmalerlag und Sparplan", () => {
    const k = berechnePension({ ...BASE, profil: "konservativ" })
    const g = berechnePension(BASE)
    expect(g.einmalerlag).toBeLessThan(k.einmalerlag)
    expect(g.sparplanStart).toBeLessThan(k.sparplanStart)
  })

  it("längere Lebenserwartung erhöht den Kapitalbedarf", () => {
    const a = berechnePension(BASE)
    const b = berechnePension({ ...BASE, entnahmeBis: 95 })
    expect(berechnePension({ ...BASE, entnahmeBis: 90 }).einmalerlag).toBeCloseTo(a.einmalerlag, 6)
    expect(b.einmalerlag).toBeGreaterThan(a.einmalerlag)
  })

  it("höhere Wunschpension vergrößert die Lücke", () => {
    const a = berechnePension(BASE)
    const b = berechnePension({ ...BASE, wunschPension: 5000 })
    expect(b.luecke).toBeGreaterThan(a.luecke)
  })

  it("keine Lücke: kein Investitionsbedarf", () => {
    const r = berechnePension({ ...BASE, wunschPension: 1000 })
    expect(r.luecke).toBe(0)
    expect(r.einmalerlag).toBe(0)
    expect(r.sparplanStart).toBe(0)
  })
})
