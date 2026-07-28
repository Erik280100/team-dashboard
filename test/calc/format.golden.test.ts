import { describe, expect, it } from "vitest"
import {
  fmt, pctOf, teamTarget, progressClass, initials, recruitActualValue,
  parseISODate, toISODate, addDays, defaultPeriod, monthWeekProgress, migrateRow, migrateRows,
  type EmployeeRow,
} from "../../src/lib/calc/format"
// @ts-expect-error – plain JS fixture, keine Typen nötig
import * as legacy from "../legacy-fixtures/format.legacy.js"

describe("format: golden master vs. legacy", () => {
  it("fmt / pctOf / progressClass / initials match", () => {
    for (const n of [0, 12.4, 999.6, undefined, null]) {
      expect(fmt(n as number)).toBe(legacy.fmt(n))
    }
    for (const r of [{ soll: 100, ist: 50 }, { soll: 0, ist: 10 }, { soll: 40, ist: 39 }]) {
      expect(pctOf(r)).toBe(legacy.pctOf(r))
      expect(progressClass(pctOf(r))).toBe(legacy.progressClass(legacy.pctOf(r)))
    }
    for (const name of ["Anna Muster", "  Cher  ", "Bernd van Beispiel", ""]) {
      expect(initials(name)).toBe(legacy.initials(name))
    }
  })

  it("teamTarget / recruitActualValue match", () => {
    const rows: EmployeeRow[] = [
      { soll: 100, ist: 50, isNew: true },
      { soll: 200, ist: 180, isNew: false },
      { soll: 0, ist: 0, isNew: true },
    ]
    expect(teamTarget(rows)).toBe(legacy.teamTarget(rows))

    expect(recruitActualValue(rows, { recruitActual: null })).toBe(
      legacy.recruitActualValue(rows, { recruitActual: null })
    )
    expect(recruitActualValue(rows, { recruitActual: 5 })).toBe(
      legacy.recruitActualValue(rows, { recruitActual: 5 })
    )
  })

  it("date helpers match", () => {
    const iso = "2026-07-28"
    expect(toISODate(parseISODate(iso))).toBe(legacy.toISODate(legacy.parseISODate(iso)))
    expect(toISODate(addDays(parseISODate(iso), 10))).toBe(
      legacy.toISODate(legacy.addDays(legacy.parseISODate(iso), 10))
    )
    expect(defaultPeriod()).toEqual(legacy.defaultPeriod())
  })

  it("monthWeekProgress matches across a range of reference dates", () => {
    const goal = { periodStart: "2026-07-01", periodEnd: "2026-07-31" }
    for (const day of ["2026-06-15", "2026-07-01", "2026-07-15", "2026-07-31", "2026-08-05"]) {
      const now = new Date(day)
      expect(monthWeekProgress(goal, now)).toEqual(legacy.monthWeekProgress(goal, day))
    }
  })

  it("migrateRow / migrateRows match", () => {
    const rowsA: EmployeeRow[] = [{ soll: 1, ist: 1, at: 10, bt: 20, et: 30 }]
    const rowsB = JSON.parse(JSON.stringify(rowsA))
    expect(migrateRows(rowsA)).toEqual(legacy.migrateRows(rowsB))
    expect(migrateRow({ soll: 1, ist: 1 } as EmployeeRow)).toEqual(legacy.migrateRow({ soll: 1, ist: 1 }))
  })
})
