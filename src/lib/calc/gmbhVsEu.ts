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
//  - DB 3,7 %, DZ ~0,29 % (Bundesschnitt, editierbar) — unbedingt fällig, das kleine
//    Befreiungsvolumen für Betriebe mit ≤3 Dienstnehmer:innen und ≤1.460 €/Monat
//    Gesamt-Lohnsumme greift bei einem real bezahlten GF-Bezug praktisch nie und wird
//    hier nicht modelliert (fehlt die Mitarbeiterzahl des Betriebs als Eingabe dafür);
//    Kommunalsteuer 3 % auf den GF-Bezug mit einer echten Freigrenze von 1.460 €/Monat
//    (Gesamt-Lohnsumme darunter: keine Kommunalsteuer; darüber: die volle Summe ist
//    steuerpflichtig, nicht nur der übersteigende Teil — das ist bei einer Freigrenze
//    so beabsichtigt, anders als bei einem Freibetrag)
//  - Sachbezug Firmen-Pkw: 2 % vom Anschaffungswert/Monat, gedeckelt bei 960 €/Monat
//  - PKW-Angemessenheitsgrenze (Luxustangente) für die AfA: 40.000 €, Mindestnutzungsdauer 8 Jahre
//  - Betriebsausgabenpauschale § 17 EStG (Basispauschalierung): 6 % vom Bezug, max.
//    13.200 €/Jahr — steht auch dem wesentlich beteiligten Gesellschafter-Geschäftsführer
//    für seine Einkünfte aus sonstiger selbständiger Arbeit (§ 22 Z 2 EStG) zu, wird in der
//    Praxis regelmäßig übersehen, weil sie wie ein Dienstverhältnis aussieht

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

export const GF_BASISPAUSCHALE_SATZ = 0.06
export const GF_BASISPAUSCHALE_MAX_JAHR = 13200

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
  // Laufende Kfz-Kosten (Treibstoff, Versicherung, Service) — standardmäßig 0, weil ohne
  // recherchierten Richtwert; wer das Auto-Feld nutzt, sollte den tatsächlichen Jahresbetrag
  // eintragen, siehe kfzLaufendeKostenJahr in GemeinsameEingabe.
  kfzLaufendeKostenJahr: 0,
  sonstigeAfaJahr: 1500,
  investitionsbedingtenGfbNutzen: false,
  // 0 Jahre = keine Verzinsung, entspricht dem bisherigen Verhalten (reiner Jahresvergleich).
  anlagehorizontJahre: 0,
  gfGehaltBrutto: 40000,
  ausschuettungsquotePct: 50,
  // Zinssatz p.a. auf den im Unternehmen verbleibenden (thesaurierten) Gewinn, z. B. bei
  // Investition in ein Wertpapierdepot der GmbH — 0 % standardmäßig, kein recherchierter Wert.
  verzinsungThesaurierungPct: 0,
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
  /** Betriebsausgaben ohne SV-Beiträge, ohne AfA, ohne Kfz-Kosten, ohne GF-Gehalt. */
  betriebsausgaben: number
  autoAnschaffungswert: number
  autoNutzungsdauerJahre: number
  autoPrivatanteilPct: number
  /** Laufende Kfz-Kosten (Treibstoff, Versicherung, Service) — separat von betriebsausgaben,
   * weil sie beim Einzelunternehmer (anders als bei GmbH/Zypern) um den Privatanteil gekürzt
   * werden müssen, siehe berechneEu. */
  kfzLaufendeKostenJahr: number
  sonstigeAfaJahr: number
  investitionsbedingtenGfbNutzen: boolean
  /** Über wie viele Jahre der thesaurierte Gewinn (GmbH/Zypern) vor einem Vergleich mit dem
   * Einzelunternehmer-Jahresnetto verzinst wird, siehe verzinsungThesaurierungPct in
   * GmbhSpezifischeEingabe/ZypernSpezifischeEingabe. 0 = kein Zinseffekt (bisheriges
   * Verhalten, reiner Jahresvergleich ohne Zeithorizont). Wird von berechneEu ignoriert. */
  anlagehorizontJahre: number
}

export interface EuErgebnis {
  afaAutoBetrieblich: number
  afaGesamt: number
  kfzLaufendeKostenBetrieblich: number
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
  const privatAnteil = clampPct(e.autoPrivatanteilPct)
  const afaAutoVoll = autoAfaJaehrlich(e.autoAnschaffungswert, e.autoNutzungsdauerJahre)
  const afaAutoBetrieblich = afaAutoVoll * (1 - privatAnteil)
  const afaGesamt = afaAutoBetrieblich + Math.max(0, e.sonstigeAfaJahr)
  // Wie die AfA muss auch der laufende Kfz-Aufwand (Treibstoff, Versicherung, Service) um
  // den Privatanteil gekürzt werden — sonst wird der volle Betrag fälschlich als Betriebs-
  // ausgabe abgesetzt, obwohl ein Teil privat veranlasst ist.
  const kfzLaufendeKostenBetrieblich = Math.max(0, e.kfzLaufendeKostenJahr) * (1 - privatAnteil)
  const gewinnVorSv = e.umsatz - e.betriebsausgaben - afaGesamt - kfzLaufendeKostenBetrieblich
  const svsBeitrag = gsvgBeitrag(gewinnVorSv)
  const gewinnNachSv = gewinnVorSv - svsBeitrag
  const gfb = gewinnfreibetrag(gewinnNachSv, e.investitionsbedingtenGfbNutzen)
  const estBemessungsgrundlage = Math.max(0, gewinnNachSv - gfb)
  const est = einkommensteuer(estBemessungsgrundlage)
  const nettoEinkommen = gewinnNachSv - est

  return {
    afaAutoBetrieblich, afaGesamt, kfzLaufendeKostenBetrieblich, gewinnVorSv, svsBeitrag, gewinnNachSv,
    gewinnfreibetrag: gfb, estBemessungsgrundlage, einkommensteuer: est, nettoEinkommen,
  }
}

export interface GmbhSpezifischeEingabe {
  /** Geschäftsführer-Bruttogehalt (Bar, jährlich) — Betriebsausgabe der GmbH. */
  gfGehaltBrutto: number
  /** Anteil des Gewinns nach KöSt, der ausgeschüttet wird (Rest bleibt thesauriert). */
  ausschuettungsquotePct: number
  /** Zinssatz p.a., mit dem der thesaurierte Gewinn über GemeinsameEingabe.anlagehorizontJahre
   * verzinst wird, bevor die latente KESt bei Entnahme abgezogen wird (vereinfacht: die Zinsen
   * selbst wachsen brutto, es wird nur am Ende einmal die volle KESt auf den Endwert fällig —
   * die laufende KöSt auf die Kapitalerträge im Unternehmen wird nicht gesondert simuliert). */
  verzinsungThesaurierungPct: number
  dzSatzPct: number
  stbMehrkostenJahr: number
  offenlegungJahr: number
}

export interface GmbhErgebnis {
  afaGesamt: number
  kfzLaufendeKosten: number
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
  /** thesaurierterGewinn nach Verzinsung über GemeinsameEingabe.anlagehorizontJahre mit
   * GmbhSpezifischeEingabe.verzinsungThesaurierungPct (Zinseszins) — bei horizontJahre 0 oder
   * verzinsungThesaurierungPct 0 identisch mit thesaurierterGewinn. Ein negativer Betrag
   * (Verlust) wird nicht verzinst. */
  thesaurierterGewinnEndwert: number
  gfBetriebsausgabenpauschale: number
  gfGewinnfreibetrag: number
  gfEinkommensteuer: number
  gfNettoBar: number
  verfuegbaresEinkommen: number
  /** Bar verfügbar plus voller (unverzinster) thesaurierter Gewinn — Vorsicht: das ist NICHT
   * direkt mit dem voll versteuerten Einzelunternehmer-Netto vergleichbar, weil auf den
   * thesaurierten Teil bei einer künftigen Entnahme noch KESt anfällt. Für einen fairen
   * Vergleich siehe gesamtNachLatenterSteuer. */
  gesamtInklThesaurierung: number
  /** Bar verfügbar plus verzinster thesaurierter Gewinn (thesaurierterGewinnEndwert), gekürzt
   * um die KESt, die bei einer künftigen Ausschüttung des Endwerts anfallen würde (27,5 % auf
   * den positiven Anteil — ein Verlust wird nicht "wegversteuert"). Das ist die richtige
   * Vergleichsgrundlage gegen das voll versteuerte Einzelunternehmer-Netto, unabhängig von der
   * gewählten Ausschüttungsquote: ohne diese Korrektur suggeriert eine niedrige Ausschüttungs-
   * quote einen GmbH-Vorteil, der beim tatsächlichen Verbrauch des Geldes gar nicht existiert
   * (siehe PR-Diskussion). Bei einem Anlagehorizont > 0 vergleicht dieser Wert einen Endwert
   * nach N Jahren gegen ein einzelnes Jahr Einzelunternehmer-Einkommen — als Antwort auf "was
   * bringt mir das Liegenlassen", nicht als exakter Jahresvergleich gedacht. */
  gesamtNachLatenterSteuer: number
}

/** Wesentlich beteiligter (>25 %) Gesellschafter-Geschäftsführer einer GmbH. */
export function berechneGmbh(e: GemeinsameEingabe, s: GmbhSpezifischeEingabe): GmbhErgebnis {
  const afaAutoVoll = autoAfaJaehrlich(e.autoAnschaffungswert, e.autoNutzungsdauerJahre)
  const afaGesamt = afaAutoVoll + Math.max(0, e.sonstigeAfaJahr)
  const kfzLaufendeKosten = Math.max(0, e.kfzLaufendeKostenJahr)
  const sachbezugAuto = sachbezugAutoJaehrlich(e.autoAnschaffungswert, e.autoPrivatanteilPct)
  const gfGehaltBrutto = Math.max(0, s.gfGehaltBrutto)
  const gfBemessungGesamt = gfGehaltBrutto + sachbezugAuto

  // DB+DZ sind praktisch unbedingt fällig (siehe Kommentar oben im Dateikopf) — nur die
  // Kommunalsteuer kennt eine echte Freigrenze: unter 1.460 €/Monat Lohnsumme entfällt sie
  // zur Gänze, darüber ist die gesamte Summe (nicht nur der übersteigende Teil) steuerpflichtig.
  const dbDzSatz = DB_SATZ + Math.max(0, s.dzSatzPct) / 100
  const dbDz = gfBemessungGesamt * dbDzSatz
  const kommunalsteuer = gfBemessungGesamt / 12 >= LOHNNEBENKOSTEN_FREIGRENZE_MONAT ? gfBemessungGesamt * KOMMUNALSTEUER_SATZ : 0
  const lohnnebenkostenGmbh = dbDz + kommunalsteuer

  const gfGsvgBeitrag = gsvgBeitrag(gfBemessungGesamt)

  const betrieblichesErgebnisVorKoest =
    e.umsatz - e.betriebsausgaben - afaGesamt - kfzLaufendeKosten - gfGehaltBrutto - lohnnebenkostenGmbh
    - Math.max(0, s.stbMehrkostenJahr) - Math.max(0, s.offenlegungJahr)
  const koeSt = betrieblichesErgebnisVorKoest > 0 ? Math.max(MINDEST_KOEST_JAHR, betrieblichesErgebnisVorKoest * KOEST_SATZ) : MINDEST_KOEST_JAHR
  // Kein Floor bei 0: ein Verlust nach Mindest-KöSt darf nicht verschwinden, sondern muss als
  // negativer thesaurierter Betrag unten durchschlagen — sonst wirkt eine defizitäre GmbH im
  // Vergleich fälschlich kostenlos (siehe PR-Diskussion, Punkt "Verlustfall").
  const gewinnNachKoest = betrieblichesErgebnisVorKoest - koeSt

  const ausschuettungBrutto = Math.max(0, gewinnNachKoest) * clampPct(s.ausschuettungsquotePct)
  const thesaurierterGewinn = gewinnNachKoest - ausschuettungBrutto
  const kESt = ausschuettungBrutto * KEST_SATZ
  const ausschuettungNetto = ausschuettungBrutto - kESt

  // Betriebsausgabenpauschale § 17 EStG (Basispauschalierung, 6 %, max. 13.200 €) steht auch
  // dem wesentlich beteiligten Gesellschafter-Geschäftsführer für seine Einkünfte aus
  // sonstiger selbständiger Arbeit (§ 22 Z 2 EStG) zu.
  const gfBetriebsausgabenpauschale = Math.min(gfBemessungGesamt * GF_BASISPAUSCHALE_SATZ, GF_BASISPAUSCHALE_MAX_JAHR)
  const gfGewinnVorGfb = Math.max(0, gfBemessungGesamt - gfGsvgBeitrag - gfBetriebsausgabenpauschale)
  const gfGfb = gewinnfreibetrag(gfGewinnVorGfb, e.investitionsbedingtenGfbNutzen)
  const gfEstBasis = Math.max(0, gfGewinnVorGfb - gfGfb)
  const gfEinkommensteuer = einkommensteuer(gfEstBasis)
  // Sachbezug ist kein Bargeld — er erhöht zwar SV-/ESt-Basis (und damit die reale Abgabenlast),
  // wird aber aus dem verfügbaren Bar-Einkommen wieder herausgerechnet (Gegenwert ist die private
  // Autonutzung selbst, nicht zusätzliches Geld am Konto). Die Betriebsausgabenpauschale
  // schmälert dagegen nur die Steuerbemessung, nicht den tatsächlichen Bar-Zufluss.
  const gfNettoGehalt = gfBemessungGesamt - gfGsvgBeitrag - gfEinkommensteuer
  const gfNettoBar = gfNettoGehalt - sachbezugAuto

  const verfuegbaresEinkommen = gfNettoBar + ausschuettungNetto
  const gesamtInklThesaurierung = verfuegbaresEinkommen + thesaurierterGewinn

  // Verzinsung des thesaurierten (nicht entnommenen) Gewinns über den gewählten Anlagehorizont,
  // z. B. bei Investition in ein Wertpapierdepot der GmbH — vereinfacht: die Zinsen wachsen
  // brutto weiter (keine laufende KöSt auf die Kapitalerträge selbst), erst am Ende wird auf
  // den vollen Endwert einmalig die KESt fällig, wenn entnommen wird. Ein negativer thesau-
  // rierter Betrag (Verlust) wird nicht verzinst.
  const zinsfaktor = Math.pow(1 + Math.max(-100, s.verzinsungThesaurierungPct) / 100, Math.max(0, e.anlagehorizontJahre))
  const thesaurierterGewinnEndwert = thesaurierterGewinn > 0 ? thesaurierterGewinn * zinsfaktor : thesaurierterGewinn
  const thesaurierterGewinnEndwertNachLatenterKest = thesaurierterGewinnEndwert > 0 ? thesaurierterGewinnEndwert * (1 - KEST_SATZ) : thesaurierterGewinnEndwert
  const gesamtNachLatenterSteuer = verfuegbaresEinkommen + thesaurierterGewinnEndwertNachLatenterKest

  return {
    afaGesamt, kfzLaufendeKosten, sachbezugAuto, gfBemessungGesamt, gfGsvgBeitrag, lohnnebenkostenGmbh,
    betrieblichesErgebnisVorKoest, koeSt, gewinnNachKoest, ausschuettungBrutto, kESt, ausschuettungNetto,
    thesaurierterGewinn, thesaurierterGewinnEndwert, gfBetriebsausgabenpauschale, gfGewinnfreibetrag: gfGfb,
    gfEinkommensteuer, gfNettoBar, verfuegbaresEinkommen, gesamtInklThesaurierung, gesamtNachLatenterSteuer,
  }
}

export interface SchwellenPunkt {
  operativerGewinn: number
  nettoEu: number
  verfuegbarGmbh: number
  gesamtGmbh: number
  gesamtGmbhNachLatenterSteuer: number
}

/**
 * Vergleichsreihe über eine Bandbreite des operativen Gewinns (Umsatz − Betriebsausgaben − AfA
 * − laufende Kfz-Kosten, vor SV/GF-Gehalt), bei sonst gleichbleibenden Einstellungen (GF-Gehalt,
 * Ausschüttungsquote, Kostenannahmen) — zeigt, ab welchem Gewinnniveau sich die GmbH lohnt.
 */
export function berechneSchwellenreihe(
  gemeinsam: GemeinsameEingabe,
  spezifisch: GmbhSpezifischeEingabe,
  vonGewinn: number,
  bisGewinn: number,
  schrittweite: number
): SchwellenPunkt[] {
  const punkte: SchwellenPunkt[] = []
  const afaAutoVoll = autoAfaJaehrlich(gemeinsam.autoAnschaffungswert, gemeinsam.autoNutzungsdauerJahre)
  const kfzVoll = Math.max(0, gemeinsam.kfzLaufendeKostenJahr)
  const privatAnteil = clampPct(gemeinsam.autoPrivatanteilPct)
  const afaGesamtEu = afaAutoVoll * (1 - privatAnteil) + Math.max(0, gemeinsam.sonstigeAfaJahr) + kfzVoll * (1 - privatAnteil)
  const afaGesamtGmbh = afaAutoVoll + Math.max(0, gemeinsam.sonstigeAfaJahr) + kfzVoll

  for (let g = vonGewinn; g <= bisGewinn; g += schrittweite) {
    const eEu: GemeinsameEingabe = { ...gemeinsam, umsatz: g + gemeinsam.betriebsausgaben + afaGesamtEu }
    const eGmbh: GemeinsameEingabe = { ...gemeinsam, umsatz: g + gemeinsam.betriebsausgaben + afaGesamtGmbh }
    const eu = berechneEu(eEu)
    const gmbh = berechneGmbh(eGmbh, spezifisch)
    punkte.push({
      operativerGewinn: g, nettoEu: eu.nettoEinkommen, verfuegbarGmbh: gmbh.verfuegbaresEinkommen,
      gesamtGmbh: gmbh.gesamtInklThesaurierung, gesamtGmbhNachLatenterSteuer: gmbh.gesamtNachLatenterSteuer,
    })
  }
  return punkte
}

export interface GruendungsVergleich {
  jaehrlicherVorteilGmbh: number
  breakEvenJahre: number | null
}

/** Wie viele Jahre dauert es, bis der laufende Vorteil der GmbH die einmaligen Gründungskosten
 * aufwiegt? Verwendet gesamtNachLatenterSteuer statt gesamtInklThesaurierung, damit die
 * Ausschüttungsquote das Ergebnis nicht verzerrt — sonst sähe eine GmbH, die alles thesauriert,
 * fälschlich immer vorteilhafter aus als eine, die ausschüttet, obwohl beim tatsächlichen
 * Verbrauch des thesaurierten Teils noch KESt fällig wird. */
export function berechneGruendungsVergleich(
  euErgebnis: EuErgebnis, gmbhErgebnis: GmbhErgebnis, gruendungskostenEinmalig: number
): GruendungsVergleich {
  const jaehrlicherVorteilGmbh = gmbhErgebnis.gesamtNachLatenterSteuer - euErgebnis.nettoEinkommen
  const breakEvenJahre = jaehrlicherVorteilGmbh > 0 ? gruendungskostenEinmalig / jaehrlicherVorteilGmbh : null
  return { jaehrlicherVorteilGmbh, breakEvenJahre }
}
