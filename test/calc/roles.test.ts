import { describe, expect, it } from "vitest"
import { accountFromClaims, canEditEmployee } from "@/lib/calc/roles"

describe("accountFromClaims", () => {
  it("liest Rolle und employeeId", () => {
    expect(accountFromClaims({ role: "lead", employeeId: "e1" })).toEqual({ role: "lead", employeeId: "e1" })
  })
  it("Konten ohne Claims gelten im Übergang als Admin", () => {
    expect(accountFromClaims({})).toEqual({ role: "admin", employeeId: null })
    expect(accountFromClaims(null)).toEqual({ role: "admin", employeeId: null })
  })
  it("ungültige Rolle / leere ID werden nicht übernommen", () => {
    expect(accountFromClaims({ role: "root", employeeId: "" })).toEqual({ role: "admin", employeeId: null })
  })
})

describe("canEditEmployee", () => {
  const member = { role: "member", employeeId: "m1" } as const
  const lead = { role: "lead", employeeId: "lead" } as const
  it("Mitarbeiter nur sich selbst", () => {
    expect(canEditEmployee(member, "m1", ["lead"])).toBe(true)
    expect(canEditEmployee(member, "m2", ["lead"])).toBe(false)
  })
  it("Führungskraft: sich und Unterstruktur, nicht Fremde", () => {
    expect(canEditEmployee(lead, "lead", ["boss"])).toBe(true)
    expect(canEditEmployee(lead, "m1", ["lead", "boss"])).toBe(true)
    expect(canEditEmployee(lead, "other", ["boss2"])).toBe(false)
  })
  it("Admin alles; Konto ohne Verknüpfung nichts", () => {
    expect(canEditEmployee({ role: "admin", employeeId: null }, "x", [])).toBe(true)
    expect(canEditEmployee({ role: "member", employeeId: null }, "x", [])).toBe(false)
  })
})

import { sbScopedTree, type SbNode } from "@/lib/calc/struktur"

describe("sbScopedTree", () => {
  const tree: SbNode = {
    id: "boss", name: "Boss", children: [
      { id: "lead", name: "Lead", children: [{ id: "m1", name: "M1", children: [] }] },
      { id: "other", name: "Other", children: [] },
    ],
  }
  it("Admin (null) sieht alles", () => expect(sbScopedTree(tree, null)).toBe(tree))
  it("Führungskraft sieht nur ihren Teilbaum", () => {
    const t = sbScopedTree(tree, "lead")
    expect(t.id).toBe("lead")
    expect(t.children?.map((c) => c.id)).toEqual(["m1"])
  })
  it("Mitarbeiter sieht nur sich selbst", () => expect(sbScopedTree(tree, "m1").children).toEqual([]))
  it("unbekannter Knoten -> leer, nicht alles", () => {
    const t = sbScopedTree(tree, "weg")
    expect(t.status).toBe("vielleicht")
    expect(t.children).toEqual([])
  })
})
