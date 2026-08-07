// Tilgungsträger — vergleicht den Restschuldverlauf eines Kredits (aus kredit.ts) mit dem
// Sparguthaben eines parallel besparten FLV-Sparplans (aus merkurFlv.ts) und findet den
// Schnittpunkt, ab dem das Guthaben die offene Restschuld übersteigt. Die FLV-Simulation
// selbst wird unverändert aus merkurFlv.ts übernommen (kalibriert gegen echte Merkur-Angebote,
// siehe test/calc/merkur.reference.test.ts) — hier passiert nur der Vergleich der beiden Reihen.
import { MERKUR_DYNAMIK_WIRKSAMKEIT, simulateMerkurFLVPraemie } from "./merkurFlv"
import type { TilgungsplanErgebnis } from "./kredit"

export interface TilgungstraegerErgebnis {
  /** Sparguthaben je Monat, Länge laufzeitJahre*12 + 1, Index 0 = Monat 0 (Guthaben 0). Leer, wenn keine Sparrate. */
  sparwertMonate: number[]
  /** Restschuld je Monat, deckungsgleich zu sparwertMonate (für den Chart). Leer, wenn keine Sparrate. */
  restschuldMonate: number[]
  /** Exakter, linear interpolierter Zeitpunkt des Schnittpunkts in Monaten (z. B. 148,3). */
  schnittpunktMonat: number | null
  /** Um wie viele Jahre früher der Kredit ggü. der vollen Laufzeit abgelöst werden könnte. */
  jahreFrueher: number | null
  sparwertImSchnittpunkt: number | null
  restschuldImSchnittpunkt: number | null
  einbezahltImSchnittpunkt: number | null
  /** Summe der Zinsen, die ab dem Schnittpunkt-Monat entfallen würden. */
  zinsersparnis: number
}

const LEER: TilgungstraegerErgebnis = {
  sparwertMonate: [],
  restschuldMonate: [],
  schnittpunktMonat: null,
  jahreFrueher: null,
  sparwertImSchnittpunkt: null,
  restschuldImSchnittpunkt: null,
  einbezahltImSchnittpunkt: null,
  zinsersparnis: 0,
}

/**
 * Summe der bis zu einem (ggf. gebrochenen) Monat einbezahlten Prämien — bildet dieselbe
 * Dynamikstaffel nach, die simulateMerkurFLVPraemie intern verwendet (Prämie steigt einmal je
 * angefangenes Vertragsjahr um waPct * MERKUR_DYNAMIK_WIRKSAMKEIT), damit "einbezahlt" konsistent
 * zum simulierten Guthaben bleibt.
 */
function einbezahltBis(sparrateMonat: number, waPct: number, monat: number): number {
  const waEff = waPct > 0 ? waPct * MERKUR_DYNAMIK_WIRKSAMKEIT : 0
  const vollMonate = Math.floor(monat)
  let summe = 0
  for (let m = 1; m <= vollMonate; m++) {
    const jahrIdx = Math.floor((m - 1) / 12)
    summe += waEff > 0 ? sparrateMonat * Math.pow(1 + waEff, jahrIdx) : sparrateMonat
  }
  const rest = monat - vollMonate
  if (rest > 0) {
    const jahrIdx = Math.floor(vollMonate / 12)
    summe += rest * (waEff > 0 ? sparrateMonat * Math.pow(1 + waEff, jahrIdx) : sparrateMonat)
  }
  return summe
}

/**
 * Vergleicht den Restschuldverlauf des Kredits mit dem Sparguthaben eines Merkur-FLV-Sparplans
 * (gleiche Laufzeit wie der Kredit) und ermittelt, ab welchem Monat das Guthaben die Restschuld
 * übersteigt. perf und dynamikPct sind Dezimalzahlen (0.06 = 6 %, nicht 6).
 */
export function berechneTilgungstraeger(
  plan: TilgungsplanErgebnis,
  kreditbetrag: number,
  sparrateMonat: number,
  laufzeitJahre: number,
  perf: number,
  dynamikPct: number
): TilgungstraegerErgebnis {
  if (sparrateMonat <= 0 || plan.monate.length === 0) return LEER

  const sparwertMonate = simulateMerkurFLVPraemie(sparrateMonat, laufzeitJahre, perf, dynamikPct)
  const restschuldMonate = [kreditbetrag, ...plan.monate.map((m) => m.restschuld)]
  const n = Math.min(sparwertMonate.length, restschuldMonate.length) - 1

  // d(k) = Sparwert − Restschuld: startet negativ (Guthaben < Restschuld), endet positiv
  // (Restschuld 0, Guthaben > 0) — es gibt also immer genau einen Vorzeichenwechsel.
  const d = (k: number) => sparwertMonate[k] - restschuldMonate[k]

  let i = -1
  for (let k = 1; k <= n; k++) {
    if (d(k) >= 0) {
      i = k
      break
    }
  }
  if (i === -1) return LEER // sollte bei rest[n] = 0 nicht vorkommen, Absicherung

  const dPrev = d(i - 1)
  const dCurr = d(i)
  const t = dCurr === dPrev ? 0 : -dPrev / (dCurr - dPrev)
  const schnittpunktMonat = (i - 1) + t

  const sparwertImSchnittpunkt = sparwertMonate[i - 1] + t * (sparwertMonate[i] - sparwertMonate[i - 1])
  const restschuldImSchnittpunkt = restschuldMonate[i - 1] + t * (restschuldMonate[i] - restschuldMonate[i - 1])
  const einbezahltImSchnittpunkt = einbezahltBis(sparrateMonat, dynamikPct, schnittpunktMonat)

  // plan.monate[i-1] entspricht Monat i (1-indiziert); die entfallenden Zinsen sind alle
  // Monate ab dem ersten vollen Monat nach dem Schnittpunkt.
  const abIndex = Math.ceil(schnittpunktMonat)
  const zinsersparnis = plan.monate.slice(abIndex).reduce((s, m) => s + m.zins, 0)

  return {
    sparwertMonate,
    restschuldMonate,
    schnittpunktMonat,
    jahreFrueher: laufzeitJahre - schnittpunktMonat / 12,
    sparwertImSchnittpunkt,
    restschuldImSchnittpunkt,
    einbezahltImSchnittpunkt,
    zinsersparnis,
  }
}
