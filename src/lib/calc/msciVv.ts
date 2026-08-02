// MSCI-World-vs-Vermögensverwaltung-Rechner — Vergleicht die Wertentwicklung eines
// MSCI-World-ETFs mit einer hauseigenen Vermögensverwaltung (VV) über einen frei
// wählbaren Anlagehorizont, ohne Kosten/KESt (bewusst vereinfacht).
//
// Datenbasis eingeschränkt auf 2021–2026 (beide Produkte), auf Kundenwunsch:
//
// VV: reale Kalenderjahres-Renditen 2021–2026 lt. eigener Auswertung (VV_ANNUAL_RETURNS,
// 2026 = laufendes Jahr/YTD). Für längere Horizonte wird dieser 6-Jahres-Block wiederholt.
//
// MSCI World (iShares Core MSCI World UCITS ETF USD Acc): Da für den ETF keine
// Kalenderjahres-Tabelle vorliegt, wird die "5J"-Spalte der Kennzahlen-Übersicht
// verwendet — sie deckt (Stand heute) exakt ca. 2021–2026 ab: Performance +69,53 % über
// 5 Jahre (≈ 11,1 % p.a.), Volatilität 14,34 % p.a., Max. Verlust -26,04 %, bester/
// schlechtester Monat +9,59 %/-9,30 %. Daraus wird ein 6-Jahres-Block aus Monatsrenditen
// synthetisch erzeugt, der auf diese Kennzahlen kalibriert ist (Crash-und-Erholungs-Zyklus
// im 2. Jahr des Blocks, zeitlich analog zum -10,2 %-Jahr der VV, ohne dass das ein
// realer Gleichlauf behauptet wird). Es sind keine echten historischen Monatsrenditen,
// sondern eine Modellrechnung, die die tatsächlichen Fonds-Kennzahlen widerspiegelt.
//
// Beide Blöcke sind bewusst gleich lang (72 Monate), damit sie im Chart auf derselben
// Zyklus-Länge wiederholt werden.
//
// Dividenden-/Kupon-Bonus der VV (auf Kundenwunsch ergänzt): Der ETF behält Dividenden/
// Kupons der enthaltenen Aktien/Anleihen komplett ein (der Kunde sieht davon nichts
// Separates). Die VV hält dagegen u. a. Einzelaktien und Anleihen und reinvestiert deren
// Ausschüttungen aktiv für den Kunden — das kommt bei der VV zusätzlich obendrauf, was der
// ETF nicht bietet. simulateVvWithDistributions() bildet das nach: Kursrendite (=
// VV_MONTHLY_RETURNS, unverändert) + einmal pro Jahr eine geschätzte Ausschüttung, komplett
// reinvestiert (ohne Kosten/KESt, konsistent mit der übrigen Modellrechnung).
//
// Geschätzte Ausschüttungsrendite (VV_DISTRIBUTION_YIELD_PCT), gewichtet nach Portfolio-
// Mix: 50 % Aktien (Dividendenrendite ~2,2 % p.a., typisch für Standardwerte in großen
// Indizes wie dem MSCI World) + 5,4 % Gold (0 %, keine Ausschüttung) + 8 % Staatsanleihen
// kurzfristig (~2,75 %) + 10 % Unternehmensanleihen kurzfristig (~3,75 %) + 6,5 %
// Unternehmensanleihen langfristig (~4,5 %) + 20,1 % Fremdwährungen (0 %, angenommen ohne
// laufende Ausschüttung) ≈ 1,99 % p.a. — im Rechner als Eingabefeld änderbar.

export const VV_DISTRIBUTION_MIX: { label: string; weightPct: number; yieldPct: number }[] = [
  { label: "Aktien", weightPct: 50, yieldPct: 2.2 },
  { label: "Gold", weightPct: 5.4, yieldPct: 0 },
  { label: "Staatsanleihen kurzfristig", weightPct: 8, yieldPct: 2.75 },
  { label: "Unternehmensanleihen kurzfristig", weightPct: 10, yieldPct: 3.75 },
  { label: "Unternehmensanleihen langfristig", weightPct: 6.5, yieldPct: 4.5 },
  { label: "Fremdwährungen", weightPct: 20.1, yieldPct: 0 },
]

export const VV_DISTRIBUTION_YIELD_PCT = VV_DISTRIBUTION_MIX.reduce(
  (sum, m) => sum + (m.weightPct / 100) * m.yieldPct,
  0
)

export const MSCI_STATS = {
  label: "iShares Core MSCI World UCITS ETF (Acc)",
  sourceLabel: "lt. Factsheet, 5J-Fenster 2021–2026",
  volatility: 14.34,
  sharpe: 0.61,
  maxDrawdown: -26.04,
  bestMonth: 9.59,
  worstMonth: -9.3,
  cagr: 11.13,
}

export const VV_STATS = {
  label: "Vermögensverwaltung",
  sourceLabel: "lt. Risikokennzahlen (Gesamthistorie)",
  sri: 4,
  volatility: 12.2,
  sharpe: 0.55,
  maxDrawdown: -28.4,
  cagr: 6.89,
}

/** Reale Kalenderjahres-Renditen der VV, 2021–2026 (2026 = laufendes Jahr/YTD). */
export const VV_ANNUAL_RETURNS = [14.6, -10.2, 10.1, 10.8, 8.5, 9.5]

// Monatsrenditen in % — 72er-Block, wird für den gewählten Anlagehorizont wiederholt.
// Generiert & kalibriert, siehe Modul-Kommentar oben (nicht händisch aus echten Kursdaten).
export const MSCI_MONTHLY_RETURNS: number[] = [
  6.219, -2.824, 6.183, -3.338, 5.946, -3.896, 5.657, -4.339, 5.482, -4.53, 5.526, -4.415,
  5.794, -4.04, 6.179, -3.538, -9.516, -9.516, -6.483, 9.997, 6.438, 4.659, 3.324, 2.434,
  5.352, -2.851, 4.72, -2.869, 4.217, -2.719, 3.91, -2.395, 3.785, -1.951, 3.774, -1.484,
  3.788, -1.085, 3.758, -0.819, 3.651, -0.71, 3.475, -0.743, 3.266, -0.881, 3.075, -1.074,
  2.956, -1.27, 2.957, -1.422, 3.113, -1.504, 3.431, -1.517, 3.878, -1.503, 4.377, -1.534,
  4.827, -1.693, 5.131, -2.032, 5.241, -2.542, 5.186, -3.139, 5.071, -3.687, 5.034, -4.049,
]

export const VV_MONTHLY_RETURNS: number[] = [
  3.321, -1.105, 3.684, -1.43, 3.991, -1.676, 4.192, -1.803, 4.255, -1.793, 4.171, -1.646,
  -1.592, -2.766, -1.592, -2.766, -1.592, -2.766, -1.592, -2.766, -1.592, 2.869, 2.869, 2.869,
  2.977, -1.435, 3.339, -1.759, 3.644, -2.003, 3.845, -2.13, 3.908, -2.12, 3.823, -1.974,
  3.032, -1.383, 3.393, -1.707, 3.699, -1.952, 3.899, -2.078, 3.963, -2.068, 3.878, -1.922,
  2.852, -1.555, 3.213, -1.879, 3.518, -2.123, 3.718, -2.25, 3.781, -2.239, 3.697, -2.094,
  2.93, -1.48, 3.292, -1.804, 3.597, -2.048, 3.797, -2.175, 3.86, -2.165, 3.776, -2.019,
]

/**
 * Baut die Monatswert-Reihe (Index 0 = Startkapital) über `years` Jahre, indem der
 * übergebene Monatsrenditen-Block so oft wie nötig wiederholt wird. `monthlyContribution`
 * wird jeweils zu Monatsbeginn eingezahlt und wächst ab diesem Monat mit.
 */
export function simulateGrowth(
  monthlyReturnsPct: number[],
  years: number,
  startCapital: number,
  monthlyContribution = 0
): number[] {
  const months = Math.max(0, Math.round(years * 12))
  const values = [startCapital]
  let v = startCapital
  for (let m = 0; m < months; m++) {
    const r = monthlyReturnsPct[m % monthlyReturnsPct.length] / 100
    v = (v + monthlyContribution) * (1 + r)
    values.push(v)
  }
  return values
}

/**
 * Wie simulateGrowth(), ergänzt aber am Ende jedes vollen Anlagejahres eine geschätzte
 * Ausschüttung (Dividenden/Kupons) auf den dann aktuellen Depotwert, komplett reinvestiert
 * — ein Bonus obendrauf, den der (thesaurierende) ETF laut Modell nicht bietet (siehe
 * Modul-Kommentar). Bei distributionYieldPct=0 identisch zu simulateGrowth().
 */
export function simulateVvWithDistributions(
  monthlyReturnsPct: number[],
  years: number,
  startCapital: number,
  monthlyContribution: number,
  distributionYieldPct: number
): number[] {
  const months = Math.max(0, Math.round(years * 12))
  const values = [startCapital]
  let v = startCapital
  for (let m = 0; m < months; m++) {
    const r = monthlyReturnsPct[m % monthlyReturnsPct.length] / 100
    v = (v + monthlyContribution) * (1 + r)
    if ((m + 1) % 12 === 0) {
      v += v * (distributionYieldPct / 100)
    }
    values.push(v)
  }
  return values
}

/** Eingezahlte Summe (Startkapital + monatliche Raten) je Monat, als Referenzlinie fürs Chart. */
export function paidInLine(years: number, startCapital: number, monthlyContribution: number): number[] {
  const months = Math.max(0, Math.round(years * 12))
  const values: number[] = []
  for (let m = 0; m <= months; m++) values.push(startCapital + monthlyContribution * m)
  return values
}

/** Größter Peak-zu-Tal-Rückgang der Wertreihe, als negativer Prozentsatz (z. B. -33.0). */
export function maxDrawdownPct(values: number[]): number {
  let peak = values[0] ?? 0
  let maxDD = 0
  for (const v of values) {
    if (v > peak) peak = v
    if (peak > 0) {
      const dd = (v - peak) / peak
      if (dd < maxDD) maxDD = dd
    }
  }
  return maxDD * 100
}

/** Jährliche CAGR (%) aus Start-/Endwert der Reihe über `years` Jahre. */
export function cagrPct(values: number[], years: number): number {
  const start = values[0]
  const end = values[values.length - 1]
  if (!(start > 0) || years <= 0) return 0
  return (Math.pow(end / start, 1 / years) - 1) * 100
}

export function msciVvFormatEUR(n: number): string {
  return Math.round(n).toLocaleString("de-AT") + " €"
}

export function msciVvFormatPct(n: number, digits = 1): string {
  return n.toLocaleString("de-AT", { minimumFractionDigits: digits, maximumFractionDigits: digits }) + " %"
}
