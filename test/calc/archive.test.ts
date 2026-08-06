import { describe, expect, it } from "vitest"
import {
  archiveNow, buildIndexEntry, buildSnapshot, isMonthCloseDue, monthKeyOf, monthLabel,
  monthTotals, nextMonthGoal, resetRowsForNewMonth,
} from "../../src/lib/calc/archive"
import { defaultPeriod, monthWeekProgress } from "../../src/lib/calc/format"
import { timelineData } from "../../src/lib/calc/overview"
import { DEFAULT_PLAN_RATES, sbRoster, type SbNode } from "../../src/lib/calc/struktur"
import { mergeRosterWithRows, teamTotals } from "../../src/lib/calc/team"
import { computeEarnings } from "../../src/lib/calc/verguetung"
import type { EmployeeRow, TeamGoal } from "../../src/lib/calc/format"
import type { ArchiveIndexEntry } from "../../src/types/archive"
import type { OrgChartDoc } from "../../src/types/dashboard"

const TREE: SbNode = {
  id: "root", name: "Chef", role: "Geschäftsstellenleiter",
  children: [{ id: "a", name: "Anna Berger", role: "FT1", children: [] }],
}

const ROWS: EmployeeRow[] = [
  {
    name: "Chef", soll: 100, ist: 50, atPlan: 10, atIst: 5, btPlan: 0, btIst: 0, etPlan: 0, etIst: 0,
    ehByPlan: { insurance: 50, investment: 0, credit: 0, realestate: 0 }, isNew: false, bonus: 200,
  },
  {
    name: "Anna Berger", soll: 50, ist: 20, atPlan: 5, atIst: 3, btPlan: 0, btIst: 0, etPlan: 0, etIst: 0,
    ehByPlan: { insurance: 20, investment: 0, credit: 0, realestate: 0 }, isNew: true, joinDate: "2026-07-05",
  },
]

const GOAL: TeamGoal = {
  note: "Fokus Juli", recruitGoal: 2, recruitActual: null,
  periodStart: "2026-07-01", periodEnd: "2026-07-31",
}

describe("resetRowsForNewMonth", () => {
  it("nulls Ist-Felder, erhält Soll/Plan/name/joinDate, mutiert nicht", () => {
    const before = JSON.parse(JSON.stringify(ROWS))
    const next = resetRowsForNewMonth(ROWS)
    expect(ROWS).toEqual(before) // keine Mutation

    expect(next[0]).toMatchObject({
      name: "Chef", soll: 100, atPlan: 10, ist: 0, atIst: 0, btIst: 0, etIst: 0, bonus: 0,
    })
    expect(next[0].ehByPlan).toEqual({ insurance: 0, investment: 0, credit: 0, realestate: 0 })
    expect(next[1]).toMatchObject({ name: "Anna Berger", soll: 50, isNew: true, joinDate: "2026-07-05", ist: 0 })
  })

  it("lässt ehByPlan unangetastet, wenn es gar nicht existiert (Altbestand)", () => {
    const legacyRow: EmployeeRow = { name: "Alt", soll: 10, ist: 5 }
    const next = resetRowsForNewMonth([legacyRow])
    expect(next[0].ehByPlan).toBeUndefined()
    expect(next[0].ist).toBe(0)
  })
})

describe("nextMonthGoal", () => {
  it("Juli -> August", () => {
    const next = nextMonthGoal(GOAL)
    expect(next.periodStart).toBe("2026-08-01")
    expect(next.periodEnd).toBe("2026-08-31")
    expect(next.recruitActual).toBeNull()
    expect(next.note).toBe("Fokus Juli")
    expect(next.recruitGoal).toBe(2)
  })

  it("Dezember rollt korrekt ins Folgejahr", () => {
    const dec: TeamGoal = { ...GOAL, periodStart: "2026-12-01", periodEnd: "2026-12-31" }
    const next = nextMonthGoal(dec)
    expect(next.periodStart).toBe("2027-01-01")
    expect(next.periodEnd).toBe("2027-01-31")
  })
})

describe("monthKeyOf / monthLabel", () => {
  it("liefert den Monat aus periodEnd", () => {
    expect(monthKeyOf(GOAL)).toBe("2026-07")
    expect(monthLabel("2026-07")).toBe("Juli 2026")
  })

  it("bleibt auch bei defaultPeriod()'s UTC-verschobenem periodStart korrekt", () => {
    // defaultPeriod() nutzt toISOString() (UTC) und kann periodStart östlich von
    // UTC einen Tag zurückdatieren — monthKeyOf() muss trotzdem den Monat von
    // periodEnd treffen, das von diesem Bug nicht betroffen ist.
    const def = defaultPeriod()
    const key = monthKeyOf(def)
    const [y, m] = key.split("-").map(Number)
    const now = new Date()
    expect(y).toBe(now.getFullYear())
    expect(m).toBe(now.getMonth() + 1)
  })
})

describe("archiveNow", () => {
  it("liegt einen Tag nach periodEnd, sodass monthWeekProgress/timelineData den vollen Monat zeigen", () => {
    const now = archiveNow(GOAL)
    expect(monthWeekProgress(GOAL, now)).toEqual({ active: true, fraction: 1 })

    const history = [{ date: "2026-07-31", ist: 70 }]
    const timeline = timelineData(GOAL, ROWS, history, now)
    expect(timeline.valid).toBe(true)
    expect(timeline.points.at(-1)?.actual).not.toBeNull()
  })
})

describe("isMonthCloseDue", () => {
  it("true nach Zeitraumende ohne Archiv-Eintrag", () => {
    expect(isMonthCloseDue(GOAL, [], new Date("2026-08-01"))).toBe(true)
  })
  it("false vor Zeitraumende", () => {
    expect(isMonthCloseDue(GOAL, [], new Date("2026-07-15"))).toBe(false)
  })
  it("false, wenn der Monat schon archiviert ist", () => {
    const entry = { month: "2026-07" } as ArchiveIndexEntry
    expect(isMonthCloseDue(GOAL, [entry], new Date("2026-08-01"))).toBe(false)
  })
})

describe("monthTotals", () => {
  it("stimmt mit teamTotals(mergeRosterWithRows(...)) und der Summe aus computeEarnings überein", () => {
    const totals = monthTotals(ROWS, GOAL, TREE, DEFAULT_PLAN_RATES)

    const roster = sbRoster(TREE)
    const merged = mergeRosterWithRows(roster, ROWS)
    const expectedTotals = teamTotals(merged)
    const expectedEur = [...computeEarnings(merged, DEFAULT_PLAN_RATES).values()].reduce((s, e) => s + e.total, 0)

    expect(totals.soll).toBe(expectedTotals.soll)
    expect(totals.ist).toBe(expectedTotals.ist)
    expect(totals.atPlan).toBe(expectedTotals.atPlan)
    expect(totals.atIst).toBe(expectedTotals.atIst)
    expect(totals.totalEur).toBeCloseTo(expectedEur, 6)
    expect(totals.pct).toBe(Math.round((expectedTotals.ist / expectedTotals.soll) * 100))
    expect(totals.ehByPlan.insurance).toBe(70)
    expect(totals.newHireCount).toBe(1)
  })
})

describe("buildSnapshot / buildIndexEntry", () => {
  const orgChart: OrgChartDoc = { tree: TREE, notes: {}, conns: [], rates: {}, planRates: DEFAULT_PLAN_RATES }

  it("filtert history auf den Zeitraum und friert planRates auf", () => {
    const history = [
      { date: "2026-06-15", ist: 999 }, // außerhalb, muss verschwinden
      { date: "2026-07-10", ist: 30 },
      { date: "2026-08-01", ist: 999 }, // außerhalb, muss verschwinden
    ]
    const snapshot = buildSnapshot({
      month: "2026-07", rows: ROWS, teamGoal: GOAL, history, orgChart, closedBy: "test@example.com",
      now: new Date("2026-08-01T10:00:00Z"),
    })
    expect(snapshot.history).toEqual([{ date: "2026-07-10", ist: 30 }])
    expect(snapshot.orgChart.planRates).toEqual(DEFAULT_PLAN_RATES)
    expect(snapshot.closedBy).toBe("test@example.com")
    expect(snapshot.month).toBe("2026-07")
  })

  it("buildIndexEntry leitet Label und Totals aus dem Snapshot ab", () => {
    const snapshot = buildSnapshot({ month: "2026-07", rows: ROWS, teamGoal: GOAL, history: [], orgChart, closedBy: null })
    const entry = buildIndexEntry(snapshot)
    expect(entry.label).toBe("Juli 2026")
    expect(entry.periodStart).toBe("2026-07-01")
    expect(entry.totals.ist).toBe(70)
  })
})
