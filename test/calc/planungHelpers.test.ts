import { afterEach, describe, expect, it, vi } from "vitest"
import {
  aggregateByGroup, currentMonthKey, emptyWeekEntry, isoWeekNumber, periodWeekKeys, planManagerKey, weekLabel, weekStartDate,
} from "../../src/lib/calc/planung"
import type { PlanWeekDoc } from "../../src/types/dashboard"

describe("isoWeekNumber", () => {
  it("Jahreswechsel und Woche 53", () => {
    expect(isoWeekNumber(new Date(2026, 11, 31))).toBe(53) // Donnerstag
    expect(isoWeekNumber(new Date(2027, 0, 1))).toBe(53) // Freitag, noch Woche 53 von 2026
    expect(isoWeekNumber(new Date(2027, 0, 4))).toBe(1)
    expect(isoWeekNumber(new Date(2020, 11, 31))).toBe(53)
    expect(isoWeekNumber(new Date(2024, 11, 30))).toBe(1) // Montag, gehört schon zu 2025-W01
  })
})

describe("weekStartDate / weekLabel", () => {
  it("liefert den Montag der Woche (UTC)", () => {
    expect(weekStartDate("2026-W38").toISOString().slice(0, 10)).toBe("2026-09-14")
    expect(weekStartDate("2026-W01").toISOString().slice(0, 10)).toBe("2025-12-29")
    expect(weekStartDate("2026-W53").toISOString().slice(0, 10)).toBe("2026-12-28")
  })

  it("beschriftet mit Kalenderwoche und Datumsbereich", () => {
    const label = weekLabel("2026-W38")
    expect(label.startsWith("KW 38 · ")).toBe(true)
    expect(label).toContain("14.09.")
    expect(label).toContain("20.09.")
  })
})

describe("periodWeekKeys", () => {
  it("alle ISO-Wochen eines Zeitraums, sortiert und ohne Doppelte", () => {
    expect(periodWeekKeys("2026-09-14", "2026-09-28")).toEqual(["2026-W38", "2026-W39", "2026-W40"])
    expect(periodWeekKeys("2026-09-16", "2026-09-16")).toEqual(["2026-W38"])
  })

  it("Ende vor Beginn ergibt eine leere Liste", () => {
    expect(periodWeekKeys("2026-09-20", "2026-09-10")).toEqual([])
  })

  it("fehlende Grenzen fallen auf den Standardzeitraum zurück", () => {
    expect(periodWeekKeys("", "").length).toBeGreaterThan(0)
  })
})

describe("planManagerKey", () => {
  it("macht aus dem Namen einen Slug ohne Umlaute und Sonderzeichen", () => {
    expect(planManagerKey("  Jürgen Müller-Ölz ")).toBe("jurgen-muller-olz")
    expect(planManagerKey("Éva")).toBe("eva")
  })

  it("leere oder reine Sonderzeichen-Namen ergeben 'unbekannt'", () => {
    expect(planManagerKey("")).toBe("unbekannt")
    expect(planManagerKey(" -- ")).toBe("unbekannt")
  })
})

describe("aggregateByGroup", () => {
  const doc = (entries: PlanWeekDoc["entries"]) => ({ entries }) as PlanWeekDoc
  const e = (vertraege: number) => ({ ...emptyWeekEntry(), vertraege })

  it("summiert die Einträge der Gruppenmitglieder über alle Wochen", () => {
    const docs = [doc({ A: e(2), B: e(3), C: e(100) }), doc({ A: e(1) })]
    const out = aggregateByGroup(docs, [{ name: "G1", names: ["A", "B"] }, { name: "G2", names: ["Z"] }])
    expect(out.get("G1")?.vertraege).toBe(6)
    expect(out.get("G2")?.vertraege).toBe(0)
  })
})

describe("currentMonthKey", () => {
  afterEach(() => vi.useRealTimers())

  it("liefert YYYY-MM mit führender Null", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 15))
    expect(currentMonthKey()).toBe("2026-03")
    vi.setSystemTime(new Date(2026, 11, 31, 23, 0))
    expect(currentMonthKey()).toBe("2026-12")
  })
})
