// Kalibrierungslauf für die Fondssparer-Konstanten (Ertragsaufschlag, Dynamikwirksamkeit je
// Laufzeit) in src/lib/calc/fondssparer.ts. Läuft NICHT im normalen `npm test` mit (siehe
// describe.skipIf unten) — nur bei Bedarf:
//
//   $env:FONDSSPARER_CALIBRATE=1; npm test -- fondssparer.calibrate
//
// Anders als bei Merkur (globale Grid-Search über 3 Konstanten) ist hier jede Laufzeit-
// Stützstelle unabhängig: die Kostenstruktur (Sparprämie, laufende Kosten, Risikokosten) ist
// vom User direkt vorgegeben (siehe fondssparer.ts), nur der Ertragsaufschlag (aus "ohne
// Dynamik") und die Dynamikwirksamkeit (aus "mit Dynamik", bei fixem Ertragsaufschlag) werden
// je Laufzeit per Bisektion gegen den Median über alle Prämienstufen gelöst. Gibt die
// gefundenen Werte + eine Abweichungstabelle auf der Konsole aus. Die Ergebnisse werden danach
// von Hand in fondssparer.ts übernommen.
import { describe, it } from "vitest"
import fixture from "../fixtures/fondssparer-angebote.json"
import {
  FONDSSPARER_FONDSKOSTEN_PA,
  fondssparerKostenVermoegenMtl,
  fondssparerRisikokostenMtl,
  fondssparerSparpraemie,
} from "../../src/lib/calc/fondssparer"

type Fall = { monat: number; jahre: number; dynamik: boolean; ziel: number }
const faelle = fixture.faelle as Fall[]
const perf = fixture.annahmePerfPa
const waPct = fixture.dynamikNominalPa
const LAUFZEITEN = [5, 10, 15, 20, 25, 30, 35, 40, 45]

function simulate(monat: number, jahre: number, ertragPa: number, dynEff: number): number {
  const g = perf + ertragPa
  const i =
    Math.pow(1 + g, 1 / 12) * Math.pow(1 - FONDSSPARER_FONDSKOSTEN_PA, 1 / 12) -
    1 -
    fondssparerKostenVermoegenMtl(jahre) -
    fondssparerRisikokostenMtl(jahre)
  const quote = fondssparerSparpraemie(jahre)
  let depot = 0
  for (let m = 1; m <= jahre * 12; m++) {
    const jahrIdx = Math.floor((m - 1) / 12)
    const praemieM = dynEff > 0 ? monat * Math.pow(1 + dynEff, jahrIdx) : monat
    depot += praemieM * quote
    depot *= 1 + i
  }
  return depot
}

/** Median von (ziel / monat * 50) über alle Prämienstufen für eine Laufzeit + Dynamik-Flag. */
function medianZiel50(jahre: number, dynamik: boolean): number | null {
  const werte = faelle
    .filter((f) => f.jahre === jahre && f.dynamik === dynamik)
    .map((f) => (f.ziel / f.monat) * 50)
    .sort((a, b) => a - b)
  if (werte.length === 0) return null
  const mid = Math.floor(werte.length / 2)
  return werte.length % 2 ? werte[mid] : (werte[mid - 1] + werte[mid]) / 2
}

function bisect(f: (x: number) => number, ziel: number, lo: number, hi: number): number {
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2
    if (f(mid) < ziel) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

describe.skipIf(!process.env.FONDSSPARER_CALIBRATE)("Fondssparer Kalibrierung (opt-in)", () => {
  it("löst Ertragsaufschlag + Dynamikwirksamkeit je Laufzeit per Bisektion", () => {
    const ertrag: Record<number, number> = {}
    const dynWirk: Record<number, number> = {}

    for (const jahre of LAUFZEITEN) {
      const zielOhne = medianZiel50(jahre, false)
      if (zielOhne === null) continue
      ertrag[jahre] = bisect((x) => simulate(50, jahre, x, 0), zielOhne, -0.05, 0.2)

      const zielMit = medianZiel50(jahre, true)
      if (zielMit !== null) {
        const wirk = bisect((x) => simulate(50, jahre, ertrag[jahre], waPct * x), zielMit, -0.5, 2)
        dynWirk[jahre] = wirk
      }
    }

    console.log("\n=== Fondssparer Kalibrierung: FONDSSPARER_ERTRAGSAUFSCHLAG_PA ===")
    for (const jahre of LAUFZEITEN) console.log(`  ${jahre}: ${ertrag[jahre]?.toFixed(6)},`)
    console.log("\n=== Fondssparer Kalibrierung: FONDSSPARER_DYNAMIK_WIRKSAMKEIT ===")
    for (const jahre of LAUFZEITEN) console.log(`  ${jahre}: ${dynWirk[jahre]?.toFixed(4) ?? "(keine Daten)"},`)

    const rows = faelle
      .map((f) => {
        const dynEff = f.dynamik ? waPct * (dynWirk[f.jahre] ?? 0) : 0
        const modell = simulate(f.monat, f.jahre, ertrag[f.jahre] ?? 0, dynEff)
        const abwPct = ((modell - f.ziel) / f.ziel) * 100
        return { ...f, modell: Math.round(modell), abwPct }
      })
      .sort((a, b) => Math.abs(b.abwPct) - Math.abs(a.abwPct))

    console.log("\nMonat | Jahre | Dyn | Ziel | Modell | Abw %")
    for (const r of rows) {
      console.log(`${r.monat}\t${r.jahre}\t${r.dynamik ? "mit" : "ohne"}\t${r.ziel}\t${r.modell}\t${r.abwPct.toFixed(3)}`)
    }
    const meanAbs = rows.reduce((s, r) => s + Math.abs(r.abwPct), 0) / rows.length
    const maxAbs = Math.max(...rows.map((r) => Math.abs(r.abwPct)))
    console.log(`\nMittlere |Abw| = ${meanAbs.toFixed(4)} %, Max |Abw| = ${maxAbs.toFixed(3)} %`)
  }, 30000)
})
