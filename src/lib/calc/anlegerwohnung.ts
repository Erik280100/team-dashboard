// Anlegerwohnungs-Rechner — 1:1-Abbild von "DAS IMMO EXCEL - mit Maximalkreditbetrag.xlsx".
// Eingaben, Formeln und Ausgaben entsprechen dem Excel-Blatt (Zellbezüge in den Kommentaren).

// Standard-Kaufnebenkosten (Excel-Werte): Kaufvertrag 1,25 % + 20 % USt = 1,5 %, Makler 3 % + 20 % USt = 3,6 %
export interface KaufnebenkostenSaetze {
  kaufvertragPct: number // netto, zzgl. USt
  notar: number // pauschal in €
  eintragungPct: number
  grunderwerbsteuerPct: number
  maklerPct: number // netto, zzgl. USt
  ustPct: number
}
export const KAUFNEBENKOSTEN_DEFAULTS: KaufnebenkostenSaetze = {
  kaufvertragPct: 1.25, notar: 1000, eintragungPct: 1.1, grunderwerbsteuerPct: 3.5, maklerPct: 3, ustPct: 20,
}
export const KREDITVERTRAG_PCT = 0.03
export const KREDIT_EINTRAGUNG_PCT = 0.012
export const KREDIT_EINTRAGUNG_AUFSCHLAG = 1.2 // + 20 % Steuern
export const STEIGERUNG = 1.02 // Miete und Wohnungswert p.a.
export const AFA_ANTEIL = 0.8
export const AFA_SATZ = 0.015

export interface AnlegerwohnungEingabe {
  maxKreditPct: number // B4, z. B. 90
  laufzeitJahre: number // C4
  groesseM2: number // D4
  mieteProM2: number // E4
  nettokaufpreis: number // F4
  zinsPct: number // G4, z. B. 3.75
  grenzsteuerPct: number // G7, z. B. 40
  eigenmittel: number | null // C25, null = leer
  kaufnebenkosten: KaufnebenkostenSaetze
}

export interface AnlegerwohnungJahr {
  jahr: number
  mieteMonat: number
  mieteJahr: number
  kreditrate: number
  restschuld: number
  zinsen: number
  ueberschussVorAfa: number
  afa: number
  steuerpflGewinn: number
  nettogewinn: number
  tilgung: number
  cashflow: number
  wohnungswert: number
}

export interface AnlegerwohnungErgebnis {
  kaufvertrag: number
  notar: number
  eintragung: number
  grunderwerbsteuer: number
  makler: number
  summeOhneKreditkosten: number // C13
  kaufnebenkosten: number // C15
  kreditbetrag: number // C16
  errichtungKredit: number // C18
  eintragungKredit: number // C19
  summeKredit: number // C20
  auszahlung: number // C22
  mindestEigenmittel: number // C24
  eigenmittelHinweis: string // D25
  eingesetzteEigenmittel: number // C26
  kreditrateMonat: number // C27
  mieteMonat: number // C28
  rendite: number | null // C30, in %
  ekRendite: number | null // C31, in %
  jahre: AnlegerwohnungJahr[]
  summeCashflow: number // T40
}

function pmt(zinsPctPa: number, monate: number, betrag: number): number {
  const i = zinsPctPa / 100 / 12
  if (monate <= 0) return 0
  if (i === 0) return betrag / monate
  return (betrag * i) / (1 - Math.pow(1 + i, -monate))
}

export function berechneAnlegerwohnung(e: AnlegerwohnungEingabe): AnlegerwohnungErgebnis {
  const kp = e.nettokaufpreis
  const k = e.kaufnebenkosten
  const ust = 1 + k.ustPct / 100
  const kaufvertrag = kp * (k.kaufvertragPct / 100) * ust
  const notar = k.notar
  const eintragung = kp * (k.eintragungPct / 100)
  const grunderwerbsteuer = kp * (k.grunderwerbsteuerPct / 100)
  const makler = kp * (k.maklerPct / 100) * ust
  const summeOhneKreditkosten = kp + kaufvertrag + notar + eintragung + grunderwerbsteuer + makler
  const kaufnebenkosten = summeOhneKreditkosten - kp

  const faktor = 1 - KREDITVERTRAG_PCT - KREDIT_EINTRAGUNG_AUFSCHLAG * KREDIT_EINTRAGUNG_PCT
  const maxKredit = kp * (e.maxKreditPct / 100)
  const mindestEigenmittel = summeOhneKreditkosten - maxKredit * faktor
  const eingesetzteEigenmittel = Math.min(summeOhneKreditkosten, Math.max(mindestEigenmittel, e.eigenmittel ?? 0))
  const kreditbetrag = Math.max(0, Math.min(maxKredit, (summeOhneKreditkosten - eingesetzteEigenmittel) / faktor))
  const errichtungKredit = kreditbetrag * KREDITVERTRAG_PCT
  const eintragungKredit = kreditbetrag * KREDIT_EINTRAGUNG_AUFSCHLAG * KREDIT_EINTRAGUNG_PCT
  const summeKredit = kreditbetrag + errichtungKredit + eintragungKredit
  const auszahlung = kreditbetrag - errichtungKredit - eintragungKredit

  let eigenmittelHinweis = "← hier eintragen"
  if (e.eigenmittel !== null) {
    if (e.eigenmittel < mindestEigenmittel) eigenmittelHinweis = "Unter Minimum – Mindestwert wird verwendet"
    else if (e.eigenmittel > summeOhneKreditkosten) eigenmittelHinweis = "Mehr als Gesamtkosten – kein Kredit nötig"
  }

  const kreditrateMonat = pmt(e.zinsPct, Math.round(e.laufzeitJahre * 12), summeKredit)
  const mieteMonat = e.groesseM2 * e.mieteProM2
  const rendite = summeKredit > 0 ? (mieteMonat * 12 / summeKredit) * 100 : null
  const zins = e.zinsPct
  const ekNenner = kaufnebenkosten + kp - kreditbetrag
  const ekRendite = rendite !== null && ekNenner !== 0
    ? rendite + (rendite - zins) * kreditbetrag / ekNenner
    : null

  const afaBasis = (kp + kaufvertrag + notar + eintragung + grunderwerbsteuer + makler) * AFA_ANTEIL * AFA_SATZ
  const jahre: AnlegerwohnungJahr[] = []
  const n = Math.max(0, Math.round(e.laufzeitJahre))
  let miete = mieteMonat
  let restschuld = summeKredit
  let wert = kp
  let summeCashflow = 0
  for (let j = 1; j <= n; j++) {
    if (j > 1) {
      miete *= STEIGERUNG
      wert *= STEIGERUNG
    }
    const mieteJahr = miete * 12
    const kreditrate = kreditrateMonat * 12
    const zinsen = restschuld * (zins / 100)
    const ueberschussVorAfa = mieteJahr - zinsen
    const afa = afaBasis * (j === 1 ? 3 : j === 2 ? 2 : 1)
    const steuerpflGewinn = ueberschussVorAfa - afa
    const nettogewinn = steuerpflGewinn * (1 - e.grenzsteuerPct / 100)
    const tilgung = kreditrate - zinsen
    const cashflow = afa + nettogewinn - tilgung
    summeCashflow += cashflow
    jahre.push({
      jahr: j, mieteMonat: miete, mieteJahr, kreditrate, restschuld, zinsen, ueberschussVorAfa, afa,
      steuerpflGewinn, nettogewinn, tilgung, cashflow, wohnungswert: wert,
    })
    restschuld = restschuld + zinsen - kreditrate
  }

  return {
    kaufvertrag, notar, eintragung, grunderwerbsteuer, makler, summeOhneKreditkosten, kaufnebenkosten,
    kreditbetrag, errichtungKredit, eintragungKredit, summeKredit, auszahlung, mindestEigenmittel,
    eigenmittelHinweis, eingesetzteEigenmittel, kreditrateMonat, mieteMonat, rendite, ekRendite, jahre, summeCashflow,
  }
}
