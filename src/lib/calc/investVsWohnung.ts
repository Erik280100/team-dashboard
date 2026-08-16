// Invest vs. Anlegerwohnung — vergleicht dieselben Eigenmittel in zwei Szenarien: A) im Depot
// angelegt, B) als Anzahlung für eine fremdfinanzierte Anlegerwohnung. Baut bewusst auf den
// bestehenden, getesteten Modulen auf statt Formeln zu duplizieren: Kaufnebenkosten,
// Annuitätentilgung und AfA (§ 8 Abs. 1a EStG, beschleunigt in Jahr 1/2) kommen unverändert aus
// kredit.ts (Finanzierungsrechner).
//
// Die Depot-Seite (Szenario A und das Nebenkonto, in das der monatliche Mietüberschuss aus
// Szenario B reinvestiert wird) rechnet bewusst OHNE jegliche Kosten — keine Ausgabeaufschläge,
// keine Depotgebühr/TER, keine jährliche agE-Teilbesteuerung wie im Renditerechner. Nur die
// angegebene Rendite, verzinst, und darauf am Ende 27,5 % KESt auf den Gewinn. Das reicht für
// die Gegenüberstellung; die UI zeigt das Ergebnis für eine Bandbreite von 5–15 % Rendite p.a.
//
// Weitere bewusste Vereinfachungen:
//  - Der monatliche Mietüberschuss (Miete − Bewirtschaftung − Kreditrate − Steuer) wird 1:1 in
//    ein Nebendepot reinvestiert; ist er negativ, sinkt der Saldo des Nebendepots (ggf. unter
//    null) — das bildet Kapital ab, das aus eigener Tasche zugeschossen werden musste, und
//    verzinst sich mit derselben Rendite weiter (Opportunitätskosten).
//  - Steuerliches Ergebnis der Wohnung = Miete − Bewirtschaftung − Kreditzinsen − AfA, darauf der
//    Grenzsteuersatz (negatives Ergebnis wirkt als Gutschrift/Verlustausgleich).
//  - Ist die Kreditlaufzeit länger als der Anlagehorizont, wird beim "Verkauf" am Ende des
//    Horizonts die verbleibende Restschuld vom Verkaufserlös abgezogen.
//  - ImmoESt-Basis: Verkaufspreis − (Kaufpreis + Kaufnebenkosten) + kumulierte AfA (AfA erhöht
//    den steuerpflichtigen Gewinn, weil sie den Buchwert schon gesenkt hat) — eine grobe
//    Näherung, keine Steuerberatung.
//  - ImmoESt fällt nur an, wenn die Haltedauer (= Anlagehorizont) unter 10 Jahren liegt; ab
//    IMMOEST_HALTEDAUER_JAHRE wird automatisch keine ImmoESt mehr angesetzt (kein manueller
//    Schalter mehr).

import {
  KREDIT_DEFAULTS, berechneAfaBemessungsgrundlage, berechneAfaJahre, berechneKreditbetrag,
  berechneTilgungsplan, type KaufnebenkostenErgebnis, type KreditSaetze, type TilgungsMonat,
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
 * Ein negativer Cashflow ist eine Entnahme (senkt die Kostenbasis cumNetto um denselben Betrag —
 * vereinfachte "Kapital zuerst zurück"-Annahme). Der Saldo darf negativ werden.
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
    if (cf >= 0) {
      cumNetto += cf
      eingezahlt += cf
    } else {
      cumNetto = Math.max(0, cumNetto + cf)
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

/** Ab dieser Haltedauer (Anlagehorizont) fällt keine ImmoESt mehr an. */
export const IMMOEST_HALTEDAUER_JAHRE = 10

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
    kreditNKSumme: number
    barbedarf: number
    immobilienwertEnde: number
    restschuldEnde: number
    verkaufskosten: number
    immoEstAnwendbar: boolean
    immoEst: number
    afaKumuliert: number
    mieteKumuliert: number
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

  const afaBasis = berechneAfaBemessungsgrundlage(kaufpreis, saetze.gebaeudeanteilPct)
  const afaJahre = berechneAfaJahre(afaBasis, saetze.afaSatzPct, h)

  const cashflows: number[] = []
  let mieteKumuliert = 0
  let steuerEffektKumuliert = 0
  for (let m = 1; m <= monateGesamt; m++) {
    const j = Math.ceil(m / 12)
    const miete_m = mieteMonat * Math.pow(1 + e.indexierungPct / 100, j - 1) * (1 - leerstandPct / 100)
    const kreditMonat = m <= tilgung.monate.length ? tilgung.monate[m - 1] : undefined
    const zins_m = kreditMonat?.zins ?? 0
    const rate_m = kreditMonat ? kreditMonat.zins + kreditMonat.tilgung : 0
    const afaMonat = (afaJahre[j - 1]?.afa ?? 0) / 12
    const steuerBasis_m = miete_m - bewirtschaftungMonat - zins_m - afaMonat
    const steuer_m = steuerBasis_m * (e.grenzsteuersatzPct / 100)
    cashflows.push(miete_m - bewirtschaftungMonat - rate_m - steuer_m)
    mieteKumuliert += miete_m
    steuerEffektKumuliert += -steuer_m
  }

  const nebenkonto = simuliereDepotVariabel(0, cashflows, e.depotRenditePa)

  const immobilienwertEnde = kaufpreis * Math.pow(1 + e.wertsteigerungPct / 100, h)
  const restschuldEnde = restschuldNachMonaten(kreditErg.kreditbetrag, monateGesamt, tilgung.monate)
  const verkaufskosten = immobilienwertEnde * (verkaufskostenPct / 100)
  const afaKumuliertEnde = afaJahre[h - 1]?.afaKumuliert ?? 0
  const gewinnBasis = Math.max(0, immobilienwertEnde - (kaufpreis + kreditErg.kaufNK.summe) + afaKumuliertEnde)
  // Haltedauer = Anlagehorizont (Kauf in Monat 0, Verkauf am Ende des Horizonts): ab 10 Jahren
  // wird automatisch keine ImmoESt mehr angesetzt, darunter mit dem angegebenen Satz.
  const immoEstAnwendbar = h < IMMOEST_HALTEDAUER_JAHRE
  const immoEst = immoEstAnwendbar ? gewinnBasis * (immoEstPct / 100) : 0

  const endwertWohnung = immobilienwertEnde - verkaufskosten - immoEst - restschuldEnde + nebenkonto.endwertNachSteuer

  // Block B — monatliche Entnahme über den gewählten Zeitraum. Beide Szenarien werden mit
  // derselben Netto-Rendite gerechnet (Rendite abzüglich KESt), damit der Vergleich fair bleibt —
  // nach dem Verkauf würde die Wohnung ja ebenfalls in ein Depot fließen.
  const rEntnahmePaPct = e.depotRenditePa * (1 - RR_KEST)
  const depotMonat = berechneEntnahmeMonat(depotVerlauf.endwertNachSteuer, rEntnahmePaPct, e.entnahmeJahre)
  const immoMonat = berechneEntnahmeMonat(endwertWohnung, rEntnahmePaPct, e.entnahmeJahre)
  const letzterCashflow = cashflows[cashflows.length - 1] ?? 0
  const nebenkontoEntnahmeMonat = berechneEntnahmeMonat(nebenkonto.endwertNachSteuer, rEntnahmePaPct, e.entnahmeJahre)
  const immoOhneVerkaufMonat = letzterCashflow + nebenkontoEntnahmeMonat

  const warnungen: string[] = []
  if (kreditErg.warnung) warnungen.push(kreditErg.warnung)
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
      kaufNK: kreditErg.kaufNK, kreditNKSumme: kreditErg.kreditNKSumme, barbedarf: kreditErg.barbedarf,
      immobilienwertEnde, restschuldEnde, verkaufskosten, immoEstAnwendbar, immoEst, afaKumuliert: afaKumuliertEnde,
      mieteKumuliert, steuerEffektKumuliert, nebenkontoEndwert: nebenkonto.endwertNachSteuer,
      zuzahlungenKumuliert: nebenkonto.entnommen, endwertNachSteuer: endwertWohnung,
    },
    differenz: endwertWohnung - depotVerlauf.endwertNachSteuer,
    entnahme: { depotMonat, immoMonat, immoOhneVerkaufMonat },
    warnungen,
  }
}
