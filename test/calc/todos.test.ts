import { describe, expect, it } from "vitest"
import { dueSoonTodos, dueState, reorderForMove, seedOrderByDue, todosInLane } from "../../src/lib/calc/todos"
import type { BoardTodo } from "../../src/types/dashboard"

function makeTodo(overrides: Partial<BoardTodo> & Pick<BoardTodo, "id">): BoardTodo {
  return {
    title: "Titel",
    description: "",
    dueDate: "",
    lane: "todo",
    category: "kunde",
    color: "grau",
    flagged: false,
    order: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("todosInLane", () => {
  it("filtert nach Lane und sortiert nach order aufsteigend", () => {
    const todos = [
      makeTodo({ id: "a", lane: "todo", order: 2 }),
      makeTodo({ id: "b", lane: "progress", order: 0 }),
      makeTodo({ id: "c", lane: "todo", order: 1 }),
    ]
    expect(todosInLane(todos, "todo", "alle").map((t) => t.id)).toEqual(["c", "a"])
  })

  it("filtert zusätzlich nach Kategorie, außer bei 'alle'", () => {
    const todos = [
      makeTodo({ id: "a", lane: "todo", category: "finanzierung", order: 0 }),
      makeTodo({ id: "b", lane: "todo", category: "kunde", order: 1 }),
    ]
    expect(todosInLane(todos, "todo", "finanzierung").map((t) => t.id)).toEqual(["a"])
    expect(todosInLane(todos, "todo", "alle").map((t) => t.id)).toEqual(["a", "b"])
  })

  it("Tiebreak bei gleichem order über createdAt", () => {
    const todos = [
      makeTodo({ id: "a", lane: "todo", order: 0, createdAt: "2026-01-02T00:00:00.000Z" }),
      makeTodo({ id: "b", lane: "todo", order: 0, createdAt: "2026-01-01T00:00:00.000Z" }),
    ]
    expect(todosInLane(todos, "todo", "alle").map((t) => t.id)).toEqual(["b", "a"])
  })
})

describe("Sortierung nach Fälligkeit", () => {
  const todos = [
    makeTodo({ id: "ohne", order: 0 }),
    makeTodo({ id: "spaet", order: 1, dueDate: "2026-12-01" }),
    makeTodo({ id: "frueh", order: 2, dueDate: "2026-11-01" }),
  ]

  it("sortiert aufsteigend nach Datum, ohne Datum zuletzt", () => {
    expect(todosInLane(todos, "todo", "alle", "faellig").map((t) => t.id)).toEqual(["frueh", "spaet", "ohne"])
  })

  it("seedOrderByDue übernimmt die Fälligkeits-Reihenfolge als order", () => {
    const seeded = seedOrderByDue(todos, "todo")
    expect(todosInLane(seeded, "todo", "alle").map((t) => t.id)).toEqual(["frueh", "spaet", "ohne"])
  })
})

describe("reorderForMove", () => {
  it("verschiebt eine Karte in eine andere (leere) Lane ans Ende", () => {
    const todos = [makeTodo({ id: "a", lane: "todo", order: 0 })]
    const result = reorderForMove(todos, "a", "progress", null)
    const moved = result.find((t) => t.id === "a")!
    expect(moved.lane).toBe("progress")
  })

  it("fügt vor einer bestimmten Karte ein (mittlere Position)", () => {
    const todos = [
      makeTodo({ id: "a", lane: "todo", order: 0 }),
      makeTodo({ id: "b", lane: "todo", order: 10 }),
      makeTodo({ id: "c", lane: "progress", order: 0 }),
    ]
    const result = reorderForMove(todos, "c", "todo", "b")
    const order = todosInLane(result, "todo", "alle").map((t) => t.id)
    expect(order).toEqual(["a", "c", "b"])
  })

  it("fügt an den Anfang ein, wenn beforeId die erste Karte ist", () => {
    const todos = [
      makeTodo({ id: "a", lane: "todo", order: 0 }),
      makeTodo({ id: "b", lane: "progress", order: 0 }),
    ]
    const result = reorderForMove(todos, "b", "todo", "a")
    expect(todosInLane(result, "todo", "alle").map((t) => t.id)).toEqual(["b", "a"])
  })

  it("hält order-Werte eindeutig, auch wenn wiederholtes Einfügen in dieselbe Lücke den Fließkomma-Abstand erschöpft (Renumber-Fallback)", () => {
    let todos = [
      makeTodo({ id: "a", lane: "todo", order: 0 }),
      makeTodo({ id: "b", lane: "todo", order: 1 }),
    ]
    const insertedIds: string[] = []
    // Immer direkt vor "b" einfügen — der Abstand zwischen der zuletzt eingefügten
    // Karte und "b" halbiert sich jedes Mal, bis die Fließkomma-Präzision nicht mehr
    // ausreicht und reorderForMove auf den Renumber-Fallback zurückfallen muss.
    for (let i = 0; i < 60; i++) {
      const id = `n${i}`
      insertedIds.push(id)
      todos = [...todos, makeTodo({ id, lane: "progress", order: 0 })]
      todos = reorderForMove(todos, id, "todo", "b")
    }
    const laneOrder = todosInLane(todos, "todo", "alle").map((t) => t.id)
    expect(laneOrder).toEqual(["a", ...insertedIds, "b"])
    const orders = todos.filter((t) => t.lane === "todo").map((t) => t.order)
    expect(new Set(orders).size).toBe(orders.length)
  })

  it("unbekannte id gibt das Array unverändert zurück", () => {
    const todos = [makeTodo({ id: "a", lane: "todo", order: 0 })]
    expect(reorderForMove(todos, "does-not-exist", "progress", null)).toBe(todos)
  })
})

describe("dueState", () => {
  it("kein Datum -> 'none'", () => {
    expect(dueState("", "2026-08-27")).toBe("none")
  })
  it("überfällig und heute -> 'red'", () => {
    expect(dueState("2026-08-26", "2026-08-27")).toBe("red")
    expect(dueState("2026-08-27", "2026-08-27")).toBe("red")
  })
  it("30 Tage -> 'red', 31 Tage -> 'orange'", () => {
    expect(dueState("2026-09-26", "2026-08-27")).toBe("red")
    expect(dueState("2026-09-27", "2026-08-27")).toBe("orange")
  })
  it("45 Tage -> 'orange', 46 Tage -> 'none'", () => {
    expect(dueState("2026-10-11", "2026-08-27")).toBe("orange")
    expect(dueState("2026-10-12", "2026-08-27")).toBe("none")
  })
})

describe("dueSoonTodos", () => {
  it("nur offene Todos bis 45 Tage, früheste zuerst", () => {
    const todos = [
      makeTodo({ id: "spaet", dueDate: "2026-10-11" }),
      makeTodo({ id: "frueh", dueDate: "2026-08-20" }),
      makeTodo({ id: "weit", dueDate: "2026-12-01" }),
      makeTodo({ id: "fertig", dueDate: "2026-08-20", lane: "fertig" }),
      makeTodo({ id: "archiv", dueDate: "2026-08-20", archived: true }),
      makeTodo({ id: "ohne" }),
    ]
    expect(dueSoonTodos(todos, "2026-08-27").map((t) => t.id)).toEqual(["frueh", "spaet"])
  })
})

describe("reorderForMove und completed", () => {
  it("Verschieben aus 'fertig' heraus öffnet ein abgehaktes Todo wieder", () => {
    const todos = [makeTodo({ id: "a", lane: "fertig", completed: true })]
    expect(reorderForMove(todos, "a", "todo", null)[0].completed).toBe(false)
  })
  it("Verschieben innerhalb von 'fertig' behält den Haken", () => {
    const todos = [makeTodo({ id: "a", lane: "fertig", completed: true })]
    expect(reorderForMove(todos, "a", "fertig", null)[0].completed).toBe(true)
  })
})
