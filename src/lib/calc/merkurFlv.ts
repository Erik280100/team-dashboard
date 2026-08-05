// Merkur-FLV (fondsgebundene Lebensversicherung) — kalibriert gegen echte Angebote.
//
// Hintergrund: Das alte, generische Merkur/Helvetia-Kostenmodell in rendite.ts
// (feste 4 % VSt + 4 % Verwaltung + 4 % Zillmerung) hält den investierten Anteil
// konstant bei ~88 %, egal wie hoch Prämie oder Laufzeit sind. Echte Merkur-
// Angebote zeigen aber einen Sparprämien-Anteil, der mit der Prämienhöhe UND der
// Laufzeit variiert (84,8 % bei 10 Jahren bis 76,4 % bei 45 Jahren) — siehe
// test/fixtures/merkur-angebote.json. Dieses Modul bildet dieses reale Verhalten
// nach, kalibriert über test/calc/merkur.calibrate.test.ts.
//
// Modellidee: Der vom Versicherer ausgewiesene "Sparprämie %"-Wert ist bereits ein
// über die ganze Laufzeit gemittelter Effekt aus laufenden Kosten UND der
// frontlastigen Zillmerung (Abschlusskosten, verteilt auf die ersten 60 Monate).
// Um daraus eine monatliche Simulation zu bauen, wird die frontlastige Zillmerung
// separat herausgerechnet (zurückaddiert) und dann in den ersten 60 Monaten
// explizit wieder abgezogen — sonst würde sie doppelt wirken.
import { rrRate } from "./rendite"

/** Sparprämie % bei Laufzeit 45 Jahre, je Monatsprämie (Stützstellen aus echten Angeboten). */
export const MERKUR_SPARPRAEMIE_BASIS_45J: Record<number, number> = {
  50: 76.41,
  100: 77.49,
  250: 78.63,
  300: 78.69,
  400: 78.78,
  450: 78.82,
  500: 78.84,
}

/** Aufschlag auf die 45-Jahres-Basis je Laufzeit (über alle Prämien gemittelt, siehe Fixture). */
export const MERKUR_LAUFZEIT_PROFIL: Record<number, number> = {
  5: 6.885,
  10: 5.924,
  15: 4.96,
  20: 4.0,
  25: 3.04,
  30: 2.485,
  35: 1.923,
  40: 0.96,
  45: 0,
}

/**
 * Kalibrierte Modellkonstanten — gefunden per Grid-Search in
 * test/calc/merkur.calibrate.test.ts (Aufruf: MERKUR_CALIBRATE=1 npm test).
 * Bei neuen Referenzangeboten: Fixture ergänzen, Kalibrierung neu laufen lassen,
 * Werte hier von Hand übernehmen.
 */
export const MERKUR_ZILLMER_PCT = 0.068
export const MERKUR_ERTRAGSAUFSCHLAG_PA = 0.00585
export const MERKUR_DYNAMIK_WIRKSAMKEIT = 0.912

/** Lineare Interpolation/Randfortschreibung über Stützstellen, sortiert nach x. Auch von fondssparer.ts genutzt. */
export function interpLinear(x: number, points: [number, number][]): number {
  const sorted = [...points].sort((a, b) => a[0] - b[0])
  if (x <= sorted[0][0]) return sorted[0][1]
  if (x >= sorted[sorted.length - 1][0]) return sorted[sorted.length - 1][1]
  for (let i = 0; i < sorted.length - 1; i++) {
    const [x0, y0] = sorted[i]
    const [x1, y1] = sorted[i + 1]
    if (x >= x0 && x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
  }
  return sorted[sorted.length - 1][1]
}

/** Basis-Sparprämie % (bei 45 Jahren) für eine beliebige Monatsprämie, linear in 1/Prämie interpoliert. */
export function merkurBasisPct(monat: number): number {
  if (monat <= 0) return Object.values(MERKUR_SPARPRAEMIE_BASIS_45J)[0]
  const points: [number, number][] = Object.entries(MERKUR_SPARPRAEMIE_BASIS_45J).map(
    ([m, pct]) => [1 / Number(m), pct]
  )
  return interpLinear(1 / monat, points)
}

/** Laufzeit-Aufschlag (auf die 45-Jahres-Basis) für eine beliebige Laufzeit, linear interpoliert/extrapoliert. */
export function merkurLaufzeitAufschlag(jahre: number): number {
  const entries = Object.entries(MERKUR_LAUFZEIT_PROFIL)
    .map(([j, pct]) => [Number(j), pct] as [number, number])
    .sort((a, b) => a[0] - b[0])
  if (jahre <= entries[0][0]) {
    // Randsteigung nach unten fortschreiben (z. B. für Laufzeiten < 5 Jahre).
    const [x0, y0] = entries[0]
    const [x1, y1] = entries[1]
    const slope = (y1 - y0) / (x1 - x0)
    return y0 + slope * (jahre - x0)
  }
  if (jahre >= entries[entries.length - 1][0]) return entries[entries.length - 1][1]
  return interpLinear(jahre, entries)
}

/** Effektiver Sparprämien-Anteil (0..1) für Prämie & Laufzeit, gemittelt über die ganze Laufzeit. */
export function merkurSparpraemieQuote(monat: number, jahre: number): number {
  return (merkurBasisPct(monat) + merkurLaufzeitAufschlag(jahre)) / 100
}

/**
 * Simuliert die Merkur-FLV-Prämientopf (kein Einmalerlag-Anteil, siehe simulateFLV in
 * rendite.ts für den unveränderten Einmalerlag-Zweig). waPct = nominale jährliche
 * Wertanpassung; die tatsächlich wirksame Prämiensteigerung liegt (Jubiläums-Timing,
 * Kosten auf Dynamikstufen) darunter -> MERKUR_DYNAMIK_WIRKSAMKEIT.
 */
export function simulateMerkurFLVPraemie(monat: number, jahre: number, perf: number, waPct = 0): number[] {
  const months = jahre * 12
  const r = rrRate(perf + MERKUR_ERTRAGSAUFSCHLAG_PA)
  const waEff = waPct > 0 ? waPct * MERKUR_DYNAMIK_WIRKSAMKEIT : 0

  // "Sparprämie-Quote" ist der über die ganze Laufzeit gemittelte Effekt inkl.
  // Zillmerung. Um die Zillmerung separat (nur Monat 1–60) abzuziehen, wird ihr
  // Durchschnittsanteil hier zurückaddiert, damit keine Doppelbelastung entsteht.
  const quote = merkurSparpraemieQuote(monat, jahre) + MERKUR_ZILLMER_PCT
  const gesamtBrutto = monat * 12 * jahre
  const zillmerMonatlich = (MERKUR_ZILLMER_PCT * gesamtBrutto) / 60

  let depot = 0
  const values = [0]
  for (let m = 1; m <= months; m++) {
    const jahrIdx = Math.floor((m - 1) / 12)
    const praemieM = waEff > 0 ? monat * Math.pow(1 + waEff, jahrIdx) : monat
    let invest = quote * praemieM - (m <= 60 ? zillmerMonatlich : 0)
    if (invest < 0) invest = 0
    depot += invest
    depot *= 1 + r
    if (depot < 0) depot = 0
    values.push(depot)
  }
  return values
}

/**
 * Merkur-Einmalerlag-Topf — unverändert aus dem bisherigen Kostenmodell übernommen
 * (4 % Abschlusskosten, 4 %/11 % VSt je nach Laufzeit, 0,55 % p.a. Depotkosten,
 * +0,835 % p.a. Kickback, 2 €/Monat Fixkosten). Dafür liegen keine echten
 * Referenzangebote vor, daher wird hier nichts kalibriert oder geändert.
 */
export function simulateMerkurFLVEinmal(einmal: number, jahre: number, perf: number): number[] {
  const months = jahre * 12
  const r = rrRate(perf)
  const depotCostEinmalPa = 0.002 + 0.0035
  const vstEinmal = jahre >= 15 ? 0.04 : 0.11
  let depot = einmal * (1 - vstEinmal) - einmal * 0.04
  if (depot < 0) depot = 0
  const values = [depot]
  for (let m = 1; m <= months; m++) {
    depot *= 1 + r
    depot -= depot * (depotCostEinmalPa / 12)
    depot += depot * (0.00835 / 12)
    depot -= 2
    if (depot < 0) depot = 0
    values.push(depot)
  }
  return values
}

/** Kostenzeilen für die Merkur-Anzeige — spiegelt die tatsächlich verwendeten Werte wider. */
export function merkurKostenZeilen(monat: number, jahre: number): [string, string][] {
  const quotePct = merkurSparpraemieQuote(monat, jahre) * 100
  return [
    ["Sparprämie (netto in Fondsanteil)", `${quotePct.toFixed(1).replace(".", ",")} % der Prämie`],
    ["Abschlusskosten (Zillmerung)", `${(MERKUR_ZILLMER_PCT * 100).toFixed(1).replace(".", ",")} % · Monat 1–60`],
    ["Fondsrabatte/Kickbacks (Ertrag)", `+${(MERKUR_ERTRAGSAUFSCHLAG_PA * 100).toFixed(2).replace(".", ",")} % p.a.`],
    ["Einmalerlag Abschlusskosten", "4 %"],
    ["Einmalerlag Verwaltung", "0,35 % p.a."],
    ["Einmalerlag VSt", "4 % (≥15 J.) / 11 % (<15 J.)"],
    ["Kickbacks (Einmalerlag)", "+0,835 % p.a."],
    ["Fixkosten (nur bei Einmalerlag)", "2 €/Monat"],
  ]
}
