import { describe, expect, it } from "vitest"
import { simulateMerkurFLVEinmal, simulateMerkurFLVPraemie } from "../../src/lib/calc/merkurFlv"
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
    expect(r.einmalerlag).toBeGreaterThan(130000)
    expect(r.einmalerlag).toBeLessThan(160000)
    expect(r.sparplanStart).toBeGreaterThan(520)
    expect(r.sparplanStart).toBeLessThan(640)
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

  it("FLV: Einmalerlag und Sparplan treffen den Kapitalbedarf (Merkur-Modell)", () => {
    const r = berechnePension(BASE)
    const perf = 0.075
    const einmal = simulateMerkurFLVEinmal(r.flv.einmalerlag, r.jahre, perf)[r.jahre * 12]
    const spar = simulateMerkurFLVPraemie(r.flv.sparplanStart, r.jahre, perf, BASE.inflation / 0.912)[r.jahre * 12]
    expect(einmal).toBeCloseTo(r.kapitalBedarf, 0)
    expect(spar).toBeCloseTo(r.kapitalBedarf, 0)
    expect(r.flv.sparplanEnde).toBeGreaterThan(r.flv.sparplanStart)
    expect(r.flv.sparplanSumme).toBeGreaterThan(r.flv.sparplanStart * r.jahre * 12 * 0.99)
  })

  it("FLV: höhere Rendite senkt Einmalerlag und Sparplan", () => {
    const k = berechnePension({ ...BASE, profil: "konservativ" }).flv
    const g = berechnePension(BASE).flv
    expect(g.einmalerlag).toBeLessThan(k.einmalerlag)
    expect(g.sparplanStart).toBeLessThan(k.sparplanStart)
  })

  it("FLV: keine Lücke ergibt 0", () => {
    const f = berechnePension({ ...BASE, wunschPension: 1000 }).flv
    expect(f.einmalerlag).toBe(0)
    expect(f.sparplanStart).toBe(0)
    expect(berechnePension({ ...BASE, wunschPension: 1000 }).kapitalBedarf).toBe(0)
  })

  it("eigene Rendite überschreibt das Risikoprofil", () => {
    const a = berechnePension({ ...BASE, rendite: 0.06 })
    const b = berechnePension({ ...BASE, profil: "ausgewogen" })
    expect(a.einmalerlag).toBeCloseTo(b.einmalerlag, 6)
    expect(a.flv.einmalerlag).toBeCloseTo(b.flv.einmalerlag, 6)
    expect(berechnePension({ ...BASE, rendite: 0.04 }).einmalerlag).toBeGreaterThan(b.einmalerlag)
  })

  it("Depot und FLV benötigen bei Pensionsantritt dasselbe Kapital (kostenfreies Konto)", () => {
    const r = berechnePension(BASE)
    expect(r.kapitalBedarf).toBeGreaterThan(0)
    expect(simulateMerkurFLVEinmal(r.flv.einmalerlag, r.jahre, 0.075)[r.jahre * 12]).toBeCloseTo(r.kapitalBedarf, 0)
  })

  it("höhere Kontoverzinsung in der Entnahme senkt den Kapitalbedarf", () => {
    const a = berechnePension({ ...BASE, kontoZins: 0.01 })
    const b = berechnePension({ ...BASE, kontoZins: 0.04 })
    expect(b.kapitalBedarf).toBeLessThan(a.kapitalBedarf)
    expect(b.flv.einmalerlag).toBeLessThan(a.flv.einmalerlag)
  })

  it("Sparplan steigt bei Depot und FLV gleich stark (Inflation)", () => {
    const r = berechnePension(BASE)
    const faktor = Math.pow(1 + BASE.inflation, r.jahre - 1)
    expect(r.sparplanEnde / r.sparplanStart).toBeCloseTo(faktor, 6)
    expect(r.flv.sparplanEnde / r.flv.sparplanStart).toBeCloseTo(faktor, 6)
    const spar = simulateMerkurFLVPraemie(r.flv.sparplanStart, r.jahre, 0.075, BASE.inflation / 0.912)[r.jahre * 12]
    expect(spar).toBeCloseTo(r.kapitalBedarf, 0)
  })
})
