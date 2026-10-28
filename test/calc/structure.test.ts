import { describe, expect, it } from "vitest"
import { collectPeople, isLeadRole, type SbNode } from "../../functions/src/structure"
import { SB_LEAD_ROLES } from "../../src/lib/calc/struktur"

describe("collectPeople", () => {
  const tree: SbNode = {
    id: "boss", name: "Boss", role: "Direktor",
    children: [
      { id: "lead", name: "Lead", role: "Teamleiter", children: [{ id: "m1", name: "M1" }, { id: "m2", name: "M2", role: "FT1" }] },
      { id: "solo", name: "Solo" },
    ],
  }

  it("liefert alle Personen in Vorordnung mit Vorgesetzten, nächster zuerst", () => {
    const people = collectPeople(tree)
    expect(people.map((p) => p.id)).toEqual(["boss", "lead", "m1", "m2", "solo"])
    expect(people.find((p) => p.id === "boss")).toMatchObject({ managerId: null, ancestors: [] })
    expect(people.find((p) => p.id === "m1")).toMatchObject({ managerId: "lead", ancestors: ["lead", "boss"], role: "" })
    expect(people.find((p) => p.id === "m2")?.role).toBe("FT1")
  })

  it("überspringt 'vielleicht'-Knoten; die Kinder erben den nächsten sichtbaren Vorgesetzten", () => {
    const people = collectPeople({
      id: "boss", name: "Boss",
      children: [{ id: "maybe", name: "Maybe", status: "vielleicht", children: [{ id: "k", name: "K" }] }],
    })
    expect(people.map((p) => p.id)).toEqual(["boss", "k"])
    expect(people[1]).toMatchObject({ managerId: "boss", ancestors: ["boss"] })
  })

  it("mehrere 'vielleicht'-Ebenen hintereinander", () => {
    const people = collectPeople({
      id: "boss", name: "Boss",
      children: [{ id: "a", name: "A", status: "vielleicht", children: [{ id: "b", name: "B", status: "vielleicht", children: [{ id: "c", name: "C" }] }] }],
    })
    expect(people[1]).toMatchObject({ id: "c", managerId: "boss", ancestors: ["boss"] })
  })

  it("'vielleicht' als Wurzel: die Kinder werden Wurzeln ohne Vorgesetzten", () => {
    const people = collectPeople({ id: "r", name: "R", status: "vielleicht", children: [{ id: "k", name: "K" }] })
    expect(people).toEqual([{ id: "k", name: "K", role: "", managerId: null, ancestors: [] }])
  })

  it("Knoten ohne children-Feld sind Blätter", () => {
    expect(collectPeople({ id: "x", name: "X" })).toHaveLength(1)
  })
})

describe("isLeadRole (Spiegel der Browser-Logik)", () => {
  it("stimmt mit den Führungsstufen im Frontend überein", () => {
    for (const role of [...SB_LEAD_ROLES, "FT1", "Trainee", ""]) {
      expect(isLeadRole(role)).toBe(SB_LEAD_ROLES.includes(role))
    }
    expect(isLeadRole("Direktor")).toBe(true)
  })
})
