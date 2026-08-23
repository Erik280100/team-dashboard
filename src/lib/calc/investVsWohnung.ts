// Invest vs. Anlegerwohnung — vergleicht dieselben Eigenmittel in zwei Szenarien: A) im Depot
// angelegt, B) als Anzahlung für eine fremdfinanzierte Anlegerwohnung. Baut bewusst auf den
// bestehenden, getesteten Modulen auf statt Formeln zu duplizieren: Kaufnebenkosten,
// Annuitätentilgung und AfA (§ 8 Abs. 1a EStG, beschleunigt in Jahr 1/2) kommen unverändert aus
// kredit.ts (Finanzierungsrechner).
//
// Die Depot-Seite (Szenario A und das Nebenkonto, in das der monatliche Mietüberschuss aus
// Szenario B reinvestiert wird) rechnet bewusst OHNE jegliche Kosten — keine Ausgabeaufschläge,
// keine Depotgebühr/TER, keine jährliche agE-Teilbesteuerung wie im Renditerechner (der Depot-
// Endwert ist dadurch leicht optimistisch). Nur die angegebene Rendite, verzinst, und darauf am
// Ende 27,5 % KESt auf den Gewinn.
//
// Weitere bewusste Vereinfachungen:
//  - Der monatliche Mietüberschuss (Miete − Bewirtschaftung − Kreditrate − Steuer) wird 1:1 in
//    ein Nebendepot reinvestiert; ist er negativ, sinkt der Saldo des Nebendepots (ggf. unter
//    null) — das bildet Kapital ab, das aus eigener Tasche zugeschossen werden musste, und
//    verzinst sich mit derselben Rendite weiter (Opportunitätskosten). Ins Nebenkonto fließen
//    außerdem: ein einmaliger Barbedarf für nicht mitfinanzierte Kreditnebenkosten (Monat 1,
//    negativ) sowie Eigenmittel, die über Kaufpreis + Kaufnebenkosten hinausgehen (Einmalerlag).
//  - Steuerliches Ergebnis der Wohnung = Miete − Bewirtschaftung − Kreditzinsen − AfA, darauf der
//    Grenzsteuersatz (negatives Ergebnis wirkt als Gutschrift/Verlustausgleich). Die einmaligen
//    Kreditnebenkosten (Geldbeschaffungskosten) werden im ersten Monat als Werbungskosten
//    zusätzlich abgesetzt.
//  - Ist die Kreditlaufzeit länger als der Anlagehorizont, wird beim "Verkauf" am Ende des
//    Horizonts die verbleibende Restschuld vom Verkaufserlös abgezogen.
//  - ImmoESt-Basis: Verkaufspreis − (Kaufpreis + Kaufnebenkosten) + kumulierte AfA (AfA erhöht
//    den steuerpflichtigen Gewinn, weil sie den Buchwert schon gesenkt hat) — dieselbe
//    Bemessungsgrundlage (Kaufpreis + Kaufnebenkosten) wird auch für die AfA verwendet, damit
//    beide konsistent sind. Eine grobe Näherung, keine Steuerberatung.
//  - ImmoESt fällt — seit Abschaffung der Spekulationsfrist am 1.4.2012 — unabhängig von der
//    Haltedauer immer an (§ 30 EStG); die Hauptwohnsitz-/Herstellerbefreiung greift bei einer
//    vermieteten Anlegerwohnung nicht. Die Pauschalbesteuerung für "Altvermögen" (Anschaffung vor
//    31.3.2002, 4,2 % vom Verkaufserlös) wird hier nicht abgebildet.

import {
  KREDIT_DEFAULTS, berechneAfaBemessungsgrundlage, berechneAfaJahre, berechneKreditbetrag,
  berechneTilgungsplan, type KaufnebenkostenErgebnis, type KostenPosition, type KreditSaetze,
  type TilgungsMonat,
} from "@/lib/calc/kredit"
import { RR_KEST, rrRate } from "@/lib/calc/rendite"

export interface DepotVerlauf {
  /** Monatsendstände ("Verkaufswert", d. h. bereits abzüglich der KESt auf den bis dahin nicht
   *  realisierten Gewinn), verlauf[0] = Startwert (Einmalerlag), verlauf[m] = Stand nach Monat m. */
  verlauf: number[]
  endwertNachSteuer: number
  eingezahlt: number
  /** Summe der Beträge, die dem Depot entnommen bzw. bei negativem Cashflow entzogen wurden. */
  entnommen: number
  kestGesamt: number
}

/**
 * Reine Wertentwicklung ohne jegliche Kosten: Cashflows werden mit der angegebenen Rendite
 * verzinst (Zinseszins, kein Ausgabeaufschlag, keine Depotgebühr), und auf den nicht realisierten
 * Gewinn werden 27,5 % KESt fällig — konsistent bei jedem Monatsstand berechnet (nicht nur am
 * Ende), damit der Verlauf keine künstlichen Sprünge hat.
 *
 * Ein negativer Cashflow senkt die Kostenbasis cumNetto um denselben Betrag (Netto-Einzahlungs-
 * saldo aus eigener Tasche); cumNetto darf dabei negativ werden — bleibt es geklammert, würde eine
 * Minusphase gefolgt von neuen Einzahlungen die Kostenbasis künstlich aufblähen und den späteren
 * Gewinn faktisch KESt-frei stellen. Der Saldo (balance) darf ebenfalls negativ werden.
 */
export function simuliereDepotVariabel(einmal: number, cashflows: number[], perfPa: number): DepotVerlauf {
  const r = rrRate(perfPa / 100)
  let balance = 0
  let cumNetto = 0
  let eingezahlt = 0
  let entnommen = 0

  const verkaufswert = (bestand: number): number => {
    const gewinn = bestand - cumNetto
    return gewinn > 0 ? bestand - gewinn * RR_KEST : bestand
  }

  if (einmal > 0) {
    balance += einmal
    cumNetto += einmal
    eingezahlt += einmal
  }

  const verlauf = [verkaufswert(balance)]
  for (let m = 0; m < cashflows.length; m++) {
    const cf = cashflows[m]
    balance += cf
    cumNetto += cf
    if (cf >= 0) {
      eingezahlt += cf
    } else {
      entnommen += -cf
    }
    balance *= 1 + r
    verlauf.push(verkaufswert(balance))
  }

  const endwertNachSteuer = verlauf[verlauf.length - 1]
  const kestGesamt = Math.max(0, balance - cumNetto) * RR_KEST

  return { verlauf, endwertNachSteuer, eingezahlt, entnommen, kestGesamt }
}

/**
 * Annuitätische Entnahme: monatlich gleichbleibender Betrag, der ein Kapital bei gegebener
 * Netto-Rendite exakt nach entnahmeJahre auf 0 bringt. Dieselbe Formel wie berechneTilgungsplan()
 * in kredit.ts (K·i / (1 − (1+i)^−n)), nur "rückwärts" — statt einen Kredit abzuzahlen, wird ein
 * Vermögen abgebaut.
 */
export function berechneEntnahmeMonat(kapital: number, renditePaPct: number, entnahmeJahre: number): number {
  const K = Math.max(0, kapital)
  const n = Math.max(0, Math.round(entnahmeJahre * 12))
  if (K <= 0 || n <= 0) return 0
  const i = renditePaPct / 100 / 12
  if (Math.abs(i) < 1e-9 || 1 + i <= 0) return K / n
  return (K * i) / (1 - Math.pow(1 + i, -n))
}

/** Restschuld nach `monate` Monaten aus einem Tilgungsplan — 0 Monate = noch nichts getilgt. */
function restschuldNachMonaten(kreditbetrag: number, monate: number, monatePlan: TilgungsMonat[]): number {
  if (monate <= 0) return Math.max(0, kreditbetrag)
  if (monatePlan.length === 0) return 0
  const idx = Math.min(monate, monatePlan.length) - 1
  return monatePlan[idx].restschuld
}

export interface InvestVsWohnungEingabe {
  eigenmittel: number
  horizontJahre: number
  entnahmeJahre: number

  /** Depot-Rendite p.a. (%) — gilt sowohl für Szenario A (Depot) als auch für das Nebenkonto in
   *  Szenario B (Mietüberschuss-Reinvestition), damit beide Seiten fair mit derselben
   *  Opportunitätskosten-Annahme gerechnet werden. */
  depotRenditePa: number

  // Szenario B — Wohnung
  kaufpreis: number
  mitMakler: boolean
  nkMitfinanziert: boolean
  kreditLaufzeitJahre: number
  kreditZinsPct: number
  mieteMonat: number
  indexierungPct: number
  leerstandPct: number
  bewirtschaftungMonat: number
  wertsteigerungPct: number
  grenzsteuersatzPct: number
  immoEstPct: number
  verkaufskostenPct: number
  saetze?: KreditSaetze
}

/** Ein Jahr der Detail-Aufschlüsselung für Szenario B (Wohnung) — für die Anzeige der
 *  Rechenschritte im Detail; im bestehenden Monatsloop mitaggregiert (kein zweiter Durchlauf). */
export interface InvestVsWohnungJahr {
  jahr: number
  miete: number
  bewirtschaftung: number
  zinsen: number
  tilgung: number
  afa: number
  steuerEffekt: number
  cashflow: number
  nebenkontoEnde: number
  restschuld: number
  verkehrswert: number
}

export interface InvestVsWohnungErgebnis {
  depot: {
    /** Endstand vor KESt (Eigenmittel + Wertzuwachs, unversteuert). */
    bruttoEndwert: number
    /** KESt (27,5 %) auf den Gewinn, bereits im Endwert abgezogen. */
    kestGesamt: number
    endwertNachSteuer: number
  }
  wohnung: {
    kreditbetrag: number
    rate: number
    beleihungsquotePct: number
    kaufNK: KaufnebenkostenErgebnis
    kreditNKPositionen: KostenPosition[]
    kreditNKSumme: number
    gesamtinvestition: number
    barbedarf: number
    ueberschussEigenmittel: number
    afaBasis: number
    immobilienwertEnde: number
    restschuldEnde: number
    verkaufskosten: number
    immoEstBasis: number
    immoEst: number
    afaKumuliert: number
    mieteKumuliert: number
    gesamtzinsen: number
    steuerEffektKumuliert: number
    nebenkontoEndwert: number
    zuzahlungenKumuliert: number
    endwertNachSteuer: number
  }
  differenz: number
  entnahme: {
    depotMonat: number
    immoMonat: number
    immoOhneVerkaufMonat: number
  }
  jahre: InvestVsWohnungJahr[]
  warnungen: string[]
}

export function berechneInvestVsWohnung(e: InvestVsWohnungEingabe): InvestVsWohnungErgebnis {
  const saetze = e.saetze ?? KREDIT_DEFAULTS
  const h = Math.max(0, Math.round(e.horizontJahre))
  const monateGesamt = h * 12
  const eigenmittel = Math.max(0, e.eigenmittel)
  const kaufpreis = Math.max(0, e.kaufpreis)
  // Kosten-/Ausfallsätze dürfen konzeptionell nicht negativ sein (ein "negativer Leerstand"
  // würde mehr als volle Auslastung bedeuten, "negative Bewirtschaftungskosten" würden Geld
  // erzeugen statt kosten) — auf 0 geklammert wie die übrigen Kostensätze in kredit.ts.
  const mieteMonat = Math.max(0, e.mieteMonat)
  const bewirtschaftungMonat = Math.max(0, e.bewirtschaftungMonat)
  const leerstandPct = Math.min(100, Math.max(0, e.leerstandPct))
  const verkaufskostenPct = Math.max(0, e.verkaufskostenPct)
  const immoEstPct = Math.max(0, e.immoEstPct)

  // Szenario A — Depot: Eigenmittel als Einmalerlag, keine laufenden Zu-/Abgänge.
  const depotVerlauf = simuliereDepotVariabel(eigenmittel, Array(monateGesamt).fill(0), e.depotRenditePa)

  // Szenario B — Wohnung: Kreditbetrag & Kaufnebenkosten wie im Finanzierungsrechner (Eigenmittel
  // decken zuerst die Kaufnebenkosten, der Rest ist Anzahlung).
  const kreditErg = berechneKreditbetrag({
    kaufpreis, eigenmittel, mitMakler: e.mitMakler, nkMitfinanziert: e.nkMitfinanziert, saetze,
  })
  const tilgung = berechneTilgungsplan(kreditErg.kreditbetrag, e.kreditZinsPct, e.kreditLaufzeitJahre)

  // AfA-Bemessungsgrundlage inkl. Kaufnebenkosten (Grunderwerbsteuer, Grundbuch, Vertragserrichtung,
  // ggf. Makler zählen zu den Anschaffungskosten) — dieselbe Basis wie bei der ImmoESt weiter unten,
  // damit beide konsistent sind.
  const afaBasis = berechneAfaBemessungsgrundlage(kaufpreis + kreditErg.kaufNK.summe, saetze.gebaeudeanteilPct)
  const afaJahre = berechneAfaJahre(afaBasis, saetze.afaSatzPct, h)

  const cashflows: number[] = []
  let mieteKumuliert = 0
  let steuerEffektKumuliert = 0
  let gesamtzinsen = 0
  const jahreAgg: { miete: number; bewirtschaftung: number; zinsen: number; tilgung: number; steuerEffekt: number; cashflow: number }[] = []
  let acc = { miete: 0, bewirtschaftung: 0, zinsen: 0, tilgung: 0, steuerEffekt: 0, cashflow: 0 }
  for (let m = 1; m <= monateGesamt; m++) {
    const j = Math.ceil(m / 12)
    const indexFaktor = Math.pow(1 + e.indexierungPct / 100, j - 1)
    const miete_m = mieteMonat * indexFaktor * (1 - leerstandPct / 100)
    // Die Bewirtschaftungskosten wachsen mit derselben Indexierung wie die Miete — bleiben sie
    // nominal konstant, wird die Wohnung gegenüber der Realität systematisch begünstigt.
    const bewirtschaftung_m = bewirtschaftungMonat * indexFaktor
    const kreditMonat = m <= tilgung.monate.length ? tilgung.monate[m - 1] : undefined
    const zins_m = kreditMonat?.zins ?? 0
    const tilgung_m = kreditMonat?.tilgung ?? 0
    const rate_m = zins_m + tilgung_m
    const afaMonat = (afaJahre[j - 1]?.afa ?? 0) / 12
    // Geldbeschaffungskosten (Kreditvertragserstellung, Pfandrechtseintragung) sind bei Vermietung
    // sofort abzugsfähige Werbungskosten — einmalig im ersten Monat angesetzt.
    const kreditNK_m = m === 1 ? kreditErg.kreditNKSumme : 0
    const steuerBasis_m = miete_m - bewirtschaftung_m - zins_m - afaMonat - kreditNK_m
    const steuer_m = steuerBasis_m * (e.grenzsteuersatzPct / 100)
    // Barbedarf (nicht mitfinanzierte Kreditnebenkosten) muss bar aufgebracht werden — schlägt
    // sich im ersten Monat als zusätzlicher Abfluss nieder, damit er auch die
    // Opportunitätsverzinsung im Nebenkonto trägt.
    const barbedarf_m = m === 1 ? kreditErg.barbedarf : 0
    const cashflow_m = miete_m - bewirtschaftung_m - rate_m - steuer_m - barbedarf_m
    cashflows.push(cashflow_m)
    mieteKumuliert += miete_m
    steuerEffektKumuliert += -steuer_m
    gesamtzinsen += zins_m

    acc.miete += miete_m; acc.bewirtschaftung += bewirtschaftung_m; acc.zinsen += zins_m
    acc.tilgung += tilgung_m; acc.steuerEffekt += -steuer_m; acc.cashflow += cashflow_m
    if (m % 12 === 0 || m === monateGesamt) {
      jahreAgg.push(acc)
      acc = { miete: 0, bewirtschaftung: 0, zinsen: 0, tilgung: 0, steuerEffekt: 0, cashflow: 0 }
    }
  }

  // Übersteigen die Eigenmittel Kaufpreis + Kaufnebenkosten + Kreditnebenkosten (Gesamtinvestition),
  // fließt der Überschuss als Einmalerlag ins Nebenkonto, statt ungenutzt zu verfallen.
  const ueberschussEigenmittel = Math.max(0, eigenmittel - kreditErg.gesamtinvestition)
  const nebenkonto = simuliereDepotVariabel(ueberschussEigenmittel, cashflows, e.depotRenditePa)

  const immobilienwertEnde = kaufpreis * Math.pow(1 + e.wertsteigerungPct / 100, h)
  const restschuldEnde = restschuldNachMonaten(kreditErg.kreditbetrag, monateGesamt, tilgung.monate)
  const verkaufskosten = immobilienwertEnde * (verkaufskostenPct / 100)
  const afaKumuliertEnde = afaJahre[h - 1]?.afaKumuliert ?? 0
  const immoEstBasis = Math.max(0, immobilienwertEnde - (kaufpreis + kreditErg.kaufNK.summe) + afaKumuliertEnde)
  // Die Spekulationsfrist wurde am 1.4.2012 abgeschafft — der Verkauf einer vermieteten
  // Anlegerwohnung ist unabhängig von der Haltedauer immer mit ImmoESt steuerpflichtig
  // (Hauptwohnsitz-/Herstellerbefreiung greift hier nicht; Altvermögen vor 31.3.2002 wird nicht
  // gesondert abgebildet).
  const immoEst = immoEstBasis * (immoEstPct / 100)

  const endwertWohnung = immobilienwertEnde - verkaufskosten - immoEst - restschuldEnde + nebenkonto.endwertNachSteuer

  const jahre: InvestVsWohnungJahr[] = jahreAgg.map((a, idx) => {
    const j = idx + 1
    return {
      jahr: j,
      miete: a.miete,
      bewirtschaftung: a.bewirtschaftung,
      zinsen: a.zinsen,
      tilgung: a.tilgung,
      afa: afaJahre[idx]?.afa ?? 0,
      steuerEffekt: a.steuerEffekt,
      cashflow: a.cashflow,
      nebenkontoEnde: nebenkonto.verlauf[Math.min(j * 12, nebenkonto.verlauf.length - 1)],
      restschuld: restschuldNachMonaten(kreditErg.kreditbetrag, j * 12, tilgung.monate),
      verkehrswert: kaufpreis * Math.pow(1 + e.wertsteigerungPct / 100, j),
    }
  })

  // Block B — monatliche Entnahme über den gewählten Zeitraum. Beide Szenarien werden mit
  // derselben Netto-Rendite gerechnet (Rendite abzüglich KESt), damit der Vergleich fair bleibt —
  // nach dem Verkauf würde die Wohnung ja ebenfalls in ein Depot fließen.
  const rEntnahmePaPct = e.depotRenditePa * (1 - RR_KEST)
  const depotMonat = berechneEntnahmeMonat(depotVerlauf.endwertNachSteuer, rEntnahmePaPct, e.entnahmeJahre)
  const immoMonat = berechneEntnahmeMonat(endwertWohnung, rEntnahmePaPct, e.entnahmeJahre)
  const letzterCashflow = cashflows[cashflows.length - 1] ?? 0
  const nebenkontoEntnahmeMonat = berechneEntnahmeMonat(nebenkonto.endwertNachSteuer, rEntnahmePaPct, e.entnahmeJahre)
  const immoOhneVerkaufMonat = letzterCashflow + nebenkontoEntnahmeMonat

  const warnungen: string[] = [...kreditErg.warnungen]
  if (restschuldEnde > 0) {
    warnungen.push(
      `Beim Verkauf nach ${h} Jahren besteht noch eine Restschuld von ${Math.round(restschuldEnde).toLocaleString("de-AT")} € `
      + "(Kreditlaufzeit länger als der Anlagehorizont) — sie wird vom Verkaufserlös abgezogen."
    )
  }

  return {
    depot: {
      bruttoEndwert: depotVerlauf.endwertNachSteuer + depotVerlauf.kestGesamt,
      kestGesamt: depotVerlauf.kestGesamt,
      endwertNachSteuer: depotVerlauf.endwertNachSteuer,
    },
    wohnung: {
      kreditbetrag: kreditErg.kreditbetrag, rate: tilgung.rate, beleihungsquotePct: kreditErg.beleihungsquotePct,
      kaufNK: kreditErg.kaufNK, kreditNKPositionen: kreditErg.kreditNKPositionen,
      kreditNKSumme: kreditErg.kreditNKSumme, gesamtinvestition: kreditErg.gesamtinvestition,
      barbedarf: kreditErg.barbedarf, ueberschussEigenmittel, afaBasis,
      immobilienwertEnde, restschuldEnde, verkaufskosten, immoEstBasis, immoEst, afaKumuliert: afaKumuliertEnde,
      mieteKumuliert, gesamtzinsen, steuerEffektKumuliert, nebenkontoEndwert: nebenkonto.endwertNachSteuer,
      zuzahlungenKumuliert: nebenkonto.entnommen, endwertNachSteuer: endwertWohnung,
    },
    differenz: endwertWohnung - depotVerlauf.endwertNachSteuer,
    entnahme: { depotMonat, immoMonat, immoOhneVerkaufMonat },
    jahre,
    warnungen,
  }
}
