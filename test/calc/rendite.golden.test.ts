// Golden-Master-Test: der TS-Port (src/lib/calc/rendite.ts) muss über ein
// Raster realistischer Eingaben exakt dieselben Werte liefern wie die
// eingefrorene Legacy-Referenz (test/legacy-fixtures/rendite.legacy.js).
import { describe, expect, it } from "vitest"
import * as ts from "../../src/lib/calc/rendite"
// @ts-expect-error – plain JS fixture, keine Typen nötig
import * as legacy from "../legacy-fixtures/rendite.legacy.js"

describe("rendite: golden master vs. legacy", () => {
  it("rrRate matches for a range of yearly performances", () => {
    for (const pa of [-0.1, 0, 0.02, 0.05, 0.06, 0.08, 0.12]) {
      expect(ts.rrRate(pa)).toBe(legacy.rrRate(pa))
    }
  })

  // Merkur ist hier bewusst NICHT mehr dabei: der Merkur-Prämientopf in simulateFLV
  // wurde gegen echte Angebote kalibriert (siehe merkurFlv.ts) und weicht daher
  // absichtlich von der eingefrorenen Legacy-Referenz ab. Der Abgleich für Merkur
  // läuft stattdessen über test/calc/merkur.reference.test.ts.
  const providers = ["helvetia"] as const
  const flvCases = [
    { monat: 100, einmal: 0, jahre: 20, perf: 0.06, waPct: 0 },
    { monat: 200, einmal: 5000, jahre: 35, perf: 0.05, waPct: 0.02 },
    { monat: 50, einmal: 10000, jahre: 10, perf: 0.03, waPct: 0 },
    { monat: 300, einmal: 0, jahre: 15, perf: 0.08, waPct: 0.03 },
  ]

  it("simulateFLV matches for helvetia across scenarios", () => {
    for (const provider of providers) {
      for (const c of flvCases) {
        const a = ts.simulateFLV(provider, c.monat, c.einmal, c.jahre, c.perf, c.waPct)
        const b = legacy.simulateFLV(provider, c.monat, c.einmal, c.jahre, c.perf, c.waPct)
        expect(a).toEqual(b)
      }
    }
  })

  // simulateFondssparer ist hier bewusst NICHT mehr dabei: das Modell wurde gegen echte
  // Angebote kalibriert (siehe fondssparer.ts) und weicht daher absichtlich von der
  // eingefrorenen Legacy-Referenz ab. Der Abgleich läuft stattdessen über
  // test/calc/fondssparer.reference.test.ts.

  const fondsdepotCases = [
    { monat: 100, einmal: 0, jahre: 20, perf: 0.06, aa: 2.5, gebuehr: 0.5, age: 0.3, fixFee: 0 },
    { monat: 150, einmal: 20000, jahre: 30, perf: 0.05, aa: 0, gebuehr: 0.2, age: 0.5, fixFee: 50 },
  ]

  it("simulateFondsdepot matches across scenarios", () => {
    for (const c of fondsdepotCases) {
      const a = ts.simulateFondsdepot(c.monat, c.einmal, c.jahre, c.perf, c.aa, c.gebuehr, c.age, c.fixFee)
      const b = legacy.simulateFondsdepot(c.monat, c.einmal, c.jahre, c.perf, c.aa, c.gebuehr, c.age, c.fixFee)
      expect(a).toEqual(b)
    }
  })

  const vvCases = [
    { monat: 200, einmal: 0, jahre: 20, perf: 0.06, age: 0.3 },
    { monat: 0, einmal: 50000, jahre: 15, perf: 0.07, age: 0.4 },
  ]

  it("simulateVV matches across scenarios", () => {
    for (const c of vvCases) {
      const a = ts.simulateVV(c.monat, c.einmal, c.jahre, c.perf, c.age)
      const b = legacy.simulateVV(c.monat, c.einmal, c.jahre, c.perf, c.age)
      expect(a).toEqual(b)
    }
  })

  it("formatters match", () => {
    for (const n of [0, 12.4, 999.6, 1234567.89, -450]) {
      expect(ts.rrFormatEUR(n)).toBe(legacy.rrFormatEUR(n))
      expect(ts.rrFormatAxis(n)).toBe(legacy.rrFormatAxis(n))
    }
  })
})
