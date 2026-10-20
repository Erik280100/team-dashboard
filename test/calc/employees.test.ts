import { describe, expect, it } from "vitest"
import { diffRowWrites, employeeDocToRow, employeeMetaOf, rowToEmployeeData } from "@/lib/calc/employees"

const doc = {
  name: "Mia Eins", role: "FT 1", managerId: "lead", ancestors: ["lead", "boss"], uid: null,
  soll: 5, ist: 3, atPlan: 1, atIst: 2, btPlan: 0, btIst: 0, etPlan: 0, etIst: 0, bonus: 10,
}

describe("employees bridge", () => {
  it("trennt Stammdaten und Zeile", () => {
    expect(employeeMetaOf("m1", doc)).toEqual({ id: "m1", name: "Mia Eins", role: "FT 1", managerId: "lead", ancestors: ["lead", "boss"], uid: null })
    const row = employeeDocToRow(doc)
    expect(row.name).toBe("Mia Eins")
    expect(row).not.toHaveProperty("ancestors")
    expect(row).not.toHaveProperty("managerId")
    expect(row.atIst).toBe(2)
  })
  it("rowToEmployeeData entfernt Name/Meta und undefined", () => {
    const data = rowToEmployeeData({ ...employeeDocToRow(doc), vbByAbwickler: undefined })
    expect(data).not.toHaveProperty("name")
    expect(data).not.toHaveProperty("vbByAbwickler")
    expect(data.bonus).toBe(10)
  })
  describe("diffRowWrites", () => {
    const employees = [employeeMetaOf("m1", doc), employeeMetaOf("m2", { ...doc, name: "Max Zwei" })]
    const prev = [employeeDocToRow(doc), employeeDocToRow({ ...doc, name: "Max Zwei" })]
    it("schreibt nur geänderte Zeilen, adressiert per ID", () => {
      const next = [prev[0], { ...prev[1], atIst: 9 }]
      const { writes, skipped } = diffRowWrites(prev, next, employees)
      expect(writes).toHaveLength(1)
      expect(writes[0].id).toBe("m2")
      expect(writes[0].data.atIst).toBe(9)
      expect(skipped).toEqual([])
    })
    it("ignoriert unbekannte Namen (kein Mitarbeiter-Dokument) und meldet sie", () => {
      const { writes, skipped } = diffRowWrites(prev, [...prev, { ...prev[0], name: "Neu Person" }], employees)
      expect(writes).toEqual([])
      expect(skipped).toEqual(["Neu Person"])
    })
    it("entfernte Zeilen löschen nichts", () => {
      expect(diffRowWrites(prev, [prev[0]], employees).writes).toEqual([])
    })
  })
})
