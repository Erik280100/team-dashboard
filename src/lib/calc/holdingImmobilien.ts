// Holding & Immobilien-GmbH — vergleicht den Kauf einer vermieteten Anlegerwohnung über drei
// Wege: A) privat (Kapital muss vorher aus einer GmbH ausgeschüttet oder als EU-Gewinn versteuert
// werden), B) über eine Kapitalgesellschaft, die den Gewinn direkt investiert (keine KESt-
// Leckage beim Kapitaltransfer). Baut bewusst auf berechneInvestVsWohnung() auf (dieselbe
// Kaufnebenkosten-/Tilgungs-/AfA-Logik wie im Finanzierungsrechner) statt die Immobilien-
// Mechanik zu duplizieren — nur die Steuersätze und die Herkunft der Eigenmittel unterscheiden
// die Wege.
//
// Kernaussage, die dieses Modul vorführt: eine Holding + eigene Immobilien-GmbH ist steuerlich
// IDENTISCH zu einem Direktkauf durch die bestehende operative GmbH — beide vermeiden die
// KESt-Leckage beim Kapitaltransfer. Der Unterschied ist reine Haftungstrennung, erkauft mit den
// zusätzlichen Fixkosten einer weiteren Gesellschaft (eigene Bilanz, eigener Jahresabschluss).
// Siehe gmbhVsEu.ts für die KöSt/KESt-Sätze und zypernLtd.ts für ein analoges Muster.
//
// Steuerliche Behandlung des Vermietungsergebnisses:
//  - Privat: Einkünfte aus Vermietung und Verpachtung, persönlicher (Grenz-)Steuersatz, beim
//    Verkauf 30 % ImmoESt (Immobilienertragsteuer, § 30 EStG — seit Abschaffung der
//    Spekulationsfrist 2012 immer fällig, keine Hauptwohnsitzbefreiung bei Vermietung).
//  - GmbH: 23 % KöSt auf das laufende Vermietungsergebnis wie auf jedes andere betriebliche
//    Einkommen, beim Verkauf ebenfalls 23 % KöSt auf den Veräußerungsgewinn (kein Sondersatz wie
//    privat). Bleibt der Verkaufserlös in der Gesellschaft, ist das die gesamte Steuerlast; wird
//    er an dich privat ausgeschüttet, kommt vereinfachend nochmal 27,5 % KESt auf den vollen
//    Betrag obendrauf (Näherung — technisch wäre nur der Bilanzgewinnanteil KESt-pflichtig, eine
//    Kapitalrückzahlung bis zur Höhe der eingelegten Eigenmittel wäre als Einlagenrückgewähr
//    KESt-frei möglich; hier bewusst konservativ/einfach gerechnet).
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
  kapitalherkunft: "gmbh" as "gmbh" | "eu",
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
  kapitalherkunft: "gmbh" | "eu"
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

  ueberHolding: boolean
  holdingFixkostenJahr: number
  holdingGruendungskostenEinmalig: number
}

export interface HoldingImmoErgebnis {
  transferSatzPrivatPct: number
  eigenmittelPrivat: number
  eigenmittelGmbh: number
  wohnungPrivat: InvestVsWohnungErgebnis["wohnung"]
  wohnungGmbh: InvestVsWohnungErgebnis["wohnung"]
  jahrePrivat: InvestVsWohnungErgebnis["jahre"]
  jahreGmbh: InvestVsWohnungErgebnis["jahre"]
  holdingFixkostenGesamt: number
  endwertPrivat: number
  endwertGmbhThesauriert: number
  endwertGmbhAusgeschuettet: number
  warnungen: string[]
}

export function berechneHoldingImmobilien(e: HoldingImmoEingabe): HoldingImmoErgebnis {
  const saetze = e.saetze ?? KREDIT_DEFAULTS
  const gewinn = Math.max(0, e.verfuegbarerGewinnVorSteuer)
  const horizontJahre = Math.max(1, Math.round(e.horizontJahre))

  const transferSatzPrivatPct = e.kapitalherkunft === "gmbh"
    ? GMBH_AUSSCHUETTUNG_EFFEKTIV_SATZ * 100
    : Math.min(100, Math.max(0, e.euGrenzsteuersatzPct))
  const eigenmittelPrivat = gewinn * (1 - transferSatzPrivatPct / 100)
  const eigenmittelGmbh = gewinn * (1 - KOEST_SATZ)

  const basisEingabe = {
    entnahmeJahre: 0, depotRenditePa: 0,
    kaufpreis: Math.max(0, e.kaufpreis), mitMakler: e.mitMakler, nkMitfinanziert: e.nkMitfinanziert,
    horizontJahre, kreditLaufzeitJahre: Math.max(1, e.kreditLaufzeitJahre), kreditZinsPct: e.kreditZinsPct,
    mieteMonat: e.mieteMonat, indexierungPct: e.indexierungPct, leerstandPct: e.leerstandPct,
    bewirtschaftungMonat: e.bewirtschaftungMonat, wertsteigerungPct: e.wertsteigerungPct,
    verkaufskostenPct: e.verkaufskostenPct, saetze,
  }

  const ergPrivat = berechneInvestVsWohnung({
    ...basisEingabe, eigenmittel: eigenmittelPrivat,
    grenzsteuersatzPct: Math.min(100, Math.max(0, e.grenzsteuersatzVermietungPct)), immoEstPct: IMMO_EST_PRIVAT_SATZ * 100,
  })
  const ergGmbh = berechneInvestVsWohnung({
    ...basisEingabe, eigenmittel: eigenmittelGmbh,
    grenzsteuersatzPct: KOEST_SATZ * 100, immoEstPct: KOEST_SATZ * 100,
  })

  const holdingFixkostenGesamt = e.ueberHolding
    ? Math.max(0, e.holdingFixkostenJahr) * horizontJahre + Math.max(0, e.holdingGruendungskostenEinmalig)
    : 0

  const endwertPrivat = ergPrivat.wohnung.endwertNachSteuer
  const endwertGmbhVorFixkosten = ergGmbh.wohnung.endwertNachSteuer
  const endwertGmbhThesauriert = endwertGmbhVorFixkosten - holdingFixkostenGesamt
  const endwertGmbhAusgeschuettet = endwertGmbhThesauriert * (1 - KEST_SATZ)

  const warnungen: string[] = [...ergPrivat.warnungen]

  return {
    transferSatzPrivatPct, eigenmittelPrivat, eigenmittelGmbh,
    wohnungPrivat: ergPrivat.wohnung, wohnungGmbh: ergGmbh.wohnung,
    jahrePrivat: ergPrivat.jahre, jahreGmbh: ergGmbh.jahre,
    holdingFixkostenGesamt, endwertPrivat, endwertGmbhThesauriert, endwertGmbhAusgeschuettet,
    warnungen,
  }
}
