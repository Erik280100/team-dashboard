// Abgleichstest: die Merkur-FLV-Simulation (src/lib/calc/merkurFlv.ts) muss nahe an
// den echten Merkur-Angeboten in test/fixtures/merkur-angebote.json liegen. Dieser
// Test läuft immer mit (im Gegensatz zu merkur.calibrate.test.ts) und ist der Weg,
// um den Abgleich jederzeit erneut zu prüfen — z. B. nach neuen Referenzangeboten
// oder nach einer Anpassung der Kalibrierung.
import { describe, expect, it } from "vitest"
import fixture from "../fixtures/merkur-angebote.json"
import { merkurBasisPct, merkurLaufzeitAufschlag, simulateMerkurFLVPraemie } from "../../src/lib/calc/merkurFlv"

type Fall = { monat: number; jahre: number; dynamik: boolean; ziel: number }
const faelle = fixture.faelle as Fall[]
const perf = fixture.annahmePerfPa
const waPct = fixture.dynamikNominalPa

describe(`merkurFlv: Abgleich gegen ${faelle.length} echte Angebote (Annahme ${perf * 100} % p.a.)`, () => {
  const rows = faelle.map((f) => {
    const values = simulateMerkurFLVPraemie(f.monat, f.jahre, perf, f.dynamik ? waPct : 0)
    const modell = values[values.length - 1]
    const abwPct = ((modell - f.ziel) / f.ziel) * 100
    return { ...f, modell, abwPct }
  })

  it("jeder Fall liegt innerhalb von ±2 % der Ablaufleistung", () => {
    const sorted = [...rows].sort((a, b) => Math.abs(b.abwPct) - Math.abs(a.abwPct))
    const header = "Monat\tJahre\tDyn\tZiel\tModell\tAbw %"
    const table = sorted
      .map((r) => `${r.monat}\t${r.jahre}\t${r.dynamik ? "mit" : "ohne"}\t${r.ziel}\t${Math.round(r.modell)}\t${r.abwPct.toFixed(2)}`)
      .join("\n")
    console.log(`\n${header}\n${table}`)

    for (const r of rows) {
      expect(Math.abs(r.abwPct), `${r.monat}€ / ${r.jahre}J / ${r.dynamik ? "mit" : "ohne"} Dynamik`).toBeLessThan(2)
    }
  })

  it("mittlere absolute Abweichung liegt unter 0,5 %", () => {
    const meanAbs = rows.reduce((s, r) => s + Math.abs(r.abwPct), 0) / rows.length
    expect(meanAbs).toBeLessThan(0.5)
  })
})

describe("merkurFlv: Sparprämien-Tabelle konsistent mit den Roh-Kostenwerten", () => {
  type KostenRoh = { monat: number; jahre: number; pct: number }[]
  const kostenRoh = fixture.kostenRoh as KostenRoh

  it("basis(prämie) + profil(laufzeit) trifft jeden gelieferten Kostenwert auf ±0,05 Prozentpunkte", () => {
    for (const k of kostenRoh) {
      const modell = merkurBasisPct(k.monat) + merkurLaufzeitAufschlag(k.jahre)
      expect(Math.abs(modell - k.pct), `${k.monat}€ / ${k.jahre}J`).toBeLessThan(0.05)
    }
  })
})
