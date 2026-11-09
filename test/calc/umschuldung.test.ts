import { describe, expect, it } from "vitest"
import { KREDIT_DEFAULTS } from "../../src/lib/calc/kredit"
import { berechneUmschuldung, type UmschuldungEingabe } from "../../src/lib/calc/umschuldung"

const OHNE_KOSTEN = { ...KREDIT_DEFAULTS, kreditvertragserstellungPct: 0, pfandrechtPct: 0, sonstigeKreditNK: 0 }

const basis: UmschuldungEingabe = {
  restschuld: 250000, restlaufzeitMonate: 264, zinsAltPct: 4.5, zinsNeuPct: 3.0, laufzeitNeuJahre: 22,
  vfeAktiv: true, vfePct: 1, kostenMitfinanziert: true,
}

describe("berechneUmschuldung", () => {
  it("ohne Kosten und mit gleichem Zins/Laufzeit: gleiche Rate, Vorteil ≈ 0", () => {
    const r = berechneUmschuldung({ ...basis, zinsNeuPct: 4.5, vfeAktiv: false, saetze: OHNE_KOSTEN })
    expect(r.planNeu.rate).toBeCloseTo(r.planAlt.rate, 6)
    expect(Math.abs(r.vorteil)).toBeLessThan(0.01)
  })

  it("niedrigerer Zins: Vorteil > 0, Break-even vorhanden; mitfinanziert deckt K Restschuld + VFE + Nebenkosten", () => {
    const r = berechneUmschuldung(basis)
    expect(r.vorteil).toBeGreaterThan(0)
    expect(r.breakEvenMonat).not.toBeNull()
    expect(r.barkosten).toBe(0)
    expect(r.kreditbetragNeu - r.kreditNKSumme).toBeCloseTo(250000 + r.vfe, 4)
  })

  it("nicht mitfinanziert: K = Restschuld, Barkosten = VFE + Nebenkosten", () => {
    const r = berechneUmschuldung({ ...basis, kostenMitfinanziert: false })
    expect(r.kreditbetragNeu).toBe(250000)
    expect(r.barkosten).toBeCloseTo(r.vfe + r.kreditNKSumme, 6)
  })

  it("höherer Zins: Vorteil < 0, kein Break-even, Warnung", () => {
    const r = berechneUmschuldung({ ...basis, zinsNeuPct: 6 })
    expect(r.vorteil).toBeLessThan(0)
    expect(r.breakEvenMonat).toBeNull()
    expect(r.warnungen.length).toBeGreaterThan(0)
  })

  it("vfeAktiv=false: VFE = 0", () => {
    const r = berechneUmschuldung({ ...basis, vfeAktiv: false })
    expect(r.vfe).toBe(0)
  })
})
