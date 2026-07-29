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
    for (const inputs of scenarios) {
      expect(calcUmdreh(inputs)).toEqual(legacy.calcUmdrehLegacy(inputs))
    }
  })
})
