// Renditerechner — 1:1 portiert aus legacy/index.html:3532–3740.
// Reine Funktionen, keine DOM-Zugriffe. Bei jeder Änderung: Golden-Master-Test
// in test/calc/rendite.golden.test.ts muss weiterhin grün bleiben (gilt nicht für
// den Merkur-Prämientopf in simulateFLV, für simulateFondssparer und für Helvetia in
// simulateFLV — alle drei sind gegen echte Angebote bzw. das offizielle Herstellermodell
// kalibriert/portiert, siehe merkurFlv.ts / fondssparer.ts / helvetiaFlv.ts und
// test/calc/merkur.reference.test.ts / test/calc/fondssparer.reference.test.ts /
// test/calc/helvetia.test.ts).
import { simulateFondssparerKalibriert } from "./fondssparer"
import { simulateHelvetiaFLV } from "./helvetiaFlv"
import { simulateMerkurFLVEinmal, simulateMerkurFLVEntnahme, simulateMerkurFLVPraemie } from "./merkurFlv"

export const RR_KEST = 0.275

// Ergebnis einer Simulation mit optionaler Entnahmephase (siehe simulate*Verlauf-Funktionen
// unten). entnommenNetto ist die tatsächlich ausbezahlte (Netto-)Summe über die Entnahmezeit;
// reichtBisMonat ist der erste Monat (durchgezählt ab Start der Ansparphase), in dem die
// gewünschte Entnahme nicht mehr voll gedeckt werden konnte — null, wenn das Kapital durchhält.
export type RRVerlauf = {
  values: number[]
  entnommenNetto: number
  reichtBisMonat: number | null
}

// Eine Farbe je Sparform, konsistent für Eingabe-Kachel, Chart-Linie und
// Hochrechnungsergebnis-Kachel verwendet (siehe RenditeRechner.tsx).
export type RRProductKey = "flv" | "fondssparer" | "fondsdepot" | "vv"
export const RR_PRODUCT_COLORS: Record<RRProductKey, { line: string; fill: string; tint: string }> = {
  flv: { line: "#155767", fill: "rgba(21,87,103,.08)", tint: "rgba(21,87,103,.05)" },
  fondssparer: { line: "#5B9BD5", fill: "rgba(91,155,213,.08)", tint: "rgba(91,155,213,.06)" },
  fondsdepot: { line: "#B07CC6", fill: "rgba(176,124,198,.08)", tint: "rgba(176,124,198,.06)" },
  vv: { line: "#E7A94C", fill: "rgba(231,169,76,.08)", tint: "rgba(231,169,76,.06)" },
}

export type Provider = "merkur" | "helvetia"

/** Monatlicher Zinssatz aus einer jährlichen Performance (stetige Verzinsung über 12 Monate). */
export function rrRate(pa: number): number {
  return Math.pow(1 + pa, 1 / 12) - 1
}

/**
 * FLV: getrennte Prämien-/Einmalerlag-Töpfe (Kostensätze können differieren).
 * waPct: jährliche Wertanpassung (Prämiendynamik) auf die mtl. Prämie, kontinuierlich
 * verzinst — die Zillmerbasis (gesamtBrutto) bleibt auf der ursprünglich vereinbarten
 * Prämiensumme, da Versicherer diese unabhängig von künftigen, nicht garantierten
 * Wertanpassungen für die Abschlusskostenberechnung heranziehen.
 *
 * entnahmeJahre/entnahmeMonat hängen im Anschluss an die Ansparphase (nur bei Merkur) eine
 * konstante, KESt-freie Monatsentnahme an (netto in der Hand, FLV ist KESt-frei). Ohne Entnahme
 * (entnahmeJahre = 0 oder entnahmeMonat = 0) unverändert zur bisherigen Ansparlogik.
 *
 * eintrittsalter wird nur von Helvetia verwendet (Risikokosten aus der Unisex-Sterbetafel,
 * siehe helvetiaFlv.ts); Merkur ignoriert den Parameter.
 */
export function simulateFLVVerlauf(
  provider: Provider,
  monat: number,
  einmal: number,
  jahre: number,
  perf: number,
  waPct = 0,
  entnahmeJahre = 0,
  entnahmeMonat = 0,
  eintrittsalter = 35
): RRVerlauf {
  if (provider === "merkur") {
    const praemieValues = simulateMerkurFLVPraemie(monat, jahre, perf, waPct)
    const einmalValues = einmal > 0 ? simulateMerkurFLVEinmal(einmal, jahre, perf) : null
    const ansparValues = einmalValues ? praemieValues.map((v, i) => v + einmalValues[i]) : praemieValues
    if (entnahmeJahre <= 0 || entnahmeMonat <= 0) {
      return { values: ansparValues, entnommenNetto: 0, reichtBisMonat: null }
    }
    // Die UI übergibt hier stets einmal = 0, daher wird der Gesamtwert am Ende der
    // Ansparphase einheitlich mit dem Prämientopf-Ertragsaufschlag fortgeschrieben.
    const entnahme = simulateMerkurFLVEntnahme(
      ansparValues[ansparValues.length - 1], entnahmeJahre * 12, entnahmeMonat, perf
    )
    return {
      values: ansparValues.concat(entnahme.values.slice(1)),
      entnommenNetto: entnahme.entnommenNetto,
      reichtBisMonat: entnahme.reichtBisMonat === null ? null : jahre * 12 + entnahme.reichtBisMonat,
    }
  }

  // Helvetia: 1:1-Port aus Helvetia_FLV_Schnellberechnung.pdf (siehe helvetiaFlv.ts). Das
  // PDF-Modell kennt nur eine einmalige Teilentnahme zu einem Stichtag, keine laufende
  // Monatsentnahme wie der Rechner sie anbietet — die UI sperrt die Entnahmephase für Helvetia
  // deshalb. Falls trotzdem eine Entnahme übergeben wird, wird hier nur der reine Ansparverlauf
  // zurückgeliefert (values auf die passende Gesamtlänge aufgefüllt, damit index-basierte
  // Zugriffe wie bei Merkur nicht außerhalb des Arrays landen).
  const result = simulateHelvetiaFLV({ monat, jahre, perf, waPct, eintrittsalter, zuzahlung: einmal })
  if (entnahmeJahre > 0 && entnahmeMonat > 0) {
    const letzterWert = result.values[result.values.length - 1]
    const values = result.values.concat(new Array(entnahmeJahre * 12).fill(letzterWert))
    return { values, entnommenNetto: 0, reichtBisMonat: null }
  }
  return { values: result.values, entnommenNetto: 0, reichtBisMonat: null }
}

export function simulateFLV(
  provider: Provider,
  monat: number,
  einmal: number,
  jahre: number,
  perf: number,
  waPct = 0,
  eintrittsalter = 35
): number[] {
  return simulateFLVVerlauf(provider, monat, einmal, jahre, perf, waPct, 0, 0, eintrittsalter).values
}

/**
 * Fondssparer: kein Einmalerlag, keine Zillmerung, keine Kickbacks. Sparprämie, laufende
 * Kosten und Ertragskurve sind laufzeitabhängig und gegen echte Angebote kalibriert (2 Fonds,
 * Annahme 6 % p.a.) — siehe fondssparer.ts. Bewusst KEIN Golden-Master-Fall mehr (siehe
 * Kopfkommentar dieser Datei), Abgleich läuft über test/calc/fondssparer.reference.test.ts.
 */
export function simulateFondssparer(
  monat: number,
  jahre: number,
  perf: number,
  waPct = 0
): number[] {
  return simulateFondssparerKalibriert(monat, jahre, perf, waPct)
}

export { simulateFondssparerVerlauf } from "./fondssparer"

/**
 * Fondsdepot: KESt via jährliche ausschüttungsgleiche Erträge (agE) + Rest-KESt beim Verkauf.
 * waPct: jährliche Wertanpassung (Dynamik) auf die mtl. Sparrate, kontinuierlich verzinst
 * — analog zur Prämiendynamik in simulateFLV.
 *
 * entnahmeJahre/entnahmeMonat hängen im Anschluss eine konstante Netto-Monatsentnahme an: der
 * Bruttobetrag wird so hochgerechnet, dass nach anteiliger KESt auf den noch unversteuerten
 * Gewinnanteil genau der gewünschte Nettobetrag ankommt (Depot ist KESt-pflichtig, FLV nicht —
 * das macht den Produktvergleich fair). Ohne Entnahme unverändert zur bisherigen Ansparlogik.
 */
export function simulateFondsdepotVerlauf(
  monat: number,
  einmal: number,
  jahre: number,
  perf: number,
  ausgabeaufschlagPct: number,
  depotgebuehrPa: number,
  ageRenditePa: number,
  einmalFixFee = 0,
  waPct = 0,
  entnahmeJahre = 0,
  entnahmeMonat = 0
): RRVerlauf {
  const months = jahre * 12
  const r = rrRate(perf)
  const aa = ausgabeaufschlagPct / 100
  const waRateMonthly = waPct > 0 ? Math.pow(1 + waPct, 1 / 12) - 1 : 0
  let depot = 0
  let cumNetto = 0
  let cumAge = 0
  if (einmal > 0) {
    const net = Math.max(0, einmal - einmalFixFee) * (1 - aa)
    depot += net
    cumNetto += net
  }
  const values = [depot]
  let yearStart = depot

  function jahresAbschluss() {
    const avg = (yearStart + depot) / 2
    const ageBetrag = Math.max(0, avg) * (ageRenditePa / 100)
    const kestAge = ageBetrag * RR_KEST
    depot -= kestAge
    if (depot < 0) depot = 0
    cumAge += ageBetrag
    values[values.length - 1] = depot
    yearStart = depot
  }

  for (let m = 1; m <= months; m++) {
    const monatAngepasst = waRateMonthly > 0 ? monat * Math.pow(1 + waRateMonthly, m - 1) : monat
    const net = monatAngepasst * (1 - aa)
    depot += net
    cumNetto += net
    depot *= 1 + r
    depot -= depot * (depotgebuehrPa / 100 / 12)
    if (depot < 0) depot = 0
    values.push(depot)
    if (m % 12 === 0) jahresAbschluss()
  }

  let entnommenNetto = 0
  let reichtBisMonat: number | null = null
  const entnahmeMonate = entnahmeJahre > 0 && entnahmeMonat > 0 ? entnahmeJahre * 12 : 0
  for (let k = 1; k <= entnahmeMonate; k++) {
    const m = months + k
    const unversteuerterGewinn = Math.max(0, depot - cumNetto - cumAge)
    const gewinnQuote = depot > 0 ? unversteuerterGewinn / depot : 0
    const bruttoBenoetigt = gewinnQuote > 0 ? entnahmeMonat / (1 - gewinnQuote * RR_KEST) : entnahmeMonat
    const brutto = Math.min(depot, bruttoBenoetigt)
    const nettoAusgezahlt = brutto - brutto * gewinnQuote * RR_KEST
    if (nettoAusgezahlt < entnahmeMonat - 1e-9 && reichtBisMonat === null) reichtBisMonat = m
    const anteil = depot > 0 ? brutto / depot : 0
    cumNetto -= cumNetto * anteil
    cumAge -= cumAge * anteil
    depot -= brutto
    entnommenNetto += nettoAusgezahlt
    if (depot < 0) depot = 0

    depot *= 1 + r
    depot -= depot * (depotgebuehrPa / 100 / 12)
    if (depot < 0) depot = 0
    values.push(depot)
    if (m % 12 === 0) jahresAbschluss()
  }

  const restGewinn = depot - cumNetto - cumAge
  if (restGewinn > 0) {
    depot -= restGewinn * RR_KEST
    values[values.length - 1] = depot
  }
  return { values, entnommenNetto, reichtBisMonat }
}

export function simulateFondsdepot(
  monat: number,
  einmal: number,
  jahre: number,
  perf: number,
  ausgabeaufschlagPct: number,
  depotgebuehrPa: number,
  ageRenditePa: number,
  einmalFixFee = 0,
  waPct = 0
): number[] {
  return simulateFondsdepotVerlauf(
    monat, einmal, jahre, perf, ausgabeaufschlagPct, depotgebuehrPa, ageRenditePa, einmalFixFee, waPct, 0, 0
  ).values
}

/**
 * Vermögensverwaltung: Setup verzehrt Monat 1-3, KESt wie Fondsdepot (teilt sich die agE-Rendite).
 * entnahmeJahre/entnahmeMonat: siehe simulateFondsdepotVerlauf (identische Brutto-Hochrechnung).
 */
export function simulateVVVerlauf(
  monat: number,
  einmal: number,
  jahre: number,
  perf: number,
  ageRenditePa: number,
  entnahmeJahre = 0,
  entnahmeMonat = 0
): RRVerlauf {
  const months = jahre * 12
  const r = rrRate(perf)
  let depot = 0
  let cumNetto = 0
  let cumAge = 0
  if (einmal > 0) {
    const net = einmal * 0.95
    depot += net
    cumNetto += net
  }
  const values = [depot]
  let yearStart = depot

  function jahresAbschluss() {
    const avg = (yearStart + depot) / 2
    const ageBetrag = Math.max(0, avg) * (ageRenditePa / 100)
    const kestAge = ageBetrag * RR_KEST
    depot -= kestAge
    if (depot < 0) depot = 0
    cumAge += ageBetrag
    values[values.length - 1] = depot
    yearStart = depot
  }

  for (let m = 1; m <= months; m++) {
    const net = m <= 3 ? 0 : monat
    depot += net
    cumNetto += net
    depot *= 1 + r
    depot -= depot * (0.0209 / 12)
    if (depot < 0) depot = 0
    values.push(depot)
    if (m % 12 === 0) jahresAbschluss()
  }

  let entnommenNetto = 0
  let reichtBisMonat: number | null = null
  const entnahmeMonate = entnahmeJahre > 0 && entnahmeMonat > 0 ? entnahmeJahre * 12 : 0
  for (let k = 1; k <= entnahmeMonate; k++) {
    const m = months + k
    const unversteuerterGewinn = Math.max(0, depot - cumNetto - cumAge)
    const gewinnQuote = depot > 0 ? unversteuerterGewinn / depot : 0
    const bruttoBenoetigt = gewinnQuote > 0 ? entnahmeMonat / (1 - gewinnQuote * RR_KEST) : entnahmeMonat
    const brutto = Math.min(depot, bruttoBenoetigt)
    const nettoAusgezahlt = brutto - brutto * gewinnQuote * RR_KEST
    if (nettoAusgezahlt < entnahmeMonat - 1e-9 && reichtBisMonat === null) reichtBisMonat = m
    const anteil = depot > 0 ? brutto / depot : 0
    cumNetto -= cumNetto * anteil
    cumAge -= cumAge * anteil
    depot -= brutto
    entnommenNetto += nettoAusgezahlt
    if (depot < 0) depot = 0

    depot *= 1 + r
    depot -= depot * (0.0209 / 12)
    if (depot < 0) depot = 0
    values.push(depot)
    if (m % 12 === 0) jahresAbschluss()
  }

  const restGewinn = depot - cumNetto - cumAge
  if (restGewinn > 0) {
    depot -= restGewinn * RR_KEST
    values[values.length - 1] = depot
  }
  return { values, entnommenNetto, reichtBisMonat }
}

export function simulateVV(
  monat: number,
  einmal: number,
  jahre: number,
  perf: number,
  ageRenditePa: number
): number[] {
  return simulateVVVerlauf(monat, einmal, jahre, perf, ageRenditePa, 0, 0).values
}

/**
 * Größte konstante Netto-Monatsentnahme, die über die Entnahmezeit durchhält (Bisektion).
 * `run(x)` liefert eine Simulation mit Entnahme x; reichtBisMonat === null heißt "trägt durch".
 * `obergrenze` (z. B. der Endwert der Ansparphase) begrenzt die Suche nach oben.
 */
export function rrMaxEntnahme(
  run: (entnahmeMonat: number) => RRVerlauf,
  obergrenze: number,
  iterationen = 60
): number {
  if (obergrenze <= 0) return 0
  let lo = 0
  let hi = obergrenze
  for (let i = 0; i < iterationen; i++) {
    const mid = (lo + hi) / 2
    if (run(mid).reichtBisMonat === null) lo = mid
    else hi = mid
  }
  return lo
}

export function rrFormatEUR(n: number): string {
  return Math.round(n).toLocaleString("de-AT") + " €"
}

export function rrFormatAxis(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1000000)
    return (
      (n / 1000000).toLocaleString("de-AT", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }) + " Mio."
    )
  if (abs >= 1000) return Math.round(n / 1000) + "k"
  return Math.round(n) + " €"
}
