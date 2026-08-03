// Kalibrierungslauf für die Merkur-FLV-Konstanten (Zillmer%, Ertragsaufschlag,
// Dynamikwirksamkeit) in src/lib/calc/merkurFlv.ts. Läuft NICHT im normalen
// `npm test` mit (siehe describe.skipIf unten) — nur bei Bedarf:
//
//   $env:MERKUR_CALIBRATE=1; npm test -- merkur.calibrate
//
// Grid-Search über die drei freien Parameter, Zielfunktion = mittlere quadratische
// relative Abweichung gegen alle Fälle in test/fixtures/merkur-angebote.json.
// Gibt die besten Parameter + eine Abweichungstabelle auf der Konsole aus. Die
// gefundenen Werte werden danach von Hand in merkurFlv.ts übernommen.
import { describe, it } from "vitest"
import fixture from "../fixtures/merkur-angebote.json"
import { merkurSparpraemieQuote } from "../../src/lib/calc/merkurFlv"
import { rrRate } from "../../src/lib/calc/rendite"

type Faelle = { monat: number; jahre: number; dynamik: boolean; ziel: number }[]
const faelle = fixture.faelle as Faelle
const perf = fixture.annahmePerfPa
const waPct = fixture.dynamikNominalPa

function simulate(monat: number, jahre: number, dynamik: boolean, zillmerPct: number, ertragPa: number, dynWirk: number): number {
  const months = jahre * 12
  const r = rrRate(perf + ertragPa)
  const waEff = dynamik ? waPct * dynWirk : 0
  const quote = merkurSparpraemieQuote(monat, jahre) + zillmerPct
  const gesamtBrutto = monat * 12 * jahre
  const zillmerMonatlich = (zillmerPct * gesamtBrutto) / 60
  let depot = 0
  for (let m = 1; m <= months; m++) {
    const jahrIdx = Math.floor((m - 1) / 12)
    const praemieM = waEff > 0 ? monat * Math.pow(1 + waEff, jahrIdx) : monat
    let invest = quote * praemieM - (m <= 60 ? zillmerMonatlich : 0)
    if (invest < 0) invest = 0
    depot += invest
    depot *= 1 + r
    if (depot < 0) depot = 0
  }
  return depot
}

function meanSquaredRelError(zillmerPct: number, ertragPa: number, dynWirk: number): number {
  let sum = 0
  for (const f of faelle) {
    const modell = simulate(f.monat, f.jahre, f.dynamik, zillmerPct, ertragPa, dynWirk)
    const relErr = (modell - f.ziel) / f.ziel
    sum += relErr * relErr
  }
  return sum / faelle.length
}

describe.skipIf(!process.env.MERKUR_CALIBRATE)("Merkur-FLV Kalibrierung (opt-in)", () => {
  it("Grid-Search über Zillmer%, Ertragsaufschlag, Dynamikwirksamkeit", () => {
    // Grid-Search braucht mehr als das vitest-Default-Timeout von 5s.
    let best = { zillmerPct: 0.068, ertragPa: 0.00585, dynWirk: 0.912, mse: Infinity }

    for (let zillmerPct = 0.04; zillmerPct <= 0.12; zillmerPct += 0.005) {
      for (let ertragPa = 0; ertragPa <= 0.015; ertragPa += 0.0005) {
        for (let dynWirk = 0.8; dynWirk <= 1.0; dynWirk += 0.01) {
          const mse = meanSquaredRelError(zillmerPct, ertragPa, dynWirk)
          if (mse < best.mse) best = { zillmerPct, ertragPa, dynWirk, mse }
        }
      }
    }

    // Feinsuche um das Grobraster-Optimum.
    let fine = { ...best }
    for (let zillmerPct = best.zillmerPct - 0.005; zillmerPct <= best.zillmerPct + 0.005; zillmerPct += 0.0005) {
      for (let ertragPa = best.ertragPa - 0.0005; ertragPa <= best.ertragPa + 0.0005; ertragPa += 0.00005) {
        for (let dynWirk = best.dynWirk - 0.01; dynWirk <= best.dynWirk + 0.01; dynWirk += 0.002) {
          const mse = meanSquaredRelError(zillmerPct, ertragPa, dynWirk)
          if (mse < fine.mse) fine = { zillmerPct, ertragPa, dynWirk, mse }
        }
      }
    }

    console.log("\n=== Merkur-FLV Kalibrierung: bestes Ergebnis ===")
    console.log(`MERKUR_ZILLMER_PCT = ${fine.zillmerPct.toFixed(4)}`)
    console.log(`MERKUR_ERTRAGSAUFSCHLAG_PA = ${fine.ertragPa.toFixed(5)}`)
    console.log(`MERKUR_DYNAMIK_WIRKSAMKEIT = ${fine.dynWirk.toFixed(3)}`)
    console.log(`RMS relative Abweichung = ${(Math.sqrt(fine.mse) * 100).toFixed(3)} %`)

    const rows = faelle
      .map((f) => {
        const modell = simulate(f.monat, f.jahre, f.dynamik, fine.zillmerPct, fine.ertragPa, fine.dynWirk)
        const abwPct = ((modell - f.ziel) / f.ziel) * 100
        return { ...f, modell: Math.round(modell), abwPct }
      })
      .sort((a, b) => Math.abs(b.abwPct) - Math.abs(a.abwPct))

    console.log("\nMonat | Jahre | Dyn | Ziel | Modell | Abw %")
    for (const r of rows) {
      console.log(
        `${r.monat}\t${r.jahre}\t${r.dynamik ? "mit" : "ohne"}\t${r.ziel}\t${r.modell}\t${r.abwPct.toFixed(2)}`
      )
    }
    const meanAbs = rows.reduce((s, r) => s + Math.abs(r.abwPct), 0) / rows.length
    const maxAbs = Math.max(...rows.map((r) => Math.abs(r.abwPct)))
    console.log(`\nMittlere |Abw| = ${meanAbs.toFixed(3)} %, Max |Abw| = ${maxAbs.toFixed(3)} %`)
  }, 60000)
})
