// Renditerechner — 1:1 portiert aus legacy/index.html:3532–3740.
// Reine Funktionen, keine DOM-Zugriffe. Bei jeder Änderung: Golden-Master-Test
// in test/calc/rendite.golden.test.ts muss weiterhin grün bleiben.

export const RR_KEST = 0.275

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
 */
export function simulateFLV(
  provider: Provider,
  monat: number,
  einmal: number,
  jahre: number,
  perf: number,
  waPct = 0
): number[] {
  const months = jahre * 12
  const r = rrRate(perf)
  const waRateMonthly = waPct > 0 ? Math.pow(1 + waPct, 1 / 12) - 1 : 0
  const vst = 0.04
  const adminPraemie = provider === "merkur" ? 0.04 : 0.07
  const abschlussPraemie = provider === "merkur" ? 0.04 : 0.07
  const depotCostPraemiePa = provider === "merkur" ? 0.002 : 0.00348
  const depotCostEinmalPa = provider === "merkur" ? 0.002 + 0.0035 : 0.00348
  const gesamtBrutto = monat * 12 * jahre
  const zillmerMonatlich = (abschlussPraemie * gesamtBrutto) / 60
  const fixMonatlich = provider === "merkur" && einmal > 0 ? 2 : 0

  function kickbackPa(m: number, leg: "praemie" | "einmal"): number {
    if (provider === "merkur") return leg === "einmal" ? 0.00835 : 0.0013
    return m <= 84 ? 0.002 : 0.004
  }

  let depotP = 0
  let depotE = 0
  if (einmal > 0) {
    if (provider === "merkur") {
      const vstEinmal = jahre >= 15 ? 0.04 : 0.11
      depotE = einmal * (1 - vstEinmal) - einmal * 0.04
    } else {
      depotE = einmal * (jahre >= 15 ? 0.9038 : 0.8423)
    }
    if (depotE < 0) depotE = 0
  }

  const values = [depotP + depotE]
  for (let m = 1; m <= months; m++) {
    const monatAngepasst =
      waRateMonthly > 0 ? monat * Math.pow(1 + waRateMonthly, m - 1) : monat
    const netPraemie = monatAngepasst * (1 - vst)
    const netNachAdmin = netPraemie * (1 - adminPraemie)
    let invest = m <= 60 ? netNachAdmin - zillmerMonatlich : netNachAdmin
    if (invest < 0) invest = 0
    depotP += invest
    depotP *= 1 + r
    depotP -= depotP * (depotCostPraemiePa / 12)
    depotP += depotP * (kickbackPa(m, "praemie") / 12)
    if (depotP < 0) depotP = 0

    if (einmal > 0) {
      depotE *= 1 + r
      depotE -= depotE * (depotCostEinmalPa / 12)
      depotE += depotE * (kickbackPa(m, "einmal") / 12)
      depotE -= fixMonatlich
      if (depotE < 0) depotE = 0
    }
    values.push(depotP + depotE)
  }
  return values
}

/**
 * Fondssparer: kein Einmalerlag, keine Zillmerung, keine Kickbacks.
 * Kosten lt. LV-InfoV-Kostenblatt (200/100 €/mon, 38J): Sparprämie 91,10 % der
 * Prämiensumme (Versicherungssteuer 3,85 % + Kosten 5,06 %), laufende Kosten
 * 0,043 % monatlich (0,516 % p.a.). Wertanpassung erhöht die mtl. Prämie jährlich
 * zum Vertragsjubiläum (Stufenmodell, ab dem 2. Versicherungsjahr).
 */
export function simulateFondssparer(
  monat: number,
  jahre: number,
  perf: number,
  waPct = 0
): number[] {
  const months = jahre * 12
  const r = rrRate(perf)
  let depot = 0
  const values = [0]
  for (let m = 1; m <= months; m++) {
    const jahrIdx = Math.floor((m - 1) / 12)
    const monatAngepasst = waPct > 0 ? monat * Math.pow(1 + waPct, jahrIdx) : monat
    const netNachAbzug = monatAngepasst * 0.911
    depot += netNachAbzug
    depot *= 1 + r
    depot -= depot * (0.00516 / 12)
    if (depot < 0) depot = 0
    values.push(depot)
  }
  return values
}

/** Fondsdepot: KESt via jährliche ausschüttungsgleiche Erträge (agE) + Rest-KESt beim Verkauf. */
export function simulateFondsdepot(
  monat: number,
  einmal: number,
  jahre: number,
  perf: number,
  ausgabeaufschlagPct: number,
  depotgebuehrPa: number,
  ageRenditePa: number,
  einmalFixFee = 0
): number[] {
  const months = jahre * 12
  const r = rrRate(perf)
  const aa = ausgabeaufschlagPct / 100
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
  for (let m = 1; m <= months; m++) {
    const net = monat * (1 - aa)
    depot += net
    cumNetto += net
    depot *= 1 + r
    depot -= depot * (depotgebuehrPa / 100 / 12)
    if (depot < 0) depot = 0
    values.push(depot)
    if (m % 12 === 0) {
      const avg = (yearStart + depot) / 2
      const ageBetrag = Math.max(0, avg) * (ageRenditePa / 100)
      const kestAge = ageBetrag * RR_KEST
      depot -= kestAge
      if (depot < 0) depot = 0
      cumAge += ageBetrag
      values[values.length - 1] = depot
      yearStart = depot
    }
  }
  const restGewinn = depot - cumNetto - cumAge
  if (restGewinn > 0) {
    depot -= restGewinn * RR_KEST
    values[values.length - 1] = depot
  }
  return values
}

/** Vermögensverwaltung: Setup verzehrt Monat 1-3, KESt wie Fondsdepot (teilt sich die agE-Rendite). */
export function simulateVV(
  monat: number,
  einmal: number,
  jahre: number,
  perf: number,
  ageRenditePa: number
): number[] {
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
  for (let m = 1; m <= months; m++) {
    const net = m <= 3 ? 0 : monat
    depot += net
    cumNetto += net
    depot *= 1 + r
    depot -= depot * (0.0209 / 12)
    if (depot < 0) depot = 0
    values.push(depot)
    if (m % 12 === 0) {
      const avg = (yearStart + depot) / 2
      const ageBetrag = Math.max(0, avg) * (ageRenditePa / 100)
      const kestAge = ageBetrag * RR_KEST
      depot -= kestAge
      if (depot < 0) depot = 0
      cumAge += ageBetrag
      values[values.length - 1] = depot
      yearStart = depot
    }
  }
  const restGewinn = depot - cumNetto - cumAge
  if (restGewinn > 0) {
    depot -= restGewinn * RR_KEST
    values[values.length - 1] = depot
  }
  return values
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
