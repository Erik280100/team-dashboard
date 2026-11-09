import { describe, expect, it } from "vitest"
import { assignableEmployees, boardSubordinates, buildAssignedTodo, hasUnseenAssigned } from "../../src/lib/calc/todos"
import type { EmployeeMeta } from "../../src/lib/calc/employees"
import type { BoardTodo } from "../../src/types/dashboard"

// boss -> lead -> m1, m2 ; boss -> other
const emp = (id: string, name: string, ancestors: string[]): EmployeeMeta => ({
  id, name, role: "", managerId: ancestors[0] ?? null, ancestors,
})
const EMPLOYEES = [
  emp("boss", "Boss", []),
  emp("lead", "Lead", ["boss"]),
  emp("m1", "Mia", ["lead", "boss"]),
  emp("m2", "Max", ["lead", "boss"]),
  emp("other", "Otto", ["boss"]),
]

const todo: BoardTodo = {
  id: "t1", title: "T", description: "", dueDate: "", lane: "kunde", category: "kunde", color: "grau",
  flagged: false, completed: true, archived: true, order: 5, createdAt: "2026-01-01T00:00:00.000Z",
}

describe("boardSubordinates", () => {
  it("liefert direkte und indirekte Mitarbeiter, nach Name sortiert", () => {
    expect(boardSubordinates(EMPLOYEES, "boss").map((e) => e.id)).toEqual(["lead", "m2", "m1", "other"])
    expect(boardSubordinates(EMPLOYEES, "lead").map((e) => e.id)).toEqual(["m2", "m1"])
  })
  it("leer ohne Untergebene oder ohne ID", () => {
    expect(boardSubordinates(EMPLOYEES, "m1")).toEqual([])
    expect(boardSubordinates(EMPLOYEES, null)).toEqual([])
  })
})

describe("assignableEmployees", () => {
  it("Vorgesetzte oben, Mitarbeiter unten, keine Geschwister, nicht man selbst", () => {
    const r = assignableEmployees(EMPLOYEES, "lead")
    expect(r.superiors.map((e) => e.id)).toEqual(["boss"])
    expect(r.subordinates.map((e) => e.id)).toEqual(["m2", "m1"])
    const m1 = assignableEmployees(EMPLOYEES, "m1")
    expect(m1.superiors.map((e) => e.id).sort()).toEqual(["boss", "lead"])
    expect(m1.subordinates).toEqual([])
    expect([...m1.superiors, ...m1.subordinates].some((e) => e.id === "m2" || e.id === "other")).toBe(false)
  })
  it("unbekannte ID: nichts", () => {
    expect(assignableEmployees(EMPLOYEES, "x")).toEqual({ superiors: [], subordinates: [] })
  })
})

describe("buildAssignedTodo", () => {
  it("landet offen in Lane todo mit Absender und ungesehen", () => {
    const r = buildAssignedTodo(todo, { id: "lead", name: "Lead" }, "2026-02-02T00:00:00.000Z", -7)
    expect(r).toMatchObject({
      lane: "todo", order: -7, completed: false, archived: false,
      assignedById: "lead", assignedByName: "Lead", assignedAt: "2026-02-02T00:00:00.000Z", assignedUnseen: true,
    })
    expect(r.title).toBe("T")
  })
})

describe("hasUnseenAssigned", () => {
  it("nur ungesehene, nicht archivierte", () => {
    expect(hasUnseenAssigned([{ assignedUnseen: true }])).toBe(true)
    expect(hasUnseenAssigned([{ assignedUnseen: true, archived: true }])).toBe(false)
    expect(hasUnseenAssigned([{}, { assignedUnseen: false }])).toBe(false)
  })
})
