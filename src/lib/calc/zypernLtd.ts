// Zypern-Ltd-Vergleichsrechner — dritte Option neben Einzelunternehmer und österreichischer
// GmbH. Wichtigster Punkt vorab, weil er praktisch jede naive Online-Rechnung falsch macht:
// eine zypriotische Limited spart nur dann Steuern, wenn der/die Gesellschafter-Direktor:in
// tatsächlich nach Zypern übersiedelt und dort steuerlich ansässig wird. Bleibt der
// Wohnsitz/Lebensmittelpunkt in Österreich, gilt die Gesellschaft nach österreichischem
// Recht (§ 1 KStG) und dem DBA Österreich-Zypern (Art. 4, Ort der tatsächlichen
// Geschäftsleitung) weiterhin als österreichisch ansässig — die 15 % zypriotische KöSt
// sind dann irrelevant, es fällt trotzdem volle österreichische KöSt an, nur mit
// zusätzlichen zypriotischen Fixkosten obendrauf (Pflicht-Audit, Registered Agent). Dieses
// Modul bildet daher zwei Zweige ab: `wohnsitzVollstaendigVerlegt = false` rechnet
// wirtschaftlich wie eine österreichische GmbH (Wiederverwendung von berechneGmbh), nur mit
// den zusätzlichen Zypern-Fixkosten als reinem Mehraufwand ohne Steuervorteil.
// `wohnsitzVollstaendigVerlegt = true` rechnet die tatsächliche zypriotische Besteuerung.
//
// Sätze recherchiert, Stand 2026 (Quellen: PwC Tax Summaries, KPMG/BDO Cyprus Tax Reform
// 2026, Cyprus Tax Department, diverse zypriotische Steuerkanzleien — siehe
// Rechercheergebnisse im zugehörigen PR):
//  - Körperschaftsteuer (Corporate Income Tax): 15 % ab 1.1.2026 (Steuerreform, zuvor über
//    20 Jahre 12,5 % — viele ältere Quellen sind hier veraltet), kein Mindeststeuer-Mechanismus
//  - Non-Dom-Regime: 0 % Special Defence Contribution (SDC) auf Dividenden für "nicht in
//    Zypern domizilierte" Personen (jede:r mit ausländischem Domizil, in den ersten 17
//    Steuerjahren als zypriotische:r Steuerresident:in — ab der Reform 2026 gegen Pauschale
//    von 250.000 €/Fünf-Jahres-Zeitraum auf bis zu 27 Jahre verlängerbar)
//  - GESY/GHS (nationales Gesundheitssystem): 2,65 % Arbeitnehmer, 2,90 % Arbeitgeber, 4,0 %
//    Selbständige, 2,65 % auf Dividenden/Zinsen/Miete (auch für Non-Doms!) — gedeckelt bei
//    180.000 € Jahreseinkommen je Einkunftsart
//  - Sozialversicherung: 8,8 % Arbeitnehmer + 8,8 % Arbeitgeber, gedeckelt bei 5.742 €/Monat
//    (68.904 €/Jahr)
//  - ESt-Tarif 2026: 0 % bis 22.000 €, 20/25/30/35 % in weiteren Stufen bis 35 % ab 72.000 €
//  - Steuerresidenz: 183-Tage-Regel ODER 60-Tage-Regel (mind. 60 Tage Anwesenheit, max. 183
//    Tage in einem anderen Staat, dauerhafter Wohnsitz — gemietet oder gekauft — in Zypern,
//    Geschäftstätigkeit/Anstellung/Direktorsfunktion in einer zypriotischen Gesellschaft)
//  - Pflicht-Audit für praktisch jede zypriotische Ltd (Ausnahme: Review Engagement bei
//    Umsatz < 300.000 € UND Bilanzsumme < 500.000 € in zwei Folgejahren)
//  - Keine jährliche Government-Levy mehr (2024 abgeschafft), nur noch 20 € HE32-Jahresmeldung
//    plus die eigentlichen Kosten für Buchhaltung, Audit/Review, Registered Office & Secretary
import {
  DZ_SATZ_DEFAULT_PCT, autoAfaJaehrlich, berechneEu, berechneGmbh, sachbezugAutoJaehrlich,
  type EuErgebnis, type GemeinsameEingabe,
} from "./gmbhVsEu"

export const CY_KOEST_SATZ = 0.15
export const CY_SDC_NON_DOM_SATZ = 0

export const CY_GESY_SATZ_ARBEITNEHMER = 0.0265
export const CY_GESY_SATZ_ARBEITGEBER = 0.029
export const CY_GESY_SATZ_DIVIDENDE = 0.0265
export const CY_GESY_DECKEL_JAHR = 180000

export const CY_SI_SATZ_ARBEITNEHMER = 0.088
export const CY_SI_SATZ_ARBEITGEBER = 0.088
export const CY_SI_DECKEL_MONAT = 5742
export const CY_SI_DECKEL_JAHR = CY_SI_DECKEL_MONAT * 12

export const CY_EST_STUFEN_2026: { bis: number; satz: number }[] = [
  { bis: 22000, satz: 0 },
  { bis: 32000, satz: 0.2 },
  { bis: 42000, satz: 0.25 },
  { bis: 72000, satz: 0.3 },
  { bis: Infinity, satz: 0.35 },
]

/** Progressive zypriotische Einkommensteuer auf eine positive Bemessungsgrundlage. */
export function zypernEinkommensteuer(bemessungsgrundlage: number): number {
  const eink = Math.max(0, bemessungsgrundlage)
  let steuer = 0
  let unten = 0
  for (const stufe of CY_EST_STUFEN_2026) {
    const oben = Math.min(eink, stufe.bis)
    if (oben > unten) steuer += (oben - unten) * stufe.satz
    unten = stufe.bis
    if (eink <= stufe.bis) break
  }
  return steuer
}

export const DEFAULTS_ZYPERN = {
  direktorGehaltBrutto: 40000,
  ausschuettungsquotePct: 50,
  buchhaltungJahr: 1500,
  auditJahr: 1800,
  registeredOfficeJahr: 1000,
  gruendungskostenEinmalig: 3000,
  umzugskostenEinmalig: 3000,
  mieteZypernMonat: 1200,
  mieteOesterreichVergleichMonat: 900,
  wohnsitzVollstaendigVerlegt: true,
}

function clampPct(pct: number): number {
  return Math.min(100, Math.max(0, pct)) / 100
}

export interface ZypernSpezifischeEingabe {
  direktorGehaltBrutto: number
  ausschuettungsquotePct: number
  buchhaltungJahr: number
  auditJahr: number
  registeredOfficeJahr: number
  /** true = Lebensmittelpunkt tatsächlich und vollständig nach Zypern verlegt (183- oder
   * 60-Tage-Regel erfüllt, kein österreichischer Wohnsitz mehr) — sonst gilt die
   * Gesellschaft steuerlich weiter als österreichisch (Ort der Geschäftsleitung). */
  wohnsitzVollstaendigVerlegt: boolean
  mieteZypernMonat: number
  mieteOesterreichVergleichMonat: number
}

export interface ZypernErgebnis {
  wohnsitzGueltig: boolean
  sachbezugAuto: number
  direktorBemessungGesamt: number
  /** Sozialversicherung Arbeitnehmeranteil — bei !wohnsitzGueltig: GSVG-Beitrag (AT-Fall). */
  siArbeitnehmer: number
  /** Sozialversicherung Arbeitgeberanteil — bei !wohnsitzGueltig: DB+DZ+Kommunalsteuer (AT-Fall). */
  siArbeitgeber: number
  gesyArbeitnehmer: number
  gesyArbeitgeber: number
  betrieblichesErgebnisVorKoest: number
  koeSt: number
  gewinnNachKoest: number
  ausschuettungBrutto: number
  /** GESY auf Dividende (0 % SDC für Non-Doms) — bei !wohnsitzGueltig: österreichische KESt (AT-Fall). */
  gesyAufDividende: number
  ausschuettungNetto: number
  thesaurierterGewinn: number
  direktorEinkommensteuer: number
  direktorNettoBar: number
  /** Mietdifferenz Zypern minus wegfallende Vergleichsmiete Österreich, Jahr (kann negativ sein). */
  wohnkostenDeltaJahr: number
  verfuegbaresEinkommen: number
  gesamtInklThesaurierung: number
}

/** Tatsächliche zypriotische Besteuerung — nur gültig bei echter, vollständiger Wohnsitzverlegung. */
function berechneZypernMitWohnsitzverlegung(e: GemeinsameEingabe, s: ZypernSpezifischeEingabe): ZypernErgebnis {
  const afaAutoVoll = autoAfaJaehrlich(e.autoAnschaffungswert, e.autoNutzungsdauerJahre)
  const afaGesamt = afaAutoVoll + Math.max(0, e.sonstigeAfaJahr)
  const sachbezugAuto = sachbezugAutoJaehrlich(e.autoAnschaffungswert, e.autoPrivatanteilPct)

  const direktorGehaltBrutto = Math.max(0, s.direktorGehaltBrutto)
  const direktorBemessungGesamt = direktorGehaltBrutto + sachbezugAuto

  const siGrundlage = Math.min(direktorBemessungGesamt, CY_SI_DECKEL_JAHR)
  const siArbeitnehmer = siGrundlage * CY_SI_SATZ_ARBEITNEHMER
  const siArbeitgeber = siGrundlage * CY_SI_SATZ_ARBEITGEBER

  const gesyGrundlageGehalt = Math.min(direktorBemessungGesamt, CY_GESY_DECKEL_JAHR)
  const gesyArbeitnehmer = gesyGrundlageGehalt * CY_GESY_SATZ_ARBEITNEHMER
  const gesyArbeitgeber = gesyGrundlageGehalt * CY_GESY_SATZ_ARBEITGEBER

  const zypernFixkosten = Math.max(0, s.buchhaltungJahr) + Math.max(0, s.auditJahr) + Math.max(0, s.registeredOfficeJahr)
  const betrieblichesErgebnisVorKoest =
    e.umsatz - e.betriebsausgaben - afaGesamt - direktorGehaltBrutto - siArbeitgeber - gesyArbeitgeber - zypernFixkosten
  const koeSt = Math.max(0, betrieblichesErgebnisVorKoest) * CY_KOEST_SATZ
  const gewinnNachKoest = Math.max(0, betrieblichesErgebnisVorKoest - koeSt)

  const ausschuettungBrutto = gewinnNachKoest * clampPct(s.ausschuettungsquotePct)
  const thesaurierterGewinn = gewinnNachKoest - ausschuettungBrutto
  const gesyGrundlageDividende = Math.min(ausschuettungBrutto, CY_GESY_DECKEL_JAHR)
  // SDC = 0 % für Non-Doms (die ersten 17 Steuerjahre) — GESY fällt aber auch für Non-Doms an.
  const gesyAufDividende = gesyGrundlageDividende * CY_GESY_SATZ_DIVIDENDE
  const ausschuettungNetto = ausschuettungBrutto - gesyAufDividende

  const direktorEstBasis = Math.max(0, direktorBemessungGesamt - siArbeitnehmer - gesyArbeitnehmer)
  const direktorEinkommensteuer = zypernEinkommensteuer(direktorEstBasis)
  const direktorNettoGehalt = direktorBemessungGesamt - siArbeitnehmer - gesyArbeitnehmer - direktorEinkommensteuer
  const direktorNettoBar = direktorNettoGehalt - sachbezugAuto

  const wohnkostenDeltaJahr = (Math.max(0, s.mieteZypernMonat) - Math.max(0, s.mieteOesterreichVergleichMonat)) * 12

  const verfuegbaresEinkommen = direktorNettoBar + ausschuettungNetto - wohnkostenDeltaJahr
  const gesamtInklThesaurierung = verfuegbaresEinkommen + thesaurierterGewinn

  return {
    wohnsitzGueltig: true, sachbezugAuto, direktorBemessungGesamt, siArbeitnehmer, siArbeitgeber,
    gesyArbeitnehmer, gesyArbeitgeber, betrieblichesErgebnisVorKoest, koeSt, gewinnNachKoest,
    ausschuettungBrutto, gesyAufDividende, ausschuettungNetto, thesaurierterGewinn,
    direktorEinkommensteuer, direktorNettoBar, wohnkostenDeltaJahr, verfuegbaresEinkommen, gesamtInklThesaurierung,
  }
}

/**
 * Ohne echte Wohnsitzverlegung bleibt der Ort der Geschäftsleitung in Österreich — die
 * Gesellschaft wird wirtschaftlich wie eine österreichische GmbH behandelt (volle KöSt/
 * GSVG/DB/DZ/Kommunalsteuer), nur mit den zypriotischen Fixkosten (Pflicht-Audit,
 * Registered Office) als zusätzlichem Aufwand ohne jeden Steuervorteil obendrauf.
 */
function berechneZypernOhneWohnsitzverlegung(e: GemeinsameEingabe, s: ZypernSpezifischeEingabe): ZypernErgebnis {
  const zypernFixkosten = Math.max(0, s.buchhaltungJahr) + Math.max(0, s.auditJahr) + Math.max(0, s.registeredOfficeJahr)
  const gmbh = berechneGmbh(e, {
    gfGehaltBrutto: s.direktorGehaltBrutto, ausschuettungsquotePct: s.ausschuettungsquotePct,
    dzSatzPct: DZ_SATZ_DEFAULT_PCT, stbMehrkostenJahr: zypernFixkosten, offenlegungJahr: 0,
  })

  return {
    wohnsitzGueltig: false,
    sachbezugAuto: gmbh.sachbezugAuto,
    direktorBemessungGesamt: gmbh.gfBemessungGesamt,
    siArbeitnehmer: gmbh.gfGsvgBeitrag,
    siArbeitgeber: gmbh.lohnnebenkostenGmbh,
    gesyArbeitnehmer: 0,
    gesyArbeitgeber: 0,
    betrieblichesErgebnisVorKoest: gmbh.betrieblichesErgebnisVorKoest,
    koeSt: gmbh.koeSt,
    gewinnNachKoest: gmbh.gewinnNachKoest,
    ausschuettungBrutto: gmbh.ausschuettungBrutto,
    gesyAufDividende: gmbh.kESt,
    ausschuettungNetto: gmbh.ausschuettungNetto,
    thesaurierterGewinn: gmbh.thesaurierterGewinn,
    direktorEinkommensteuer: gmbh.gfEinkommensteuer,
    direktorNettoBar: gmbh.gfNettoBar,
    wohnkostenDeltaJahr: 0,
    verfuegbaresEinkommen: gmbh.verfuegbaresEinkommen,
    gesamtInklThesaurierung: gmbh.gesamtInklThesaurierung,
  }
}

export function berechneZypernLtd(e: GemeinsameEingabe, s: ZypernSpezifischeEingabe): ZypernErgebnis {
  return s.wohnsitzVollstaendigVerlegt ? berechneZypernMitWohnsitzverlegung(e, s) : berechneZypernOhneWohnsitzverlegung(e, s)
}

export interface ZypernGruendungsVergleich {
  jaehrlicherVorteilVsEu: number
  breakEvenJahre: number | null
}

/** Wie viele Jahre dauert es, bis der laufende Vorteil ggü. dem Einzelunternehmer die
 * einmaligen Kosten (Gründung + Umzug) aufwiegt? */
export function berechneZypernGruendungsVergleich(
  euErgebnis: EuErgebnis, zypernErgebnis: ZypernErgebnis, einmalkosten: number
): ZypernGruendungsVergleich {
  const jaehrlicherVorteilVsEu = zypernErgebnis.gesamtInklThesaurierung - euErgebnis.nettoEinkommen
  const breakEvenJahre = jaehrlicherVorteilVsEu > 0 ? einmalkosten / jaehrlicherVorteilVsEu : null
  return { jaehrlicherVorteilVsEu, breakEvenJahre }
}

export interface DreiWegePunkt {
  operativerGewinn: number
  nettoEu: number
  verfuegbarGmbh: number
  gesamtGmbh: number
  verfuegbarZypern: number
  gesamtZypern: number
}

/**
 * Vergleichsreihe über eine Bandbreite des operativen Gewinns für alle drei Rechtsformen,
 * bei sonst gleichbleibenden Einstellungen — siehe berechneSchwellenreihe in gmbhVsEu.ts für
 * die Zwei-Wege-Variante (EU/GmbH), die dieselbe Grundidee verfolgt.
 */
export function berechneDreiWegeSchwellenreihe(
  gemeinsam: GemeinsameEingabe,
  gmbhSpezifisch: Parameters<typeof berechneGmbh>[1],
  zypernSpezifisch: ZypernSpezifischeEingabe,
  vonGewinn: number,
  bisGewinn: number,
  schrittweite: number
): DreiWegePunkt[] {
  const punkte: DreiWegePunkt[] = []
  const afaAutoVoll = autoAfaJaehrlich(gemeinsam.autoAnschaffungswert, gemeinsam.autoNutzungsdauerJahre)
  const afaGesamtEu = afaAutoVoll * (1 - clampPct(gemeinsam.autoPrivatanteilPct)) + Math.max(0, gemeinsam.sonstigeAfaJahr)
  const afaGesamtVoll = afaAutoVoll + Math.max(0, gemeinsam.sonstigeAfaJahr)

  for (let g = vonGewinn; g <= bisGewinn; g += schrittweite) {
    const eEu: GemeinsameEingabe = { ...gemeinsam, umsatz: g + gemeinsam.betriebsausgaben + afaGesamtEu }
    const eVoll: GemeinsameEingabe = { ...gemeinsam, umsatz: g + gemeinsam.betriebsausgaben + afaGesamtVoll }
    const eu = berechneEu(eEu)
    const gmbh = berechneGmbh(eVoll, gmbhSpezifisch)
    const zypern = berechneZypernLtd(eVoll, zypernSpezifisch)
    punkte.push({
      operativerGewinn: g, nettoEu: eu.nettoEinkommen,
      verfuegbarGmbh: gmbh.verfuegbaresEinkommen, gesamtGmbh: gmbh.gesamtInklThesaurierung,
      verfuegbarZypern: zypern.verfuegbaresEinkommen, gesamtZypern: zypern.gesamtInklThesaurierung,
    })
  }
  return punkte
}
