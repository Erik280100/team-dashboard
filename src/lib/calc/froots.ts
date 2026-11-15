// froots-Vermögensverwaltung — gemeinsame Berechnungsbasis von Pensionsrechner und Renditerechner.
// Modell: ETF-Depot ohne Setup-Kosten; die Kosten (inkl. Servicegebühr, froots-Website rechnet mit 1,0 %)
// werden quartalsweise als Anteil des veranlagten Kapitals abgebucht. KESt wie beim Depot (agE + Rest-KESt).
import { rrRate, simulateFondsdepotVerlauf, type RRVerlauf } from "./rendite"

/** Kosten des froots-Depots auf das veranlagte Kapital (p.a., inkl. Servicegebühr). */
export const KOSTEN_PA = 0.0209
/** Die Kosten werden alle KOSTEN_INTERVALL_MONATE Monate mit KOSTEN_PA × Intervall/12 abgebucht. */
export const KOSTEN_INTERVALL_MONATE = 3

/** Kumulierter Wachstumsfaktor je Monat m (0..monate): monatliche Bruttoverzinsung; alle
 *  KOSTEN_INTERVALL_MONATE Monate werden KOSTEN_PA/4 des Kapitals abgebucht. */
export function wachstumsfaktoren(monate: number, bruttoPa: number, kostenPa = KOSTEN_PA): number[] {
  const g = rrRate(bruttoPa) + 1
  const fee = 1 - kostenPa * KOSTEN_INTERVALL_MONATE / 12
  const cum = [1]
  for (let m = 1; m <= monate; m++) {
    cum.push(cum[m - 1] * g * (m % KOSTEN_INTERVALL_MONATE === 0 ? fee : 1))
  }
  return cum
}

/**
 * Sparplan/Entnahme im froots-Modell inkl. KESt (Rückgabe wie simulateFondsdepotVerlauf).
 * Gleiche Wachstums- und Kostenlogik wie wachstumsfaktoren(); waPct = jährliche Dynamik der Sparrate,
 * entnahmeJahre/entnahmeMonat = optionale Netto-Monatsentnahme (Brutto-Hochrechnung wie beim Depot).
 */
export function simulateFrootsVerlauf(
  monat: number,
  einmal: number,
  jahre: number,
  perf: number,
  ageRenditePa: number,
  waPct = 0,
  entnahmeJahre = 0,
  entnahmeMonat = 0
): RRVerlauf {
  return simulateFondsdepotVerlauf(
    monat, einmal, jahre, perf, 0, KOSTEN_PA * 100, ageRenditePa, 0, waPct,
    entnahmeJahre, entnahmeMonat, 0, KOSTEN_INTERVALL_MONATE
  )
}
