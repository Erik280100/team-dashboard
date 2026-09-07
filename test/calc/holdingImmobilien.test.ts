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
  it("gives the GmbH path more starting equity than the private path when capital comes from a GmbH (no KESt leakage vs. combined KöSt+KESt leakage)", () => {
    const r = berechneHoldingImmobilien({ ...DEFAULTS_HOLDING_IMMO, kapitalherkunft: "gmbh" })
    expect(r.eigenmittelGmbh).toBeGreaterThan(r.eigenmittelPrivat)
    expect(r.eigenmittelGmbh).toBeCloseTo(DEFAULTS_HOLDING_IMMO.verfuegbarerGewinnVorSteuer * 0.77, 2)
    expect(r.eigenmittelPrivat).toBeCloseTo(DEFAULTS_HOLDING_IMMO.verfuegbarerGewinnVorSteuer * (1 - GMBH_AUSSCHUETTUNG_EFFEKTIV_SATZ), 2)
  })

  it("uses the EU marginal rate instead of the combined GmbH rate when capital comes from an EU", () => {
    const r = berechneHoldingImmobilien({ ...DEFAULTS_HOLDING_IMMO, kapitalherkunft: "eu", euGrenzsteuersatzPct: 40 })
    expect(r.transferSatzPrivatPct).toBeCloseTo(40, 5)
    expect(r.eigenmittelPrivat).toBeCloseTo(DEFAULTS_HOLDING_IMMO.verfuegbarerGewinnVorSteuer * 0.6, 2)
  })

  it("taxing the eventual GmbH payout again (KESt) makes it worse than keeping the money in the company", () => {
    const r = berechneHoldingImmobilien(DEFAULTS_HOLDING_IMMO)
    expect(r.endwertGmbhAusgeschuettet).toBeLessThan(r.endwertGmbhThesauriert)
    expect(r.endwertGmbhAusgeschuettet).toBeCloseTo(r.endwertGmbhThesauriert * 0.725, 2)
  })

  it("holding overhead costs reduce the GmbH end value but do not touch the private path", () => {
    const ohneHolding = berechneHoldingImmobilien({ ...DEFAULTS_HOLDING_IMMO, ueberHolding: false })
    const mitHolding = berechneHoldingImmobilien({ ...DEFAULTS_HOLDING_IMMO, ueberHolding: true, holdingFixkostenJahr: 2500, holdingGruendungskostenEinmalig: 3000 })
    expect(mitHolding.endwertGmbhThesauriert).toBeLessThan(ohneHolding.endwertGmbhThesauriert)
    expect(mitHolding.endwertPrivat).toBeCloseTo(ohneHolding.endwertPrivat, 2)
    expect(ohneHolding.holdingFixkostenGesamt).toBe(0)
  })

  it("a direct purchase by the operating GmbH and a purchase via holding+subsidiary are tax-identical (holding only adds overhead)", () => {
    const direkt = berechneHoldingImmobilien({ ...DEFAULTS_HOLDING_IMMO, ueberHolding: false })
    const holding = berechneHoldingImmobilien({ ...DEFAULTS_HOLDING_IMMO, ueberHolding: true, holdingFixkostenJahr: 0, holdingGruendungskostenEinmalig: 0 })
    expect(holding.endwertGmbhThesauriert).toBeCloseTo(direkt.endwertGmbhThesauriert, 6)
  })

  it("produces finite, non-NaN results at default values", () => {
    const r = berechneHoldingImmobilien(DEFAULTS_HOLDING_IMMO)
    expect(Number.isFinite(r.endwertPrivat)).toBe(true)
    expect(Number.isFinite(r.endwertGmbhThesauriert)).toBe(true)
    expect(Number.isFinite(r.endwertGmbhAusgeschuettet)).toBe(true)
  })
})
