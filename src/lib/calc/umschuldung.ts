// Umschuldungsrechner — vergleicht den bestehenden Kredit (offener Betrag, Restlaufzeit, Zins)
// mit einem neuen Kredit. Der neue Kredit nutzt die Logik des Finanzierungsrechners
// (Annuitätentilgungsplan, Kreditnebenkosten, Effektivzins), siehe kredit.ts.
import {
  KREDIT_DEFAULTS, berechneKreditNebenkosten, berechneTilgungsplan, effektivzinsPct,
  type KostenPosition, type KreditSaetze, type TilgungsplanErgebnis,
} from "@/lib/calc/kredit"

export const VFE_DEFAULT_PCT = 1

export interface UmschuldungEingabe {
  restschuld: number
  restlaufzeitMonate: number
  zinsAltPct: number
  zinsNeuPct: number
  laufzeitNeuJahre: number
  vfeAktiv: boolean
  vfePct: number
  kostenMitfinanziert: boolean
  saetze?: KreditSaetze
}

export interface UmschuldungErgebnis {
  planAlt: TilgungsplanErgebnis
  planNeu: TilgungsplanErgebnis
  vfe: number
  kostenPositionen: KostenPosition[]
  kreditNKSumme: number
  /** Neuer Kreditbetrag (inkl. mitfinanzierter Kosten). */
  kreditbetragNeu: number
  /** Kosten, die bar zu zahlen sind (nur wenn nicht mitfinanziert). */
  barkosten: number
  effektivzinsNeu: number
  gesamtaufwandAlt: number
  gesamtaufwandNeu: number
  /** Gesamtaufwand alt − neu (positiv = Umschuldung spart Geld). */
  vorteil: number
  ersparnisProMonat: number
  /** Erster Monat, ab dem die Umschuldung in Summe günstiger ist; null = nie. */
  breakEvenMonat: number | null
  warnungen: string[]
}

export function berechneUmschuldung(e: UmschuldungEingabe): UmschuldungErgebnis {
  const saetze = e.saetze ?? KREDIT_DEFAULTS
  const restschuld = Math.max(0, e.restschuld)
  const nAlt = Math.max(0, Math.round(e.restlaufzeitMonate))
  const planAlt = berechneTilgungsplan(restschuld, e.zinsAltPct, nAlt / 12)

  const vfe = e.vfeAktiv ? restschuld * (Math.max(0, e.vfePct) / 100) : 0
  const warnungen: string[] = []

  let kreditbetragNeu: number
  if (e.kostenMitfinanziert) {
    const r = saetze.kreditvertragserstellungPct / 100
      + (saetze.pfandrechtPct / 100) * (1 + saetze.nebengebuehrensicherstellungPct / 100)
    if (r >= 1) {
      kreditbetragNeu = 0
      warnungen.push("Kreditnebenkosten-Sätze zu hoch, um den Kredit mitzufinanzieren.")
    } else {
      kreditbetragNeu = (restschuld + vfe + saetze.sonstigeKreditNK) / (1 - r)
    }
  } else {
    kreditbetragNeu = restschuld
  }
  if (restschuld <= 0) kreditbetragNeu = 0

  const nk = berechneKreditNebenkosten(kreditbetragNeu, saetze)
  const kostenPositionen: KostenPosition[] = []
  if (e.vfeAktiv) {
    kostenPositionen.push({
      label: "Vorfälligkeitsentschädigung",
      betrag: vfe,
      hinweis: `${e.vfePct.toLocaleString("de-AT")} % der Restschuld`,
    })
  }
  kostenPositionen.push(...nk.positionen)
  const barkosten = e.kostenMitfinanziert ? 0 : vfe + nk.summe

  const planNeu = berechneTilgungsplan(kreditbetragNeu, e.zinsNeuPct, e.laufzeitNeuJahre)
  const effektivzinsNeu = effektivzinsPct(kreditbetragNeu - nk.summe, planNeu.rate, planNeu.monate.length)

  const gesamtaufwandAlt = planAlt.gesamtaufwand
  const gesamtaufwandNeu = planNeu.gesamtaufwand + barkosten
  const vorteil = gesamtaufwandAlt - gesamtaufwandNeu

  // Break-even: kumulierte Zahlungen + noch offene Restschuld (+ Barkosten beim neuen Kredit).
  let breakEvenMonat: number | null = null
  const maxN = Math.max(planAlt.monate.length, planNeu.monate.length)
  let zahltAlt = 0
  let zahltNeu = 0
  for (let m = 1; m <= maxN; m++) {
    const a = planAlt.monate[m - 1]
    const n = planNeu.monate[m - 1]
    if (a) zahltAlt += a.zins + a.tilgung
    if (n) zahltNeu += n.zins + n.tilgung
    const restAlt = a ? a.restschuld : 0
    const restNeu = n ? n.restschuld : 0
    if (barkosten + zahltNeu + restNeu <= zahltAlt + restAlt) {
      breakEvenMonat = m
      break
    }
  }

  if (restschuld > 0 && vorteil < 0) {
    warnungen.push("Die Umschuldung verursacht in Summe mehr Kosten als der bestehende Kredit.")
  }
  if (e.laufzeitNeuJahre * 12 > nAlt && nAlt > 0) {
    warnungen.push("Die neue Laufzeit ist länger als die Restlaufzeit — niedrigere Rate, aber längere Belastung.")
  }
  if (e.laufzeitNeuJahre > 35) {
    warnungen.push("Laufzeit über 35 Jahre — über der FMA-Empfehlung für nachhaltige Immobilienfinanzierung.")
  }

  return {
    planAlt, planNeu, vfe, kostenPositionen, kreditNKSumme: nk.summe, kreditbetragNeu, barkosten,
    effektivzinsNeu, gesamtaufwandAlt, gesamtaufwandNeu, vorteil,
    ersparnisProMonat: planAlt.rate - planNeu.rate, breakEvenMonat, warnungen,
  }
}
