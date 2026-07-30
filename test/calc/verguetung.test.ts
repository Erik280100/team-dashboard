import { describe, expect, it } from "vitest"
import {
  computeEarnings, readPlanUnits, sumPlanUnits, withPlanUnits,
} from "../../src/lib/calc/verguetung"
import { DEFAULT_PLAN_RATES, PLAN_IDS, type PlanId } from "../../src/lib/calc/struktur"
import type { MergedRow } from "../../src/lib/calc/team"

const RATES = DEFAULT_PLAN_RATES

function row(
  name: string,
  role: string,
  managerName: string | null,
  ehByPlan?: Partial<Record<PlanId, number>>
): MergedRow {
  return {
    name,
    role,
    managerName,
    depth: 0,
    rowIndex: null,
    soll: 0,
    ist: 0,
    ehByPlan,
  }
}

function insuranceOf(map: ReturnType<typeof computeEarnings>, name: string) {
  const e = map.get(name)!
  return {
    own: e.own.insurance.amount,
    diff: e.diff.insurance.amount,
    total: e.own.insurance.amount + e.diff.insurance.amount,
  }
}

describe("readPlanUnits / sumPlanUnits / withPlanUnits", () => {
  it("falls back to { insurance: ist } when ehByPlan is missing (Altbestand)", () => {
    const units = readPlanUnits({ ist: 12 })
    expect(units).toEqual({ insurance: 12, investment: 0, credit: 0, realestate: 0 })
  })

  it("reads ehByPlan when present, ignoring ist", () => {
    const units = readPlanUnits({ ist: 999, ehByPlan: { insurance: 2, credit: 3 } })
    expect(units).toEqual({ insurance: 2, investment: 0, credit: 3, realestate: 0 })
  })

  it("sumPlanUnits sums all four plans", () => {
    expect(sumPlanUnits({ insurance: 2, investment: 1.5, credit: 0, realestate: 0.5 })).toBe(4)
  })

  it("withPlanUnits keeps ist synchronized with the plan sum", () => {
    const next = withPlanUnits({ name: "X", soll: 0, ist: 0 }, {
      insurance: 2, investment: 0, credit: 1, realestate: 0,
    })
    expect(next.ist).toBe(3)
    expect(next.ehByPlan).toEqual({ insurance: 2, investment: 0, credit: 1, realestate: 0 })
  })
})

describe("computeEarnings: Kaskade ohne Gleichstand", () => {
  it("FT2 -> Teamleiter -> Geschäftsstellenleiter -> Regionalleiter -> Direktor summiert auf den Direktorensatz", () => {
    const merged: MergedRow[] = [
      row("Direktor", "Direktor", null),
      row("RL", "Regionalleiter", "Direktor"),
      row("GSL", "Geschäftsstellenleiter", "RL"),
      row("TL", "Teamleiter", "GSL"),
      row("FT2", "FT2", "TL", { insurance: 1 }),
    ]
    const e = computeEarnings(merged, RATES)
    expect(insuranceOf(e, "FT2").own).toBeCloseTo(2)
    expect(insuranceOf(e, "TL").diff).toBeCloseTo(2) // 4 - 2
    expect(insuranceOf(e, "GSL").diff).toBeCloseTo(1) // 5 - 4
    expect(insuranceOf(e, "RL").diff).toBeCloseTo(2) // 7 - 5
    expect(insuranceOf(e, "Direktor").diff).toBeCloseTo(1) // 8 - 7
    const totalPaidOut = PLAN_IDS.reduce(
      (s, p) => s + [...e.values()].reduce((s2, x) => s2 + x.own[p].amount + x.diff[p].amount, 0),
      0
    )
    expect(totalPaidOut).toBeCloseTo(8) // = 1 EH * Direktorensatz Insurance
  })
})

describe("computeEarnings: Gleichstand zweier Geschäftsstellenleiter", () => {
  it("GSL A (unten) produziert selbst: 5,50 / 0,50 / 2,00", () => {
    const merged: MergedRow[] = [
      row("Direktor", "Direktor", null),
      row("GSL B", "Geschäftsstellenleiter", "Direktor"),
      row("GSL A", "Geschäftsstellenleiter", "GSL B", { insurance: 1 }),
    ]
    const e = computeEarnings(merged, RATES)
    expect(insuranceOf(e, "GSL A").total).toBeCloseTo(5.5)
    expect(insuranceOf(e, "GSL B").total).toBeCloseTo(0.5)
    expect(insuranceOf(e, "Direktor").total).toBeCloseTo(2)
  })

  it("ein FT2 unter GSL A produziert: 2,00 / 3,50 / 0,50 / 2,00", () => {
    const merged: MergedRow[] = [
      row("Direktor", "Direktor", null),
      row("GSL B", "Geschäftsstellenleiter", "Direktor"),
      row("GSL A", "Geschäftsstellenleiter", "GSL B"),
      row("FT2", "FT2", "GSL A", { insurance: 1 }),
    ]
    const e = computeEarnings(merged, RATES)
    expect(insuranceOf(e, "FT2").total).toBeCloseTo(2)
    expect(insuranceOf(e, "GSL A").total).toBeCloseTo(3.5)
    expect(insuranceOf(e, "GSL B").total).toBeCloseTo(0.5)
    expect(insuranceOf(e, "Direktor").total).toBeCloseTo(2)
  })
})

describe("computeEarnings: drei gleiche Stufen hintereinander", () => {
  it("die mittlere Person bekommt zweimal 0,50 (als untere und als obere Paarungshälfte)", () => {
    const merged: MergedRow[] = [
      row("TL3", "Teamleiter", null),
      row("TL2", "Teamleiter", "TL3"),
      row("TL1", "Teamleiter", "TL2", { insurance: 1 }),
    ]
    const e = computeEarnings(merged, RATES)
    // TL1 (Produzent) bekommt zusätzlich zur Eigenproduktion 0,50 Gleichstand
    // (untere Hälfte der ersten Paarung TL1/TL2) — wie im GSL-Eigenproduktions-
    // Beispiel oben (5,00 -> 5,50).
    expect(insuranceOf(e, "TL1").own).toBeCloseTo(4)
    expect(insuranceOf(e, "TL1").total).toBeCloseTo(4.5)
    expect(insuranceOf(e, "TL2").diff).toBeCloseTo(1) // 0,5 (unten, Paarung 1) + 0,5 (oben, Paarung 2)
    expect(insuranceOf(e, "TL3").diff).toBeCloseTo(0.5)
  })
})

describe("computeEarnings: Ebene wird durch Gleichstand aufgezehrt", () => {
  it("FT2 -> TL A -> TL B -> GSL -> Direktor: GSL bekommt 0,00 €, Direktor den Rest", () => {
    const merged: MergedRow[] = [
      row("Direktor", "Direktor", null),
      row("GSL", "Geschäftsstellenleiter", "Direktor"),
      row("TL B", "Teamleiter", "GSL"),
      row("TL A", "Teamleiter", "TL B"),
      row("FT2", "FT2", "TL A", { insurance: 1 }),
    ]
    const e = computeEarnings(merged, RATES)
    expect(insuranceOf(e, "FT2").own).toBeCloseTo(2)
    // TL A: normale Differenz (4 - 2 = 2) + 0,5 Gleichstand (untere Hälfte TL A/TL B) = 2,5
    expect(insuranceOf(e, "TL A").diff).toBeCloseTo(2.5)
    expect(insuranceOf(e, "TL B").diff).toBeCloseTo(0.5)
    expect(insuranceOf(e, "GSL").diff).toBeCloseTo(0) // GSL-Satz (5) bereits durch Gleichstand abgedeckt
    expect(insuranceOf(e, "Direktor").diff).toBeCloseTo(3) // 8 - 5
  })
})

describe("computeEarnings: Nicht-Führungsstufe bekommt keine Differenz", () => {
  it("ein FT über einer Führungskraft in der Kette wird übersprungen, aber die Kette läuft weiter", () => {
    const merged: MergedRow[] = [
      row("GSL", "Geschäftsstellenleiter", null),
      row("FT4-oben", "FT4", "GSL"), // untypische Konstellation: FT4 als "Vorgesetzter"
      row("FT1", "FT1", "FT4-oben", { insurance: 1 }),
    ]
    const e = computeEarnings(merged, RATES)
    expect(insuranceOf(e, "FT4-oben").diff).toBe(0)
    expect(insuranceOf(e, "GSL").diff).toBeCloseTo(4) // 5 - 1, FT4 wird übersprungen
  })
})

describe("computeEarnings: Seitenzweige bekommen nichts", () => {
  it("Produktion unter GSL Y bringt GSL X und dessen TL keine Differenz", () => {
    const merged: MergedRow[] = [
      row("Direktor", "Direktor", null),
      row("GSL X", "Geschäftsstellenleiter", "Direktor"),
      row("TL X", "Teamleiter", "GSL X"),
      row("GSL Y", "Geschäftsstellenleiter", "Direktor"),
      row("TL Y", "Teamleiter", "GSL Y"),
      row("FT2 Y", "FT2", "TL Y", { insurance: 1 }),
    ]
    const e = computeEarnings(merged, RATES)
    expect(insuranceOf(e, "GSL X").total).toBe(0)
    expect(insuranceOf(e, "TL X").total).toBe(0)
    expect(insuranceOf(e, "TL Y").diff).toBeCloseTo(2)
    expect(insuranceOf(e, "GSL Y").diff).toBeCloseTo(1)
  })
})

describe("computeEarnings: alle vier Pläne unabhängig", () => {
  it("Real Estate rechnet mit eigenen Sätzen, unabhängig von Insurance", () => {
    const merged: MergedRow[] = [
      row("Direktor", "Direktor", null),
      row("TL", "Teamleiter", "Direktor"),
      row("FT1", "FT1", "TL", { insurance: 3, realestate: 2 }),
    ]
    const e = computeEarnings(merged, RATES)
    const ft1 = e.get("FT1")!
    expect(ft1.own.insurance.amount).toBeCloseTo(3 * 1) // FT1 Insurance-Satz 1
    expect(ft1.own.realestate.amount).toBeCloseTo(2 * 1) // FT1 Real-Estate-Satz 1
    const tl = e.get("TL")!
    expect(tl.diff.insurance.amount).toBeCloseTo(3 * (4 - 1))
    expect(tl.diff.realestate.amount).toBeCloseTo(2 * (1.75 - 1))
  })
})

describe("computeEarnings: Zyklenschutz", () => {
  it("terminiert, wenn managerName-Ketten sich zyklisch referenzieren", () => {
    const merged: MergedRow[] = [
      row("A", "Teamleiter", "B", { insurance: 1 }),
      row("B", "Geschäftsstellenleiter", "A"),
    ]
    expect(() => computeEarnings(merged, RATES)).not.toThrow()
  })
})
