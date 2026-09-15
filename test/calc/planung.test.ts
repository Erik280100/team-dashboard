import { describe, expect, it } from "vitest"
import {
  aggregateByName, defaultAnnual, emptyWeekEntry, isoWeekKey, monthWeekKeys,
  quarterStatus, quotePct, shiftWeek, sumWeekEntries, weekToQuarter, yearWeekKeys,
} from "../../src/lib/calc/planung"
import type { PlanWeekDoc, PlanWeekEntry } from "../../src/types/dashboard"

function entry(patch: Partial<PlanWeekEntry> = {}): PlanWeekEntry {
  return { ...emptyWeekEntry(), ...patch }
}

describe("isoWeekKey", () => {
  it("Montag und Sonntag derselben Woche liefern denselben Schlüssel", () => {
    // 2026-09-14 ist ein Montag (KW 38), 2026-09-20 der darauffolgende Sonntag
    expect(isoWeekKey(new Date(2026, 8, 14))).toBe("2026-W38")
    expect(isoWeekKey(new Date(2026, 8, 20))).toBe("2026-W38")
  })

  it("Jahreswechsel: der 1.1. kann noch zur letzten KW des Vorjahres gehören", () => {
    // 2025-01-01 ist ein Mittwoch, gehört ISO-8601 zu 2025-W01 (Donnerstag der Woche liegt in 2025)
    expect(isoWeekKey(new Date(2025, 0, 1))).toBe("2025-W01")
    // 2027-01-01 ist ein Freitag -> Donnerstag der Woche liegt noch in 2026 -> 2026-W53
    expect(isoWeekKey(new Date(2027, 0, 1))).toBe("2026-W53")
  })
})

describe("shiftWeek", () => {
  it("wechselt vor und zurück über eine Jahresgrenze (2026 hat 53 ISO-Wochen)", () => {
    expect(shiftWeek("2026-W53", 1)).toBe("2027-W01")
    expect(shiftWeek("2027-W01", -1)).toBe("2026-W53")
  })
})

describe("monthWeekKeys", () => {
  it("enthält Randwochen, die in den Vor-/Folgemonat hineinragen", () => {
    // September 2026: Mo 31.08.–So 06.09. ist KW 36 (ragt in August hinein),
    // Mo 28.09.–So 04.10. ist KW 40 (ragt in Oktober hinein).
    const weeks = monthWeekKeys("2026-09")
    expect(weeks[0]).toBe("2026-W36")
    expect(weeks[weeks.length - 1]).toBe("2026-W40")
  })

  it("jede Woche ist genau einmal enthalten", () => {
    const weeks = monthWeekKeys("2026-02")
    expect(new Set(weeks).size).toBe(weeks.length)
  })
})

describe("yearWeekKeys", () => {
  it("enthält nur Wochen des angegebenen ISO-Wochenjahres", () => {
    const weeks = yearWeekKeys(2026)
    expect(weeks.every((w) => w.startsWith("2026-W"))).toBe(true)
    expect(weeks).toContain("2026-W01")
    expect(weeks).toContain("2026-W53")
  })
})

describe("weekToQuarter", () => {
  it("ordnet Wochennummern den vier Quartalen zu", () => {
    expect(weekToQuarter("2026-W01")).toBe("Q1")
    expect(weekToQuarter("2026-W13")).toBe("Q1")
    expect(weekToQuarter("2026-W14")).toBe("Q2")
    expect(weekToQuarter("2026-W26")).toBe("Q2")
    expect(weekToQuarter("2026-W27")).toBe("Q3")
    expect(weekToQuarter("2026-W39")).toBe("Q3")
    expect(weekToQuarter("2026-W40")).toBe("Q4")
    expect(weekToQuarter("2026-W53")).toBe("Q4")
  })
})

describe("sumWeekEntries", () => {
  it("summiert alle Zahlenfelder", () => {
    const sum = sumWeekEntries([
      entry({ atg: 3, vertraege: 1 }),
      entry({ atg: 4, vertraege: 2 }),
    ])
    expect(sum.atg).toBe(7)
    expect(sum.vertraege).toBe(3)
  })

  it("leere Liste ergibt einen leeren Eintrag", () => {
    expect(sumWeekEntries([])).toEqual(emptyWeekEntry())
  })
})

describe("aggregateByName", () => {
  const docs: PlanWeekDoc[] = [
    { week: "2026-W01", entries: { Anna: entry({ vertraege: 1 }), Bert: entry({ vertraege: 5 }) } },
    { week: "2026-W02", entries: { Anna: entry({ vertraege: 2 }) } },
  ]

  it("summiert je Name über alle Dokumente, fehlende Wochen zählen als 0", () => {
    const result = aggregateByName(docs, ["Anna", "Bert", "Carla"])
    expect(result.get("Anna")?.vertraege).toBe(3)
    expect(result.get("Bert")?.vertraege).toBe(5)
    expect(result.get("Carla")).toEqual(emptyWeekEntry())
  })
})

describe("quotePct", () => {
  it("berechnet die Abschlussquote", () => {
    expect(quotePct(5, 10)).toBe(50)
  })
  it("liefert 0 bei beratungen <= 0 statt einer Division durch 0", () => {
    expect(quotePct(5, 0)).toBe(0)
  })
})

describe("quarterStatus", () => {
  const targets = { vertraege: 100 }

  it("künftige Jahre sind 'upcoming'", () => {
    expect(quarterStatus("Q1", { vertraege: 0 }, targets, 2099)).toBe("upcoming")
  })

  it("vergangene Jahre: 'completed' ab 95% Zielerreichung, sonst 'behind'", () => {
    expect(quarterStatus("Q1", { vertraege: 95 }, targets, 2000)).toBe("completed")
    expect(quarterStatus("Q1", { vertraege: 50 }, targets, 2000)).toBe("behind")
  })

  it("laufendes Jahr, Quartal noch nicht begonnen: 'upcoming'", () => {
    const now = new Date(2026, 0, 1) // KW 1
    expect(quarterStatus("Q4", { vertraege: 0 }, targets, 2026, now)).toBe("upcoming")
  })

  it("laufendes Jahr, Quartal im Plan vs. im Rückstand (Pro-rata mit 90%-Faktor)", () => {
    // Q1 = KW 1..13, "jetzt" = KW 7 -> erwarteter Anteil (7-1)/(13-1)*0.9 = 45%
    const now = new Date(2026, 1, 9) // Montag KW 7 2026
    expect(quarterStatus("Q1", { vertraege: 50 }, targets, 2026, now)).toBe("on-track")
    expect(quarterStatus("Q1", { vertraege: 10 }, targets, 2026, now)).toBe("behind")
  })

  it("laufendes Jahr, Quartal vorbei: 'completed'/'behind' wie bei vergangenen Jahren", () => {
    const now = new Date(2026, 11, 31) // KW 53
    expect(quarterStatus("Q1", { vertraege: 95 }, targets, 2026, now)).toBe("completed")
    expect(quarterStatus("Q1", { vertraege: 50 }, targets, 2026, now)).toBe("behind")
  })
})

describe("defaultAnnual", () => {
  it("liefert alle fünf Zielkennzahlen und vier Quartale mit Meilenstein", () => {
    const d = defaultAnnual()
    expect(Object.keys(d.targets).sort()).toEqual(["analysen", "atg", "beratungen", "einheiten", "vertraege"].sort())
    expect(Object.keys(d.quarters)).toEqual(["Q1", "Q2", "Q3", "Q4"])
    expect(d.quarters.Q1.milestone).toBeTruthy()
  })
})
