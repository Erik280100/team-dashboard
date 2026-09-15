import { describe, expect, it } from "vitest"
import {
  DEFAULTS_HOLDING_IMMO, GMBH_AUSSCHUETTUNG_EFFEKTIV_SATZ, berechneHoldingImmobilien,
} from "../../src/lib/calc/holdingImmobilien"

describe("GMBH_AUSSCHUETTUNG_EFFEKTIV_SATZ", () => {
  it("matches the well-known combined KöSt+KESt burden of ~44.18%", () => {
    expect(GMBH_AUSSCHUETTUNG_EFFEKTIV_SATZ).toBeCloseTo(0.44175, 5)
  })
})

describe("berechneHoldingImmobilien", () => {
  it("gives the company path (Weg C) more starting equity than either private path", () => {
    const r = berechneHoldingImmobilien(DEFAULTS_HOLDING_IMMO)
    expect(r.eigenmittelHolding).toBeGreaterThan(r.eigenmittelEu)
    expect(r.eigenmittelHolding).toBeGreaterThan(r.eigenmittelGmbhPrivat)
    expect(r.eigenmittelHolding).toBeCloseTo(DEFAULTS_HOLDING_IMMO.verfuegbarerGewinnVorSteuer * 0.77, 2)
  })

  it("uses the EU marginal rate for the EU path and the combined GmbH+KESt rate for the GmbH-private path", () => {
    const r = berechneHoldingImmobilien({ ...DEFAULTS_HOLDING_IMMO, euGrenzsteuersatzPct: 40 })
    expect(r.eigenmittelEu).toBeCloseTo(DEFAULTS_HOLDING_IMMO.verfuegbarerGewinnVorSteuer * 0.6, 2)
    expect(r.eigenmittelGmbhPrivat).toBeCloseTo(DEFAULTS_HOLDING_IMMO.verfuegbarerGewinnVorSteuer * (1 - GMBH_AUSSCHUETTUNG_EFFEKTIV_SATZ), 2)
  })

  it("holding overhead costs reduce the company end value but do not touch either private path", () => {
    const ohneHolding = berechneHoldingImmobilien({ ...DEFAULTS_HOLDING_IMMO, ueberHolding: false })
    const mitHolding = berechneHoldingImmobilien({ ...DEFAULTS_HOLDING_IMMO, ueberHolding: true, holdingFixkostenJahr: 2500, holdingGruendungskostenEinmalig: 3000 })
    expect(mitHolding.endwertHolding).toBeLessThan(ohneHolding.endwertHolding)
    expect(mitHolding.endwertEu).toBeCloseTo(ohneHolding.endwertEu, 2)
    expect(mitHolding.endwertGmbhPrivat).toBeCloseTo(ohneHolding.endwertGmbhPrivat, 2)
    expect(ohneHolding.holdingFixkostenGesamt).toBe(0)
  })

  it("a direct purchase by the operating GmbH and a purchase via holding+subsidiary are tax-identical (holding only adds overhead)", () => {
    const direkt = berechneHoldingImmobilien({ ...DEFAULTS_HOLDING_IMMO, ueberHolding: false })
    const holding = berechneHoldingImmobilien({ ...DEFAULTS_HOLDING_IMMO, ueberHolding: true, holdingFixkostenJahr: 0, holdingGruendungskostenEinmalig: 0 })
    expect(holding.endwertHolding).toBeCloseTo(direkt.endwertHolding, 6)
  })

  it("produces finite, non-NaN results at default values", () => {
    const r = berechneHoldingImmobilien(DEFAULTS_HOLDING_IMMO)
    expect(Number.isFinite(r.endwertEu)).toBe(true)
    expect(Number.isFinite(r.endwertGmbhPrivat)).toBe(true)
    expect(Number.isFinite(r.endwertHolding)).toBe(true)
  })
})
