import { describe, expect, it } from "vitest"
import { mergeThreeWay } from "@/lib/calc/threeWayMerge"

describe("mergeThreeWay", () => {
  it("behält fremde Änderung an anderem Eintrag und eigene am eigenen", () => {
    const base = { rows: [{ name: "A", ist: 1 }, { name: "B", ist: 1 }] }
    const mine = { rows: [{ name: "A", ist: 5 }, { name: "B", ist: 1 }] }
    const server = { rows: [{ name: "A", ist: 1 }, { name: "B", ist: 9 }] }
    expect(mergeThreeWay(base, mine, server)).toEqual({ rows: [{ name: "A", ist: 5 }, { name: "B", ist: 9 }] })
  })
  it("merged verschiedene Felder desselben Eintrags", () => {
    const base = { cases: [{ id: "1", name: "x", eingereicht: false, aufbereitet: false }] }
    const mine = { cases: [{ id: "1", name: "x", eingereicht: true, aufbereitet: false }] }
    const server = { cases: [{ id: "1", name: "x", eingereicht: false, aufbereitet: true }] }
    expect(mergeThreeWay(base, mine, server)).toEqual({ cases: [{ id: "1", name: "x", eingereicht: true, aufbereitet: true }] })
  })
  it("fügt neue Einträge beider Seiten ein und löscht eigene Löschungen", () => {
    const base = { cases: [{ id: "1" }, { id: "2" }] }
    const mine = { cases: [{ id: "1" }, { id: "3" }] }
    const server = { cases: [{ id: "1" }, { id: "2" }, { id: "4" }] }
    expect(mergeThreeWay(base, mine, server)).toEqual({ cases: [{ id: "1" }, { id: "4" }, { id: "3" }] })
  })
  it("Anwesenheit: neue Person eines anderen bleibt, eigene Änderung kommt dazu", () => {
    const base = { entries: { A: { seminar: true } } }
    const mine = { entries: { A: { seminar: false } } }
    const server = { entries: { A: { seminar: true }, B: { seminar: false } } }
    expect(mergeThreeWay(base, mine, server)).toEqual({ entries: { A: { seminar: false }, B: { seminar: false } } })
  })
  it("Arrays ohne Schlüssel werden ganz übernommen, wenn geändert", () => {
    expect(mergeThreeWay({ conns: [{ from: "a", to: "b" }] }, { conns: [] }, { conns: [{ from: "a", to: "b" }], x: 1 }))
      .toEqual({ conns: [], x: 1 })
  })
  it("History bleibt nach Datum sortiert", () => {
    const base = { history: [{ date: "2026-10-01", ist: 1 }] }
    const mine = { history: [{ date: "2026-10-01", ist: 1 }, { date: "2026-10-03", ist: 3 }] }
    const server = { history: [{ date: "2026-10-01", ist: 1 }, { date: "2026-10-02", ist: 2 }] }
    expect((mergeThreeWay(base, mine, server) as typeof base).history.map((h) => h.date)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"])
  })
})
