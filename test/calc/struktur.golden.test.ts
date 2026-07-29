import { describe, expect, it } from "vitest"
import {
  sbAll, sbFind, sbFindByName, sbFindByLastName, sbLastWord,
  sbGetRoleForName, sbGetRateForRole, sbSubtreeWidth, sbLayout, sbLine, sbEsc,
  type SbNode,
} from "../../src/lib/calc/struktur"
// @ts-expect-error – plain JS fixture, keine Typen nötig
import * as legacy from "../legacy-fixtures/struktur.legacy.js"

function sampleTree(): SbNode {
  return {
    id: "1",
    name: "Anna Muster",
    role: "Direktor",
    children: [
      {
        id: "2",
        name: "Bernd Beispiel",
        role: "Teamleiter",
        children: [
          { id: "4", name: "Clara Schmidt", role: "Kundenberater", children: [] },
          { id: "5", name: "David Weber", role: "FT2", children: [] },
        ],
      },
      { id: "3", name: "Eva Huber", role: "Kundenberater", children: [] },
    ],
  }
}

describe("struktur: golden master vs. legacy", () => {
  it("sbAll flattens identically", () => {
    const a = sbAll(sampleTree()).map((n) => n.id)
    const b = legacy.sbAll(sampleTree()).map((n: { id: string }) => n.id)
    expect(a).toEqual(b)
  })

  it("sbFind / sbFindByName / sbFindByLastName match", () => {
    for (const id of ["1", "4", "nope"]) {
      expect(sbFind(sampleTree(), id)?.id).toEqual(legacy.sbFind(sampleTree(), id)?.id)
    }
    for (const name of ["Clara Schmidt", "eva huber", "Nobody"]) {
      expect(sbFindByName(sampleTree(), name)?.id).toEqual(
        legacy.sbFindByName(sampleTree(), name)?.id
      )
    }
    for (const last of ["Weber", "huber", "xyz"]) {
      expect(sbFindByLastName(sampleTree(), last)?.id).toEqual(
        legacy.sbFindByLastName(sampleTree(), last)?.id
      )
    }
    expect(sbLastWord("  Dr. Anna Muster ")).toBe(legacy.sbLastWord("  Dr. Anna Muster "))
  })

  it("sbGetRoleForName / sbGetRateForRole match", () => {
    const rates = { Direktor: 100, Teamleiter: 50, Kundenberater: 20 }
    for (const name of ["Anna Muster", "Weber", "Nobody Here"]) {
      expect(sbGetRoleForName(sampleTree(), name)).toBe(
        legacy.sbGetRoleForName(sampleTree(), name)
      )
    }
    for (const role of ["Direktor", "FT2", "Unknown"]) {
      expect(sbGetRateForRole(rates, role)).toBe(legacy.sbGetRateForRole(rates, role))
    }
  })

  it("sbSubtreeWidth and sbLayout produce identical geometry", () => {
    const treeA = sampleTree()
    const treeB = sampleTree()
    expect(sbSubtreeWidth(treeA)).toBe(legacy.sbSubtreeWidth(treeB))

    sbLayout(treeA, 0, 0, 0)
    legacy.sbLayout(treeB, 0, 0, 0)

    const flatten = (n: SbNode, acc: { id: string; x?: number; y?: number; d?: number }[] = []) => {
      acc.push({ id: n.id, x: n.x, y: n.y, d: n.d })
      ;(n.children || []).forEach((c) => flatten(c, acc))
      return acc
    }
    expect(flatten(treeA)).toEqual(flatten(treeB))
  })

  it("sbLine / sbEsc produce identical strings", () => {
    expect(sbLine(1, 2, 3, 4, "#000", 2)).toBe(legacy.sbLine(1, 2, 3, 4, "#000", 2))
    expect(sbEsc('<b>Test & "Quote"</b>\nzeile2')).toBe(
      legacy.sbEsc('<b>Test & "Quote"</b>\nzeile2')
    )
  })
})
