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
