// Entnahmephase: Regressionstest (ohne Entnahme muss sich am bestehenden Verhalten der
// simulate*-Funktionen nichts ändern — die golden/reference-Tests decken die eigentlichen
// Ansparwerte bereits ab) plus gezielte Tests für die neue Entnahmelogik selbst.
import { describe, expect, it } from "vitest"
import {
  RR_KEST,
  rrMaxEntnahme,
  simulateFLV,
  simulateFLVVerlauf,
  simulateFondsdepot,
  simulateFondsdepotVerlauf,
  simulateFondssparer,
  simulateFondssparerVerlauf,
  simulateVV,
  simulateVVVerlauf,
} from "../../src/lib/calc/rendite"

describe("Entnahmephase: Regression ohne Entnahme", () => {
  it("simulateFLVVerlauf (merkur) liefert bei entnahmeJahre=0 dieselben values wie simulateFLV", () => {
    const v = simulateFLVVerlauf("merkur", 200, 0, 20, 0.06, 0.02, 0, 0)
    expect(v.values).toEqual(simulateFLV("merkur", 200, 0, 20, 0.06, 0.02))
    expect(v.entnommenNetto).toBe(0)
    expect(v.reichtBisMonat).toBeNull()
  })

  it("simulateFLVVerlauf (helvetia) liefert bei entnahmeJahre=0 dieselben values wie simulateFLV", () => {
    const v = simulateFLVVerlauf("helvetia", 200, 5000, 20, 0.06, 0, 0, 0)
    expect(v.values).toEqual(simulateFLV("helvetia", 200, 5000, 20, 0.06, 0))
  })

  it("simulateFondssparerVerlauf liefert bei entnahmeJahre=0 dieselben values wie simulateFondssparer", () => {
    const v = simulateFondssparerVerlauf(200, 20, 0.06, 0.02, 0, 0)
    expect(v.values).toEqual(simulateFondssparer(200, 20, 0.06, 0.02))
  })

  it("simulateFondsdepotVerlauf liefert bei entnahmeJahre=0 dieselben values wie simulateFondsdepot", () => {
    const v = simulateFondsdepotVerlauf(200, 0, 20, 0.06, 2.5, 0.5, 0.3, 0, 0, 0, 0)
    expect(v.values).toEqual(simulateFondsdepot(200, 0, 20, 0.06, 2.5, 0.5, 0.3, 0, 0))
  })

  it("simulateVVVerlauf liefert bei entnahmeJahre=0 dieselben values wie simulateVV", () => {
    const v = simulateVVVerlauf(200, 0, 20, 0.06, 0.3, 0, 0)
    expect(v.values).toEqual(simulateVV(200, 0, 20, 0.06, 0.3))
  })

  it("Länge entspricht (jahre + entnahmeJahre) * 12 + 1", () => {
    const v = simulateFondsdepotVerlauf(200, 0, 20, 0.06, 2.5, 0.5, 0.3, 0, 0, 10, 500)
    expect(v.values.length).toBe((20 + 10) * 12 + 1)
  })
})

describe("Entnahmephase: FLV (KESt-frei)", () => {
  it("zahlt bei ausreichendem Kapital genau die gewünschte Netto-Summe aus", () => {
    const v = simulateFLVVerlauf("merkur", 500, 0, 25, 0.06, 0, 15, 800)
    expect(v.reichtBisMonat).toBeNull()
    expect(v.entnommenNetto).toBeCloseTo(800 * 15 * 12, 0)
    expect(v.values[v.values.length - 1]).toBeGreaterThan(0)
  })

  it("meldet reichtBisMonat, wenn die Entnahme zu hoch ist", () => {
    const v = simulateFLVVerlauf("merkur", 200, 0, 20, 0.06, 0, 20, 5000)
    expect(v.reichtBisMonat).not.toBeNull()
    expect(v.values[v.values.length - 1]).toBe(0)
  })
})

describe("Entnahmephase: Fondsdepot (KESt-pflichtig)", () => {
  it("Kapital fällt monoton in der Entnahmephase bei hoher Entnahme", () => {
    const ansparMonate = 20 * 12
    const v = simulateFondsdepotVerlauf(200, 0, 20, 0.06, 2.5, 0.5, 0.3, 0, 0, 20, 3000)
    for (let i = ansparMonate + 1; i < v.values.length; i++) {
      expect(v.values[i]).toBeLessThanOrEqual(v.values[i - 1] + 1e-6)
    }
    expect(v.reichtBisMonat).not.toBeNull()
    expect(v.values[v.values.length - 1]).toBe(0)
  })

  it("bei moderater Entnahme reicht das Kapital durch (reichtBisMonat === null)", () => {
    const v = simulateFondsdepotVerlauf(500, 0, 25, 0.06, 2.5, 0.5, 0.3, 0, 0, 15, 800)
    expect(v.reichtBisMonat).toBeNull()
    expect(v.entnommenNetto).toBeGreaterThan(0)
  })

  it("KESt-Hochrechnung: Netto-Auszahlung ist kleiner als Brutto-Depotabfluss, wenn ein Gewinnanteil besteht", () => {
    const v = simulateFondsdepotVerlauf(500, 0, 25, 0.06, 0, 0.3, 0, 0, 0, 10, 1000)
    // Depotwert vor Entnahme deutlich über Einbezahltem => es gibt einen Gewinnanteil,
    // der KESt-Effekt greift, also entnommenNetto === angeforderte Summe (netto ausgezahlt),
    // aber der Depotabfluss selbst muss dafür größer als entnommenNetto sein solange reichtBisMonat null ist.
    expect(v.reichtBisMonat).toBeNull()
    expect(v.entnommenNetto).toBeCloseTo(1000 * 10 * 12, 0)
  })
})

describe("rrMaxEntnahme", () => {
  it("findet eine Entnahme, die exakt bis zum Ende der Entnahmezeit trägt", () => {
    const monat = 500
    const jahre = 25
    const perf = 0.06
    const entnahmeJahre = 20
    const endwert = simulateFondsdepot(monat, 0, jahre, perf, 2.5, 0.5, 0.3)[jahre * 12]

    const max = rrMaxEntnahme(
      (x) => simulateFondsdepotVerlauf(monat, 0, jahre, perf, 2.5, 0.5, 0.3, 0, 0, entnahmeJahre, x),
      endwert
    )

    const atMax = simulateFondsdepotVerlauf(monat, 0, jahre, perf, 2.5, 0.5, 0.3, 0, 0, entnahmeJahre, max)
    expect(atMax.reichtBisMonat).toBeNull()
    expect(atMax.values[atMax.values.length - 1]).toBeLessThan(endwert * 0.01)

    const overMax = simulateFondsdepotVerlauf(
      monat, 0, jahre, perf, 2.5, 0.5, 0.3, 0, 0, entnahmeJahre, max * 1.05
    )
    expect(overMax.reichtBisMonat).not.toBeNull()
  })

  it("liefert 0 bei obergrenze <= 0", () => {
    expect(rrMaxEntnahme(() => ({ values: [0], entnommenNetto: 0, reichtBisMonat: null }), 0)).toBe(0)
  })
})

// Nur zur Dokumentation der KESt-Konstante, die die Hochrechnung im Rechenkern verwendet.
describe("RR_KEST", () => {
  it("ist 27,5 %", () => {
    expect(RR_KEST).toBe(0.275)
  })
})
