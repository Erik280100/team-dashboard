// GmbH-vs-Einzelunternehmer-Vergleichsrechner (Österreich) — vergleicht das tatsächlich
// verfügbare Nettoeinkommen eines Einzelunternehmers mit dem eines wesentlich beteiligten
// (>25 %) Gesellschafter-Geschäftsführers derselben operativen Tätigkeit, inklusive der
// Posten, die reine Steuersatz-Vergleiche meist auslassen: GSVG-Pflichtversicherung in
// beiden Rechtsformen (der GF bleibt bei >25 % Anteil in der GSVG, nicht ASVG), DB/DZ/
// Kommunalsteuer auf den GF-Bezug, Mindestkörperschaftsteuer, Sachbezug für ein privat
// genutztes Firmenauto sowie die laufenden Mehrkosten der GmbH für doppelte Buchführung/
// Jahresabschluss/Firmenbuch-Offenlegung gegenüber der selbst erstellten EÜR.
//
// Sätze recherchiert, Stand 2026 (Quellen: WKO, SVS, BMF/USP, siehe Rechercheergebnisse
// im zugehörigen PR):
//  - ESt-Tarifstufen 2026 (0/20/30/40/48/50/55 %), automatisch inflationsangepasst
//  - Gewinnfreibetrag: 15 % Grundfreibetrag bis 33.000 € (automatisch), gestaffelter
//    investitionsbedingter Freibetrag bis 583.000 € (max. 46.400 €) — steht laut
//    Verwaltungspraxis auch dem wesentlich beteiligten Gesellschafter-Geschäftsführer zu
//  - GSVG: KV 6,80 %, PV 18,50 %, Selbständigenvorsorge 1,53 %, UV fix 12,96 €/Monat;
//    Mindestbeitragsgrundlage 551,10 €/Monat, Höchstbeitragsgrundlage 8.085 €/Monat
//  - KöSt 23 % linear, Mindest-KöSt 500 €/Jahr (Stammkapital 10.000 € seit der Reform 2024)
//  - KESt 27,5 % auf Ausschüttungen
//  - DB 3,7 %, DZ ~0,29 % (Bundesschnitt, editierbar), Kommunalsteuer 3 % auf den
//    GF-Bezug — Freigrenze 1.460 €/Monat (darunter entfällt die gesamte Abgabe)
//  - Sachbezug Firmen-Pkw: 2 % vom Anschaffungswert/Monat, gedeckelt bei 960 €/Monat
//  - PKW-Angemessenheitsgrenze (Luxustangente) für die AfA: 40.000 €, Mindestnutzungsdauer 8 Jahre

export const EST_STUFEN_2026: { bis: number; satz: number }[] = [
  { bis: 13539, satz: 0 },
  { bis: 21992, satz: 0.2 },
  { bis: 36458, satz: 0.3 },
  { bis: 70365, satz: 0.4 },
  { bis: 104859, satz: 0.48 },
  { bis: 1000000, satz: 0.5 },
  { bis: Infinity, satz: 0.55 },
]

/** Progressive Einkommensteuer (Stufengrenzsteuersätze) auf eine positive Bemessungsgrundlage. */
export function einkommensteuer(bemessungsgrundlage: number): number {
  const eink = Math.max(0, bemessungsgrundlage)
  let steuer = 0
  let unten = 0
  for (const stufe of EST_STUFEN_2026) {
    const oben = Math.min(eink, stufe.bis)
    if (oben > unten) steuer += (oben - unten) * stufe.satz
    unten = stufe.bis
    if (eink <= stufe.bis) break
  }
  return steuer
}

/** Staffel des Gewinnfreibetrags — kumulierte Obergrenzen der Bemessungsgrundlage je Stufe. */
export const GFB_STAFFEL: { bis: number; satz: number }[] = [
  { bis: 33000, satz: 0.15 }, // Grundfreibetrag, automatisch ohne Investition
  { bis: 178000, satz: 0.13 }, // investitionsbedingt, nächste 145.000
  { bis: 353000, satz: 0.07 }, // investitionsbedingt, nächste 175.000
  { bis: 583000, satz: 0.045 }, // investitionsbedingt, nächste 230.000
]

/**
 * Gewinnfreibetrag auf einen positiven Gewinn. Der Grundfreibetrag (erste Stufe) steht
 * automatisch zu; die höheren Stufen nur, wenn tatsächlich in begünstigte Wirtschaftsgüter
 * oder Wertpapiere investiert wird — hier vereinfacht über `investitionsbedingtNutzen`
 * abgebildet (Annahme: ausreichend investiert, wenn aktiviert).
 */
export function gewinnfreibetrag(gewinn: number, investitionsbedingtNutzen: boolean): number {
  const g = Math.max(0, gewinn)
  let fb = 0
  let unten = 0
  for (const stufe of GFB_STAFFEL) {
    const oben = Math.min(g, stufe.bis)
    if (oben > unten && (unten === 0 || investitionsbedingtNutzen)) fb += (oben - unten) * stufe.satz
    unten = stufe.bis
    if (g <= stufe.bis) break
  }
  return fb
}

export const GSVG_SATZ_KV = 0.068
export const GSVG_SATZ_PV = 0.185
export const GSVG_SATZ_SVS = 0.0153
export const GSVG_GESAMTSATZ = GSVG_SATZ_KV + GSVG_SATZ_PV + GSVG_SATZ_SVS
export const GSVG_UV_MONAT = 12.96
export const GSVG_UV_JAHR = GSVG_UV_MONAT * 12
export const GSVG_MINDESTBEITRAGSGRUNDLAGE_MONAT = 551.1
export const GSVG_MINDESTBEITRAGSGRUNDLAGE_JAHR = GSVG_MINDESTBEITRAGSGRUNDLAGE_MONAT * 12
export const GSVG_HOECHSTBEITRAGSGRUNDLAGE_MONAT = 8085
export const GSVG_HOECHSTBEITRAGSGRUNDLAGE_JAHR = GSVG_HOECHSTBEITRAGSGRUNDLAGE_MONAT * 12

/**
 * GSVG-Pflichtbeiträge (KV+PV+Selbständigenvorsorge+UV) auf eine Jahres-Beitragsgrundlage.
 * Die Grundlage ist der Gewinn/Bezug VOR Abzug der heurigen SV-Beiträge selbst — die
 * Beiträge werden nämlich bei der Bemessung wieder hinzugerechnet (keine Zirkularität),
 * gedeckelt zwischen Mindest- und Höchstbeitragsgrundlage.
 */
export function gsvgBeitrag(beitragsgrundlageVorSv: number): number {
  const grundlage = Math.min(
    GSVG_HOECHSTBEITRAGSGRUNDLAGE_JAHR,
    Math.max(GSVG_MINDESTBEITRAGSGRUNDLAGE_JAHR, beitragsgrundlageVorSv)
  )
  return grundlage * GSVG_GESAMTSATZ + GSVG_UV_JAHR
}

export const KOEST_SATZ = 0.23
export const KEST_SATZ = 0.275
export const MINDEST_KOEST_JAHR = 500

export const DB_SATZ = 0.037
export const DZ_SATZ_DEFAULT_PCT = 0.29 // Bundesschnitt, je Landeskammer unterschiedlich — editierbar
export const KOMMUNALSTEUER_SATZ = 0.03
export const LOHNNEBENKOSTEN_FREIGRENZE_MONAT = 1460

export const SACHBEZUG_SATZ_MONAT = 0.02
export const SACHBEZUG_DECKEL_MONAT = 960
export const SACHBEZUG_DECKEL_JAHR = SACHBEZUG_DECKEL_MONAT * 12

export const PKW_ANGEMESSENHEITSGRENZE = 40000
export const PKW_MINDESTNUTZUNGSDAUER_JAHRE = 8

export const EU_BILANZIERUNGSPFLICHT_UMSATZ = 700000
export const KLEINUNTERNEHMERGRENZE_UST = 55000

export const GMBH_STAMMKAPITAL_MINDEST = 10000
export const GMBH_STAMMKAPITAL_BAR_MINDEST = 5000

export const DEFAULTS = {
  umsatz: 100000,
  betriebsausgaben: 15000,
  autoAnschaffungswert: 35000,
  autoNutzungsdauerJahre: PKW_MINDESTNUTZUNGSDAUER_JAHRE,
  autoPrivatanteilPct: 20,
  sonstigeAfaJahr: 1500,
  investitionsbedingtenGfbNutzen: false,
  gfGehaltBrutto: 40000,
  ausschuettungsquotePct: 50,
  dzSatzPct: DZ_SATZ_DEFAULT_PCT,
  stbMehrkostenJahr: 2200,
  offenlegungJahr: 150,
  gruendungskostenEinmalig: 2500,
}

function clampPct(pct: number): number {
  return Math.min(100, Math.max(0, pct)) / 100
}

/** Jährliche AfA für den betrieblich genutzten Pkw, inkl. Angemessenheitsgrenze (Luxustangente). */
export function autoAfaJaehrlich(anschaffungswert: number, nutzungsdauerJahre: number): number {
  const bemessungswert = Math.min(Math.max(0, anschaffungswert), PKW_ANGEMESSENHEITSGRENZE)
  const jahre = Math.max(1, nutzungsdauerJahre || PKW_MINDESTNUTZUNGSDAUER_JAHRE)
  return bemessungswert / jahre
}

/** Sachbezug für einen privat genutzten Firmen-Pkw (nur relevant für die GmbH-Seite). */
export function sachbezugAutoJaehrlich(anschaffungswert: number, privatanteilPct: number): number {
  if (privatanteilPct <= 0) return 0
  return Math.min(Math.max(0, anschaffungswert) * SACHBEZUG_SATZ_MONAT * 12, SACHBEZUG_DECKEL_JAHR)
}

export interface GemeinsameEingabe {
  umsatz: number
  /** Betriebsausgaben ohne SV-Beiträge, ohne AfA, ohne GF-Gehalt. */
  betriebsausgaben: number
  autoAnschaffungswert: number
  autoNutzungsdauerJahre: number
  autoPrivatanteilPct: number
  sonstigeAfaJahr: number
  investitionsbedingtenGfbNutzen: boolean
}

export interface EuErgebnis {
  afaAutoBetrieblich: number
  afaGesamt: number
  gewinnVorSv: number
  svsBeitrag: number
  gewinnNachSv: number
  gewinnfreibetrag: number
  estBemessungsgrundlage: number
  einkommensteuer: number
  nettoEinkommen: number
}

/** Einzelunternehmer, Gewinnermittlung per Einnahmen-Ausgaben-Rechnung (EÜR). */
export function berechneEu(e: GemeinsameEingabe): EuErgebnis {
  const afaAutoVoll = autoAfaJaehrlich(e.autoAnschaffungswert, e.autoNutzungsdauerJahre)
  const afaAutoBetrieblich = afaAutoVoll * (1 - clampPct(e.autoPrivatanteilPct))
  const afaGesamt = afaAutoBetrieblich + Math.max(0, e.sonstigeAfaJahr)
  const gewinnVorSv = e.umsatz - e.betriebsausgaben - afaGesamt
  const svsBeitrag = gsvgBeitrag(gewinnVorSv)
  const gewinnNachSv = gewinnVorSv - svsBeitrag
  const gfb = gewinnfreibetrag(gewinnNachSv, e.investitionsbedingtenGfbNutzen)
  const estBemessungsgrundlage = Math.max(0, gewinnNachSv - gfb)
  const est = einkommensteuer(estBemessungsgrundlage)
  const nettoEinkommen = gewinnNachSv - est

  return { afaAutoBetrieblich, afaGesamt, gewinnVorSv, svsBeitrag, gewinnNachSv, gewinnfreibetrag: gfb, estBemessungsgrundlage, einkommensteuer: est, nettoEinkommen }
}

export interface GmbhSpezifischeEingabe {
  /** Geschäftsführer-Bruttogehalt (Bar, jährlich) — Betriebsausgabe der GmbH. */
  gfGehaltBrutto: number
  /** Anteil des Gewinns nach KöSt, der ausgeschüttet wird (Rest bleibt thesauriert). */
  ausschuettungsquotePct: number
  dzSatzPct: number
  stbMehrkostenJahr: number
  offenlegungJahr: number
}

export interface GmbhErgebnis {
  afaGesamt: number
  sachbezugAuto: number
  gfBemessungGesamt: number
  gfGsvgBeitrag: number
  lohnnebenkostenGmbh: number
  betrieblichesErgebnisVorKoest: number
  koeSt: number
  gewinnNachKoest: number
  ausschuettungBrutto: number
  kESt: number
  ausschuettungNetto: number
  thesaurierterGewinn: number
  gfGewinnfreibetrag: number
  gfEinkommensteuer: number
  gfNettoBar: number
  verfuegbaresEinkommen: number
  gesamtInklThesaurierung: number
}

/** Wesentlich beteiligter (>25 %) Gesellschafter-Geschäftsführer einer GmbH. */
export function berechneGmbh(e: GemeinsameEingabe, s: GmbhSpezifischeEingabe): GmbhErgebnis {
  const afaAutoVoll = autoAfaJaehrlich(e.autoAnschaffungswert, e.autoNutzungsdauerJahre)
  const afaGesamt = afaAutoVoll + Math.max(0, e.sonstigeAfaJahr)
  const sachbezugAuto = sachbezugAutoJaehrlich(e.autoAnschaffungswert, e.autoPrivatanteilPct)
  const gfGehaltBrutto = Math.max(0, s.gfGehaltBrutto)
  const gfBemessungGesamt = gfGehaltBrutto + sachbezugAuto

  const ueberFreigrenze = gfBemessungGesamt / 12 >= LOHNNEBENKOSTEN_FREIGRENZE_MONAT
  const lohnnebenkostenSatz = DB_SATZ + Math.max(0, s.dzSatzPct) / 100 + KOMMUNALSTEUER_SATZ
  const lohnnebenkostenGmbh = ueberFreigrenze ? gfBemessungGesamt * lohnnebenkostenSatz : 0

  const gfGsvgBeitrag = gsvgBeitrag(gfBemessungGesamt)

  const betrieblichesErgebnisVorKoest =
    e.umsatz - e.betriebsausgaben - afaGesamt - gfGehaltBrutto - lohnnebenkostenGmbh - Math.max(0, s.stbMehrkostenJahr) - Math.max(0, s.offenlegungJahr)
  const koeSt = betrieblichesErgebnisVorKoest > 0 ? Math.max(MINDEST_KOEST_JAHR, betrieblichesErgebnisVorKoest * KOEST_SATZ) : MINDEST_KOEST_JAHR
  const gewinnNachKoest = Math.max(0, betrieblichesErgebnisVorKoest - koeSt)

  const ausschuettungBrutto = gewinnNachKoest * clampPct(s.ausschuettungsquotePct)
  const thesaurierterGewinn = gewinnNachKoest - ausschuettungBrutto
  const kESt = ausschuettungBrutto * KEST_SATZ
  const ausschuettungNetto = ausschuettungBrutto - kESt

  const gfGfb = gewinnfreibetrag(Math.max(0, gfBemessungGesamt - gfGsvgBeitrag), e.investitionsbedingtenGfbNutzen)
  const gfEstBasis = Math.max(0, gfBemessungGesamt - gfGsvgBeitrag - gfGfb)
  const gfEinkommensteuer = einkommensteuer(gfEstBasis)
  // Sachbezug ist kein Bargeld — er erhöht zwar SV-/ESt-Basis (und damit die reale Abgabenlast),
  // wird aber aus dem verfügbaren Bar-Einkommen wieder herausgerechnet (Gegenwert ist die private
  // Autonutzung selbst, nicht zusätzliches Geld am Konto).
  const gfNettoGehalt = gfBemessungGesamt - gfGsvgBeitrag - gfEinkommensteuer
  const gfNettoBar = gfNettoGehalt - sachbezugAuto

  const verfuegbaresEinkommen = gfNettoBar + ausschuettungNetto
  const gesamtInklThesaurierung = verfuegbaresEinkommen + thesaurierterGewinn

  return {
    afaGesamt, sachbezugAuto, gfBemessungGesamt, gfGsvgBeitrag, lohnnebenkostenGmbh,
    betrieblichesErgebnisVorKoest, koeSt, gewinnNachKoest, ausschuettungBrutto, kESt, ausschuettungNetto,
    thesaurierterGewinn, gfGewinnfreibetrag: gfGfb, gfEinkommensteuer, gfNettoBar,
    verfuegbaresEinkommen, gesamtInklThesaurierung,
  }
}

export interface SchwellenPunkt {
  operativerGewinn: number
  nettoEu: number
  verfuegbarGmbh: number
  gesamtGmbh: number
}

/**
 * Vergleichsreihe über eine Bandbreite des operativen Gewinns (Umsatz − Betriebsausgaben − AfA,
 * vor SV/GF-Gehalt), bei sonst gleichbleibenden Einstellungen (GF-Gehalt, Ausschüttungsquote,
 * Kostenannahmen) — zeigt, ab welchem Gewinnniveau sich die GmbH lohnt.
 */
export function berechneSchwellenreihe(
  gemeinsam: GemeinsameEingabe,
  spezifisch: GmbhSpezifischeEingabe,
  vonGewinn: number,
  bisGewinn: number,
  schrittweite: number
): SchwellenPunkt[] {
  const punkte: SchwellenPunkt[] = []
  const afaGesamtEu = autoAfaJaehrlich(gemeinsam.autoAnschaffungswert, gemeinsam.autoNutzungsdauerJahre) * (1 - clampPct(gemeinsam.autoPrivatanteilPct)) + Math.max(0, gemeinsam.sonstigeAfaJahr)
  const afaGesamtGmbh = autoAfaJaehrlich(gemeinsam.autoAnschaffungswert, gemeinsam.autoNutzungsdauerJahre) + Math.max(0, gemeinsam.sonstigeAfaJahr)

  for (let g = vonGewinn; g <= bisGewinn; g += schrittweite) {
    const eEu: GemeinsameEingabe = { ...gemeinsam, umsatz: g + gemeinsam.betriebsausgaben + afaGesamtEu }
    const eGmbh: GemeinsameEingabe = { ...gemeinsam, umsatz: g + gemeinsam.betriebsausgaben + afaGesamtGmbh }
    const eu = berechneEu(eEu)
    const gmbh = berechneGmbh(eGmbh, spezifisch)
    punkte.push({ operativerGewinn: g, nettoEu: eu.nettoEinkommen, verfuegbarGmbh: gmbh.verfuegbaresEinkommen, gesamtGmbh: gmbh.gesamtInklThesaurierung })
  }
  return punkte
}

export interface GruendungsVergleich {
  jaehrlicherVorteilGmbh: number
  breakEvenJahre: number | null
}

/** Wie viele Jahre dauert es, bis der laufende Vorteil der GmbH die einmaligen Gründungskosten aufwiegt? */
export function berechneGruendungsVergleich(
  euErgebnis: EuErgebnis, gmbhErgebnis: GmbhErgebnis, gruendungskostenEinmalig: number
): GruendungsVergleich {
  const jaehrlicherVorteilGmbh = gmbhErgebnis.gesamtInklThesaurierung - euErgebnis.nettoEinkommen
  const breakEvenJahre = jaehrlicherVorteilGmbh > 0 ? gruendungskostenEinmalig / jaehrlicherVorteilGmbh : null
  return { jaehrlicherVorteilGmbh, breakEvenJahre }
}
