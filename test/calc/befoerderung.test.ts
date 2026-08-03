import { describe, expect, it } from "vitest"
import {
  computePromotionProgress, eigenproduktion, gesamtproduktion,
  MIN_OWN_UNITS_PER_MONTH_FOR_POINT, STAGE_REQUIREMENTS,
  type PromotionProgress,
} from "../../src/lib/calc/befoerderung"
import type { PlanId } from "../../src/lib/calc/struktur"
import type { MergedRow } from "../../src/lib/calc/team"

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

function get(map: Map<string, PromotionProgress>, name: string): PromotionProgress {
  const p = map.get(name)
  if (!p) throw new Error(`no progress for ${name}`)
  return p
}

describe("eigenproduktion / gesamtproduktion", () => {
  it("eigenproduktion zählt nur Insurance", () => {
    expect(eigenproduktion({ ist: 999, ehByPlan: { insurance: 5, credit: 100 } })).toBe(5)
  })
  it("gesamtproduktion summiert alle vier Sparten", () => {
    expect(gesamtproduktion({ ist: 0, ehByPlan: { insurance: 5, credit: 3, investment: 1, realestate: 2 } })).toBe(11)
  })
  it("Altbestand ohne ehByPlan: ist gilt als Insurance", () => {
    expect(eigenproduktion({ ist: 42 })).toBe(42)
    expect(gesamtproduktion({ ist: 42 })).toBe(42)
  })
})

describe("computePromotionProgress: FT-Stufen (nur Eigenproduktion)", () => {
  it("FT1 -> FT2 braucht 1000 EH Eigenproduktion (Insurance)", () => {
    const merged = [row("A", "FT1", null, { insurance: 400 })]
    const p = get(computePromotionProgress(merged), "A")
    expect(p.nextRole).toBe("FT2")
    expect(p.criteria).toHaveLength(1)
    expect(p.criteria[0].kind).toBe("eigenproduktion")
    expect(p.criteria[0].have).toBe(400)
    expect(p.criteria[0].need).toBe(1000)
    expect(p.criteria[0].missing).toBe(600)
    expect(p.ready).toBe(false)
  })

  it("Credit/Investment/Real-Estate-Einheiten zählen NICHT zur Eigenproduktion", () => {
    const merged = [row("A", "FT1", null, { insurance: 100, credit: 5000, investment: 5000, realestate: 5000 })]
    const p = get(computePromotionProgress(merged), "A")
    expect(p.criteria[0].have).toBe(100)
  })

  it("ready === true, wenn die Eigenproduktion die Schwelle erreicht", () => {
    const merged = [row("A", "FT3", null, { insurance: 4000 })]
    const p = get(computePromotionProgress(merged), "A")
    expect(p.nextRole).toBe("FT4")
    expect(p.ready).toBe(true)
  })

  it("Altbestand ohne ehByPlan: ist zählt als Insurance-Eigenproduktion", () => {
    const r = row("A", "FT1", null)
    r.ist = 1000
    const p = get(computePromotionProgress([r]), "A")
    expect(p.criteria[0].have).toBe(1000)
    expect(p.ready).toBe(true)
  })
})

describe("computePromotionProgress: Teamleiter (Mitarbeiter direkt + indirekt)", () => {
  it("zählt Agenten ab FT2 über den gesamten Unterbau (nicht nur direkte Kinder)", () => {
    const merged = [
      row("Chef", "FT4", null),
      row("Kind1", "FT2", "Chef"),
      row("Enkel1", "FT2", "Kind1"),
      row("Enkel2", "FT3", "Kind1"),
    ]
    const p = get(computePromotionProgress(merged), "Chef")
    expect(p.nextRole).toBe("Teamleiter")
    const maCrit = p.criteria.find((c) => c.kind === "mitarbeiter")!
    expect(maCrit.have).toBe(3) // Kind1 + Enkel1 + Enkel2
    expect(maCrit.need).toBe(3)
    expect(p.ready).toBe(false) // Gruppenproduktion fehlt noch
  })

  it("FT1-Kinder zählen nicht als Rekrut", () => {
    const merged = [
      row("Chef", "FT4", null),
      row("Kind1", "FT1", "Chef"),
    ]
    const p = get(computePromotionProgress(merged), "Chef")
    const maCrit = p.criteria.find((c) => c.kind === "mitarbeiter")!
    expect(maCrit.have).toBe(0)
  })

  it("Erleichterung: 2 statt 3 Agenten reichen ab 6000 EH Eigenproduktion", () => {
    const merged = [
      row("Chef", "FT4", null, { insurance: 6000 }),
      row("Kind1", "FT2", "Chef"),
      row("Kind2", "FT2", "Chef"),
    ]
    const p = get(computePromotionProgress(merged), "Chef")
    const maCrit = p.criteria.find((c) => c.kind === "mitarbeiter")!
    expect(maCrit.need).toBe(2)
    expect(maCrit.relaxed).toBe(true)
    expect(maCrit.have).toBe(2)
  })

  it("Gruppenproduktion/Monat = 4000 EH / (1 Quartal * 3) = 1333, gerundet", () => {
    const req = STAGE_REQUIREMENTS.find((r) => r.role === "Teamleiter")!
    expect(req.groupUnits).toBe(4000)
    expect(req.quarters).toBe(1)
    const merged = [row("Chef", "FT4", null, { insurance: 1333 })]
    const p = get(computePromotionProgress(merged), "Chef")
    const gpCrit = p.criteria.find((c) => c.kind === "gruppenproduktion")!
    expect(gpCrit.need).toBe(1333) // Math.round(4000/3)
    expect(gpCrit.have).toBe(1333)
    expect(gpCrit.missing).toBe(0)
  })
})

describe("computePromotionProgress: Geschäftsstellenleiter (Punkte nur direkte Kinder)", () => {
  it("Punkte zählen nur direkte Kinder, nicht den tieferen Unterbau", () => {
    const merged = [
      row("Chef", "Teamleiter", null),
      row("DirektesFT2", "FT2", "Chef", { insurance: 200 }), // 1 Punkt
      row("DirekterTL", "Teamleiter", "Chef"), // 2 Punkte
      row("Enkel", "Geschäftsstellenleiter", "DirekterTL"), // wäre 4 Punkte, zählt aber NICHT (indirekt)
    ]
    const p = get(computePromotionProgress(merged), "Chef")
    expect(p.nextRole).toBe("Geschäftsstellenleiter")
    const pktCrit = p.criteria.find((c) => c.kind === "punkte")!
    expect(pktCrit.have).toBe(3) // 1 (FT2) + 2 (TL), Enkel nicht mitgezählt
    expect(pktCrit.need).toBe(4)
  })

  it("FT-Kind unter der Mindestproduktion (100 EH/Monat) gibt keinen Punkt, darüber schon", () => {
    const low = [row("Chef", "Teamleiter", null), row("Kind", "FT2", "Chef", { insurance: 99 })]
    const pLow = get(computePromotionProgress(low), "Chef")
    expect(pLow.criteria.find((c) => c.kind === "punkte")!.have).toBe(0)

    const high = [row("Chef", "Teamleiter", null), row("Kind", "FT2", "Chef", { insurance: MIN_OWN_UNITS_PER_MONTH_FOR_POINT })]
    const pHigh = get(computePromotionProgress(high), "Chef")
    expect(pHigh.criteria.find((c) => c.kind === "punkte")!.have).toBe(1)
  })

  it("Erleichterung: 3 statt 4 Punkte reichen ab 65.000 EH Gruppenproduktion", () => {
    const merged = [
      row("Chef", "Teamleiter", null, { insurance: 65000 }),
      row("K1", "FT2", "Chef", { insurance: 200 }),
      row("K2", "FT2", "Chef", { insurance: 200 }),
      row("K3", "FT2", "Chef", { insurance: 200 }),
    ]
    const p = get(computePromotionProgress(merged), "Chef")
    const pktCrit = p.criteria.find((c) => c.kind === "punkte")!
    expect(pktCrit.need).toBe(3)
    expect(pktCrit.relaxed).toBe(true)
    expect(pktCrit.have).toBe(3) // K1 + K2 + K3, je 1 Punkt
    // Gruppenproduktion (65000 Chef + 600 Kinder = 65600) liegt weit über dem
    // Monatsziel (round(20000/6) = 3333) -> beide Kriterien erfüllt.
    expect(p.ready).toBe(true)
  })
})

describe("computePromotionProgress: Unterbau-Rollup (Gruppenproduktion)", () => {
  it("summiert Person + mehrstufigen Unterbau, alle Sparten", () => {
    const merged = [
      row("A", "Geschäftsstellenleiter", null, { insurance: 100 }),
      row("B", "Teamleiter", "A", { insurance: 50, credit: 10 }),
      row("C", "FT2", "B", { insurance: 20 }),
      row("D", "FT1", "C", { realestate: 5 }),
    ]
    const p = get(computePromotionProgress(merged), "A")
    const gpCrit = p.criteria.find((c) => c.kind === "gruppenproduktion")!
    // 100 (A) + 60 (B) + 20 (C) + 5 (D) = 185
    expect(gpCrit.have).toBe(185)
  })
})

describe("computePromotionProgress: Status 'vielleicht' wird über MergedRow bereits gefiltert", () => {
  it("eine Person, die im Roster fehlt (weil 'vielleicht'), wird nicht gezählt — ihre sichtbaren Kinder hängen am nächsten Vorgesetzten", () => {
    // Simuliert das Ergebnis von sbRoster()+mergeRosterWithRows(): "Versteckt" taucht
    // in `merged` gar nicht erst auf, ihr Kind zeigt stattdessen auf den Großvater.
    const merged = [
      row("Grossvater", "FT4", null),
      row("SichtbaresKind", "FT2", "Grossvater"), // wäre eigentlich Enkel von "Versteckt"
    ]
    const p = get(computePromotionProgress(merged), "Grossvater")
    const maCrit = p.criteria.find((c) => c.kind === "mitarbeiter")!
    expect(maCrit.have).toBe(1)
  })
})

describe("computePromotionProgress: Leiter-Grenzen", () => {
  it("Direktor hat kein nextRole und keine Kriterien", () => {
    const merged = [row("A", "Direktor", null)]
    const p = get(computePromotionProgress(merged), "A")
    expect(p.nextRole).toBeNull()
    expect(p.criteria).toHaveLength(0)
    expect(p.ready).toBe(false)
  })

  it("unbekannte Rolle (z. B. 'Mitarbeiter') wird wie FT1 behandelt, Ziel ist FT2", () => {
    const merged = [row("A", "Mitarbeiter", null, { insurance: 1000 })]
    const p = get(computePromotionProgress(merged), "A")
    expect(p.nextRole).toBe("FT2")
    expect(p.ready).toBe(true)
  })

  it("Rollen-Normalisierung: 'FT 2' und 'FT2' liefern dasselbe Ergebnis", () => {
    const spaced = get(computePromotionProgress([row("A", "FT 2", null, { insurance: 500 })]), "A")
    const compact = get(computePromotionProgress([row("A", "FT2", null, { insurance: 500 })]), "A")
    expect(spaced.nextRole).toBe(compact.nextRole)
    expect(spaced.criteria).toEqual(compact.criteria)
  })
})

describe("computePromotionProgress: Zyklenschutz", () => {
  it("terminiert, wenn managerName-Ketten sich zyklisch referenzieren", () => {
    const merged = [
      row("A", "FT4", "B"),
      row("B", "FT4", "A"),
    ]
    expect(() => computePromotionProgress(merged)).not.toThrow()
  })
})
