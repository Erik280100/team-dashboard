// Finanzierungsrechner (Kredit-/Tilgungsrechner) — errechnet aus Kaufpreis, Eigenmitteln
// und der Frage "Makler ja/nein" automatisch die Kauf- und Kreditnebenkosten, den
// tatsächlich benötigten Kreditbetrag und den monatsgenauen Annuitätentilgungsplan
// (Zins/Tilgung/Restschuld, Gesamtzinsen, Effektivzinssatz).
//
// Sätze recherchiert (Stand 2026, marktüblich Österreich, siehe Quellen im Plan):
// Grunderwerbsteuer 3,5 % (Regelsatz), Grundbucheintragung Eigentum 1,1 %, Vertragserrichtung
// RA/Notar ~2 % netto, Maklerprovision ~3 % netto (jeweils + 20 % USt), Kreditvertragserstellung
// ~3 % der Kreditsumme, Pfandrechtseintragung 1,2 % + 20 % Nebengebührensicherstellung. Die
// befristete Grundbuch-/Pfandrechtsbefreiung für Eigenheime ist am 30.06.2026 ausgelaufen und
// wird hier bewusst nicht (mehr) berücksichtigt.

export interface KreditSaetze {
  grunderwerbsteuerPct: number
  grundbuchEintragungPct: number
  vertragserrichtungPct: number
  maklerprovisionPct: number
  ustPct: number
  sonstigeKaufNK: number
  kreditvertragserstellungPct: number
  pfandrechtPct: number
  nebengebuehrensicherstellungPct: number
  sonstigeKreditNK: number
  gebaeudeanteilPct: number
  afaSatzPct: number
}

export const KREDIT_DEFAULTS: KreditSaetze = {
  grunderwerbsteuerPct: 3.5,
  grundbuchEintragungPct: 1.1,
  vertragserrichtungPct: 2.0,
  maklerprovisionPct: 3.0,
  ustPct: 20,
  sonstigeKaufNK: 0,
  kreditvertragserstellungPct: 3.0,
  pfandrechtPct: 1.2,
  nebengebuehrensicherstellungPct: 20,
  sonstigeKreditNK: 0,
  gebaeudeanteilPct: 80,
  afaSatzPct: 1.5,
}

export interface KostenPosition {
  label: string
  betrag: number
  hinweis: string
}

export interface KaufnebenkostenErgebnis {
  positionen: KostenPosition[]
  summe: number
}

/** Kaufnebenkosten (Grunderwerbsteuer, Grundbuch, Vertragserrichtung, ggf. Makler) auf Basis des Kaufpreises. */
export function berechneKaufnebenkosten(
  kaufpreis: number, mitMakler: boolean, saetze: KreditSaetze = KREDIT_DEFAULTS
): KaufnebenkostenErgebnis {
  const kp = Math.max(0, kaufpreis)
  const ustFaktor = 1 + saetze.ustPct / 100

  const positionen: KostenPosition[] = [
    { label: "Grunderwerbsteuer", betrag: kp * (saetze.grunderwerbsteuerPct / 100), hinweis: `${saetze.grunderwerbsteuerPct.toLocaleString("de-AT")} % vom Kaufpreis` },
    { label: "Grundbucheintragung (Eigentum)", betrag: kp * (saetze.grundbuchEintragungPct / 100), hinweis: `${saetze.grundbuchEintragungPct.toLocaleString("de-AT")} % vom Kaufpreis` },
    { label: "Vertragserrichtung (RA/Notar, inkl. USt)", betrag: kp * (saetze.vertragserrichtungPct / 100) * ustFaktor, hinweis: `${saetze.vertragserrichtungPct.toLocaleString("de-AT")} % + ${saetze.ustPct.toLocaleString("de-AT")} % USt` },
  ]
  if (mitMakler) {
    positionen.push({
      label: "Maklerprovision (inkl. USt)",
      betrag: kp * (saetze.maklerprovisionPct / 100) * ustFaktor,
      hinweis: `${saetze.maklerprovisionPct.toLocaleString("de-AT")} % + ${saetze.ustPct.toLocaleString("de-AT")} % USt`,
    })
  }
  if (saetze.sonstigeKaufNK > 0) {
    positionen.push({ label: "Sonstige Kaufnebenkosten", betrag: saetze.sonstigeKaufNK, hinweis: "Fixbetrag" })
  }

  return { positionen, summe: positionen.reduce((s, p) => s + p.betrag, 0) }
}

export interface KreditbetragEingabe {
  kaufpreis: number
  eigenmittel: number
  mitMakler: boolean
  nkMitfinanziert: boolean
  saetze?: KreditSaetze
}

export interface KreditbetragErgebnis {
  kaufNK: KaufnebenkostenErgebnis
  kreditNKPositionen: KostenPosition[]
  kreditNKSumme: number
  kreditbetrag: number
  nettoAuszahlung: number
  gesamtinvestition: number
  barbedarf: number
  beleihungsquotePct: number
  warnung?: string
}

/**
 * Ermittelt den benötigten Kreditbetrag aus Kaufpreis, Eigenmitteln und den Kaufnebenkosten.
 *
 * Bei mitfinanzierten Kreditnebenkosten hängen diese selbst vom Kreditbetrag ab (Bearbeitungs-
 * gebühr und Pfandrechtseintragung sind %-Sätze der Kreditsumme) — das wird nicht iterativ
 * angenähert, sondern exakt aufgelöst:
 *
 *   bedarf = kaufpreis + kaufNK − eigenmittel + fixeKreditNK
 *   r      = kreditvertragserstellungPct + pfandrechtPct × (1 + ngsPct)      (als Anteile, nicht %)
 *   K      = bedarf / (1 − r)
 */
export function berechneKreditbetrag(eingabe: KreditbetragEingabe): KreditbetragErgebnis {
  const saetze = eingabe.saetze ?? KREDIT_DEFAULTS
  const kaufpreis = Math.max(0, eingabe.kaufpreis)
  const eigenmittel = Math.max(0, eingabe.eigenmittel)
  const kaufNK = berechneKaufnebenkosten(kaufpreis, eingabe.mitMakler, saetze)
  const gesamtinvestitionOhneKreditNK = kaufpreis + kaufNK.summe

  const fixeKreditNK = saetze.sonstigeKreditNK
  const bedarf = Math.max(0, gesamtinvestitionOhneKreditNK - eigenmittel + fixeKreditNK)

  let kreditbetrag: number
  let warnung: string | undefined

  if (eingabe.nkMitfinanziert) {
    const r = saetze.kreditvertragserstellungPct / 100
      + (saetze.pfandrechtPct / 100) * (1 + saetze.nebengebuehrensicherstellungPct / 100)
    if (r >= 1) {
      // Theoretisch möglich bei absurd hohen Sätzen — dann lässt sich die Zirkularität
      // nicht mehr auflösen (die %-Kosten würden den Kredit selbst übersteigen).
      kreditbetrag = 0
      warnung = "Kreditnebenkosten-Sätze zu hoch, um den Kredit mitzufinanzieren."
    } else {
      kreditbetrag = bedarf / (1 - r)
    }
  } else {
    kreditbetrag = Math.max(0, gesamtinvestitionOhneKreditNK - eigenmittel)
  }

  const kreditNKPositionen: KostenPosition[] = [
    { label: "Kreditvertragserstellung", betrag: kreditbetrag * (saetze.kreditvertragserstellungPct / 100), hinweis: `${saetze.kreditvertragserstellungPct.toLocaleString("de-AT")} % der Kreditsumme` },
    { label: "Pfandrechtseintragung (inkl. Nebengebührensicherstellung)", betrag: kreditbetrag * (saetze.pfandrechtPct / 100) * (1 + saetze.nebengebuehrensicherstellungPct / 100), hinweis: `${saetze.pfandrechtPct.toLocaleString("de-AT")} % + ${saetze.nebengebuehrensicherstellungPct.toLocaleString("de-AT")} % Aufschlag` },
  ]
  if (saetze.sonstigeKreditNK > 0) {
    kreditNKPositionen.push({ label: "Sonstige Kreditnebenkosten", betrag: saetze.sonstigeKreditNK, hinweis: "Fixbetrag" })
  }
  const kreditNKSumme = kreditNKPositionen.reduce((s, p) => s + p.betrag, 0)

  const nettoAuszahlung = kreditbetrag - kreditNKSumme
  const gesamtinvestition = gesamtinvestitionOhneKreditNK + kreditNKSumme
  // Barbedarf: was zusätzlich zu den Eigenmitteln bar aufgebracht werden muss, wenn die
  // Kreditnebenkosten NICHT mitfinanziert werden (bei mitfinanziert ist das 0, da alles im Kredit steckt).
  const barbedarf = eingabe.nkMitfinanziert ? 0 : Math.max(0, kreditNKSumme - Math.max(0, eigenmittel - gesamtinvestitionOhneKreditNK))
  const beleihungsquotePct = kaufpreis > 0 ? (kreditbetrag / kaufpreis) * 100 : 0

  if (!warnung && eigenmittel < kaufNK.summe) {
    warnung = "Die Eigenmittel decken nicht einmal die Kaufnebenkosten."
  } else if (!warnung && beleihungsquotePct > 80) {
    warnung = "Beleihungsquote über 80 % — höhere Zinsen/strengere Bankvorgaben möglich."
  }

  return {
    kaufNK, kreditNKPositionen, kreditNKSumme, kreditbetrag, nettoAuszahlung,
    gesamtinvestition, barbedarf, beleihungsquotePct, warnung,
  }
}

export interface TilgungsMonat {
  monat: number
  zins: number
  tilgung: number
  restschuld: number
}

export interface TilgungsJahr {
  jahr: number
  rateSumme: number
  zinsen: number
  tilgung: number
  restschuld: number
}

export interface TilgungsplanErgebnis {
  rate: number
  monate: TilgungsMonat[]
  jahre: TilgungsJahr[]
  gesamtzinsen: number
  gesamtaufwand: number
}

/**
 * Annuitätendarlehen, monatliche nachschüssige Verzinsung/Tilgung — das in Österreich
 * übliche Modell für Hypothekarkredite (gleichbleibende Rate über die Laufzeit).
 *
 *   i    = zinsPct / 100 / 12
 *   n    = laufzeitJahre * 12
 *   rate = K * i / (1 − (1+i)^−n)          (bzw. K/n bei i = 0)
 *
 * Die letzte Monatsrate wird um den Rundungsrest korrigiert, damit die Restschuld exakt
 * auf 0 endet.
 */
export function berechneTilgungsplan(kreditbetrag: number, zinsPct: number, laufzeitJahre: number): TilgungsplanErgebnis {
  const K = Math.max(0, kreditbetrag)
  const n = Math.max(0, Math.round(laufzeitJahre * 12))
  const i = zinsPct / 100 / 12

  if (K <= 0 || n <= 0) {
    return { rate: 0, monate: [], jahre: [], gesamtzinsen: 0, gesamtaufwand: 0 }
  }

  const rate = i === 0 ? K / n : (K * i) / (1 - Math.pow(1 + i, -n))

  const monate: TilgungsMonat[] = []
  let rest = K
  for (let m = 1; m <= n; m++) {
    const zins = rest * i
    let tilgung = rate - zins
    if (m === n) {
      // Rundungsrest in der letzten Rate ausgleichen, damit die Restschuld exakt 0 wird.
      tilgung = rest
    }
    rest = Math.max(0, rest - tilgung)
    monate.push({ monat: m, zins, tilgung, restschuld: rest })
  }

  const jahre: TilgungsJahr[] = []
  for (let j = 0; j < Math.ceil(n / 12); j++) {
    const monateDesJahres = monate.slice(j * 12, j * 12 + 12)
    jahre.push({
      jahr: j + 1,
      rateSumme: monateDesJahres.reduce((s, m) => s + m.zins + m.tilgung, 0),
      zinsen: monateDesJahres.reduce((s, m) => s + m.zins, 0),
      tilgung: monateDesJahres.reduce((s, m) => s + m.tilgung, 0),
      restschuld: monateDesJahres[monateDesJahres.length - 1].restschuld,
    })
  }

  const gesamtzinsen = monate.reduce((s, m) => s + m.zins, 0)
  const gesamtaufwand = K + gesamtzinsen

  return { rate, monate, jahre, gesamtzinsen, gesamtaufwand }
}

export interface AfaJahr {
  jahr: number
  faktor: number
  afa: number
  afaKumuliert: number
}

/** AfA-Bemessungsgrundlage (Gebäudewert): Grund und Boden ist nicht abschreibbar, daher nur
 *  ein pauschaler Anteil des Kaufpreises (Default 80 % Gebäude / 20 % Grund). */
export function berechneAfaBemessungsgrundlage(kaufpreis: number, gebaeudeanteilPct: number): number {
  return Math.max(0, kaufpreis) * (Math.max(0, gebaeudeanteilPct) / 100)
}

/**
 * Beschleunigte AfA für Gebäude (§ 8 Abs. 1a EStG): im ersten Jahr das Dreifache, im zweiten
 * Jahr das Zweifache des linearen AfA-Satzes, ab dem dritten Jahr der normale (lineare) Satz.
 */
export function berechneAfaJahre(bemessungsgrundlage: number, afaSatzPct: number, jahre: number): AfaJahr[] {
  const basis = Math.max(0, bemessungsgrundlage)
  const satz = Math.max(0, afaSatzPct) / 100
  const n = Math.max(0, Math.round(jahre))

  const ergebnisse: AfaJahr[] = []
  let kumuliert = 0
  for (let j = 1; j <= n; j++) {
    const faktor = j === 1 ? 3 : j === 2 ? 2 : 1
    const afa = Math.max(0, Math.min(basis * satz * faktor, basis - kumuliert))
    kumuliert += afa
    ergebnisse.push({ jahr: j, faktor, afa, afaKumuliert: kumuliert })
  }
  return ergebnisse
}

/**
 * Effektivzinssatz (IRR) unter Berücksichtigung der einmalig mitfinanzierten Kreditnebenkosten:
 * die Bank zahlt netto nur `nettoAuszahlung` aus, der Kreditnehmer zahlt aber `rate` auf den
 * vollen Kreditbetrag zurück — der Nominalzins unterschätzt daher die tatsächliche Belastung.
 * Gesucht ist der monatliche Zins r_eff mit nettoAuszahlung = Σ rate / (1+r_eff)^m, gelöst per
 * Bisection und anschließend geometrisch auf ein Jahr hochgerechnet ((1+r_eff)^12 − 1).
 */
export function effektivzinsPct(nettoAuszahlung: number, rate: number, monate: number): number {
  if (nettoAuszahlung <= 0 || rate <= 0 || monate <= 0) return 0

  const barwert = (rMonat: number): number => {
    if (rMonat === 0) return rate * monate
    return (rate * (1 - Math.pow(1 + rMonat, -monate))) / rMonat
  }

  let lo = 0
  let hi = 1 // 100% pro Monat als sichere Obergrenze
  // Bei sehr kleiner Nettoauszahlung relativ zur Rate kann der Barwert selbst bei r=1 noch
  // zu groß sein (Randfall) — hi iterativ erweitern.
  while (barwert(hi) > nettoAuszahlung && hi < 1e6) hi *= 2

  for (let iter = 0; iter < 80; iter++) {
    const mid = (lo + hi) / 2
    if (barwert(mid) > nettoAuszahlung) lo = mid
    else hi = mid
  }

  const rMonatEff = (lo + hi) / 2
  return (Math.pow(1 + rMonatEff, 12) - 1) * 100
}

export function kreditFormatEUR(n: number): string {
  return Math.round(n).toLocaleString("de-AT") + " €"
}

export function kreditFormatPct(n: number, digits = 2): string {
  return n.toLocaleString("de-AT", { minimumFractionDigits: digits, maximumFractionDigits: digits }) + " %"
}
