// Pensionsrechner — reine Funktionen, keine DOM-Zugriffe.
// Modell (vereinfacht, siehe Disclaimer in PensionsRechner.tsx):
//  1. Brutto aus Netto (14 Bezüge, SV 18,12 %, Tarif §33 EStG 2026)
//  2. Staatliche Pension nach Pensionskonto-Logik (1,78 % je Versicherungsjahr)
//  3. Pensionslücke (real, heutige Kaufkraft) → nominal bei Pensionsantritt
//  4. Kapitalbedarf = Barwert einer inflationsindexierten Entnahme bis ENTNAHME_BIS_ALTER; das Kapital bleibt
//     in der Pension investiert (Depot: Rendite abzüglich Kosten wie im froots-Pensionsrechner,
//     FLV: Verzinsung wie in der Merkur-Entnahmephase des Renditerechners)
//  5. Einmalerlag heute bzw. Sparplan (jährlich um die Inflation dynamisiert)
import { rrRate } from "./rendite"
import {
  MERKUR_DYNAMIK_WIRKSAMKEIT, MERKUR_ERTRAGSAUFSCHLAG_PA, simulateMerkurFLVEinmal, simulateMerkurFLVPraemie,
} from "./merkurFlv"

export type RisikoProfil = "konservativ" | "ausgewogen" | "gewinnorientiert"

export const PENSION_PROFILE: Record<RisikoProfil, { label: string; rendite: number }> = {
  konservativ: { label: "Konservativ", rendite: 0.05 },
  ausgewogen: { label: "Ausgewogen", rendite: 0.06 },
  gewinnorientiert: { label: "Gewinnorientiert", rendite: 0.075 },
}

/** Kosten des froots-Depots auf das veranlagte Kapital (p.a., wie im froots-Pensionsrechner),
 *  quartalsweise vom Kapital abgebucht; in der Pension mindern sie die Rendite des weiter investierten Kapitals. */
export const KOSTEN_PA = 0.01
export const KOSTEN_INTERVALL_MONATE = 3
/** Ende des Entnahmezeitraums (Lebenserwartung als Planungshorizont). */
export const ENTNAHME_BIS_ALTER = 90
/** Beginn der Erwerbstätigkeit für die Zahl der Versicherungsjahre. */
export const ERWERBSBEGINN_ALTER = 25
/** Versicherungssteuer der FLV (nur Anzeige): in der Merkur-Kostenstruktur bereits enthalten. */
export const FLV_VERSICHERUNGSSTEUER = 0.04

export const PK_PROZENT = 0.0178 // Pensionskonto: Gutschrift je Jahr
export const SV_SATZ = 0.1812 // SV Angestellte
export const KV_PENSION = 0.06 // KV-Beitrag auf Pension
export const HBG_MONAT = 6930 // Höchstbeitragsgrundlage 2026 / Monat
export const PENSIONISTEN_ABSETZBETRAG = 1020
export const VERKEHRSABSETZBETRAG = 463
export const WERBUNGSKOSTEN_PAUSCHALE = 132
export const SONDERZAHLUNG_FREIBETRAG = 620
export const SONDERZAHLUNG_STEUER = 0.06

/** Einkommensteuer-Tarif §33 EStG 2026 (Tarifstufen vor Absetzbeträgen). */
const TARIF_2026: { bis: number; satz: number }[] = [
  { bis: 13539, satz: 0 },
  { bis: 21992, satz: 0.2 },
  { bis: 36458, satz: 0.3 },
  { bis: 70365, satz: 0.4 },
  { bis: 104859, satz: 0.48 },
  { bis: 1_000_000, satz: 0.5 },
  { bis: Infinity, satz: 0.55 },
]

export function incomeTax2026(jahresEinkommen: number): number {
  let steuer = 0
  let von = 0
  for (const st of TARIF_2026) {
    if (jahresEinkommen <= von) break
    steuer += (Math.min(jahresEinkommen, st.bis) - von) * st.satz
    von = st.bis
  }
  return steuer
}

/** Netto je Monat (14 Bezüge) bei gegebenem Monatsbrutto (Angestellte, ohne Pendlerpauschale). */
export function nettoAusBrutto(bruttoMonat: number): number {
  const bg = Math.min(bruttoMonat, HBG_MONAT)
  const svLaufend = bg * SV_SATZ * 12
  const svSonder = bg * SV_SATZ * 2
  const laufendBrutto = bruttoMonat * 12
  const zuVersteuern = Math.max(0, laufendBrutto - svLaufend - WERBUNGSKOSTEN_PAUSCHALE)
  const lst = Math.max(0, incomeTax2026(zuVersteuern) - VERKEHRSABSETZBETRAG)
  const sonderBrutto = bruttoMonat * 2
  const sonderBasis = Math.max(0, sonderBrutto - svSonder - SONDERZAHLUNG_FREIBETRAG)
  const sonderSteuer = sonderBasis * SONDERZAHLUNG_STEUER
  const jahresNetto = laufendBrutto - svLaufend - lst + (sonderBrutto - svSonder - sonderSteuer)
  return jahresNetto / 14
}

/** Netto-Pension je Monat (14 Bezüge) bei gegebener Brutto-Pension je Monat. */
export function pensionNettoAusBrutto(pensionBruttoMonat: number): number {
  const kvLaufend = pensionBruttoMonat * 12 * KV_PENSION
  const kvSonder = pensionBruttoMonat * 2 * KV_PENSION
  const laufendBasis = pensionBruttoMonat * 12 - kvLaufend
  // Pensionistenabsetzbetrag: voll bis 21.000 € Jahrespension, linear auslaufend bis 26.200 €
  const jahrespension = pensionBruttoMonat * 14
  const absetz = jahrespension <= 21000
    ? PENSIONISTEN_ABSETZBETRAG
    : jahrespension >= 26200
    ? 0
    : PENSIONISTEN_ABSETZBETRAG * (26200 - jahrespension) / 5200
  const lst = Math.max(0, incomeTax2026(laufendBasis) - absetz)
  const sonderBasis = Math.max(0, pensionBruttoMonat * 2 - kvSonder - SONDERZAHLUNG_FREIBETRAG)
  const sonderSteuer = sonderBasis * SONDERZAHLUNG_STEUER
  const jahresNetto = pensionBruttoMonat * 14 - kvLaufend - kvSonder - lst - sonderSteuer
  return jahresNetto / 14
}

function bisektion(f: (x: number) => number, ziel: number, hi: number): number {
  let lo = 0
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (f(mid) < ziel) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

export function bruttoAusNetto(nettoMonat: number): number {
  if (nettoMonat <= 0) return 0
  return bisektion(nettoAusBrutto, nettoMonat, 100_000)
}

export type PensionInput = {
  alter: number
  pensionsalter: number
  nettoMonat: number
  wunschPension: number
  inflation: number // 0,02
  profil: RisikoProfil
  /** Ende der Entnahmephase (Lebenserwartung), Default ENTNAHME_BIS_ALTER. */
  entnahmeBis?: number
  /** Eigene Bruttorendite p.a. (z. B. 0.055); überschreibt die Rendite des Risikoprofils. */
  rendite?: number
}

export type PensionFlvResult = {
  /** Kapitalbedarf bei Pensionsantritt (die FLV bleibt in der Pension mit `entnahmeRendite` investiert). */
  kapitalBedarf: number
  /** Verzinsung der FLV in der Entnahmephase (p.a.). */
  entnahmeRendite: number
  einmalerlag: number
  sparplanStart: number
  sparplanEnde: number
  sparplanSumme: number
  /** Effektive Jahresrendite des Einmalerlags über die Ansparphase (nach allen Kosten). */
  renditeAnsparphase: number
}

export type PensionResult = {
  jahre: number // bis Pensionsantritt
  /** Effektive Jahresrendite des Depots in der Ansparphase (nach Kosten). */
  nettoRendite: number
  bruttoMonat: number // geschätztes Monatsbrutto
  staatBrutto: number
  staatNetto: number // Monatswert (14×), heutige Kaufkraft
  luecke: number // heutige Kaufkraft
  lueckeNominal: number // bei Pensionsantritt
  /** Kapital bei Pensionsantritt (nominal), das das Depot braucht; es bleibt in der Pension zu `entnahmeRendite` investiert. */
  kapitalBedarf: number
  /** Verzinsung des Depots in der Entnahmephase: Bruttorendite abzüglich Kosten. */
  entnahmeRendite: number
  /** Geschätztes Bruttojahreseinkommen (14 Bezüge). */
  bruttoJahr: number
  /** Staatliche Netto-Pension und Wunschpension nominal bei Pensionsantritt (je Monat). */
  staatNettoNominal: number
  wunschNominal: number
  /** Dauer der Entnahmephase in Jahren. */
  entnahmeJahre: number
  einmalerlag: number
  sparplanStart: number
  sparplanEnde: number
  /** Summe aller Sparplan-Einzahlungen bis Pensionsantritt (Depot). */
  sparplanSumme: number
  /** Dieselbe Lücke, finanziert über die Merkur-FLV (Kostenstruktur/Formeln des Renditerechners). */
  flv: PensionFlvResult
}

/** Staatliche Pension (brutto/netto, je Monat bei 14 Bezügen) aus dem Nettoeinkommen. */
export function staatlichePension(nettoMonat: number, pensionsalter: number) {
  const bruttoMonat = bruttoAusNetto(nettoMonat)
  const jahre = Math.max(0, pensionsalter - ERWERBSBEGINN_ALTER)
  const staatBrutto = Math.min(bruttoMonat, HBG_MONAT) * PK_PROZENT * jahre
  return { bruttoMonat, staatBrutto, staatNetto: pensionNettoAusBrutto(staatBrutto) }
}

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

/** Kapital bei Pensionsantritt, das eine monatliche Entnahme `startMonat` (jährlich um `infl` steigend)
 *  über `monate` Monate trägt, wenn der Rest mit `zinsPa` (nach Kosten) weiter verzinst wird
 *  (Entnahme zu Monatsbeginn). */
export function kapitalBedarf(startMonat: number, monate: number, infl: number, zinsPa: number): number {
  const r = rrRate(zinsPa)
  let pv = 0
  for (let m = 0; m < monate; m++) {
    pv += startMonat * Math.pow(1 + infl, Math.floor(m / 12)) / Math.pow(1 + r, m)
  }
  return pv
}

/** Endwert einer Sparrate 1 € (Start), die jährlich um `g` steigt; Einzahlung zu Monatsbeginn. */
export function sparplanFaktor(monate: number, g: number, bruttoPa: number): number {
  const cum = wachstumsfaktoren(monate, bruttoPa)
  let fv = 0
  for (let m = 0; m < monate; m++) {
    fv += Math.pow(1 + g, Math.floor(m / 12)) * cum[monate] / cum[m]
  }
  return fv
}

/** Summe einer Sparplan-Einzahlung (Startrate `start`, jährlich um `g` steigend) über `jahre` Jahre. */
export function sparplanSumme(start: number, jahre: number, g: number): number {
  let sum = 0
  for (let m = 0; m < jahre * 12; m++) sum += start * Math.pow(1 + g, Math.floor(m / 12))
  return sum
}

/** FLV: Einmalerlag (Merkur-Einmaltopf) und Sparplan (kalibrierter Merkur-Prämientopf), jeweils so bestimmt,
 *  dass das Kapital bei Pensionsantritt dem Bedarf entspricht. Der Sparplan steigt — wie beim Depot — wirksam
 *  um `infl` pro Jahr: Merkur setzt eine nominale Dynamik nur zu MERKUR_DYNAMIK_WIRKSAMKEIT um, daher wird sie
 *  entsprechend höher angesetzt, damit beide Varianten dieselbe Einzahlungsentwicklung haben. */
export function berechneFlv(bedarf: number, jahre: number, infl: number, perf: number): PensionFlvResult {
  const entnahmeRendite = perf + MERKUR_ERTRAGSAUFSCHLAG_PA
  if (bedarf <= 0 || jahre <= 0) {
    return { kapitalBedarf: bedarf, entnahmeRendite, einmalerlag: 0, sparplanStart: 0, sparplanEnde: 0, sparplanSumme: 0, renditeAnsparphase: 0 }
  }
  const months = jahre * 12
  const einmalerlag = bisektion((x) => simulateMerkurFLVEinmal(x, jahre, perf)[months], bedarf, bedarf * 1.5 + 100)
  const waNominal = infl / MERKUR_DYNAMIK_WIRKSAMKEIT
  const sparplanStart = bisektion((x) => simulateMerkurFLVPraemie(x, jahre, perf, waNominal)[months], bedarf, bedarf)
  return {
    kapitalBedarf: bedarf, entnahmeRendite,
    einmalerlag, sparplanStart,
    sparplanEnde: sparplanStart * Math.pow(1 + infl, Math.max(0, jahre - 1)),
    sparplanSumme: sparplanSumme(sparplanStart, jahre, infl),
    renditeAnsparphase: Math.pow(bedarf / einmalerlag, 1 / jahre) - 1,
  }
}

export function berechnePension(inp: PensionInput): PensionResult {
  const jahre = Math.max(0, inp.pensionsalter - inp.alter)
  const brutto = inp.rendite ?? PENSION_PROFILE[inp.profil].rendite
  const accum = wachstumsfaktoren(jahre * 12, brutto)
  // effektive Jahresrendite nach Kosten (Anzeige)
  const nettoRendite = jahre > 0 ? Math.pow(accum[jahre * 12], 1 / jahre) - 1 : brutto

  const { bruttoMonat, staatBrutto, staatNetto } = staatlichePension(inp.nettoMonat, inp.pensionsalter)
  const luecke = Math.max(0, inp.wunschPension - staatNetto)
  const lueckeNominal = luecke * Math.pow(1 + inp.inflation, jahre)

  const entnahmeMonate = Math.max(0, ((inp.entnahmeBis ?? ENTNAHME_BIS_ALTER) - inp.pensionsalter) * 12)
  const entnahmeRendite = brutto - KOSTEN_PA
  const bedarf = luecke > 0 ? kapitalBedarf(lueckeNominal, entnahmeMonate, inp.inflation, entnahmeRendite) : 0
  // FLV: Entnahme-Verzinsung wie simulateMerkurFLVEntnahme (laufende Kosten stecken in der Sparprämien-Quote)
  const bedarfFlv = luecke > 0
    ? kapitalBedarf(lueckeNominal, entnahmeMonate, inp.inflation, brutto + MERKUR_ERTRAGSAUFSCHLAG_PA)
    : 0
  const einmalerlag = bedarf / accum[jahre * 12]
  const faktor = sparplanFaktor(jahre * 12, inp.inflation, brutto)
  const sparplanStart = faktor > 0 ? bedarf / faktor : 0
  const sparplanEnde = sparplanStart * Math.pow(1 + inp.inflation, Math.max(0, jahre - 1))

  return {
    jahre, nettoRendite, bruttoMonat, staatBrutto, staatNetto, luecke, lueckeNominal,
    kapitalBedarf: bedarf, entnahmeRendite, bruttoJahr: bruttoMonat * 14,
    staatNettoNominal: staatNetto * Math.pow(1 + inp.inflation, jahre),
    wunschNominal: inp.wunschPension * Math.pow(1 + inp.inflation, jahre),
    entnahmeJahre: entnahmeMonate / 12, einmalerlag, sparplanStart, sparplanEnde,
    sparplanSumme: sparplanSumme(sparplanStart, jahre, inp.inflation),
    flv: berechneFlv(bedarfFlv, jahre, inp.inflation, brutto),
  }
}
