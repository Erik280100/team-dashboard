// Abgleichstest: die Fondssparer-Simulation (src/lib/calc/fondssparer.ts) muss nahe an den
// echten Angeboten in test/fixtures/fondssparer-angebote.json liegen. Läuft immer mit
// (im Gegensatz zu fondssparer.calibrate.test.ts) und ist der Weg, um den Abgleich jederzeit
// erneut zu prüfen — z. B. nach neuen Referenzangeboten oder nach einer Anpassung der
// Kalibrierung.
import { describe, expect, it } from "vitest"
import fixture from "../fixtures/fondssparer-angebote.json"
import { simulateFondssparerKalibriert } from "../../src/lib/calc/fondssparer"

type Fall = { monat: number; jahre: number; dynamik: boolean; ziel: number }
const faelle = fixture.faelle as Fall[]
const perf = fixture.annahmePerfPa
const waPct = fixture.dynamikNominalPa

describe(`fondssparer: Abgleich gegen ${faelle.length} echte Angebote (Annahme ${perf * 100} % p.a.)`, () => {
  const rows = faelle.map((f) => {
    const values = simulateFondssparerKalibriert(f.monat, f.jahre, perf, f.dynamik ? waPct : 0)
    const modell = values[values.length - 1]
    const abwPct = ((modell - f.ziel) / f.ziel) * 100
    return { ...f, modell, abwPct }
  })

  it("jeder Fall liegt innerhalb von ±0,5 % der Ablaufleistung", () => {
    const sorted = [...rows].sort((a, b) => Math.abs(b.abwPct) - Math.abs(a.abwPct))
    const header = "Monat\tJahre\tDyn\tZiel\tModell\tAbw %"
    const table = sorted
      .map((r) => `${r.monat}\t${r.jahre}\t${r.dynamik ? "mit" : "ohne"}\t${r.ziel}\t${Math.round(r.modell)}\t${r.abwPct.toFixed(3)}`)
      .join("\n")
    console.log(`\n${header}\n${table}`)

    for (const r of rows) {
      expect(Math.abs(r.abwPct), `${r.monat}€ / ${r.jahre}J / ${r.dynamik ? "mit" : "ohne"} Dynamik`).toBeLessThan(0.5)
    }
  })

  it("mittlere absolute Abweichung liegt unter 0,1 %", () => {
    const meanAbs = rows.reduce((s, r) => s + Math.abs(r.abwPct), 0) / rows.length
    expect(meanAbs).toBeLessThan(0.1)
  })
})

describe("fondssparer: Modelleigenschaften", () => {
  it("Ablaufleistung ist exakt linear in der Prämie", () => {
    for (const jahre of [5, 10, 20, 30, 45]) {
      const basis = simulateFondssparerKalibriert(50, jahre, 0.06, 0)
      const doppelt = simulateFondssparerKalibriert(500, jahre, 0.06, 0)
      const ende1 = basis[basis.length - 1]
      const ende2 = doppelt[doppelt.length - 1]
      expect(ende2 / ende1).toBeCloseTo(10, 6)
    }
  })

  it("Ablaufleistung ist streng monoton steigend in der Laufzeit (1..65 Jahre)", () => {
    let prev = 0
    for (let jahre = 1; jahre <= 65; jahre++) {
      const values = simulateFondssparerKalibriert(200, jahre, 0.06, 0)
      const ende = values[values.length - 1]
      expect(ende, `Laufzeit ${jahre}`).toBeGreaterThan(prev)
      prev = ende
    }
  })

  it("Dynamik erhöht die Ablaufleistung gegenüber ohne Dynamik, für jede Laufzeit", () => {
    for (let jahre = 1; jahre <= 65; jahre += 4) {
      const ohne = simulateFondssparerKalibriert(200, jahre, 0.06, 0)
      const mit = simulateFondssparerKalibriert(200, jahre, 0.06, 0.03)
      expect(mit[mit.length - 1], `Laufzeit ${jahre}`).toBeGreaterThanOrEqual(ohne[ohne.length - 1])
    }
  })
})
