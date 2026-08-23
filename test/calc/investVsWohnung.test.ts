import { describe, expect, it } from "vitest"
import {
  berechneAfaBemessungsgrundlage, berechneAfaJahre, berechneKreditbetrag, berechneTilgungsplan, KREDIT_DEFAULTS,
} from "../../src/lib/calc/kredit"
import { RR_KEST } from "../../src/lib/calc/rendite"
import {
  berechneEntnahmeMonat, berechneInvestVsWohnung, simuliereDepotVariabel,
  type InvestVsWohnungEingabe,
} from "../../src/lib/calc/investVsWohnung"

const BASIS: InvestVsWohnungEingabe = {
  eigenmittel: 60000,
  horizontJahre: 20,
  entnahmeJahre: 20,

  depotRenditePa: 6,

  kaufpreis: 250000,
  mitMakler: true,
  nkMitfinanziert: true,
  kreditLaufzeitJahre: 35,
  kreditZinsPct: 2.85,
  mieteMonat: 800,
  indexierungPct: 2,
  leerstandPct: 3,
  bewirtschaftungMonat: 60,
  wertsteigerungPct: 3,
  grenzsteuersatzPct: 40,
  immoEstPct: 30,
  verkaufskostenPct: 0,
}

describe("simuliereDepotVariabel", () => {
  it("compounds a lump sum at exactly the given rate and taxes only the gain with KESt", () => {
    const einmal = 60000
    const jahre = 20
    const perfPa = 5
    const erg = simuliereDepotVariabel(einmal, Array(jahre * 12).fill(0), perfPa)
    const bruttoEndwert = einmal * Math.pow(1 + perfPa / 100, jahre)
    const erwartet = bruttoEndwert - (bruttoEndwert - einmal) * RR_KEST
    expect(erg.endwertNachSteuer).toBeCloseTo(erwartet, 2)
  })

  it("compounds constant monthly contributions with no fees deducted along the way", () => {
    const monat = 250
    const jahre = 10
    const perfPa = 6
    const erg = simuliereDepotVariabel(0, Array(jahre * 12).fill(monat), perfPa)
    expect(erg.eingezahlt).toBeCloseTo(monat * jahre * 12, 6)
    // Ohne Kosten muss der Bruttostand (vor KESt) exakt einer monatlichen Verzinsungsreihe
    // ohne jeglichen Abzug entsprechen — die KESt darf nur den Gewinn (Bruttostand − Einzahlungen)
    // schmälern, nicht mehr.
    const bruttoGewinn = erg.endwertNachSteuer + erg.kestGesamt - erg.eingezahlt
    expect(bruttoGewinn).toBeGreaterThan(0)
    expect(erg.endwertNachSteuer).toBeCloseTo(erg.eingezahlt + bruttoGewinn * (1 - RR_KEST), 6)
  })

  it("lets the balance go negative on a withdrawal instead of clamping to zero", () => {
    const eigen = simuliereDepotVariabel(0, [-500, -500, -500], 5)
    expect(eigen.verlauf[3]).toBeLessThan(0)
    expect(eigen.entnommen).toBeCloseTo(1500, 6)
  })

  it("reduces the cost basis (cumNetto) on withdrawal so a later gain is still taxed correctly", () => {
    // Erst einzahlen, dann alles wieder entnehmen, dann nochmal Gewinn erwirtschaften — die
    // finale KESt darf sich nicht auf den längst entnommenen Betrag beziehen.
    const eigen = simuliereDepotVariabel(0, [1000, -1000, ...Array(23).fill(0)], 6)
    expect(eigen.kestGesamt).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(eigen.endwertNachSteuer)).toBe(true)
  })

  it("keeps the true net-deposit cost basis (not floored at zero) when the balance dips negative between deposits", () => {
    // Ein Nebenkonto (Mietüberschuss-Reinvestition) darf ins Minus rutschen; die Kostenbasis muss
    // dem tatsächlichen Netto-Einzahlungssaldo folgen (hier 1000 − 3000 + 5000 = 3000), nicht bei 0
    // hängen bleiben, sonst wird ein späterer Gewinn faktisch KESt-frei.
    const cashflows = [1000, -3000, 5000]
    const perfPa = 6
    const erg = simuliereDepotVariabel(0, cashflows, perfPa)
    const r = Math.pow(1 + perfPa / 100, 1 / 12) - 1
    let balance = 0
    for (const cf of cashflows) { balance += cf; balance *= 1 + r }
    const cumNetto = 1000 - 3000 + 5000
    const erwarteteKest = Math.max(0, balance - cumNetto) * RR_KEST
    expect(erg.kestGesamt).toBeCloseTo(erwarteteKest, 6)
  })

  it("the per-month verlauf never jumps at the final month (consistent sale-value formula throughout)", () => {
    const erg = simuliereDepotVariabel(50000, Array(240).fill(300), 7)
    for (let m = 1; m < erg.verlauf.length; m++) {
      // Von Monat zu Monat darf sich der Wert nur durch Verzinsung + Einzahlung ändern, nie durch
      // einen einmaligen Steuer-Sprung, der nur am letzten Monat auftritt.
      const zuwachs = erg.verlauf[m] - erg.verlauf[m - 1]
      expect(zuwachs).toBeGreaterThan(-1000)
      expect(zuwachs).toBeLessThan(10000)
    }
  })
})

describe("berechneEntnahmeMonat", () => {
  it("returns 0 for non-positive capital or duration", () => {
    expect(berechneEntnahmeMonat(0, 4, 20)).toBe(0)
    expect(berechneEntnahmeMonat(100000, 4, 0)).toBe(0)
    expect(berechneEntnahmeMonat(-1000, 4, 20)).toBe(0)
  })

  it("splits the capital evenly when the net return is zero", () => {
    expect(berechneEntnahmeMonat(120000, 0, 10)).toBeCloseTo(1000, 6)
  })

  it("the present value of the withdrawal annuity equals the invested capital", () => {
    const kapital = 500000
    const renditePaPct = 3.5
    const jahre = 25
    const monat = berechneEntnahmeMonat(kapital, renditePaPct, jahre)
    const i = renditePaPct / 100 / 12
    let barwert = 0
    for (let m = 1; m <= jahre * 12; m++) barwert += monat / Math.pow(1 + i, m)
    expect(barwert).toBeCloseTo(kapital, 2)
  })
})

describe("berechneInvestVsWohnung", () => {
  it("uses berechneKreditbetrag unchanged, so Eigenmittel first cover the Kaufnebenkosten", () => {
    const erg = berechneInvestVsWohnung(BASIS)
    const referenz = berechneKreditbetrag({
      kaufpreis: BASIS.kaufpreis, eigenmittel: BASIS.eigenmittel, mitMakler: BASIS.mitMakler,
      nkMitfinanziert: BASIS.nkMitfinanziert, saetze: KREDIT_DEFAULTS,
    })
    expect(erg.wohnung.kreditbetrag).toBeCloseTo(referenz.kreditbetrag, 6)
    expect(erg.wohnung.kaufNK.summe).toBeCloseTo(referenz.kaufNK.summe, 6)
  })

  it("when Eigenmittel exactly cover the Kaufnebenkosten, the loan equals the purchase price", () => {
    // nkMitfinanziert: false, damit die Kreditnebenkosten nicht zusätzlich in die Kreditsumme
    // eingerechnet werden — sonst wäre Kreditbetrag > Kaufpreis auch bei voll gedeckten Kauf-NK.
    const kaufNK = berechneKreditbetrag({
      kaufpreis: 250000, eigenmittel: 0, mitMakler: true, nkMitfinanziert: false, saetze: KREDIT_DEFAULTS,
    }).kaufNK.summe
    const erg = berechneInvestVsWohnung({ ...BASIS, eigenmittel: kaufNK, nkMitfinanziert: false })
    expect(erg.wohnung.kreditbetrag).toBeCloseTo(250000, 2)
  })

  it("carries the remaining Restschuld into the sale proceeds when Kreditlaufzeit exceeds the horizon", () => {
    const erg = berechneInvestVsWohnung({ ...BASIS, kreditLaufzeitJahre: 35, horizontJahre: 20 })
    const referenz = berechneKreditbetrag({
      kaufpreis: BASIS.kaufpreis, eigenmittel: BASIS.eigenmittel, mitMakler: BASIS.mitMakler,
      nkMitfinanziert: BASIS.nkMitfinanziert, saetze: KREDIT_DEFAULTS,
    })
    const plan = berechneTilgungsplan(referenz.kreditbetrag, BASIS.kreditZinsPct, 35)
    expect(erg.wohnung.restschuldEnde).toBeCloseTo(plan.monate[20 * 12 - 1].restschuld, 2)
    expect(erg.wohnung.restschuldEnde).toBeGreaterThan(0)
    expect(erg.warnungen.some((w) => w.includes("Restschuld"))).toBe(true)
  })

  it("has zero Restschuld left when the Kreditlaufzeit is not longer than the horizon", () => {
    const erg = berechneInvestVsWohnung({ ...BASIS, kreditLaufzeitJahre: 15, horizontJahre: 20 })
    expect(erg.wohnung.restschuldEnde).toBe(0)
  })

  it("accelerated AfA is 3x in year 1, 2x in year 2, and 1x from year 3 on, and never exceeds the Bemessungsgrundlage (which includes Kaufnebenkosten)", () => {
    const erg = berechneInvestVsWohnung({ ...BASIS, horizontJahre: 5 })
    // afaKumuliert nach 5 Jahren = Basis * Satz * (3+2+1+1+1), solange das nicht über der
    // Bemessungsgrundlage liegt. Basis = Gebäudeanteil von (Kaufpreis + Kaufnebenkosten).
    const kaufNK = berechneKreditbetrag({
      kaufpreis: BASIS.kaufpreis, eigenmittel: BASIS.eigenmittel, mitMakler: BASIS.mitMakler,
      nkMitfinanziert: BASIS.nkMitfinanziert, saetze: KREDIT_DEFAULTS,
    }).kaufNK.summe
    const basis = (BASIS.kaufpreis + kaufNK) * (KREDIT_DEFAULTS.gebaeudeanteilPct / 100)
    const erwartet = basis * (KREDIT_DEFAULTS.afaSatzPct / 100) * (3 + 2 + 1 + 1 + 1)
    expect(erg.wohnung.afaKumuliert).toBeCloseTo(Math.min(erwartet, basis), 2)
    expect(erg.wohnung.afaKumuliert).toBeLessThanOrEqual(basis + 1e-6)
  })

  it("with zero Wertsteigerung and zero Miete, the Immo scenario underperforms the Depot (financing and running costs only lose money)", () => {
    const erg = berechneInvestVsWohnung({ ...BASIS, wertsteigerungPct: 0, mieteMonat: 0 })
    expect(erg.wohnung.endwertNachSteuer).toBeLessThan(erg.depot.endwertNachSteuer)
    expect(erg.differenz).toBeLessThan(0)
  })

  it("charges ImmoESt regardless of holding period — the Spekulationsfrist was abolished in 2012", () => {
    for (const horizontJahre of [9, 10, 30]) {
      const erg = berechneInvestVsWohnung({ ...BASIS, horizontJahre, wertsteigerungPct: 5 })
      const kaufNK = berechneKreditbetrag({
        kaufpreis: BASIS.kaufpreis, eigenmittel: BASIS.eigenmittel, mitMakler: BASIS.mitMakler,
        nkMitfinanziert: BASIS.nkMitfinanziert, saetze: KREDIT_DEFAULTS,
      }).kaufNK.summe
      const verkehrswert = BASIS.kaufpreis * Math.pow(1.05, horizontJahre)
      const erwarteteBasis = Math.max(0, verkehrswert - (BASIS.kaufpreis + kaufNK) + erg.wohnung.afaKumuliert)
      expect(erg.wohnung.immoEstBasis).toBeCloseTo(erwarteteBasis, 2)
      expect(erg.wohnung.immoEst).toBeCloseTo(erwarteteBasis * (BASIS.immoEstPct / 100), 2)
      expect(erg.wohnung.immoEst).toBeGreaterThan(0)
    }
  })

  it("a higher depotRenditePa strictly increases the Depot endwert", () => {
    const niedrig = berechneInvestVsWohnung({ ...BASIS, depotRenditePa: 4 })
    const hoch = berechneInvestVsWohnung({ ...BASIS, depotRenditePa: 8 })
    expect(hoch.depot.endwertNachSteuer).toBeGreaterThan(niedrig.depot.endwertNachSteuer)
  })

  it("matches the plain compound-interest-minus-KESt formula for the Depot scenario (no fees anywhere)", () => {
    const erg = berechneInvestVsWohnung({ ...BASIS, depotRenditePa: 10, horizontJahre: 15 })
    const brutto = BASIS.eigenmittel * Math.pow(1.1, 15)
    const erwartet = brutto - (brutto - BASIS.eigenmittel) * RR_KEST
    expect(erg.depot.endwertNachSteuer).toBeCloseTo(erwartet, 2)
  })

  it("exposes bruttoEndwert and kestGesamt for the Depot side, consistent with the net endwert", () => {
    const erg = berechneInvestVsWohnung({ ...BASIS, depotRenditePa: 7, horizontJahre: 12 })
    expect(erg.depot.bruttoEndwert - erg.depot.kestGesamt).toBeCloseTo(erg.depot.endwertNachSteuer, 6)
    expect(erg.depot.kestGesamt).toBeCloseTo((erg.depot.bruttoEndwert - BASIS.eigenmittel) * RR_KEST, 2)
  })

  it("a higher wertsteigerungPct strictly increases the Immo endwert", () => {
    const niedrig = berechneInvestVsWohnung({ ...BASIS, wertsteigerungPct: 1 })
    const hoch = berechneInvestVsWohnung({ ...BASIS, wertsteigerungPct: 5 })
    expect(hoch.wohnung.endwertNachSteuer).toBeGreaterThan(niedrig.wohnung.endwertNachSteuer)
  })

  it("clamps negative Miete/Bewirtschaftung/Leerstand/Verkaufskosten/ImmoESt rates instead of letting them invert the cashflow", () => {
    const negativ = berechneInvestVsWohnung({
      ...BASIS, mieteMonat: -800, bewirtschaftungMonat: -60, leerstandPct: -3,
      verkaufskostenPct: -5, immoEstPct: -30,
    })
    const genullt = berechneInvestVsWohnung({
      ...BASIS, mieteMonat: 0, bewirtschaftungMonat: 0, leerstandPct: 0,
      verkaufskostenPct: 0, immoEstPct: 0,
    })
    expect(negativ.wohnung.endwertNachSteuer).toBeCloseTo(genullt.wohnung.endwertNachSteuer, 2)
  })

  it("returns zeros instead of NaN for degenerate inputs (Kaufpreis, Horizont, Eigenmittel all 0)", () => {
    const erg = berechneInvestVsWohnung({ ...BASIS, kaufpreis: 0, horizontJahre: 0, eigenmittel: 0 })
    expect(erg.depot.endwertNachSteuer).toBe(0)
    expect(erg.wohnung.endwertNachSteuer).toBe(0)
    expect(Number.isFinite(erg.differenz)).toBe(true)
    expect(erg.entnahme.depotMonat).toBe(0)
    expect(erg.entnahme.immoMonat).toBe(0)
  })

  it("returns zeros instead of NaN when entnahmeJahre is 0", () => {
    const erg = berechneInvestVsWohnung({ ...BASIS, entnahmeJahre: 0 })
    expect(erg.entnahme.depotMonat).toBe(0)
    expect(erg.entnahme.immoMonat).toBe(0)
  })

  it("charges the Barbedarf (non-financed Kreditnebenkosten) against the Nebenkonto in month 1 instead of losing it", () => {
    const erg = berechneInvestVsWohnung({ ...BASIS, nkMitfinanziert: false })
    expect(erg.wohnung.barbedarf).toBeGreaterThan(0)
    expect(erg.wohnung.zuzahlungenKumuliert).toBeGreaterThanOrEqual(erg.wohnung.barbedarf)
  })

  it("credits Eigenmittel beyond the Gesamtinvestition to the Nebenkonto as a lump sum instead of losing them", () => {
    const erg = berechneInvestVsWohnung({ ...BASIS, eigenmittel: 400000 })
    expect(erg.wohnung.ueberschussEigenmittel).toBeGreaterThan(0)
    const wenigerEigenmittel = berechneInvestVsWohnung({ ...BASIS, eigenmittel: 300000 })
    expect(erg.wohnung.endwertNachSteuer).toBeGreaterThan(wenigerEigenmittel.wohnung.endwertNachSteuer)
  })

  it("indexes Bewirtschaftungskosten with the same Mietindexierung as the Miete, so they don't stay flat over the horizon", () => {
    const erg = berechneInvestVsWohnung({ ...BASIS, indexierungPct: 3, horizontJahre: 10 })
    const jahr1 = erg.jahre[0]
    const jahr10 = erg.jahre[9]
    const mieteWachstum = jahr10.miete / jahr1.miete
    const bewirtschaftungWachstum = jahr10.bewirtschaftung / jahr1.bewirtschaftung
    expect(bewirtschaftungWachstum).toBeCloseTo(mieteWachstum, 6)
  })

  it("deducts the one-off Kreditnebenkosten as Werbungskosten in the first year's tax base", () => {
    const erg = berechneInvestVsWohnung(BASIS)
    const referenz = berechneKreditbetrag({
      kaufpreis: BASIS.kaufpreis, eigenmittel: BASIS.eigenmittel, mitMakler: BASIS.mitMakler,
      nkMitfinanziert: BASIS.nkMitfinanziert, saetze: KREDIT_DEFAULTS,
    })
    const tilgung = berechneTilgungsplan(referenz.kreditbetrag, BASIS.kreditZinsPct, BASIS.kreditLaufzeitJahre)
    const afaBasis = berechneAfaBemessungsgrundlage(BASIS.kaufpreis + referenz.kaufNK.summe, KREDIT_DEFAULTS.gebaeudeanteilPct)
    const afaJahr1 = berechneAfaJahre(afaBasis, KREDIT_DEFAULTS.afaSatzPct, 1)[0].afa
    const miete1 = BASIS.mieteMonat * (1 - BASIS.leerstandPct / 100) * 12
    const bewirtschaftung1 = BASIS.bewirtschaftungMonat * 12
    const steuerBasis1 = miete1 - bewirtschaftung1 - tilgung.jahre[0].zinsen - afaJahr1 - referenz.kreditNKSumme
    const erwarteterSteuerEffekt1 = -steuerBasis1 * (BASIS.grenzsteuersatzPct / 100)
    expect(erg.jahre[0].steuerEffekt).toBeCloseTo(erwarteterSteuerEffekt1, 1)
  })

  it("returns a per-year Jahresverlauf whose Zinsen sum to the cumulative gesamtzinsen", () => {
    const erg = berechneInvestVsWohnung({ ...BASIS, horizontJahre: 10 })
    const summeZinsen = erg.jahre.reduce((s, j) => s + j.zinsen, 0)
    expect(summeZinsen).toBeCloseTo(erg.wohnung.gesamtzinsen, 2)
  })
})
