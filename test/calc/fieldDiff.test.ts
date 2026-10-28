import { describe, expect, it } from "vitest"
import { deleteField, FieldPath } from "firebase/firestore"
import { diffFields, toUpdateArgs } from "../../src/lib/calc/fieldDiff"

const isDelete = (v: unknown) => (v as { isEqual: (o: unknown) => boolean }).isEqual(deleteField())

describe("diffFields", () => {
  it("liefert nichts, wenn sich nichts geändert hat", () => {
    expect(diffFields({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } })).toEqual([])
  })

  it("vergleicht Objekte feldgenau, damit fremde Änderungen im Nachbarfeld nicht überschrieben werden", () => {
    const changes = diffFields({ ehByPlan: { insurance: 1, credit: 2 } }, { ehByPlan: { insurance: 5, credit: 2 } })
    expect(changes).toEqual([{ path: ["ehByPlan", "insurance"], value: 5 }])
  })

  it("vergleicht Arrays als Ganzes", () => {
    const changes = diffFields({ tags: [1, 2] }, { tags: [1, 2, 3] })
    expect(changes).toEqual([{ path: ["tags"], value: [1, 2, 3] }])
  })

  it("schreibt ab der Tiefe `depth` ganze Objekte", () => {
    const prev = { a: { b: { c: 1, d: 2 } } }
    const next = { a: { b: { c: 9, d: 2 } } }
    expect(diffFields(prev, next, 2)).toEqual([{ path: ["a", "b", "c"], value: 9 }])
    expect(diffFields(prev, next, 1)).toEqual([{ path: ["a", "b"], value: { c: 9, d: 2 } }])
    expect(diffFields(prev, next, 0)).toEqual([{ path: ["a"], value: { b: { c: 9, d: 2 } } }])
  })

  it("entfernte und undefined-Felder werden mit deleteField() gelöscht", () => {
    const changes = diffFields({ a: 1, b: 2, c: 3 }, { a: 1, c: undefined })
    expect(changes.map((c) => c.path.join("."))).toEqual(["b", "c"])
    expect(changes.every((c) => isDelete(c.value))).toBe(true)
  })

  it("undefined im neuen Stand wird nicht geschrieben", () => {
    expect(diffFields({}, { a: undefined })).toEqual([])
  })

  it("Objekt wird durch einen Wert ersetzt: der ganze Wert wird am Pfad geschrieben", () => {
    expect(diffFields({ a: { x: 1 } }, { a: 5 })).toEqual([{ path: ["a"], value: 5 }])
    expect(diffFields({ a: 5 }, { a: { x: 1 } })).toEqual([{ path: ["a"], value: { x: 1 } }])
  })

  it("null ist kein Objekt und wird als Wert verglichen", () => {
    expect(diffFields({ a: { x: 1 } }, { a: null })).toEqual([{ path: ["a"], value: null }])
    expect(diffFields({ a: null }, { a: null })).toEqual([])
  })

  it("neue Felder werden geschrieben", () => {
    expect(diffFields({}, { n: { x: 1 } })).toEqual([{ path: ["n"], value: { x: 1 } }])
  })
})

describe("toUpdateArgs", () => {
  it("liefert null, wenn nichts zu schreiben ist", () => {
    expect(toUpdateArgs([])).toBeNull()
  })

  it("baut die flache Liste aus FieldPath/Wert-Paaren für updateDoc", () => {
    const args = toUpdateArgs([
      { path: ["a", "b"], value: 1 },
      { path: ["c"], value: "x" },
    ])!
    expect(args).toHaveLength(4)
    expect((args[0] as FieldPath).isEqual(new FieldPath("a", "b"))).toBe(true)
    expect(args[1]).toBe(1)
    expect((args[2] as FieldPath).isEqual(new FieldPath("c"))).toBe(true)
    expect(args[3]).toBe("x")
  })
})
