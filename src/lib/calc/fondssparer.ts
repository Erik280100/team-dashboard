// Fondssparer — kalibriert gegen echte Angebote.
//
// Hintergrund: Das alte, generische Kostenmodell in rendite.ts (feste Sparprämie 91,10 % +
// feste laufende Kosten 0,516 % p.a., unabhängig von der Laufzeit) trifft reale Angebote nicht.
// Echte Fondssparer-Angebote zeigen sowohl eine laufzeitabhängige Kostenstruktur als auch eine
// Prämiendynamik, die sich deutlich schwächer auswirkt als eine simple 3-%-Steigerung der
// Monatsprämie — siehe test/fixtures/fondssparer-angebote.json (124 echte Ablaufleistungen,
// 50–500 €/Monat, 5–45 Jahre Laufzeit, mit und ohne 3 % Dynamik, Annahme 6 % p.a.). Dieses
// Modul bildet dieses reale Verhalten nach, kalibriert über test/calc/fondssparer.calibrate.test.ts.
//
// Anders als bei der Merkur-FLV (merkurFlv.ts) ist die Sparprämien-Quote NICHT prämienabhängig —
// die gelieferten Werte sind über alle Prämienstufen linear (500 € = 10 × 50 € auf den Euro
// genau). Alle Parameter hängen nur von der Laufzeit ab.
//
// Modellidee: Kein Einmalerlag, keine Zillmerung, keine Kickbacks. Die Sparprämien-Quote je
// Laufzeit ist bereits der über die ganze Laufzeit gemittelte Nettoanteil (Versicherungssteuer +
// Kosten). Die Fondskosten (1,89 % p.a., für alle Laufzeiten gleich) werden explizit aus der
// Performance herausgerechnet, damit sie im Kostenausweis der UI ehrlich ausgewiesen werden
// können — das macht den kalibrierten "Ertragsaufschlag" größer als bei Merkur, weil er diese
// 1,89 pp mitkompensiert (siehe Kommentar bei FONDSSPARER_ERTRAGSAUFSCHLAG unten).
import { interpLinear } from "./merkurFlv"

/** Sparprämie: Anteil der Monatsprämie, der (netto nach VSt + Kosten) investiert wird. */
export const FONDSSPARER_SPARPRAEMIE: Record<number, number> = {
  5: 0.9103,
  10: 0.9107,
  15: 0.9108,
  20: 0.9109,
  25: 0.9109,
  30: 0.9109,
  35: 0.911,
  40: 0.911,
  45: 0.911,
}

/** Laufende Kosten am veranlagten Vermögen, monatlich (nicht die Fondskosten). */
export const FONDSSPARER_KOSTEN_VERMOEGEN_MTL: Record<number, number> = {
  5: 0.00025,
  10: 0.00031,
  15: 0.00036,
  20: 0.00038,
  25: 0.00039,
  30: 0.0004,
  35: 0.00041,
  40: 0.00042,
  45: 0.00042,
}

/** Risikokosten am veranlagten Vermögen, monatlich. */
export const FONDSSPARER_RISIKOKOSTEN_MTL: Record<number, number> = {
  5: 0,
  10: 0,
  15: 0,
  20: 0.00001,
  25: 0.00001,
  30: 0.00001,
  35: 0.00001,
  40: 0.00002,
  45: 0.00003,
}

/** Kosten der Fonds selbst, für alle Laufzeiten gleich (zwei Fonds). */
export const FONDSSPARER_FONDSKOSTEN_PA = 0.0189

/**
 * Kalibrierter Ertragsaufschlag (Prozentpunkte auf perf), je Laufzeit. Kalibriert über
 * test/calc/fondssparer.calibrate.test.ts gegen die 6-%-p.a.-Angebote im Fixture.
 *
 * Fällt größer aus als Merkurs MERKUR_ERTRAGSAUFSCHLAG_PA (+0,585 pp), weil hier zusätzlich die
 * 1,89 pp Fondskosten kompensiert werden müssen, die simulateFondssparerKalibriert() separat von
 * perf abzieht (siehe Modulkommentar oben). Der eigentliche Kalibrierrest liegt bei
 * +0,19 pp (45 J.) bis +1,07 pp (10 J.).
 *
 * Linear in 1/Laufzeit interpoliert (Kurvenform a + b/T), analog merkurBasisPct().
 */
export const FONDSSPARER_ERTRAGSAUFSCHLAG_PA: Record<number, number> = {
  5: 0.020794,
  10: 0.029589,
  15: 0.026046,
  20: 0.024427,
  25: 0.023377,
  30: 0.022716,
  35: 0.022262,
  40: 0.022055,
  45: 0.021761,
}

/**
 * Wirksamkeit der nominalen Prämiendynamik (0..1), je Laufzeit. Eine z. B. 3 %ige jährliche
 * Wertanpassung der Monatsprämie schlägt sich nicht 1:1 in der Ablaufleistung nieder — mit
 * wachsender Laufzeit nähert sie sich 1 an. Analog MERKUR_DYNAMIK_WIRKSAMKEIT, hier aber
 * laufzeitabhängig statt konstant, weil die Angebotsdaten das eindeutig zeigen (0,40 bei 10 J.
 * bis 0,91 bei 45 J.).
 *
 * Für 5 Jahre liegen keine Dynamik-Angebote vor — der Wert ist über die Randsteigung
 * 10→15 Jahre nach unten extrapoliert (siehe fondssparer.calibrate.test.ts).
 */
export const FONDSSPARER_DYNAMIK_WIRKSAMKEIT: Record<number, number> = {
  5: 0.1386,
  10: 0.4018,
  15: 0.665,
  20: 0.7708,
  25: 0.8265,
  30: 0.8601,
  35: 0.8824,
  40: 0.8979,
  45: 0.909,
}

function lookupByJahre(table: Record<number, number>, jahre: number): number {
  const entries = Object.entries(table).map(([j, v]) => [Number(j), v] as [number, number])
  return interpLinear(jahre, entries)
}

/** Ertragsaufschlag für eine beliebige Laufzeit, linear in 1/Laufzeit interpoliert/extrapoliert. */
export function fondssparerErtragsaufschlag(jahre: number): number {
  const entries = Object.entries(FONDSSPARER_ERTRAGSAUFSCHLAG_PA)
    .map(([j, v]) => [1 / Number(j), v] as [number, number])
  return interpLinear(1 / jahre, entries)
}

/** Dynamik-Wirksamkeit für eine beliebige Laufzeit, linear interpoliert. */
export function fondssparerDynamikWirksamkeit(jahre: number): number {
  return lookupByJahre(FONDSSPARER_DYNAMIK_WIRKSAMKEIT, jahre)
}

export function fondssparerSparpraemie(jahre: number): number {
  return lookupByJahre(FONDSSPARER_SPARPRAEMIE, jahre)
}

export function fondssparerKostenVermoegenMtl(jahre: number): number {
  return lookupByJahre(FONDSSPARER_KOSTEN_VERMOEGEN_MTL, jahre)
}

export function fondssparerRisikokostenMtl(jahre: number): number {
  return lookupByJahre(FONDSSPARER_RISIKOKOSTEN_MTL, jahre)
}

/**
 * Fondssparer: kein Einmalerlag, keine Zillmerung, keine Kickbacks. waPct = nominale jährliche
 * Wertanpassung der Monatsprämie zum Vertragsjubiläum; die tatsächlich wirksame Steigerung liegt
 * darunter, siehe fondssparerDynamikWirksamkeit().
 */
export function simulateFondssparerKalibriert(
  monat: number, jahre: number, perf: number, waPct = 0
): number[] {
  const months = jahre * 12
  const g = perf + fondssparerErtragsaufschlag(jahre)
  const iMonat =
    Math.pow(1 + g, 1 / 12) * Math.pow(1 - FONDSSPARER_FONDSKOSTEN_PA, 1 / 12) -
    1 -
    fondssparerKostenVermoegenMtl(jahre) -
    fondssparerRisikokostenMtl(jahre)
  const dynEff = waPct > 0 ? waPct * fondssparerDynamikWirksamkeit(jahre) : 0
  const quote = fondssparerSparpraemie(jahre)

  let depot = 0
  const values = [0]
  for (let m = 1; m <= months; m++) {
    const jahrIdx = Math.floor((m - 1) / 12)
    const praemieM = dynEff > 0 ? monat * Math.pow(1 + dynEff, jahrIdx) : monat
    depot += praemieM * quote
    depot *= 1 + iMonat
    if (depot < 0) depot = 0
    values.push(depot)
  }
  return values
}

/** Kostenzeilen für die Fondssparer-Anzeige — spiegelt die tatsächlich verwendeten Werte wider. */
export function fondssparerKostenZeilen(jahre: number): [string, string][] {
  const quotePct = fondssparerSparpraemie(jahre) * 100
  const abzugPct = (1 - fondssparerSparpraemie(jahre)) * 100
  const kostenPct = fondssparerKostenVermoegenMtl(jahre) * 100
  const risikoPct = fondssparerRisikokostenMtl(jahre) * 100
  return [
    ["Sparprämie (netto in Fondsanteil)", `${quotePct.toFixed(2).replace(".", ",")} % der Prämie`],
    ["Versicherungssteuer + Kosten", `${abzugPct.toFixed(2).replace(".", ",")} % der Prämie`],
    ["Kosten am veranlagten Vermögen", `${kostenPct.toFixed(3).replace(".", ",")} % monatlich`],
    ["Risikokosten am veranlagten Vermögen", `${risikoPct.toFixed(3).replace(".", ",")} % monatlich`],
    ["Kosten der Fonds", `${(FONDSSPARER_FONDSKOSTEN_PA * 100).toFixed(2).replace(".", ",")} % p.a.`],
  ]
}
