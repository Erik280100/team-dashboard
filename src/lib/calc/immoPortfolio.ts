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
//    Kalenderjahr (keine unterjährige Halbjahres-AfA).
//  - Der Bestand (Sammelposten) erhält keine beschleunigte Anfangs-AfA mehr (§ 8 Abs. 1a EStG
//    gilt nur in den ersten beiden Jahren ab Anschaffung) und keinen eigenen Zinssatz-Input —
//    dieser wird aus Restschuld/Rate/Restlaufzeit rückgerechnet (Bisection).
//  - Bewirtschaftungskosten (Hausverwaltung, Instandhaltung, Sonstiges) sind pauschale
//    Monatsbeträge pro Objekt bzw. × Bestandsanzahl, keine Einzelabrechnung.

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
  mindestabstandMonate: number
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
}

export interface ImmoJahr {
  jahr: number
  anzahlObjekte: number
  portfolioWert: number
  restschuldGesamt: number
  liquiditaet: number
  nettovermoegen: number
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
  jahresmiete: number
  jahresAfa: number
  jahresCashflow: number
}

export interface ImmoKennzahlen {
  anzahlGratis: number
  bruttomietrenditeSchnittPct: number
  nettomietrenditeSchnittPct: number
  eigenkapitalrenditePct: number
  irrPct: number | null
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
export function berechneAfaJahreLinear(bemessungsgrundlage: number, afaSatzPct: number, jahre: number): AfaJahr[] {
  const basis = Math.max(0, bemessungsgrundlage)
  const satz = Math.max(0, afaSatzPct) / 100
  const n = Math.max(0, Math.round(jahre))
  const ergebnisse: AfaJahr[] = []
  let kumuliert = 0
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
  return basis * Math.pow(1 + eingabe.indexierungPct / 100, kaufMonat / 12)
}

interface Kaufbedarf {
  referenzKaufpreis: number
  kreditbetrag: number
  kreditNKSumme: number
  eigenmittelbedarf: number
}

/** Finanzierungsbedarf eines Kaufs zum aktuellen Referenzkaufpreis (wächst mit dem Wertzuwachs
 *  mit) — reine Berechnung ohne Seiteneffekt, damit sie in der Kaufschleife pro Objekt neu
 *  aufgerufen werden kann. */
function berechneKaufbedarf(eingabe: ImmoPortfolioEingabe, saetze: KreditSaetze, monat: number): Kaufbedarf {
  const referenzKaufpreis = Math.max(0, eingabe.kaufpreisReferenz) * Math.pow(1 + eingabe.wertzuwachsPct / 100, monat / 12)
  const kreditbetrag = referenzKaufpreis * (eingabe.ltvKaufPct / 100)
  const kaufNK = berechneKaufnebenkosten(referenzKaufpreis, eingabe.mitMakler, saetze)
  const kreditNKSumme = berechneKreditNebenkostenSumme(kreditbetrag, saetze)
  const eigenmittelbedarf = referenzKaufpreis - kreditbetrag + kaufNK.summe + (eingabe.nkMitfinanziert ? 0 : kreditNKSumme)
  return { referenzKaufpreis, kreditbetrag, kreditNKSumme, eigenmittelbedarf }
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
    const afaBasis = berechneAfaBemessungsgrundlage(Math.max(0, eingabe.bestandWert), eingabe.gebaeudeanteilPct)
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
      afaSerie: berechneAfaJahreLinear(afaBasis, eingabe.afaSatzPct, horizontJahre + 1),
      afaKumuliert: 0,
      mieteMonat: Math.max(0, eingabe.bestandMieteMonat),
      letzteUmschuldungMonat: 0,
    })
  }

  const jahre: ImmoJahr[] = []
  const kaeufe: ImmoKauf[] = []
  const umschuldungen: ImmoUmschuldung[] = []

  let naechsterKaufAbMonat = 1
  let mieteJahr = 0, kostenJahr = 0, zinsenJahr = 0, tilgungJahr = 0, rateJahr = 0
  let eigenmitteleinsatzJahr = 0
  let eigenmitteleinsatzKumuliert = 0

  for (let monat = 1; monat <= monateGesamt; monat++) {
    // 1) Guthabenzinsen auf die vorhandene Liquidität, anteilig auf die beiden Töpfe verteilt.
    const zinsBasis = Math.max(0, liquiditaet)
    const guthabenzins = zinsBasis * (eingabe.guthabenzinsPct / 100 / 12)
    liquiditaet += guthabenzins
    if (zinsBasis > 0) {
      topfUmschuldung += guthabenzins * (Math.max(0, topfUmschuldung) / zinsBasis)
      topfSparen += guthabenzins * (Math.max(0, topfSparen) / zinsBasis)
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
      if (obj.restMonate === 0) obj.restschuld = 0

      obj.verkehrswert *= Math.pow(1 + eingabe.wertzuwachsPct / 100, 1 / 12)

      const effektiveMiete = obj.mieteMonat * (1 - eingabe.leerstandPct / 100)
      const kosten = bewirtschaftungskostenMonat(eingabe, obj)
      const rateGezahlt = zins + tilgung

      mieteJahr += effektiveMiete
      kostenJahr += kosten
      zinsenJahr += zins
      tilgungJahr += tilgung
      rateJahr += rateGezahlt

      const cashflow = effektiveMiete - kosten - rateGezahlt
      liquiditaet += cashflow
      topfSparen += cashflow
    }

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
        afaGesamtJahr += afa
      }

      const steuerErgebnis = mieteJahr - kostenJahr - zinsenJahr - afaGesamtJahr
      const steuerEffekt = -steuerErgebnis * (eingabe.grenzsteuersatzPct / 100)
      liquiditaet += steuerEffekt
      topfSparen += steuerEffekt

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

        liquiditaet += auszahlung
        topfUmschuldung += auszahlung
        obj.restschuld = beleihbar
        obj.rate = planNeu.rate
        obj.restMonate = eingabe.laufzeitJahre * 12
        obj.letzteUmschuldungMonat = monat
      }
    }

    // 4) Kaufprüfung — jeden Monat, sobald der Mindestabstand erreicht ist. Reicht die Liquidität
    //    für mehr als eine Wohnung, werden auch mehrere im selben Monat gekauft (z. B. ein
    //    Zinshaus mit mehreren Einheiten) — sonst würde weiter angespartes Eigenkapital neben den
    //    "gratis" laufenden Umschuldungskäufen ungenutzt liegen bleiben. Die beiden Kapitalquellen
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
    if (
      monat >= naechsterKaufAbMonat
      && berechneKaufbedarf(eingabe, saetze, monat).referenzKaufpreis > KAUFPREIS_MINDESTGRENZE
    ) {
      let gekauftDiesenMonat = false

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
        const { referenzKaufpreis, kreditbetrag, kreditNKSumme, eigenmittelbedarf } = bedarf
        const kreditGesamt = kreditbetrag + (eingabe.nkMitfinanziert ? kreditNKSumme : 0)
        const plan = berechneTilgungsplan(kreditGesamt, eingabe.zinssatzPct, eingabe.laufzeitJahre)
        const kaufJahrIndex = Math.ceil(monat / 12)
        const afaBasis = berechneAfaBemessungsgrundlage(referenzKaufpreis, eingabe.gebaeudeanteilPct)
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
        }

        if (resteinkommenMitObjekt(neuesObjekt) < eingabe.mindestResteinkommenMonat) return false

        topfUmschuldung -= ausUmschuldung
        topfSparen -= (eigenmittelbedarf - ausUmschuldung)
        liquiditaet -= eigenmittelbedarf

        const gratisAnteilPct = (ausUmschuldung / eigenmittelbedarf) * 100
        const istGratis = gratisAnteilPct >= 99.9
        const eigenmittelAnteil = eigenmittelbedarf - ausUmschuldung
        eigenmitteleinsatzJahr += eigenmittelAnteil
        eigenmitteleinsatzKumuliert += eigenmittelAnteil

        neuesObjekt.id = naechsteObjektId++
        objekte.push(neuesObjekt)
        gekauftDiesenMonat = true

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

      // Der Mindestabstand gilt erst ab dem letzten Kauf dieser "Kaufserie" — nicht mehr als
      // starre Taktung, sondern als Mindestpause, bevor überhaupt wieder geprüft wird.
      if (gekauftDiesenMonat) {
        naechsterKaufAbMonat = monat + Math.max(0, Math.round(eingabe.mindestabstandMonate))
      }
    }

    // 5) Jahresschnappschuss (immer nach der Kaufprüfung, damit ein Kauf im Dezember schon
    //    im selben Jahresergebnis aufscheint).
    if (monat % 12 === 0) {
      const portfolioWert = objekte.reduce((s, o) => s + o.verkehrswert, 0)
      const restschuldGesamt = objekte.reduce((s, o) => s + o.restschuld, 0)
      const nettovermoegen = portfolioWert - restschuldGesamt + liquiditaet
      const einkommensbasis = eingabe.nettoeinkommenMonat + 0.8 * (mieteJahr / 12)

      jahre.push({
        jahr: monat / 12,
        anzahlObjekte: objekte.length,
        portfolioWert, restschuldGesamt, liquiditaet, nettovermoegen,
        mieteinnahmen: mieteJahr,
        bewirtschaftungskosten: kostenJahr,
        kreditratenGesamt: rateJahr,
        zinsenGesamt: zinsenJahr,
        tilgungGesamt: tilgungJahr,
        afaGesamt: afaGesamtJahr,
        steuerErgebnis: mieteJahr - kostenJahr - zinsenJahr - afaGesamtJahr,
        steuerEffekt: -(mieteJahr - kostenJahr - zinsenJahr - afaGesamtJahr) * (eingabe.grenzsteuersatzPct / 100),
        cashflowNetto: mieteJahr - kostenJahr - rateJahr - (mieteJahr - kostenJahr - zinsenJahr - afaGesamtJahr) * (eingabe.grenzsteuersatzPct / 100),
        ltvPct: portfolioWert > 0 ? (restschuldGesamt / portfolioWert) * 100 : 0,
        dstiPct: einkommensbasis > 0 ? (rateJahr / 12 / einkommensbasis) * 100 : 0,
        eigenmitteleinsatzKauf: eigenmitteleinsatzJahr,
        eigenmitteleinsatzKumuliert,
      })
      mieteJahr = 0; kostenJahr = 0; zinsenJahr = 0; tilgungJahr = 0; rateJahr = 0
      eigenmitteleinsatzJahr = 0
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
        jahresmiete: j.mieteinnahmen,
        jahresAfa: j.afaGesamt,
        jahresCashflow: j.cashflowNetto,
      }
    })

  const letztesJahr = jahre[jahre.length - 1]
  const summeKaufpreise = kaeufe.reduce((s, k) => s + k.kaufpreis, 0) + (eingabe.bestandAnzahl > 0 ? eingabe.bestandWert : 0)
  const bruttomietrenditeSchnittPct = summeKaufpreise > 0 ? (letztesJahr.mieteinnahmen / summeKaufpreise) * 100 : 0
  const nettomietrenditeSchnittPct = summeKaufpreise > 0
    ? ((letztesJahr.mieteinnahmen - letztesJahr.bewirtschaftungskosten) / summeKaufpreise) * 100 : 0

  const eigenkapitalrenditePct = eigenmittelStart + eingabe.sparbetragMonat * monateGesamt > 0
    ? ((letztesJahr.nettovermoegen - (eigenmittelStart + eingabe.sparbetragMonat * monateGesamt))
      / (eigenmittelStart + eingabe.sparbetragMonat * monateGesamt)) * 100
    : 0

  const irrPct = berechnePortfolioIrrPct(eigenmittelStart, eingabe.sparbetragMonat, monateGesamt, letztesJahr.nettovermoegen)

  let kumCashflow = 0
  let breakEvenJahr: number | null = null
  for (const j of jahre) {
    kumCashflow += j.cashflowNetto
    if (kumCashflow >= 0 && breakEvenJahr === null) breakEvenJahr = j.jahr
  }

  const anzahlGratis = kaeufe.filter((k) => k.istGratis).length

  const warnungen: string[] = []
  const kumSteuerErgebnis = jahre.reduce((s, j) => s + j.steuerErgebnis, 0)
  if (kumSteuerErgebnis < 0) {
    warnungen.push(
      "Das kumulierte steuerliche Ergebnis über den Betrachtungszeitraum ist negativ — bei "
      + "dauerhaften Verlusten prüft das Finanzamt Liebhaberei (§ 1 Abs. 2 LVO); ohne "
      + "absehbaren Gesamtüberschuss droht der Verlust der steuerlichen Anerkennung."
    )
  }
  if (eingabe.beleihungUmschuldungPct > 80) {
    warnungen.push(
      `Die angenommene Beleihung bei Umschuldung von ${eingabe.beleihungUmschuldungPct.toLocaleString("de-AT")} % `
      + "liegt über dem in der Praxis üblichen Rahmen von 70–80 % des Verkehrswerts — echte Bankangebote können "
      + "abweichen."
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
      anzahlGratis, bruttomietrenditeSchnittPct, nettomietrenditeSchnittPct,
      eigenkapitalrenditePct, irrPct, breakEvenJahr,
    },
    warnungen,
  }
}
