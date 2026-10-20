import { describe, expect, it } from "vitest"
import { computeMonthStats, monthKeyFromGoal, monthWeekKeys as serverWeekKeys } from "../../functions/src/planStats"
import { monthWeekKeys, sumWeekEntries } from "../../src/lib/calc/planung"
import { monthKeyOf } from "../../src/lib/calc/archive"
import { applyMonthStats } from "../../src/lib/calc/team"
import type { EmployeeRow } from "../../src/lib/calc/format"

describe("planStats (Server-Spiegel)", () => {
  it("Wochen und Monatsschlüssel stimmen mit dem Client überein", () => {
    for (const m of ["2026-01", "2026-02", "2026-09", "2026-12", "2027-01", "2020-12"]) {
      expect(serverWeekKeys(m)).toEqual(monthWeekKeys(m))
    }
    for (const periodStart of ["2026-09-01", "2026-10-15", "2027-01-03"]) {
      expect(monthKeyFromGoal({ periodStart })).toBe(monthKeyOf({ periodStart }))
    }
  })

  it("Summen entsprechen sumWeekEntries + Zuordnung AT/BT/ST/ET", () => {
    const weeks = [
      { analysenZ: 4, analysen: 3, beratungenZ: 2, beratungen: 1, stz: 1, stg: 0, etz: 2, etg: 1 },
      { analysenZ: 5, analysen: 2, beratungenZ: 3, beratungen: 3, stz: 0, stg: 1, etz: 1, etg: 1 },
    ]
    const stats = computeMonthStats("2026-09", weeks, { ehZiel: 12 })
    const client = sumWeekEntries(weeks as never)
    expect(stats).toEqual({
      month: "2026-09",
      atPlan: client.analysenZ, atIst: client.analysen,
      btPlan: client.beratungenZ, btIst: client.beratungen,
      stPlan: client.stz, stIst: client.stg,
      etPlan: client.etz, etIst: client.etg,
      soll: 12,
    })
  })

  it("ohne Daten: Nullen", () => {
    expect(computeMonthStats("2026-09", [], undefined)).toMatchObject({ atIst: 0, soll: 0 })
  })
})

describe("applyMonthStats", () => {
  const stats = { month: "2026-09", atPlan: 5, atIst: 4, btPlan: 3, btIst: 2, stPlan: 1, stIst: 1, etPlan: 2, etIst: 1, soll: 20 }
  const rows: EmployeeRow[] = [
    { name: "Eigen", soll: 9, ist: 1, atIst: 7 },
    { name: "Fremd", soll: 9, ist: 1, atIst: 7, monthStats: stats },
    { name: "FremdAlt", soll: 9, ist: 1, atIst: 7, monthStats: { ...stats, month: "2026-08" } },
    { name: "FremdOhne", soll: 9, ist: 1, atIst: 7 },
  ]
  it("lässt sichtbare Zeilen unverändert, ersetzt die übrigen durch Monatssummen oder 0", () => {
    const out = applyMonthStats(rows, "2026-09", (n) => n === "Eigen")
    expect(out[0]).toBe(rows[0])
    expect(out[1]).toMatchObject({ atIst: 4, atPlan: 5, soll: 20, ist: 1 })
    expect(out[2]).toMatchObject({ atIst: 0, soll: 0, ist: 1 })
    expect(out[3]).toMatchObject({ atIst: 0, soll: 0 })
  })
})
