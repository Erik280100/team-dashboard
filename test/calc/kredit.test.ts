import { describe, expect, it } from "vitest"
import {
  KREDIT_DEFAULTS, berechneKaufnebenkosten, berechneKreditbetrag, berechneTilgungsplan,
  effektivzinsPct,
} from "../../src/lib/calc/kredit"

describe("berechneTilgungsplan", () => {
  it("matches the well-known annuity reference case: 300k, 3.5% p.a., 30 years", () => {
    const plan = berechneTilgungsplan(300000, 3.5, 30)
    expect(plan.rate).toBeCloseTo(1347.13, 1)
    expect(plan.gesamtzinsen).toBeCloseTo(184968.26, 0)
    expect(plan.gesamtaufwand).toBeCloseTo(484968.26, 0)
    expect(plan.monate).toHaveLength(360)
  })

  it("pays down the balance to exactly zero, with the last month absorbing the rounding remainder", () => {
    const plan = berechneTilgungsplan(300000, 3.5, 30)
    const letzterMonat = plan.monate[plan.monate.length - 1]
    expect(letzterMonat.restschuld).toBe(0)
  })

  it("sums of monthly principal repaid equal the original loan amount", () => {
    const plan = berechneTilgungsplan(250000, 4.2, 25)
    const summeTilgung = plan.monate.reduce((s, m) => s + m.tilgung, 0)
    expect(summeTilgung).toBeCloseTo(250000, 6)
  })

  it("sum of monthly interest equals gesamtzinsen, and gesamtaufwand = Kredit + Zinsen", () => {
    const plan = berechneTilgungsplan(180000, 2.8, 20)
    const summeZins = plan.monate.reduce((s, m) => s + m.zins, 0)
    expect(summeZins).toBeCloseTo(plan.gesamtzinsen, 6)
    expect(plan.gesamtaufwand).toBeCloseTo(180000 + plan.gesamtzinsen, 6)
  })

  it("yearly breakdown sums match the monthly figures and end on the correct year-end balance", () => {
    const plan = berechneTilgungsplan(200000, 3, 10)
    expect(plan.jahre).toHaveLength(10)
    const summeZinsenJahre = plan.jahre.reduce((s, j) => s + j.zinsen, 0)
    expect(summeZinsenJahre).toBeCloseTo(plan.gesamtzinsen, 6)
    expect(plan.jahre[9].restschuld).toBe(0)
  })

  it("falls back to straight-line repayment (K/n) at 0% interest", () => {
    const plan = berechneTilgungsplan(120000, 0, 10)
    expect(plan.rate).toBeCloseTo(120000 / 120, 6)
    expect(plan.gesamtzinsen).toBeCloseTo(0, 6)
    expect(plan.monate.every((m) => m.zins === 0)).toBe(true)
  })

  it("returns an empty plan for a zero loan amount, without NaN/Infinity", () => {
    const plan = berechneTilgungsplan(0, 3.5, 30)
    expect(plan.rate).toBe(0)
    expect(plan.monate).toHaveLength(0)
    expect(plan.jahre).toHaveLength(0)
    expect(plan.gesamtzinsen).toBe(0)
  })
})

describe("berechneKaufnebenkosten", () => {
  it("with a broker: ~10.6% of the purchase price (default rates)", () => {
    const erg = berechneKaufnebenkosten(400000, true)
    // 3.5% GrESt + 1.1% Grundbuch + 2%*1.2 Vertragserrichtung + 3%*1.2 Makler = 10.6%
    expect(erg.summe).toBeCloseTo(400000 * 0.106, 0)
  })

  it("without a broker: ~7.0% of the purchase price (default rates)", () => {
    const erg = berechneKaufnebenkosten(400000, false)
    expect(erg.summe).toBeCloseTo(400000 * 0.07, 0)
  })

  it("adds a flat 'sonstige Kaufnebenkosten' amount on top", () => {
    const mitExtra = berechneKaufnebenkosten(300000, false, { ...KREDIT_DEFAULTS, sonstigeKaufNK: 1500 })
    const ohneExtra = berechneKaufnebenkosten(300000, false)
    expect(mitExtra.summe - ohneExtra.summe).toBeCloseTo(1500, 6)
  })
})

describe("berechneKreditbetrag", () => {
  it("resolves the circularity exactly when financing costs are rolled into the loan", () => {
    const eingabe = { kaufpreis: 400000, eigenmittel: 80000, mitMakler: true, nkMitfinanziert: true }
    const kredit = berechneKreditbetrag(eingabe)

    // Backsolve: K * (1 - r) should reproduce the non-financing-cost funding gap.
    const r = KREDIT_DEFAULTS.kreditvertragserstellungPct / 100
      + (KREDIT_DEFAULTS.pfandrechtPct / 100) * (1 + KREDIT_DEFAULTS.nebengebuehrensicherstellungPct / 100)
    const bedarf = 400000 + kredit.kaufNK.summe - 80000
    expect(kredit.kreditbetrag * (1 - r)).toBeCloseTo(bedarf, 2)

    // And the loan amount must actually cover purchase + all costs minus own funds.
    expect(kredit.kreditbetrag).toBeCloseTo(kredit.gesamtinvestition - 80000, 2)
  })

  it("without financing the ancillary loan costs, the loan only covers purchase + Kauf-NK minus Eigenmittel", () => {
    const kredit = berechneKreditbetrag({ kaufpreis: 400000, eigenmittel: 80000, mitMakler: true, nkMitfinanziert: false })
    expect(kredit.kreditbetrag).toBeCloseTo(400000 + kredit.kaufNK.summe - 80000, 2)
    expect(kredit.barbedarf).toBeGreaterThan(0)
  })

  it("a broker raises the required loan amount versus no broker, all else equal", () => {
    const mitMakler = berechneKreditbetrag({ kaufpreis: 400000, eigenmittel: 80000, mitMakler: true, nkMitfinanziert: true })
    const ohneMakler = berechneKreditbetrag({ kaufpreis: 400000, eigenmittel: 80000, mitMakler: false, nkMitfinanziert: true })
    expect(mitMakler.kreditbetrag).toBeGreaterThan(ohneMakler.kreditbetrag)
  })

  it("returns a zero loan amount (not NaN) when Eigenmittel cover the entire investment", () => {
    const kredit = berechneKreditbetrag({ kaufpreis: 100000, eigenmittel: 500000, mitMakler: false, nkMitfinanziert: true })
    expect(kredit.kreditbetrag).toBe(0)
    expect(Number.isFinite(kredit.kreditbetrag)).toBe(true)
  })

  it("flags a warning when Eigenmittel don't even cover the Kaufnebenkosten", () => {
    const kredit = berechneKreditbetrag({ kaufpreis: 400000, eigenmittel: 1000, mitMakler: true, nkMitfinanziert: true })
    expect(kredit.warnung).toBeTruthy()
  })
})

describe("effektivzinsPct", () => {
  it("equals the compounded nominal monthly rate when there are no financing costs at all", () => {
    // With no Kredit-NK, nettoAuszahlung === kreditbetrag === present value of the annuity
    // at the nominal monthly rate i — so the IRR must reproduce i exactly, annualized
    // geometrically: (1+i)^12 - 1 (slightly above the flat nominal rate, by construction).
    const zinsPct = 3.5
    const plan = berechneTilgungsplan(300000, zinsPct, 30)
    const eff = effektivzinsPct(300000, plan.rate, plan.monate.length)
    const iMonat = zinsPct / 100 / 12
    const erwartet = (Math.pow(1 + iMonat, 12) - 1) * 100
    expect(eff).toBeCloseTo(erwartet, 2)
  })

  it("is higher than the nominal rate once financing costs are rolled into the loan (lower net payout, same rate)", () => {
    const kredit = berechneKreditbetrag({ kaufpreis: 400000, eigenmittel: 80000, mitMakler: true, nkMitfinanziert: true })
    const plan = berechneTilgungsplan(kredit.kreditbetrag, 3.5, 30)
    const eff = effektivzinsPct(kredit.nettoAuszahlung, plan.rate, plan.monate.length)
    expect(eff).toBeGreaterThan(3.5)
  })

  it("returns 0 for degenerate inputs instead of NaN", () => {
    expect(effektivzinsPct(0, 1000, 360)).toBe(0)
    expect(effektivzinsPct(100000, 0, 360)).toBe(0)
    expect(effektivzinsPct(100000, 1000, 0)).toBe(0)
  })
})
