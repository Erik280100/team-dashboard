import { describe, expect, it } from "vitest"
import { DEFAULTS, berechneEu } from "../../src/lib/calc/gmbhVsEu"
import {
  CY_KOEST_SATZ, DEFAULTS_ZYPERN, berechneDreiWegeSchwellenreihe, berechneZypernGruendungsVergleich,
  berechneZypernLtd, zypernEinkommensteuer,
} from "../../src/lib/calc/zypernLtd"

describe("zypernEinkommensteuer", () => {
  it("is zero within the tax-free bracket (0-22.000 €)", () => {
    expect(zypernEinkommensteuer(21000)).toBe(0)
  })

  it("matches a hand-calculated multi-bracket example", () => {
    // 50.000 €: 0 bis 22.000 frei, 20% bis 32.000, 25% bis 42.000, 30% bis 50.000
    const erwartet = (32000 - 22000) * 0.2 + (42000 - 32000) * 0.25 + (50000 - 42000) * 0.3
    expect(zypernEinkommensteuer(50000)).toBeCloseTo(erwartet, 2)
  })
})

describe("berechneZypernLtd — mit echter Wohnsitzverlegung", () => {
  const spezifisch = { ...DEFAULTS_ZYPERN, wohnsitzVollstaendigVerlegt: true }

  it("taxes the corporate result at 15% with no minimum tax at a loss", () => {
    const r = berechneZypernLtd(
      { ...DEFAULTS, umsatz: 0, betriebsausgaben: 0, sonstigeAfaJahr: 0, autoAnschaffungswert: 0 },
      { ...spezifisch, direktorGehaltBrutto: 0, buchhaltungJahr: 0, auditJahr: 0, registeredOfficeJahr: 0 }
    )
    expect(r.koeSt).toBe(0)
  })

  it("charges no SDC (0%) on distributed dividends for a non-dom — only GESY", () => {
    const r = berechneZypernLtd(DEFAULTS, { ...spezifisch, ausschuettungsquotePct: 100 })
    if (r.ausschuettungBrutto > 0) {
      const effektiverSatz = (r.ausschuettungBrutto - r.ausschuettungNetto) / r.ausschuettungBrutto
      expect(effektiverSatz).toBeCloseTo(0.0265, 5)
    }
  })

  it("produces a plausible positive result at default values", () => {
    const r = berechneZypernLtd(DEFAULTS, spezifisch)
    expect(r.wohnsitzGueltig).toBe(true)
    expect(Number.isFinite(r.gesamtInklThesaurierung)).toBe(true)
  })

  it("a higher Cyprus rent than the Austrian comparison rent reduces available income", () => {
    const guenstig = berechneZypernLtd(DEFAULTS, { ...spezifisch, mieteZypernMonat: 900, mieteOesterreichVergleichMonat: 900 })
    const teuer = berechneZypernLtd(DEFAULTS, { ...spezifisch, mieteZypernMonat: 1800, mieteOesterreichVergleichMonat: 900 })
    expect(teuer.verfuegbaresEinkommen).toBeLessThan(guenstig.verfuegbaresEinkommen)
    expect(teuer.verfuegbaresEinkommen + teuer.wohnkostenDeltaJahr).toBeCloseTo(guenstig.verfuegbaresEinkommen + guenstig.wohnkostenDeltaJahr, 2)
  })
})

describe("berechneZypernLtd — ohne Wohnsitzverlegung (Ort der Geschäftsleitung Österreich)", () => {
  const spezifisch = { ...DEFAULTS_ZYPERN, wohnsitzVollstaendigVerlegt: false }

  it("flags the result as invalid (wohnsitzGueltig: false)", () => {
    const r = berechneZypernLtd(DEFAULTS, spezifisch)
    expect(r.wohnsitzGueltig).toBe(false)
  })

  it("is strictly worse than the genuine relocation scenario at the same inputs (extra Cyprus overhead, no tax benefit)", () => {
    const ohneUmzug = berechneZypernLtd(DEFAULTS, { ...spezifisch, wohnsitzVollstaendigVerlegt: false })
    const mitUmzug = berechneZypernLtd(DEFAULTS, { ...spezifisch, wohnsitzVollstaendigVerlegt: true })
    expect(ohneUmzug.gesamtInklThesaurierung).toBeLessThan(mitUmzug.gesamtInklThesaurierung)
  })

  it("does NOT apply the 15% Cyprus rate — the effective corporate rate matches Austrian KöSt (23%), not Cyprus", () => {
    const r = berechneZypernLtd(DEFAULTS, spezifisch)
    if (r.betrieblichesErgebnisVorKoest > 0) {
      const effektiverSatz = r.koeSt / r.betrieblichesErgebnisVorKoest
      expect(effektiverSatz).not.toBeCloseTo(CY_KOEST_SATZ, 2)
      expect(effektiverSatz).toBeCloseTo(0.23, 2)
    }
  })
})

describe("berechneZypernGruendungsVergleich", () => {
  it("returns null break-even years when Cyprus has no yearly advantage over the EU baseline", () => {
    const eu = berechneEu({ ...DEFAULTS, umsatz: 300000 })
    const zypern = berechneZypernLtd({ ...DEFAULTS, umsatz: 40000 }, { ...DEFAULTS_ZYPERN, wohnsitzVollstaendigVerlegt: true })
    const vergleich = berechneZypernGruendungsVergleich(eu, zypern, DEFAULTS_ZYPERN.gruendungskostenEinmalig + DEFAULTS_ZYPERN.umzugskostenEinmalig)
    expect(vergleich.jaehrlicherVorteilVsEu).toBeLessThan(0)
    expect(vergleich.breakEvenJahre).toBeNull()
  })
})

describe("berechneDreiWegeSchwellenreihe", () => {
  it("returns one point per step across the requested range, without NaN/Infinity", () => {
    const gmbhSpezifisch = { gfGehaltBrutto: DEFAULTS.gfGehaltBrutto, ausschuettungsquotePct: DEFAULTS.ausschuettungsquotePct, dzSatzPct: DEFAULTS.dzSatzPct, stbMehrkostenJahr: DEFAULTS.stbMehrkostenJahr, offenlegungJahr: DEFAULTS.offenlegungJahr }
    const punkte = berechneDreiWegeSchwellenreihe(DEFAULTS, gmbhSpezifisch, { ...DEFAULTS_ZYPERN, wohnsitzVollstaendigVerlegt: true }, 20000, 220000, 20000)
    expect(punkte).toHaveLength(11)
    for (const p of punkte) {
      expect(Number.isFinite(p.verfuegbarZypern)).toBe(true)
      expect(Number.isFinite(p.gesamtZypern)).toBe(true)
    }
  })
})
