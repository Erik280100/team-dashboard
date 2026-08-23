// Anlegerwohnungs-Portfolio-Rechner — simuliert den Aufbau eines Wohnungsportfolios über die
// Zeit: sparen → kaufen → Wert steigt → umschulden (auf den höheren Verkehrswert) → die
// Auszahlung finanziert die nächste Wohnung, im Idealfall ganz ohne neues Eigenkapital.
//
// Baut bewusst auf src/lib/calc/kredit.ts auf statt Formeln zu duplizieren: Kaufnebenkosten,
// Kreditnebenkosten-Sätze, AfA-Regeln (§ 8 Abs. 1a EStG) und die Annuitätenformel kommen von
// dort. Diese Datei fügt nur das hinzu, was kredit.ts (Einzelobjekt-Rechner) nicht kann: die
// Simulation eines wachsenden Portfolios über Jahre, mit Mietertrag, Wertsteigerung,
// wiederkehrender Umschuldung und der Frage, wie viele Wohnungen sich davon "von selbst"
// finanzieren.
//
// Bewusste Vereinfachungen (siehe auch die Warnhinweise im Ergebnis):
//  - Umschuldung erfolgt zum eingestellten Beleihungssatz auf den AKTUELLEN Verkehrswert; real
//    verlangen Banken meist 70–80 %, nicht 100 %.
//  - Mietindexierung/Verkehrswertfortschreibung erfolgt am Jahresende für alle Objekte
//    gemeinsam (kalenderjährlich), nicht individuell zum Kauf- bzw. Mietvertragsdatum.
//  - AfA für ein im Dezember gekauftes Objekt beginnt vereinfachend erst im nächsten vollen
//    Kalenderjahr (keine unterjährige Halbjahres-AfA) — dieses nächste Jahr zählt dann als Jahr 1
//    der beschleunigten AfA (Faktor 3), nicht als Jahr 2.
//  - Der Bestand (Sammelposten) erhält keine beschleunigte Anfangs-AfA mehr (§ 8 Abs. 1a EStG
//    gilt nur in den ersten beiden Jahren ab Anschaffung) und keinen eigenen Zinssatz-Input —
//    dieser wird aus Restschuld/Rate/Restlaufzeit rückgerechnet (Bisection).
//  - Bewirtschaftungskosten (Hausverwaltung, Instandhaltung, Sonstiges) sind pauschale
//    Monatsbeträge pro Objekt bzw. × Bestandsanzahl, keine Einzelabrechnung.
//  - Käufe finden statt, sobald genug Kapital vorhanden ist — keine künstliche Mindestpause
//    zwischen zwei Käufen.
//  - Negative Liquidität ist nicht möglich (kein Kontoüberziehungs-Modell): Ein laufender
//    Cashflow-Fehlbetrag oder eine Steuernachzahlung wird sofort aus dem Nettoeinkommen
//    zugeschossen (liquiditaetsNachschuss/-Kumuliert im Ergebnis, plus Warnhinweis).

import {
  KREDIT_DEFAULTS, berechneAfaBemessungsgrundlage, berechneAfaJahre, berechneKaufnebenkosten,
  berechneTilgungsplan, type AfaJahr, type KreditSaetze,
} from "@/lib/calc/kredit"

export interface ImmoPortfolioEingabe {
  // Start & Sparen
  eigenmittel: number
  sparbetragMonat: number
  guthabenzinsPct: number

  // Kauf & Finanzierung
  kaufpreisReferenz: number
  wohnflaecheM2: number
  ltvKaufPct: number
  laufzeitJahre: number
  zinssatzPct: number
  mitMakler: boolean
  nkMitfinanziert: boolean

  // Miete
  mietModus: "direkt" | "proM2"
  mieteMonat: number
  mietpreisProM2: number
  indexierungPct: number
  leerstandPct: number
  /** Befristete Vermietung (MRG) — mindert die Anfangsmiete neu gekaufter Objekte um den in der
   *  Praxis üblichen Befristungsabschlag von 25 %. */
  befristet: boolean

  // Bewirtschaftungskosten (pro Objekt bzw. × Bestandsanzahl, außer instandhaltung, die ist
  // pro m² und gilt nur für neu gekaufte Objekte, da für den Bestand keine m²-Angabe existiert)
  hausverwaltungMonat: number
  instandhaltungProM2Monat: number
  sonstigeKostenMonat: number

  // Wertentwicklung — gilt auch für künftige Kaufpreise (Referenzkaufpreis wird mitgezogen)
  wertzuwachsPct: number

  // Umschuldung
  umschuldungAlleJahre: number
  beleihungUmschuldungPct: number

  // Steuer
  grenzsteuersatzPct: number
  gebaeudeanteilPct: number
  afaSatzPct: number

  // Bestand (Sammelposten aller bereits vorhandenen Wohnungen)
  bestandAnzahl: number
  bestandWert: number
  bestandRestschuld: number
  bestandRateMonat: number
  bestandMieteMonat: number
  bestandRestlaufzeitJahre: number
  /** Historische Anschaffungskosten (nicht der heutige Verkehrswert!) — Basis für AfA und für die
   *  ImmoESt-Bemessung bei einem gedachten Verkauf. Falls unbekannt, ersatzweise den Verkehrswert
   *  eintragen (führt tendenziell zu einer zu niedrigen AfA bzw. zu hohen ImmoESt-Basis). */
  bestandAnschaffungskosten: number
  /** Anzahl der Jahre, für die der Bestand bereits linear abgeschrieben wurde. */
  bestandAfaJahreVerbraucht: number

  // Leistbarkeit
  nettoeinkommenMonat: number
  /** Nur zur Anzeige (DSTI-Kennzahl) — blockiert keinen Kauf. */
  lebenshaltungMonat: number
  /** Harte Kauf-/Umschuldungssperre: Deckt ein cashflow-negatives Portfolio den Fehlbetrag nicht
   *  aus dem laufenden Sparen, wird er vom Nettoeinkommen abgezogen ("Sparquote schrumpft").
   *  Bleibt davon weniger als dieser Betrag vom Nettoeinkommen übrig, wird kein weiterer Kauf mehr
   *  getätigt — anders als eine feste DSTI-%-Grenze, denn ein kleines Minus (z. B. Miete 500 €,
   *  Rate 520 €) ist damit unproblematisch, solange genug Gehalt übrig bleibt. */
  mindestResteinkommenMonat: number

  horizontJahre: number
  saetze?: KreditSaetze
}

interface ObjektZustand {
  id: number
  istBestand: boolean
  kaufMonat: number
  kaufJahrIndex: number
  kaufpreis: number
  wohnflaecheM2: number
  verkehrswert: number
  restschuld: number
  rate: number
  zinsPct: number
  restMonate: number
  afaBasis: number
  afaSerie: AfaJahr[]
  afaKumuliert: number
  mieteMonat: number
  letzteUmschuldungMonat: number
  /** Anschaffungskosten inkl. Kaufnebenkosten (nicht der laufend fortgeschriebene Verkehrswert!) —
   *  Basis für die ImmoESt bei einem gedachten Verkauf (§ 30 Abs. 3 EStG). */
  anschaffungskostenGesamt: number
  /** Kumuliertes steuerliches Ergebnis (Miete − Kosten − Zinsen − AfA) NUR dieses Objekts seit
   *  seinem eigenen Kaufmonat — Grundlage der objektbezogenen Liebhaberei-Prognose (§ 1 Abs. 2
   *  Z 3 LVO wird je Einkunftsquelle, also je Objekt, beurteilt — nicht im Portfolio-Saldo). */
  eigenSteuerErgebnisKumuliert: number
  /** Verhindert eine mehrfache Liebhaberei-Prüfung desselben Objekts. */
  liebhabereiGeprueft: boolean
}

export interface ImmoJahr {
  jahr: number
  anzahlObjekte: number
  portfolioWert: number
  restschuldGesamt: number
  liquiditaet: number
  nettovermoegen: number
  /** nettovermoegen abzüglich einer gedachten ImmoESt (30 %, § 30a EStG) auf einen Verkauf ALLER
   *  Objekte zu diesem Zeitpunkt — siehe IMMOEST_PCT. Vereinfachung: kein Altvermögen-Sonderfall
   *  (4,2 %-Pauschale), keine Berücksichtigung eines gewerblichen Grundstückshandels. */
  nettovermoegenNachSteuer: number
  mieteinnahmen: number
  bewirtschaftungskosten: number
  kreditratenGesamt: number
  zinsenGesamt: number
  tilgungGesamt: number
  afaGesamt: number
  steuerErgebnis: number
  steuerEffekt: number
  cashflowNetto: number
  ltvPct: number
  dstiPct: number
  /** Aus eigener Tasche aufgebrachter Eigenmittelanteil (Eigenmittelbedarf minus
   *  Umschuldungserlös) der in diesem Jahr getätigten Käufe. */
  eigenmitteleinsatzKauf: number
  /** Laufende Summe von eigenmitteleinsatzKauf seit Simulationsstart. */
  eigenmitteleinsatzKumuliert: number
  /** In diesem Jahr aus dem Nettoeinkommen zugeschossenes Kapital, um zu verhindern, dass ein
   *  laufender Cashflow-Fehlbetrag oder eine Steuernachzahlung die Liquidität negativ werden
   *  lässt (eine Kontoüberziehung ist im Modell nicht vorgesehen) — KEIN Kaufkapital, daher
   *  separat von eigenmitteleinsatzKauf ausgewiesen. */
  liquiditaetsNachschuss: number
  /** Laufende Summe von liquiditaetsNachschuss seit Simulationsstart. */
  liquiditaetsNachschussKumuliert: number
}

export interface ImmoKauf {
  objektId: number
  monat: number
  jahr: number
  kaufpreis: number
  eigenmittelbedarf: number
  ausUmschuldung: number
  /** = eigenmittelbedarf - ausUmschuldung: der tatsächlich aus eigener Tasche finanzierte Teil. */
  eigenmittelAnteil: number
  gratisAnteilPct: number
  istGratis: boolean
  rate: number
  anfangsmiete: number
  bruttomietrenditePct: number
  /** Beschleunigte AfA im ersten Jahr (Faktor 3, § 8 Abs. 1a EStG) dieses konkreten Kaufs. */
  afaJahr1: number
}

export interface ImmoUmschuldung {
  objektId: number
  monat: number
  jahr: number
  verkehrswert: number
  restschuldAlt: number
  restschuldNeu: number
  kosten: number
  auszahlung: number
}

export interface ImmoMeilenstein {
  jahr: number
  anzahlObjekte: number
  davonGratis: number
  portfolioWert: number
  restschuldGesamt: number
  nettovermoegen: number
  nettovermoegenNachSteuer: number
  jahresmiete: number
  jahresAfa: number
  jahresCashflow: number
}

export interface ImmoKennzahlen {
  anzahlGratis: number
  /** Summe aller aus Umschuldungserlösen finanzierten Anteile (ImmoKauf.ausUmschuldung) über ALLE
   *  Käufe — nicht nur die zu 100 % gratis finanzierten, sondern auch Käufe, die z. B. nur zu 29 %
   *  oder 61 % aus Umschuldung gedeckt wurden. anzahlGratis allein blendet diese Teilfinanzierung aus. */
  ausUmschuldungGesamt: number
  /** ausUmschuldungGesamt als Anteil am gesamten Kapitalbedarf (Summe aller eigenmittelbedarf) aller
   *  Käufe — beantwortet "wie viel wurde mir insgesamt durch Umschuldung abgenommen?". */
  umschuldungsAnteilGesamtPct: number
  /** Summe der einzelnen gratisAnteilPct/100 über ALLE Käufe — ein zu 100 % gratis finanzierter Kauf
   *  zählt voll (1), ein nur zu z. B. 29 % aus Umschuldung finanzierter Kauf zählt anteilig (0,29).
   *  Verallgemeinert anzahlGratis (das nur ganze, zu 100 % gratis finanzierte Käufe zählt) zu einer
   *  gebrochenen "Gratis-Äquivalent"-Anzahl, die auch teilweise Umschuldungsfinanzierung sichtbar macht. */
  gratisAequivalentAnzahl: number
  bruttomietrenditeSchnittPct: number
  nettomietrenditeSchnittPct: number
  eigenkapitalrenditePct: number
  irrPct: number | null
  /** Wie eigenkapitalrenditePct, aber auf Basis von nettovermoegenNachSteuer. */
  eigenkapitalrenditeNachSteuerPct: number
  /** Wie irrPct, aber auf Basis von nettovermoegenNachSteuer. */
  irrNachSteuerPct: number | null
  breakEvenJahr: number | null
}

export interface ImmoPortfolioErgebnis {
  jahre: ImmoJahr[]
  kaeufe: ImmoKauf[]
  umschuldungen: ImmoUmschuldung[]
  meilensteine: ImmoMeilenstein[]
  kennzahlen: ImmoKennzahlen
  warnungen: string[]
}

/** Unterhalb dieses Referenzkaufpreises finden keine Käufe statt (siehe Kaufprüfung weiter
 *  unten) — sowohl weil das kein realistischer Wohnungskaufpreis mehr ist, als auch weil ein
 *  sehr niedriger Kaufpreis bei fixen (kaufpreisunabhängigen) Nebenkosten sonst eine unbegrenzte
 *  Kaufschleife auslösen kann. */
export const KAUFPREIS_MINDESTGRENZE = 80000

/** KESt auf Geldeinlagen bei Kreditinstituten (§ 27a Abs. 1 Z 1 EStG) — nicht zu verwechseln mit
 *  den 27,5 % auf Dividenden/Fonds/Anleihen. Wird auf die Guthabenzinsen der Liquidität
 *  angewendet (in Österreich von der Bank automatisch einbehalten). */
export const IMMO_KEST_PCT = 25

/** Besonderer Steuersatz auf Immobilienveräußerungsgewinne (§ 30a EStG), unabhängig von der
 *  Behaltedauer (die Spekulationsfrist ist seit 1.4.2012 für Neuvermögen abgeschafft).
 *  Vereinfachung: keine 4,2 %-Pauschale für Altvermögen (Anschaffung vor dem 31.3.2002), kein
 *  Sonderfall gewerblicher Grundstückshandel. */
export const IMMOEST_PCT = 30

/** Ermittelt Pfandrechts-/Vertragserrichtungskosten von einer Kreditsumme — dieselbe Formel wie
 *  in kredit.ts für die Kreditnebenkosten, hier zusätzlich für Umschuldungen wiederverwendet. */
function berechneKreditNebenkostenSumme(kreditbetrag: number, saetze: KreditSaetze): number {
  const k = Math.max(0, kreditbetrag)
  return (
    k * (saetze.kreditvertragserstellungPct / 100)
    + k * (saetze.pfandrechtPct / 100) * (1 + saetze.nebengebuehrensicherstellungPct / 100)
    + saetze.sonstigeKreditNK
  )
}

/**
 * Lineare AfA ohne die Anlaufbeschleunigung aus § 8 Abs. 1a EStG — für den Immobilien-Bestand
 * (Sammelposten), der schon vor dem Simulationsstart angeschafft wurde; eine etwaige
 * beschleunigte Anfangsphase liegt für ihn bereits in der Vergangenheit.
 */
export function berechneAfaJahreLinear(
  bemessungsgrundlage: number, afaSatzPct: number, jahre: number, bereitsAbgeschriebenJahre = 0
): AfaJahr[] {
  const basis = Math.max(0, bemessungsgrundlage)
  const satz = Math.max(0, afaSatzPct) / 100
  const n = Math.max(0, Math.round(jahre))
  const ergebnisse: AfaJahr[] = []
  // Für einen Bestand, der schon vor Simulationsstart abgeschrieben wurde, startet die Serie
  // nicht bei 0, sondern bereits um die schon verbrauchten Jahre reduziert.
  let kumuliert = Math.min(basis, basis * satz * Math.max(0, bereitsAbgeschriebenJahre))
  for (let j = 1; j <= n; j++) {
    const afa = Math.max(0, Math.min(basis * satz, basis - kumuliert))
    kumuliert += afa
    ergebnisse.push({ jahr: j, faktor: 1, afa, afaKumuliert: kumuliert })
  }
  return ergebnisse
}

/**
 * Rechnet aus Restschuld, Monatsrate und Restlaufzeit eines bestehenden Kredits den
 * (nominellen, monatlich × 12) Zinssatz zurück — per Bisection auf die Annuitäten-
 * Barwertformel, analog zu effektivzinsPct() in kredit.ts. Wird für den Bestands-Sammelposten
 * gebraucht, der keinen eigenen Zinssatz-Input hat.
 */
export function berechneImpliziterZinssatzPct(restschuld: number, rate: number, restMonate: number): number {
  const K = Math.max(0, restschuld)
  const n = Math.max(0, Math.round(restMonate))
  if (K <= 0 || rate <= 0 || n <= 0 || rate * n <= K) return 0

  const barwert = (iMonat: number): number => {
    if (iMonat === 0) return rate * n
    return (rate * (1 - Math.pow(1 + iMonat, -n))) / iMonat
  }

  let lo = 0
  let hi = 1
  while (barwert(hi) > K && hi < 10) hi *= 2
  for (let iter = 0; iter < 80; iter++) {
    const mid = (lo + hi) / 2
    if (barwert(mid) > K) lo = mid
    else hi = mid
  }
  return ((lo + hi) / 2) * 12 * 100
}

/**
 * IRR der Eigenmittel-Zahlungsreihe: −Starteigenmittel, jeden Monat −Sparbetrag, am Ende
 * +Nettovermögen. Bisection auf den Kapitalwert (NPV), analog effektivzinsPct() in kredit.ts.
 * Gibt null zurück, wenn kein Kapital eingesetzt wurde oder sich kein Vorzeichenwechsel im
 * Suchintervall findet (degenerierter Fall).
 */
export function berechnePortfolioIrrPct(
  eigenmittel: number, sparbetragMonat: number, monate: number, nettovermoegenEnde: number
): number | null {
  const n = Math.round(monate)
  if (n <= 0 || (eigenmittel <= 0 && sparbetragMonat <= 0)) return null

  const npv = (iMonat: number): number => {
    let summe = -eigenmittel
    for (let m = 1; m <= n; m++) {
      let cf = -sparbetragMonat
      if (m === n) cf += nettovermoegenEnde
      summe += cf / Math.pow(1 + iMonat, m)
    }
    return summe
  }

  // Suchintervall bewusst eng: (1+i)^-m mit m bis zu 480 (40 Jahre) kippt bei extrem negativem
  // i (z. B. −0,99/Monat) in double-Arithmetik nach Infinity/NaN und lässt die Bisection
  // entgleisen. −50 %/Monat ist schon jenseits jeder realistischen Verlustrate und bleibt
  // dabei sicher innerhalb des double-Wertebereichs.
  const lo0 = -0.5
  const hi0 = 5
  const npvLo0 = npv(lo0)
  const npvHi0 = npv(hi0)
  if (!Number.isFinite(npvLo0) || !Number.isFinite(npvHi0) || npvLo0 * npvHi0 > 0) return null

  let lo = lo0
  let hi = hi0
  for (let iter = 0; iter < 200; iter++) {
    const mid = (lo + hi) / 2
    if (npvLo0 * npv(mid) <= 0) hi = mid
    else lo = mid
  }
  const iMonat = (lo + hi) / 2
  return (Math.pow(1 + iMonat, 12) - 1) * 100
}

function mieteStartWert(eingabe: ImmoPortfolioEingabe, kaufMonat: number): number {
  const basis = eingabe.mietModus === "proM2"
    ? eingabe.mietpreisProM2 * eingabe.wohnflaecheM2
    : eingabe.mieteMonat
  // Befristungsabschlag (in der Praxis üblich ~25 % bei befristeten MRG-Mietverträgen) gilt für
  // jeden künftigen Kauf, nicht rückwirkend für den Bestand (dessen Miete bereits real vereinbart ist).
  const befristungsfaktor = eingabe.befristet ? 0.75 : 1
  return basis * befristungsfaktor * Math.pow(1 + eingabe.indexierungPct / 100, kaufMonat / 12)
}

interface Kaufbedarf {
  referenzKaufpreis: number
  kreditbetrag: number
  kreditNKSumme: number
  /** Nur die Kaufnebenkosten (Grunderwerbsteuer, Grundbuch, Vertragserrichtung, ggf. Makler) —
   *  ohne Kreditnebenkosten. Anschaffungskosten für AfA-Basis und ImmoESt. */
  kaufNKSumme: number
  eigenmittelbedarf: number
}

/** Kreditnebenkosten, wenn sie selbst mitfinanziert werden — dieselbe Zirkularität wie in
 *  berechneKreditbetrag() (kredit.ts): die NK sind ein %-Satz DER KREDITSUMME, die NK selbst
 *  stecken aber mit im Kredit. Exakt aufgelöst (nicht angenähert), analog zu kredit.ts:111-137:
 *    L = kreditbetrag + (r*L + F)  =>  L = (kreditbetrag + F) / (1 − r)
 *  kreditNKSumme = L − kreditbetrag. */
function berechneKreditNebenkostenSummeMitfinanziert(kreditbetrag: number, saetze: KreditSaetze): number {
  const k = Math.max(0, kreditbetrag)
  const r = saetze.kreditvertragserstellungPct / 100
    + (saetze.pfandrechtPct / 100) * (1 + saetze.nebengebuehrensicherstellungPct / 100)
  if (r >= 1) return 0 // wie in kredit.ts: bei absurd hohen Sätzen nicht auflösbar
  return (k * r + saetze.sonstigeKreditNK) / (1 - r)
}

/** Finanzierungsbedarf eines Kaufs zum aktuellen Referenzkaufpreis (wächst mit dem Wertzuwachs
 *  mit) — reine Berechnung ohne Seiteneffekt, damit sie in der Kaufschleife pro Objekt neu
 *  aufgerufen werden kann. */
function berechneKaufbedarf(eingabe: ImmoPortfolioEingabe, saetze: KreditSaetze, monat: number): Kaufbedarf {
  const referenzKaufpreis = Math.max(0, eingabe.kaufpreisReferenz) * Math.pow(1 + eingabe.wertzuwachsPct / 100, monat / 12)
  const kreditbetrag = referenzKaufpreis * (eingabe.ltvKaufPct / 100)
  const kaufNK = berechneKaufnebenkosten(referenzKaufpreis, eingabe.mitMakler, saetze)
  const kreditNKSumme = eingabe.nkMitfinanziert
    ? berechneKreditNebenkostenSummeMitfinanziert(kreditbetrag, saetze)
    : berechneKreditNebenkostenSumme(kreditbetrag, saetze)
  const eigenmittelbedarf = referenzKaufpreis - kreditbetrag + kaufNK.summe + (eingabe.nkMitfinanziert ? 0 : kreditNKSumme)
  return { referenzKaufpreis, kreditbetrag, kreditNKSumme, kaufNKSumme: kaufNK.summe, eigenmittelbedarf }
}

/** Steuereffekt aus dem jährlichen steuerErgebnis: ein Verlust erzeugt eine Gutschrift zum
 *  Grenzsteuersatz, ein Gewinn eine Nachzahlung. Die Gutschrift ist gedeckelt auf die grob
 *  überschlägige Steuer, die auf das übrige (Netto-)Einkommen überhaupt anfallen kann — eine
 *  Vermietungsverlust-Gutschrift kann real nie mehr Steuer zurückholen, als auf das sonstige
 *  Einkommen entrichtet wurde. Grobe Näherung, keine echte Veranlagungssimulation. */
function berechneSteuerEffekt(steuerErgebnis: number, eingabe: ImmoPortfolioEingabe): number {
  const rohEffekt = -steuerErgebnis * (eingabe.grenzsteuersatzPct / 100)
  if (rohEffekt <= 0) return rohEffekt
  const maxGutschrift = Math.max(0, eingabe.nettoeinkommenMonat) * 12 * (eingabe.grenzsteuersatzPct / 100)
  return Math.min(rohEffekt, maxGutschrift)
}

function bewirtschaftungskostenMonat(eingabe: ImmoPortfolioEingabe, obj: ObjektZustand): number {
  if (obj.istBestand) {
    return eingabe.bestandAnzahl * (eingabe.hausverwaltungMonat + eingabe.sonstigeKostenMonat)
  }
  return eingabe.hausverwaltungMonat + eingabe.instandhaltungProM2Monat * obj.wohnflaecheM2 + eingabe.sonstigeKostenMonat
}

/** Monatlicher operativer Cashflow eines einzelnen Objekts (Miete − Kosten − Kreditrate), mit dem
 *  jeweils AKTUELLEN Zustand des Objekts (insb. obj.rate) — wird sowohl bei der Kaufsperre als
 *  auch bei der Umschuldungssperre gebraucht, um die Auswirkung auf das Resteinkommen zu prüfen. */
function objektMonatscashflow(eingabe: ImmoPortfolioEingabe, obj: ObjektZustand): number {
  return obj.mieteMonat * (1 - eingabe.leerstandPct / 100) - bewirtschaftungskostenMonat(eingabe, obj) - obj.rate
}

/** Simuliert den Portfolioaufbau Monat für Monat über den gewählten Horizont. */
export function simuliereImmoPortfolio(eingabe: ImmoPortfolioEingabe): ImmoPortfolioErgebnis {
  const saetze = eingabe.saetze ?? KREDIT_DEFAULTS
  const horizontJahre = Math.max(1, Math.round(eingabe.horizontJahre))
  const monateGesamt = horizontJahre * 12

  let liquiditaet = Math.max(0, eingabe.eigenmittel)
  let topfUmschuldung = 0
  let topfSparen = liquiditaet
  const eigenmittelStart = liquiditaet

  const objekte: ObjektZustand[] = []
  let naechsteObjektId = 0

  if (eingabe.bestandAnzahl > 0) {
    // AfA-Basis sind die historischen Anschaffungskosten, NICHT der (typischerweise höhere)
    // heutige Verkehrswert (A5) — sonst wird die AfA auf einen bereits eingetretenen
    // Wertzuwachs berechnet, der niemals Anschaffungskosten war.
    const anschaffungskosten = Math.max(0, eingabe.bestandAnschaffungskosten)
    const afaBasis = berechneAfaBemessungsgrundlage(anschaffungskosten, eingabe.gebaeudeanteilPct)
    objekte.push({
      id: naechsteObjektId++,
      istBestand: true,
      kaufMonat: 0,
      kaufJahrIndex: 1,
      kaufpreis: Math.max(0, eingabe.bestandWert),
      wohnflaecheM2: 0,
      verkehrswert: Math.max(0, eingabe.bestandWert),
      restschuld: Math.max(0, eingabe.bestandRestschuld),
      rate: Math.max(0, eingabe.bestandRateMonat),
      zinsPct: berechneImpliziterZinssatzPct(
        eingabe.bestandRestschuld, eingabe.bestandRateMonat, eingabe.bestandRestlaufzeitJahre * 12
      ),
      restMonate: Math.max(0, Math.round(eingabe.bestandRestlaufzeitJahre * 12)),
      afaBasis,
      afaSerie: berechneAfaJahreLinear(afaBasis, eingabe.afaSatzPct, horizontJahre + 1, eingabe.bestandAfaJahreVerbraucht),
      afaKumuliert: 0,
      mieteMonat: Math.max(0, eingabe.bestandMieteMonat),
      letzteUmschuldungMonat: 0,
      anschaffungskostenGesamt: anschaffungskosten,
      eigenSteuerErgebnisKumuliert: 0,
      liebhabereiGeprueft: false,
    })
  }

  const jahre: ImmoJahr[] = []
  const kaeufe: ImmoKauf[] = []
  const umschuldungen: ImmoUmschuldung[] = []
  const liebhabereiWarnungen: string[] = []

  let mieteJahr = 0, kostenJahr = 0, zinsenJahr = 0, tilgungJahr = 0, rateJahr = 0
  let eigenmitteleinsatzJahr = 0
  let eigenmitteleinsatzKumuliert = 0
  let geldbeschaffungskostenJahr = 0
  let nachschussJahr = 0
  let nachschussKumuliert = 0

  // Negative Liquidität ist nicht zulässig (kein Kontoüberziehungs-Modell): Würde ein laufender
  // Cashflow-Fehlbetrag oder eine Steuernachzahlung die Liquidität unter 0 drücken, wird der
  // Fehlbetrag stattdessen sofort aus dem Nettoeinkommen zugeschossen (genau die Annahme, die die
  // mindestResteinkommenMonat-Sperre ohnehin schon für Käufe/Umschuldungen trifft — hier wird sie
  // auf JEDEN Monat angewendet, nicht nur auf neue Käufe). Der Zuschuss fließt in topfSparen, damit
  // topfUmschuldung + topfSparen === liquiditaet erhalten bleibt (A3), und wird kumuliert
  // ausgewiesen (nachschussKumuliert), damit er nicht unsichtbar in den Zahlen verschwindet.
  const deckeLiquiditaetNichtNegativ = () => {
    if (liquiditaet >= 0) return
    const nachschuss = -liquiditaet
    liquiditaet = 0
    topfSparen += nachschuss
    nachschussJahr += nachschuss
    nachschussKumuliert += nachschuss
  }

  for (let monat = 1; monat <= monateGesamt; monat++) {
    // 1) Guthabenzinsen auf die vorhandene Liquidität, anteilig auf die beiden Töpfe verteilt (A3)
    //    — die Summe aus topfUmschuldung + topfSparen bleibt dabei exakt gleich liquiditaet.
    const zinsBasis = Math.max(0, liquiditaet)
    const guthabenzinsBrutto = zinsBasis * (eingabe.guthabenzinsPct / 100 / 12)
    // KESt (25 % auf Geldeinlagen, § 27a Abs. 1 Z 1 EStG) wird von der Bank direkt einbehalten (E2).
    const guthabenzinsNetto = guthabenzinsBrutto * (1 - IMMO_KEST_PCT / 100)
    liquiditaet += guthabenzinsNetto
    if (zinsBasis > 0) {
      const anteilUmschuldung = Math.max(0, topfUmschuldung) / zinsBasis
      const zinsUmschuldungsTopf = guthabenzinsNetto * anteilUmschuldung
      topfUmschuldung += zinsUmschuldungsTopf
      topfSparen += guthabenzinsNetto - zinsUmschuldungsTopf
    } else {
      topfSparen += guthabenzinsNetto
    }

    // 2) Sparbetrag.
    liquiditaet += eingabe.sparbetragMonat
    topfSparen += eingabe.sparbetragMonat

    // 3) Je Objekt: Kredit tilgen, Wert fortschreiben, Miete/Kosten verrechnen.
    for (const obj of objekte) {
      const zins = obj.restMonate > 0 ? obj.restschuld * (obj.zinsPct / 100 / 12) : 0
      let tilgung = obj.restMonate > 0 ? obj.rate - zins : 0
      if (tilgung > obj.restschuld) tilgung = obj.restschuld
      if (tilgung < 0) tilgung = 0
      obj.restschuld = Math.max(0, obj.restschuld - tilgung)
      obj.restMonate = Math.max(0, obj.restMonate - 1)
      // Nur einen verschwindend kleinen Rundungsrest hart auf 0 setzen (A2) — bei einer sauber
      // aus der Annuitätenformel abgeleiteten Rate amortisiert der Kredit exakt auf 0, bis auf
      // Fließkomma-Rauschen. Ist die (z. B. beim Bestand frei eingegebene) Rate dagegen zu
      // niedrig, um die Restschuld in der Restlaufzeit tatsächlich zu tilgen, bleibt eine echte
      // Restschuld bestehen, statt sie unrealistisch verschwinden zu lassen.
      if (obj.restMonate === 0 && obj.restschuld < 0.01) obj.restschuld = 0

      obj.verkehrswert *= Math.pow(1 + eingabe.wertzuwachsPct / 100, 1 / 12)

      const effektiveMiete = obj.mieteMonat * (1 - eingabe.leerstandPct / 100)
      const kosten = bewirtschaftungskostenMonat(eingabe, obj)
      const rateGezahlt = zins + tilgung

      mieteJahr += effektiveMiete
      kostenJahr += kosten
      zinsenJahr += zins
      tilgungJahr += tilgung
      rateJahr += rateGezahlt
      obj.eigenSteuerErgebnisKumuliert += effektiveMiete - kosten - zins

      const cashflow = effektiveMiete - kosten - rateGezahlt
      liquiditaet += cashflow
      topfSparen += cashflow
    }
    deckeLiquiditaetNichtNegativ()

    let afaGesamtJahr = 0
    if (monat % 12 === 0) {
      const jahrIndex = monat / 12

      // Mietindexierung fürs neue Jahr.
      for (const obj of objekte) obj.mieteMonat *= 1 + eingabe.indexierungPct / 100

      // AfA je Objekt aus der beim Kauf vorberechneten Serie.
      for (const obj of objekte) {
        const jahreSeitKauf = jahrIndex - obj.kaufJahrIndex + 1
        const afa = jahreSeitKauf >= 1 ? (obj.afaSerie[jahreSeitKauf - 1]?.afa ?? 0) : 0
        obj.afaKumuliert += afa
        obj.eigenSteuerErgebnisKumuliert -= afa
        afaGesamtJahr += afa
      }

      // Liebhaberei wird je Einkunftsquelle beurteilt (je Objekt), nicht im Portfolio-Saldo, und
      // die "kleine Vermietung" (Eigentumswohnung, § 1 Abs. 2 Z 3 LVO) muss den Gesamtüberschuss
      // innerhalb von 20 Jahren erzielen (E3) — jedes Objekt wird genau einmal, 20 Jahre nach
      // seinem eigenen Kaufmonat, geprüft.
      for (const obj of objekte) {
        if (monat - obj.kaufMonat === 240 && !obj.liebhabereiGeprueft) {
          obj.liebhabereiGeprueft = true
          if (obj.eigenSteuerErgebnisKumuliert < 0) {
            liebhabereiWarnungen.push(obj.istBestand ? "Bestand" : `Kauf aus Jahr ${obj.kaufJahrIndex}`)
          }
        }
      }

      const steuerErgebnis = mieteJahr - kostenJahr - zinsenJahr - afaGesamtJahr - geldbeschaffungskostenJahr
      const steuerEffekt = berechneSteuerEffekt(steuerErgebnis, eingabe)
      liquiditaet += steuerEffekt
      topfSparen += steuerEffekt
      deckeLiquiditaetNichtNegativ()

      // Umschuldung: alle `umschuldungAlleJahre` Jahre, wenn der beleihbare Wert die
      // Restschuld übersteigt.
      for (const obj of objekte) {
        const monateSeitLetzter = monat - obj.letzteUmschuldungMonat
        if (monateSeitLetzter < eingabe.umschuldungAlleJahre * 12) continue
        const beleihbar = obj.verkehrswert * (eingabe.beleihungUmschuldungPct / 100)
        if (beleihbar <= obj.restschuld) continue

        const kosten = berechneKreditNebenkostenSumme(beleihbar, saetze)
        const auszahlung = beleihbar - obj.restschuld - kosten
        if (auszahlung <= 0) continue

        // Harte Sperre: Eine Umschuldung, die die Kreditrate dieses Objekts so weit erhöht, dass
        // das Resteinkommen unter die Mindestgrenze fällt, findet nicht statt — die Wohnung bleibt
        // beim alten (kleineren) Kredit, die Umschuldung wird im nächsten Turnus erneut versucht.
        // Ohne diese Sperre reißt eine Welle gleichzeitiger 100%-Umschuldungen (jede erhöht die
        // Rate spürbar, weil sie den vollen aktuellen Verkehrswert neu finanziert) die
        // Haushaltsrechnung erst, NACHDEM längst weitere Käufe auf Basis der alten, niedrigeren
        // Raten getätigt wurden.
        const planNeu = berechneTilgungsplan(beleihbar, obj.zinsPct, eingabe.laufzeitJahre)
        const cashflowAktuell = objekte.reduce((s, o) => s + objektMonatscashflow(eingabe, o), 0)
        // obj.rate steckt aktuell noch mit NEGATIVEM Vorzeichen in cashflowAktuell (siehe
        // objektMonatscashflow: "... - obj.rate"). Um die alte Rate herauszurechnen und die neue
        // einzusetzen, wird sie deshalb ADDIERT (nicht subtrahiert) und die neue abgezogen.
        const cashflowNachUmschuldung = cashflowAktuell + obj.rate - planNeu.rate
        const defizitNachUmschuldung = Math.max(0, -cashflowNachUmschuldung)
        if (eingabe.nettoeinkommenMonat - defizitNachUmschuldung < eingabe.mindestResteinkommenMonat) continue

        umschuldungen.push({
          objektId: obj.id, monat, jahr: jahrIndex, verkehrswert: obj.verkehrswert,
          restschuldAlt: obj.restschuld, restschuldNeu: beleihbar, kosten, auszahlung,
        })
        // Geldbeschaffungskosten der Umschuldung sind Werbungskosten (B3) — fließen (mangels
        // eines wirklich verursachungsgerechten Zeitpunkts) ins selbe Jahr wie die Umschuldung.
        geldbeschaffungskostenJahr += kosten

        liquiditaet += auszahlung
        topfUmschuldung += auszahlung
        obj.restschuld = beleihbar
        obj.rate = planNeu.rate
        obj.restMonate = eingabe.laufzeitJahre * 12
        obj.letzteUmschuldungMonat = monat
      }
    }

    // 4) Kaufprüfung — jeden Monat, sobald genug Kapital für einen weiteren Kauf da ist (keine
    //    künstliche Mindestpause zwischen Käufen mehr: gekauft wird, sobald es sich ausgeht).
    //    Reicht die Liquidität für mehr als eine Wohnung, werden auch mehrere im selben Monat
    //    gekauft (z. B. ein Zinshaus mit mehreren Einheiten) — sonst würde weiter angespartes
    //    Eigenkapital neben den "gratis" laufenden Umschuldungskäufen ungenutzt liegen bleiben.
    //    Die beiden Kapitalquellen
    //    werden dafür bewusst NICHT in einen gemeinsamen Topf geworfen: Würde jeder Kauf zuerst
    //    den (bei hoher Beleihung schnell wachsenden) Umschuldungs-Topf leeren, bevor je ein Cent
    //    Eigenmittel angerührt wird, bliebe laufend Ersparnis liegen, sobald der Umschuldungs-Topf
    //    dauerhaft für sich allein reicht — genau das monatliche Sparen soll aber zusätzliche,
    //    nicht mehr "gratis" finanzierte Wohnungen ermöglichen.
    // Sanity-Untergrenze für den Referenzkaufpreis: Unter KAUFPREIS_MINDESTGRENZE ist kein
    // realistischer Wohnungskauf mehr abgebildet, UND es drohen numerische Ausreißer — bei nicht
    // mitfinanzierten Kreditnebenkosten (fixer €-Betrag, unabhängig vom Kaufpreis) kann bei einem
    // sehr niedrigen (nicht nur exakt 0) Kaufpreis ein positiver, aber nahezu konstanter
    // Eigenmittelbedarf entstehen: Die Kaufschleifen würden dann faktisch unbegrenzt viele
    // Wohnungen zu diesem Minimalpreis kaufen, die trotzdem volle (kaufpreisunabhängige) Miete
    // abwerfen — ein Rückkopplungseffekt, der die Simulation zum Einfrieren bringt. Ohne
    // Umschuldung/Käufe unterhalb der Grenze läuft die Simulation weiter (Sparen, Guthabenzinsen,
    // Bestand), nur eben ohne neue Käufe.
    if (berechneKaufbedarf(eingabe, saetze, monat).referenzKaufpreis > KAUFPREIS_MINDESTGRENZE) {
      // Harte Kaufsperre: Ein cashflow-negatives Portfolio ist für sich genommen kein Problem
      // (z. B. Miete 500 €, Rate 520 €) — der Fehlbetrag wird faktisch von der Sparquote
      // aufgefangen. Kritisch wird es erst, wenn dieser Fehlbetrag so groß wird, dass er vom
      // Nettoeinkommen abgezogen weniger als mindestResteinkommenMonat übrig lässt. Bewusst keine
      // DSTI-%-Grenze, sondern ein Absolutbetrag vom Gehalt.
      const resteinkommenMitObjekt = (zusaetzlich: ObjektZustand): number => {
        const cashflowGesamt = objekte.reduce((s, o) => s + objektMonatscashflow(eingabe, o), 0)
          + objektMonatscashflow(eingabe, zusaetzlich)
        const portfolioDefizit = Math.max(0, -cashflowGesamt)
        return eingabe.nettoeinkommenMonat - portfolioDefizit
      }

      const fuehreKaufDurch = (bedarf: Kaufbedarf, ausUmschuldung: number): boolean => {
        const { referenzKaufpreis, kreditbetrag, kreditNKSumme, kaufNKSumme, eigenmittelbedarf } = bedarf
        const kreditGesamt = kreditbetrag + (eingabe.nkMitfinanziert ? kreditNKSumme : 0)
        const plan = berechneTilgungsplan(kreditGesamt, eingabe.zinssatzPct, eingabe.laufzeitJahre)
        // Ein im Dezember gekauftes Objekt existiert beim Jahresend-AfA-Block DIESES Jahres noch
        // nicht (der läuft vor der Kaufprüfung) — sein "Jahr 1" der beschleunigten AfA (Faktor 3)
        // ist daher erst das nächste Kalenderjahr, sonst würde dieser Eintrag der Serie komplett
        // übersprungen (A1).
        const kaufJahrIndex = monat % 12 === 0 ? monat / 12 + 1 : Math.ceil(monat / 12)
        // Anschaffungskosten inkl. Kaufnebenkosten (Grunderwerbsteuer, Grundbuch, Vertragserrichtung,
        // ggf. Makler) sind Teil der AfA-Basis (B2) und der ImmoESt-Basis bei einem Verkauf.
        const anschaffungskostenGesamt = referenzKaufpreis + kaufNKSumme
        const afaBasis = berechneAfaBemessungsgrundlage(anschaffungskostenGesamt, eingabe.gebaeudeanteilPct)
        const mieteStart = mieteStartWert(eingabe, monat)

        const neuesObjekt: ObjektZustand = {
          id: -1,
          istBestand: false,
          kaufMonat: monat,
          kaufJahrIndex,
          kaufpreis: referenzKaufpreis,
          wohnflaecheM2: eingabe.wohnflaecheM2,
          verkehrswert: referenzKaufpreis,
          restschuld: kreditGesamt,
          rate: plan.rate,
          zinsPct: eingabe.zinssatzPct,
          restMonate: eingabe.laufzeitJahre * 12,
          afaBasis,
          afaSerie: berechneAfaJahre(afaBasis, eingabe.afaSatzPct, Math.max(1, horizontJahre - kaufJahrIndex + 2)),
          afaKumuliert: 0,
          mieteMonat: mieteStart,
          letzteUmschuldungMonat: monat,
          anschaffungskostenGesamt,
          eigenSteuerErgebnisKumuliert: 0,
          liebhabereiGeprueft: false,
        }

        if (resteinkommenMitObjekt(neuesObjekt) < eingabe.mindestResteinkommenMonat) return false

        topfUmschuldung -= ausUmschuldung
        topfSparen -= (eigenmittelbedarf - ausUmschuldung)
        liquiditaet -= eigenmittelbedarf
        // Geldbeschaffungskosten des Kredits sind Werbungskosten (B3) — unabhängig davon, ob sie
        // bar bezahlt oder mitfinanziert wurden (das betrifft nur den Cashflow, nicht den
        // steuerlichen Abzugszeitpunkt).
        geldbeschaffungskostenJahr += kreditNKSumme

        const gratisAnteilPct = (ausUmschuldung / eigenmittelbedarf) * 100
        const istGratis = gratisAnteilPct >= 99.9
        const eigenmittelAnteil = eigenmittelbedarf - ausUmschuldung
        eigenmitteleinsatzJahr += eigenmittelAnteil
        eigenmitteleinsatzKumuliert += eigenmittelAnteil

        neuesObjekt.id = naechsteObjektId++
        objekte.push(neuesObjekt)

        kaeufe.push({
          objektId: neuesObjekt.id, monat, jahr: Math.ceil(monat / 12), kaufpreis: referenzKaufpreis,
          eigenmittelbedarf, ausUmschuldung, eigenmittelAnteil, gratisAnteilPct, istGratis, rate: plan.rate,
          anfangsmiete: mieteStart, bruttomietrenditePct: referenzKaufpreis > 0 ? (mieteStart * 12 / referenzKaufpreis) * 100 : 0,
          afaJahr1: neuesObjekt.afaSerie[0]?.afa ?? 0,
        })
        return true
      }

      // Phase 1: so lange weiterkaufen, wie der Umschuldungs-Topf allein je einen Kauf komplett
      // trägt (gratis finanziert).
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const bedarf = berechneKaufbedarf(eingabe, saetze, monat)
        if (!(bedarf.eigenmittelbedarf > 0) || topfUmschuldung < bedarf.eigenmittelbedarf) break
        if (!fuehreKaufDurch(bedarf, bedarf.eigenmittelbedarf)) break
      }

      // Phase 2: unabhängig davon so lange weiterkaufen, wie der Spar-Topf (angespartes
      // Eigenkapital aus Sparbetrag + Mietüberschüssen) allein je einen weiteren Kauf trägt —
      // das ist der Teil, der laufendes Sparen tatsächlich in zusätzliche Wohnungen umsetzt,
      // statt es neben den Umschuldungskäufen ungenutzt anwachsen zu lassen.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const bedarf = berechneKaufbedarf(eingabe, saetze, monat)
        if (!(bedarf.eigenmittelbedarf > 0) || topfSparen < bedarf.eigenmittelbedarf) break
        if (!fuehreKaufDurch(bedarf, 0)) break
      }

      // Phase 3: reicht keiner der beiden Töpfe mehr allein, aber beide zusammen noch für einen
      // weiteren Kauf, wird dieser gemischt finanziert (Rest aus Umschuldung + Rest aus Sparen) —
      // das bildet die "95 % Umschuldung"-Übergangskäufe ab.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const bedarf = berechneKaufbedarf(eingabe, saetze, monat)
        if (!(bedarf.eigenmittelbedarf > 0) || liquiditaet < bedarf.eigenmittelbedarf) break
        const ausUmschuldung = Math.min(Math.max(0, topfUmschuldung), bedarf.eigenmittelbedarf)
        if (!fuehreKaufDurch(bedarf, ausUmschuldung)) break
      }
    }

    // 5) Jahresschnappschuss (immer nach der Kaufprüfung, damit ein Kauf im Dezember schon
    //    im selben Jahresergebnis aufscheint).
    if (monat % 12 === 0) {
      const portfolioWert = objekte.reduce((s, o) => s + o.verkehrswert, 0)
      const restschuldGesamt = objekte.reduce((s, o) => s + o.restschuld, 0)
      const nettovermoegen = portfolioWert - restschuldGesamt + liquiditaet
      // ImmoESt (30 %, § 30a EStG) auf einen GEDACHTEN Verkauf ALLER Objekte zu diesem Zeitpunkt —
      // Basis je Objekt: Verkehrswert − Anschaffungskosten inkl. AK-NK + kumulierte AfA (B6/E8).
      // Vereinfachung: keine 4,2 %-Altvermögens-Pauschale, kein gewerblicher Grundstückshandel.
      const immoEstGesamt = objekte.reduce(
        (s, o) => s + Math.max(0, o.verkehrswert - o.anschaffungskostenGesamt + o.afaKumuliert) * (IMMOEST_PCT / 100), 0
      )
      const nettovermoegenNachSteuer = nettovermoegen - immoEstGesamt
      // Wohnungszählung: der Bestand ist EIN Sammelposten-Objekt, steht aber für bestandAnzahl
      // tatsächliche Wohnungen (C1) — sonst widerspricht die Stückzahl dem vollen Portfolio-Wert.
      const anzahlObjekte = objekte.reduce((s, o) => s + (o.istBestand ? eingabe.bestandAnzahl : 1), 0)
      const einkommensbasis = eingabe.nettoeinkommenMonat + 0.8 * (mieteJahr / 12)

      const steuerErgebnisJahr = mieteJahr - kostenJahr - zinsenJahr - afaGesamtJahr - geldbeschaffungskostenJahr
      const steuerEffektJahr = berechneSteuerEffekt(steuerErgebnisJahr, eingabe)

      jahre.push({
        jahr: monat / 12,
        anzahlObjekte,
        portfolioWert, restschuldGesamt, liquiditaet, nettovermoegen, nettovermoegenNachSteuer,
        mieteinnahmen: mieteJahr,
        bewirtschaftungskosten: kostenJahr,
        kreditratenGesamt: rateJahr,
        zinsenGesamt: zinsenJahr,
        tilgungGesamt: tilgungJahr,
        afaGesamt: afaGesamtJahr,
        steuerErgebnis: steuerErgebnisJahr,
        steuerEffekt: steuerEffektJahr,
        cashflowNetto: mieteJahr - kostenJahr - rateJahr + steuerEffektJahr,
        ltvPct: portfolioWert > 0 ? (restschuldGesamt / portfolioWert) * 100 : 0,
        dstiPct: einkommensbasis > 0 ? (rateJahr / 12 / einkommensbasis) * 100 : 0,
        eigenmitteleinsatzKauf: eigenmitteleinsatzJahr,
        eigenmitteleinsatzKumuliert,
        liquiditaetsNachschuss: nachschussJahr,
        liquiditaetsNachschussKumuliert: nachschussKumuliert,
      })
      mieteJahr = 0; kostenJahr = 0; zinsenJahr = 0; tilgungJahr = 0; rateJahr = 0
      eigenmitteleinsatzJahr = 0; geldbeschaffungskostenJahr = 0; nachschussJahr = 0
    }
  }

  // Meilensteine alle 5 Jahre bis zum Horizont, plus der Horizont selbst (falls kein Vielfaches
  // von 5) — fix auf 10/15/20 wäre bei einem 35-Jahres-Horizont irreführend gewesen: die
  // Kopf-KPIs und die Kauf-Timeline zeigen den vollen Zeitraum, die Meilensteine sonst nicht.
  const meilensteinJahre = Array.from(new Set(
    [5, 10, 15, 20, 25, 30, 35, 40].filter((j) => j <= horizontJahre).concat(horizontJahre)
  )).sort((a, b) => a - b)

  const meilensteine: ImmoMeilenstein[] = meilensteinJahre
    .map((zielJahr) => {
      const j = jahre[zielJahr - 1]
      return {
        jahr: zielJahr,
        anzahlObjekte: j.anzahlObjekte,
        davonGratis: kaeufe.filter((k) => k.istGratis && k.jahr <= zielJahr).length,
        portfolioWert: j.portfolioWert,
        restschuldGesamt: j.restschuldGesamt,
        nettovermoegen: j.nettovermoegen,
        nettovermoegenNachSteuer: j.nettovermoegenNachSteuer,
        jahresmiete: j.mieteinnahmen,
        jahresAfa: j.afaGesamt,
        jahresCashflow: j.cashflowNetto,
      }
    })

  const letztesJahr = jahre[jahre.length - 1]
  // Bruttomietrendite bezogen auf den AKTUELLEN Portfolio-Verkehrswert (nicht auf die Summe der
  // historischen, nominalen Kaufpreise, C2) — Zähler und Nenner sind damit konsistent zum selben
  // Zeitpunkt, statt eine mit Indexierung/Wertzuwachs über Jahrzehnte gewachsene Miete durch einen
  // eingefrorenen historischen Kaufpreis zu teilen.
  const bruttomietrenditeSchnittPct = letztesJahr.portfolioWert > 0
    ? (letztesJahr.mieteinnahmen / letztesJahr.portfolioWert) * 100 : 0
  const nettomietrenditeSchnittPct = letztesJahr.portfolioWert > 0
    ? ((letztesJahr.mieteinnahmen - letztesJahr.bewirtschaftungskosten) / letztesJahr.portfolioWert) * 100 : 0

  const eigenmittelGesamt = eigenmittelStart + eingabe.sparbetragMonat * monateGesamt
  const eigenkapitalrenditePct = eigenmittelGesamt > 0
    ? ((letztesJahr.nettovermoegen - eigenmittelGesamt) / eigenmittelGesamt) * 100
    : 0
  const eigenkapitalrenditeNachSteuerPct = eigenmittelGesamt > 0
    ? ((letztesJahr.nettovermoegenNachSteuer - eigenmittelGesamt) / eigenmittelGesamt) * 100
    : 0

  const irrPct = berechnePortfolioIrrPct(eigenmittelStart, eingabe.sparbetragMonat, monateGesamt, letztesJahr.nettovermoegen)
  const irrNachSteuerPct = berechnePortfolioIrrPct(
    eigenmittelStart, eingabe.sparbetragMonat, monateGesamt, letztesJahr.nettovermoegenNachSteuer
  )

  // Cashflow-Breakeven: erstes Jahr, in dem die kumulierte operative Nettocashflow (inkl.
  // Steuereffekt) die Summe aus Start-Eigenmitteln und allen seither aus eigener Tasche
  // finanzierten Kaufanteilen übersteigt (C3) — vorher wurde nur bei 0 gestartet, ohne das
  // eingesetzte Kapital zu berücksichtigen, wodurch fast immer "Jahr 1" gemeldet wurde.
  let kumCashflow = 0
  let kumEigenmitteleinsatz = eigenmittelStart
  let breakEvenJahr: number | null = null
  for (const j of jahre) {
    kumCashflow += j.cashflowNetto
    kumEigenmitteleinsatz += j.eigenmitteleinsatzKauf
    if (kumCashflow >= kumEigenmitteleinsatz && breakEvenJahr === null) breakEvenJahr = j.jahr
  }

  const anzahlGratis = kaeufe.filter((k) => k.istGratis).length
  const ausUmschuldungGesamt = kaeufe.reduce((s, k) => s + k.ausUmschuldung, 0)
  const eigenmittelbedarfGesamt = kaeufe.reduce((s, k) => s + k.eigenmittelbedarf, 0)
  const umschuldungsAnteilGesamtPct = eigenmittelbedarfGesamt > 0
    ? (ausUmschuldungGesamt / eigenmittelbedarfGesamt) * 100 : 0
  const gratisAequivalentAnzahl = kaeufe.reduce((s, k) => s + k.gratisAnteilPct / 100, 0)

  const warnungen: string[] = []

  if (liebhabereiWarnungen.length > 0) {
    warnungen.push(
      `Liebhaberei-Risiko (§ 1 Abs. 2 Z 3 LVO, "kleine Vermietung"): ${liebhabereiWarnungen.length} Objekt(e) `
      + `erzielen in ihren ersten 20 Jahren keinen steuerlichen Gesamtüberschuss — betrifft: `
      + `${liebhabereiWarnungen.join(", ")}. Das Finanzamt kann pro Objekt die steuerliche Anerkennung versagen `
      + "und bereits genutzte Verluste rückwirkend aberkennen."
    )
  }
  if (eingabe.beleihungUmschuldungPct > 80) {
    warnungen.push(
      `Die angenommene Beleihung bei Umschuldung von ${eingabe.beleihungUmschuldungPct.toLocaleString("de-AT")} % `
      + "liegt über dem in der Praxis üblichen Rahmen von 70–80 % des Verkehrswerts — echte Bankangebote können "
      + "abweichen."
    )
  }
  if (eingabe.ltvKaufPct > 80) {
    warnungen.push(
      `Die Beleihung beim Kauf von ${eingabe.ltvKaufPct.toLocaleString("de-AT")} % liegt über dem von der FMA `
      + "erwarteten Rahmen (seit Auslaufen der KIM-V zum 30.6.2025 als Aufsichtserwartung fortgeführt: ≥ 20 % "
      + "Eigenmittel inkl. Nebenkosten) — echte Bankangebote können strenger ausfallen."
    )
  }
  if (eingabe.laufzeitJahre > 35) {
    warnungen.push(
      `Eine Kreditlaufzeit von ${eingabe.laufzeitJahre} Jahren liegt über dem von der FMA erwarteten Rahmen von `
      + "maximal 35 Jahren."
    )
  }
  const summeAnschaffungskostenEnde = objekte.reduce((s, o) => s + o.anschaffungskostenGesamt, 0)
  const summeRestschuldEnde = objekte.reduce((s, o) => s + o.restschuld, 0)
  if (summeRestschuldEnde > summeAnschaffungskostenEnde) {
    warnungen.push(
      "Ein Teil der ausstehenden Kredite stammt aus Umschuldungs-Cash-out (die gesamte Restschuld übersteigt die "
      + "gesamten Anschaffungskosten) — die Simulation zieht die Zinsen darauf dennoch voll steuerlich ab; in der "
      + "Praxis ist der Zinsenabzug nur für den der Vermietung dienenden Kreditanteil zulässig, ein Cash-out-Anteil "
      + "kann vom Finanzamt anteilig aberkannt werden (B1)."
    )
  }
  if (
    eingabe.bestandAnzahl > 0 && eingabe.bestandRestschuld > 0 && eingabe.bestandRateMonat > 0
    && eingabe.bestandRateMonat * eingabe.bestandRestlaufzeitJahre * 12 < eingabe.bestandRestschuld
  ) {
    warnungen.push(
      "Die angegebene Rate für den Bestand tilgt die angegebene Restschuld selbst bei 0 % Zinsen nicht in der "
      + "angegebenen Restlaufzeit — es bleibt am Ende der Restlaufzeit eine Restschuld offen (kein Fehler, aber "
      + "Eingaben prüfen)."
    )
  }
  if (nachschussKumuliert > 0) {
    warnungen.push(
      `In Summe wurden ${Math.round(nachschussKumuliert).toLocaleString("de-AT")} € zusätzlich aus dem `
      + "Nettoeinkommen zugeschossen, um zu verhindern, dass die Liquidität durch einen laufenden "
      + "Cashflow-Fehlbetrag oder eine Steuernachzahlung negativ wird (eine Kontoüberziehung ist im Modell nicht "
      + "vorgesehen). Dieser Betrag ist NICHT in \"Eigenmitteleinsatz (Kauf)\" enthalten, da er kein Kaufkapital "
      + "ist, sondern laufende Deckung."
    )
  }
  if (letztesJahr && letztesJahr.anzahlObjekte >= 10) {
    warnungen.push(
      `Ab einer zweistelligen Anzahl an Objekten (hier: ${letztesJahr.anzahlObjekte}) rückt bei einem späteren `
      + "Verkauf die Einstufung als gewerblicher Grundstückshandel näher — dann entfällt der 30-%-ImmoESt-Satz "
      + "zugunsten des Tarifs plus Sozialversicherungspflicht (E9)."
    )
  }
  if (letztesJahr && letztesJahr.cashflowNetto < 0) {
    warnungen.push("Der operative Netto-Cashflow ist im letzten Jahr des Betrachtungszeitraums noch negativ.")
  }
  if (kaeufe.length === 0) {
    warnungen.push("Im gewählten Zeitraum konnte keine einzige neue Wohnung finanziert werden — Eingaben prüfen.")
  }

  return {
    jahre, kaeufe, umschuldungen, meilensteine,
    kennzahlen: {
      anzahlGratis, ausUmschuldungGesamt, umschuldungsAnteilGesamtPct, gratisAequivalentAnzahl,
      bruttomietrenditeSchnittPct, nettomietrenditeSchnittPct,
      eigenkapitalrenditePct, irrPct, eigenkapitalrenditeNachSteuerPct, irrNachSteuerPct, breakEvenJahr,
    },
    warnungen,
  }
}
