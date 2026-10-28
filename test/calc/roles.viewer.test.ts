import { describe, expect, it } from "vitest"
import { accountFromClaims, canEditEmployee, canReadAll, canViewEmployee, type AccountInfo } from "../../src/lib/calc/roles"

const acc = (role: AccountInfo["role"], employeeId: string | null = null): AccountInfo => ({ role, employeeId, mustChangePassword: false })

describe("Lesemodus (viewer)", () => {
  it("accountFromClaims behält die Rolle viewer", () => {
    expect(accountFromClaims({ role: "viewer" })).toEqual({ role: "viewer", employeeId: null, mustChangePassword: false })
  })

  it("canReadAll gilt nur für Admin und Lesemodus", () => {
    expect(canReadAll("admin")).toBe(true)
    expect(canReadAll("viewer")).toBe(true)
    expect(canReadAll("lead")).toBe(false)
    expect(canReadAll("member")).toBe(false)
  })

  it("canViewEmployee: der Lesemodus sieht jeden, auch ohne Verknüpfung", () => {
    expect(canViewEmployee(acc("viewer"), "x", [])).toBe(true)
    expect(canViewEmployee(acc("member", "m1"), "m2", ["lead"])).toBe(false)
    expect(canViewEmployee(acc("lead", "lead"), "m2", ["lead"])).toBe(true)
  })

  it("canEditEmployee: der Lesemodus ändert nichts, auch nicht den eigenen Mitarbeiter oder dessen Unterstruktur", () => {
    expect(canEditEmployee(acc("viewer", "m1"), "m1", [])).toBe(false)
    expect(canEditEmployee(acc("viewer", "lead"), "m1", ["lead"])).toBe(false)
    expect(canEditEmployee(acc("viewer"), "m1", [])).toBe(false)
  })

  it("canEditEmployee: Admin immer, sonst nur selbst oder Vorgesetzte", () => {
    expect(canEditEmployee(acc("admin"), "m1", [])).toBe(true)
    expect(canEditEmployee(acc("member", "m1"), "m1", [])).toBe(true)
    expect(canEditEmployee(acc("lead", "lead"), "m1", ["lead", "boss"])).toBe(true)
    expect(canEditEmployee(acc("member", "m2"), "m1", ["lead"])).toBe(false)
    expect(canEditEmployee(acc("member"), "m1", [])).toBe(false)
  })
})
