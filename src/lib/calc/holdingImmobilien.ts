// Holding & Immobilien-GmbH — vergleicht den Kauf einer vermieteten Anlegerwohnung über drei
// gleichzeitig sichtbare Wege: A) Einzelunternehmer, der seinen EU-Gewinn privat investiert,
// B) eine bestehende GmbH, deren Gewinn erst ausgeschüttet und dann privat investiert wird,
// C) eine Kapitalgesellschaft (direkt die operative GmbH oder eine Holding mit eigener
// Immobilien-GmbH), die den Gewinn ohne Umweg über das Privatvermögen direkt investiert. Baut
// bewusst auf berechneInvestVsWohnung() auf (dieselbe Kaufnebenkosten-/Tilgungs-/AfA-Logik wie
// im Finanzierungsrechner) statt die Immobilien-Mechanik zu duplizieren — nur die Steuersätze
// und die Herkunft der Eigenmittel unterscheiden die drei Wege.
//
// Kernaussage, die dieses Modul vorführt: eine Holding + eigene Immobilien-GmbH ist steuerlich
// IDENTISCH zu einem Direktkauf durch die bestehende operative GmbH (Weg C) — beide vermeiden
// die KESt-Leckage beim Kapitaltransfer, die Weg A und B jeweils auf ihre Art treffen. Der
// Unterschied zwischen Direktkauf und Holding ist reine Haftungstrennung, erkauft mit den
// zusätzlichen Fixkosten einer weiteren Gesellschaft (eigene Bilanz, eigener Jahresabschluss).
// Siehe gmbhVsEu.ts für die KöSt/KESt-Sätze und zypernLtd.ts für ein analoges Muster.
//
// Steuerliche Behandlung des Vermietungsergebnisses:
//  - Privat (Weg A und B): Einkünfte aus Vermietung und Verpachtung, persönlicher
//    (Grenz-)Steuersatz, beim Verkauf 30 % ImmoESt (Immobilienertragsteuer, § 30 EStG — seit
//    Abschaffung der Spekulationsfrist 2012 immer fällig, keine Hauptwohnsitzbefreiung bei
//    Vermietung).
//  - Kapitalgesellschaft (Weg C): 23 % KöSt auf das laufende Vermietungsergebnis wie auf jedes
//    andere betriebliche Einkommen, beim Verkauf ebenfalls 23 % KöSt auf den
//    Veräußerungsgewinn (kein Sondersatz wie privat). Das ist der Endwert, solange das Geld in
//    der Gesellschaft bleibt — wird es später doch privat entnommen, kommt nochmal 27,5 % KESt
//    obendrauf (siehe Weg B: ökonomisch fast derselbe Endzustand, nur zeitlich verzögert).
import {
  KREDIT_DEFAULTS, type KreditSaetze,
} from "@/lib/calc/kredit"
import { berechneInvestVsWohnung, type InvestVsWohnungErgebnis } from "@/lib/calc/investVsWohnung"
import { KEST_SATZ, KOEST_SATZ } from "@/lib/calc/gmbhVsEu"

export const IMMO_EST_PRIVAT_SATZ = 0.3
/** Effektive Gesamtbelastung, wenn Kapital aus einer GmbH ausgeschüttet wird, bevor es privat
 * investiert werden kann: 1 − (1 − KöSt) × (1 − KESt). */
export const GMBH_AUSSCHUETTUNG_EFFEKTIV_SATZ = 1 - (1 - KOEST_SATZ) * (1 - KEST_SATZ)

export const DEFAULTS_HOLDING_IMMO = {
  verfuegbarerGewinnVorSteuer: 150000,
  euGrenzsteuersatzPct: 48,
  grenzsteuersatzVermietungPct: 48,

  kaufpreis: 250000,
  mitMakler: true,
  nkMitfinanziert: true,
  horizontJahre: 20,
  kreditLaufzeitJahre: 25,
  kreditZinsPct: 3.5,
  mieteMonat: 950,
  indexierungPct: 1.6,
  leerstandPct: 3,
  bewirtschaftungMonat: 50,
  wertsteigerungPct: 2,
  verkaufskostenPct: 3,

  ueberHolding: true,
  holdingFixkostenJahr: 2500,
  holdingGruendungskostenEinmalig: 3000,
}

export interface HoldingImmoEingabe {
  verfuegbarerGewinnVorSteuer: number
  euGrenzsteuersatzPct: number
  grenzsteuersatzVermietungPct: number

  kaufpreis: number
  mitMakler: boolean
  nkMitfinanziert: boolean
  horizontJahre: number
  kreditLaufzeitJahre: number
  kreditZinsPct: number
  mieteMonat: number
  indexierungPct: number
  leerstandPct: number
  bewirtschaftungMonat: number
  wertsteigerungPct: number
  verkaufskostenPct: number
  saetze?: KreditSaetze

  /** true = Kauf über eine Holding mit eigener Immobilien-GmbH (Haftungstrennung, zusätzliche
   * Fixkosten); false = Direktkauf durch die bestehende operative GmbH (steuerlich identisch,
   * keine zusätzlichen Fixkosten). */
  ueberHolding: boolean
  holdingFixkostenJahr: number
  holdingGruendungskostenEinmalig: number
}

export interface HoldingImmoErgebnis {
  eigenmittelEu: number
  eigenmittelGmbhPrivat: number
  eigenmittelHolding: number
  wohnungEu: InvestVsWohnungErgebnis["wohnung"]
  wohnungGmbhPrivat: InvestVsWohnungErgebnis["wohnung"]
  wohnungHolding: InvestVsWohnungErgebnis["wohnung"]
  holdingFixkostenGesamt: number
  endwertEu: number
  endwertGmbhPrivat: number
  endwertHolding: number
  warnungen: string[]
}

export function berechneHoldingImmobilien(e: HoldingImmoEingabe): HoldingImmoErgebnis {
  const saetze = e.saetze ?? KREDIT_DEFAULTS
  const gewinn = Math.max(0, e.verfuegbarerGewinnVorSteuer)
  const horizontJahre = Math.max(1, Math.round(e.horizontJahre))
  const grenzsteuersatzVermietungPct = Math.min(100, Math.max(0, e.grenzsteuersatzVermietungPct))

  // Weg A — Einzelunternehmer: der Gewinn ist schon beim Entstehen sein persönliches
  // Einkommen (keine separate "Ausschüttung" nötig), einmalig mit dem Grenzsteuersatz belastet.
  const eigenmittelEu = gewinn * (1 - Math.min(100, Math.max(0, e.euGrenzsteuersatzPct)) / 100)
  // Weg B — GmbH-Gewinn wird ausgeschüttet, bevor privat investiert wird: kombinierte
  // KöSt+KESt-Leckage.
  const eigenmittelGmbhPrivat = gewinn * (1 - GMBH_AUSSCHUETTUNG_EFFEKTIV_SATZ)
  // Weg C — Kapitalgesellschaft investiert direkt, keine Leckage außer der KöSt selbst.
  const eigenmittelHolding = gewinn * (1 - KOEST_SATZ)

  const basisEingabe = {
    entnahmeJahre: 0, depotRenditePa: 0,
    kaufpreis: Math.max(0, e.kaufpreis), mitMakler: e.mitMakler, nkMitfinanziert: e.nkMitfinanziert,
    horizontJahre, kreditLaufzeitJahre: Math.max(1, e.kreditLaufzeitJahre), kreditZinsPct: e.kreditZinsPct,
    mieteMonat: e.mieteMonat, indexierungPct: e.indexierungPct, leerstandPct: e.leerstandPct,
    bewirtschaftungMonat: e.bewirtschaftungMonat, wertsteigerungPct: e.wertsteigerungPct,
    verkaufskostenPct: e.verkaufskostenPct, saetze,
  }

  const ergEu = berechneInvestVsWohnung({
    ...basisEingabe, eigenmittel: eigenmittelEu,
    grenzsteuersatzPct: grenzsteuersatzVermietungPct, immoEstPct: IMMO_EST_PRIVAT_SATZ * 100,
  })
  const ergGmbhPrivat = berechneInvestVsWohnung({
    ...basisEingabe, eigenmittel: eigenmittelGmbhPrivat,
    grenzsteuersatzPct: grenzsteuersatzVermietungPct, immoEstPct: IMMO_EST_PRIVAT_SATZ * 100,
  })
  const ergHolding = berechneInvestVsWohnung({
    ...basisEingabe, eigenmittel: eigenmittelHolding,
    grenzsteuersatzPct: KOEST_SATZ * 100, immoEstPct: KOEST_SATZ * 100,
  })

  const holdingFixkostenGesamt = e.ueberHolding
    ? Math.max(0, e.holdingFixkostenJahr) * horizontJahre + Math.max(0, e.holdingGruendungskostenEinmalig)
    : 0

  const endwertEu = ergEu.wohnung.endwertNachSteuer
  const endwertGmbhPrivat = ergGmbhPrivat.wohnung.endwertNachSteuer
  const endwertHolding = ergHolding.wohnung.endwertNachSteuer - holdingFixkostenGesamt

  const warnungen = Array.from(new Set([...ergEu.warnungen, ...ergGmbhPrivat.warnungen, ...ergHolding.warnungen]))

  return {
    eigenmittelEu, eigenmittelGmbhPrivat, eigenmittelHolding,
    wohnungEu: ergEu.wohnung, wohnungGmbhPrivat: ergGmbhPrivat.wohnung, wohnungHolding: ergHolding.wohnung,
    holdingFixkostenGesamt, endwertEu, endwertGmbhPrivat, endwertHolding,
    warnungen,
  }
}
