import { describe, expect, it } from "vitest"
import { calcUmdreh, type UmdrehInputs } from "../../src/lib/calc/umdreh"
// @ts-expect-error – plain JS fixture, keine Typen nötig
import * as legacy from "../legacy-fixtures/umdreh.legacy.js"

describe("umdreh: golden master vs. legacy", () => {
  const scenarios: UmdrehInputs[] = [
    { praemie: 100, beraterAlt: 3, beraterNeu: 3, fkAlt: 5, fkNeu: 5, stornoActive: false },
    { praemie: 100, beraterAlt: 3, beraterNeu: 3, fkAlt: 5, fkNeu: 5, stornoActive: true },
    { praemie: 250, beraterAlt: 4, beraterNeu: 4, fkAlt: 4, fkNeu: 4, stornoActive: true },
    { praemie: 0, beraterAlt: 0, beraterNeu: 0, fkAlt: 0, fkNeu: 0, stornoActive: false },
    { praemie: 80, beraterAlt: 2, beraterNeu: 5, fkAlt: 6, fkNeu: 2, stornoActive: true },
  ]

  it("calcUmdreh matches legacy recalc() output for various inputs", () => {
    // UM_EH_NEU nutzt bewusst 2,11 statt des Legacy-Faktors 2,14 (die "Alt"-Seite
    // bleibt unverändert bei 2,3), daher werden die "Neu"-abhängigen Felder separat
    // mit dem angepassten Faktor verglichen statt direkt gegen die Legacy-Fixture.
    for (const inputs of scenarios) {
      const a = calcUmdreh(inputs)
      const b = legacy.calcUmdrehLegacy(inputs)
      const scale = 2.11 / 2.14

      expect(a.beraterMinus).toEqual(b.beraterMinus)
      expect(a.fkMinus).toEqual(b.fkMinus)
      expect(a.gesamtMinus).toEqual(b.gesamtMinus)

      expect(a.beraterAktuell).toBeCloseTo(b.beraterAktuell * scale)
      expect(a.fkAktuell).toBeCloseTo(b.fkAktuell * scale)
      expect(a.gesamtAktuell).toBeCloseTo(b.gesamtAktuell * scale)

      expect(a.beraterDiff).toBeCloseTo(a.beraterAktuell - a.beraterMinus)
      expect(a.fkDiff).toBeCloseTo(a.fkAktuell - a.fkMinus)
      expect(a.gesamtDiff).toBeCloseTo(a.gesamtAktuell - a.gesamtMinus)
    }
  })
})
