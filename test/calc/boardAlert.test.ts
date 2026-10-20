import { describe, expect, it } from "vitest"
import { hasOpenDueTodos } from "../../src/lib/calc/todos"

describe("hasOpenDueTodos", () => {
  const todo = (dueDate: string, lane: "todo" | "fertig" = "todo") => ({ dueDate, lane })
  it("true bei erreichtem oder überschrittenem Datum", () => {
    expect(hasOpenDueTodos([todo("2026-10-20")], "2026-10-20")).toBe(true)
    expect(hasOpenDueTodos([todo("2026-10-01")], "2026-10-20")).toBe(true)
  })
  it("false bei zukünftigem Datum, ohne Datum und für Erledigtes", () => {
    expect(hasOpenDueTodos([todo("2026-10-21")], "2026-10-20")).toBe(false)
    expect(hasOpenDueTodos([todo("")], "2026-10-20")).toBe(false)
    expect(hasOpenDueTodos([todo("2026-10-01", "fertig")], "2026-10-20")).toBe(false)
    expect(hasOpenDueTodos([], "2026-10-20")).toBe(false)
  })
  it("ein fälliges unter mehreren genügt", () => {
    expect(hasOpenDueTodos([todo("2026-12-01"), todo("2026-10-19"), todo("")], "2026-10-20")).toBe(true)
  })
})
