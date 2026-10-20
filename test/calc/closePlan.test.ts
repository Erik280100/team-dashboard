import { describe, expect, it } from "vitest"
import { planClose, type CloseInput, type Shared } from "../../functions/src/closePlan"
import * as archive from "../../src/lib/calc/archive"
import * as employees from "../../src/lib/calc/employees"

// Dieselben Funktionen, die Cloud-Build nach lib/shared.cjs bündelt.
const shared = {
  monthKeyOf: archive.monthKeyOf, nextMonthGoal: archive.nextMonthGoal,
  buildSnapshot: archive.buildSnapshot, buildIndexEntry: archive.buildIndexEntry,
  resetRowsForNewMonth: archive.resetRowsForNewMonth,
  employeeDocToRow: employees.employeeDocToRow, rowToEmployeeData: employees.rowToEmployeeData,
} as unknown as Shared

const input = (): CloseInput => ({
  teamGoal: { note: "Fokus", recruitGoal: 2, recruitActual: null, periodStart: "2026-10-01", periodEnd: "2026-10-31" },
  history: [{ date: "2026-09-30", ist: 1 }, { date: "2026-10-15", ist: 40 }, { date: "2026-10-31", ist: 70 }],
  org: {
    tree: { id: "boss", name: "Boss", role: "Geschäftsstellenleiter", children: [{ id: "m1", name: "Mia", role: "FT1", children: [] }] },
    notes: {}, conns: [], rates: {}, planRates: {},
  },
  employees: [
    {
      id: "boss",
      data: { name: "Boss", role: "Geschäftsstellenleiter", ancestors: [], soll: 5, ist: 30, atPlan: 1, atIst: 99, bonus: 100, ehByPlan: { insurance: 30 } },
      weeks: [{ analysenZ: 4, analysen: 3, beratungenZ: 2, beratungen: 1, stz: 0, stg: 0, etz: 1, etg: 1 }, { analysenZ: 1, analysen: 1 }],
      monthNote: { ehZiel: 50 },
    },
    {
      id: "m1",
      data: { name: "Mia", role: "FT1", ancestors: ["boss"], soll: 2, ist: 10, isNew: true, ehByPlan: { insurance: 10 }, vbByAbwickler: { Georg: 1 } },
      weeks: [],
    },
  ],
  index: [{ month: "2026-09" }],
  closedBy: "automatisch",
  now: new Date("2026-11-01T00:10:00+01:00"),
})

describe("planClose", () => {
  const plan = planClose(input(), shared)

  it("archiviert den Monat mit Live-Werten aus der Planung", () => {
    expect(plan.month).toBe("2026-10")
    const boss = plan.snapshotEmployees.find((e) => e.id === "boss")!.data
    expect(boss).toMatchObject({ name: "Boss", ancestors: [], atPlan: 5, atIst: 4, btPlan: 2, btIst: 1, etPlan: 1, etIst: 1, soll: 50, ist: 30 })
    expect(plan.snapshotEmployees.find((e) => e.id === "m1")!.data).toMatchObject({ ancestors: ["boss"], soll: 0, atIst: 0 })
    expect(plan.snapshotMeta).toMatchObject({ month: "2026-10", closedBy: "automatisch" })
    expect(plan.snapshotMeta).not.toHaveProperty("rows")
    // nur Verlaufseinträge des abgeschlossenen Monats
    expect((plan.snapshotMeta.history as unknown[]).length).toBe(2)
  })

  it("trägt den Monat in den Index ein (sortiert, ohne Dopplung)", () => {
    expect(plan.indexMonths.map((e) => e.month)).toEqual(["2026-09", "2026-10"])
    const again = planClose({ ...input(), index: [{ month: "2026-10" }, { month: "2026-09" }] }, shared)
    expect(again.indexMonths.map((e) => e.month)).toEqual(["2026-09", "2026-10"])
  })

  it("setzt Ist-Werte, Einheiten und Bonus zurück und lässt Soll/Plan stehen", () => {
    const boss = plan.resetWrites.find((w) => w.id === "boss")!.data
    expect(boss).toMatchObject({ ist: 0, atIst: 0, bonus: 0, soll: 5, atPlan: 1 })
    expect(boss.ehByPlan).toMatchObject({ insurance: 0 })
    expect(boss).not.toHaveProperty("name")
    expect(plan.resetWrites.find((w) => w.id === "m1")!.data.vbByAbwickler).toEqual({})
  })

  it("stellt auf den nächsten Kalendermonat um und behält nur neue Verlaufseinträge", () => {
    expect(plan.next.teamGoal).toMatchObject({ periodStart: "2026-11-01", periodEnd: "2026-11-30", note: "Fokus", recruitActual: null })
    expect(plan.next.history).toEqual([])
  })

  it("Dezember -> Januar des Folgejahres", () => {
    const dec = input()
    dec.teamGoal = { ...dec.teamGoal, periodStart: "2026-12-01", periodEnd: "2026-12-31" }
    expect(planClose(dec, shared).next.teamGoal).toMatchObject({ periodStart: "2027-01-01", periodEnd: "2027-01-31" })
  })
})
