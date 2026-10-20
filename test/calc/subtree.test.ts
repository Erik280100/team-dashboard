import { describe, expect, it } from "vitest"
import { applySubtreeUpdate, SubtreeError, type OrgStructure, type SubtreeInput } from "../../functions/src/subtree"

// boss -> lead -> (m1 -> m1a), m2 ; boss -> other
const current = (): OrgStructure => ({
  tree: {
    id: "boss", name: "Boss", role: "Direktor", children: [
      { id: "lead", name: "Lead", role: "Teamleiter", children: [
        { id: "m1", name: "M1", role: "FT1", children: [{ id: "m1a", name: "M1a", role: "FT1", children: [] }] },
        { id: "m2", name: "M2", role: "FT1", children: [] },
      ] },
      { id: "other", name: "Other", role: "Teamleiter", children: [] },
    ],
  },
  notes: { m1: [{ text: "a", date: "d" }], other: [{ text: "x", date: "d" }], m1a: [{ text: "b", date: "d" }] },
  conns: [{ from: "m1", to: "m2", label: "" }, { from: "other", to: "boss", label: "o" }, { from: "m1", to: "other", label: "x" }],
})

const keep = (): SubtreeInput => ({
  children: JSON.parse(JSON.stringify(current().tree.children![0].children)),
  notes: { m1: [{ text: "a", date: "d" }], m1a: [{ text: "b", date: "d" }] },
  conns: [{ from: "m1", to: "m2", label: "" }],
})

describe("applySubtreeUpdate", () => {
  it("ohne Änderung bleibt alles gleich", () => {
    const out = applySubtreeUpdate(current(), "lead", keep())
    expect(out.tree).toEqual(current().tree)
    expect(out.notes).toEqual(current().notes)
    expect(out.conns).toHaveLength(3)
  })

  it("fügt Personen unter sich und unter Mitarbeitern hinzu", () => {
    const input = keep()
    input.children.push({ id: "n1", name: "Neu", role: "FT1", children: [] })
    input.children[0].children!.push({ id: "n2", name: "Neu2", role: "FT1", children: [] })
    const out = applySubtreeUpdate(current(), "lead", input)
    const lead = out.tree.children![0]
    expect(lead.children!.map((c) => c.id)).toEqual(["m1", "m2", "n1"])
    expect(lead.children![0].children!.map((c) => c.id)).toEqual(["m1a", "n2"])
    expect(out.tree.children![1]).toEqual(current().tree.children![1]) // fremder Ast unverändert
  })

  it("entfernt Person samt Notizen und Verbindungen, fremde bleiben", () => {
    const input = keep()
    input.children = input.children.filter((c) => c.id !== "m1")
    input.conns = []
    const out = applySubtreeUpdate(current(), "lead", input)
    expect(out.tree.children![0].children!.map((c) => c.id)).toEqual(["m2"])
    expect(out.notes).toEqual({ other: [{ text: "x", date: "d" }] })
    expect(out.conns).toEqual([{ from: "other", to: "boss", label: "o" }])
  })

  it("verschieben innerhalb der Unterstruktur ist möglich", () => {
    const input = keep()
    const m1a = input.children[0].children!.pop()!
    input.children[1].children = [m1a]
    const out = applySubtreeUpdate(current(), "lead", input)
    expect(out.tree.children![0].children![1].children!.map((c) => c.id)).toEqual(["m1a"])
  })

  it("lehnt ID aus fremdem Ast ab (nicht herüberziehen/überschreiben)", () => {
    for (const id of ["other", "boss", "lead"]) {
      const input = keep()
      input.children.push({ id, name: "X", children: [] })
      expect(() => applySubtreeUpdate(current(), "lead", input)).toThrow(SubtreeError)
    }
  })

  it("lehnt doppelte IDs, leere Namen und unbekannten Aufrufer ab", () => {
    const dup = keep()
    dup.children.push({ id: "m2", name: "Dup", children: [] })
    expect(() => applySubtreeUpdate(current(), "lead", dup)).toThrow(SubtreeError)
    const empty = keep()
    empty.children.push({ id: "z", name: " ", children: [] })
    expect(() => applySubtreeUpdate(current(), "lead", empty)).toThrow(SubtreeError)
    expect(() => applySubtreeUpdate(current(), "ghost", keep())).toThrow(SubtreeError)
  })

  it("ignoriert Notizen/Verbindungen außerhalb der Unterstruktur im Input", () => {
    const input = keep()
    input.notes.other = [{ text: "hack", date: "d" }]
    input.notes.boss = [{ text: "hack", date: "d" }]
    input.conns.push({ from: "m1", to: "other", label: "hack" }, { from: "boss", to: "m1", label: "hack" })
    const out = applySubtreeUpdate(current(), "lead", input)
    expect(out.notes.other).toEqual([{ text: "x", date: "d" }])
    expect(out.notes.boss).toBeUndefined()
    expect(out.conns.filter((c) => c.label === "hack")).toHaveLength(0)
    expect(out.conns.find((c) => c.label === "x")).toBeTruthy() // bestehende Linie nach außen bleibt
  })

  it("entfernt Layout-Felder und eigenen Knoten kann man nicht ändern", () => {
    const input = keep()
    ;(input.children[0] as Record<string, unknown>).x = 5
    const out = applySubtreeUpdate(current(), "lead", input)
    expect(out.tree.children![0].children![0]).not.toHaveProperty("x")
    expect(out.tree.children![0].name).toBe("Lead")
    expect(out.tree.children![0].role).toBe("Teamleiter")
  })
})

describe("applySubtreeUpdate – Härtung", () => {
  const add = (id: string, extra: Record<string, unknown> = {}) => {
    const input = keep()
    input.children.push({ id, name: "Neu", role: "FT1", children: [], ...extra })
    return input
  }

  it("lehnt IDs mit Pfadzeichen oder Sonderzeichen ab", () => {
    for (const id of ["opfer/planWeeks/2026-W41", "a.b", "a b", "", "x".repeat(65), "ä"]) {
      expect(() => applySubtreeUpdate(current(), "lead", add(id)), id).toThrow(SubtreeError)
    }
    expect(() => applySubtreeUpdate(current(), "lead", add("n_1-x"))).not.toThrow()
  })

  it("lehnt eine ID ab, die als (inaktiver) Mitarbeiter schon existiert, aber nicht zur eigenen Unterstruktur gehört", () => {
    const employeeIds = new Set(["boss", "lead", "m1", "m1a", "m2", "other", "ehemalig"])
    expect(() => applySubtreeUpdate(current(), "lead", add("ehemalig"), employeeIds)).toThrow(SubtreeError)
    // eigene bisherige Unterstruktur darf weiterverwendet werden
    expect(() => applySubtreeUpdate(current(), "lead", keep(), employeeIds)).not.toThrow()
  })

  it("begrenzt Textlängen, Notizen und Verbindungen", () => {
    expect(() => applySubtreeUpdate(current(), "lead", add("n1", { name: "x".repeat(101) }))).toThrow(SubtreeError)
    const longNote = keep()
    longNote.notes.m1 = [{ text: "x".repeat(2001), date: "d" }]
    expect(() => applySubtreeUpdate(current(), "lead", longNote)).toThrow(SubtreeError)
    const manyNotes = keep()
    manyNotes.notes.m1 = Array.from({ length: 51 }, () => ({ text: "t", date: "d" }))
    expect(() => applySubtreeUpdate(current(), "lead", manyNotes)).toThrow(SubtreeError)
    const manyConns = keep()
    manyConns.conns = Array.from({ length: 201 }, () => ({ from: "m1", to: "m2", label: "" }))
    expect(() => applySubtreeUpdate(current(), "lead", manyConns)).toThrow(SubtreeError)
  })
})
