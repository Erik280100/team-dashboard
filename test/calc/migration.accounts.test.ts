import { describe, expect, it } from "vitest"
import { migrateToAccounts, type LegacyData } from "@/lib/migration/accounts"
import type { SbNode } from "@/lib/calc/struktur"
import { STARTER_GOAL } from "@/types/dashboard"

const tree: SbNode = {
  id: "boss", name: "Boss", role: "Geschäftsstellenleiter",
  children: [
    { id: "lead", name: "Lead", role: "Teamleiter", children: [
      { id: "m1", name: "Mia Eins", role: "FT 1", children: [] },
      { id: "maybe", name: "Vielleicht", role: "FT 1", status: "vielleicht", children: [
        { id: "m2", name: "Max Zwei", role: "FT 1", children: [] },
      ] },
    ] },
  ],
}

const row = (name: string, atIst: number) => ({
  name, soll: 5, ist: 3, atPlan: 1, atIst, btPlan: 0, btIst: 0, stPlan: 0, stIst: 0, etPlan: 0, etIst: 0,
})

function legacy(over: Partial<LegacyData> = {}): LegacyData {
  return {
    dashboard: { rows: [row("Anna Boss", 1), row("Peter Lead", 2), row("Mia Eins", 3), row("Max Zwei", 4), row("Verwaist", 9)], teamGoal: STARTER_GOAL, history: [] },
    orgchart: { tree, notes: {}, conns: [], rates: {} },
    attendance: { entries: { Lead: { seminar: true, seminarReason: "", training: false, trainingReason: "" } } },
    financings: { cases: [{ id: "f1", name: "K", betrag: 1, art: "hauskauf", beschaeftigung: "angestellt", betreuer: "Mia Eins", docs: {}, aufbereitet: false, eingereicht: false, kreditvertrag: false, archived: false, createdAt: "" } as never] },
    erikTodos: { todos: [{ id: "t1", title: "x" } as never] },
    archiveIndex: null,
    planWeeks: { "2026-W41": { week: "2026-W41", entries: { "Mia Eins": { atz: 1 } as never, Unbekannt: { atz: 2 } as never } } },
    planMonthNotes: {},
    planAnnual: { "2026_lead": { targets: {}, quarters: {} } as never },
    snapshots: {},
    ...over,
  }
}

const find = (r: ReturnType<typeof migrateToAccounts>, path: string) => r.docs.find((d) => d.path === path)

describe("migrateToAccounts", () => {
  const r = migrateToAccounts(legacy(), { boardOwnerId: "boss" })

  it("legt Mitarbeiter mit ID, managerId und ancestors an (vielleicht-Knoten werden übersprungen)", () => {
    expect(find(r, "employees/boss")?.data).toMatchObject({ name: "Boss", managerId: null, ancestors: [], atIst: 1 })
    expect(find(r, "employees/lead")?.data).toMatchObject({ managerId: "boss", ancestors: ["boss"], atIst: 2 })
    expect(find(r, "employees/m2")?.data).toMatchObject({ managerId: "lead", ancestors: ["lead", "boss"], atIst: 4 })
    expect(find(r, "employees/maybe")).toBeUndefined()
  })
  it("meldet verwaiste Zeilen und schlägt Rollen vor", () => {
    expect(r.warnings.some((w) => w.includes("Verwaist"))).toBe(true)
    expect(r.accounts.find((a) => a.employeeId === "lead")?.suggestedRole).toBe("lead")
    expect(r.accounts.find((a) => a.employeeId === "m1")?.suggestedRole).toBe("member")
  })
  it("verteilt Planung, Anwesenheit, Jahresplanung auf Mitarbeiter-IDs", () => {
    expect(find(r, "employees/m1/planWeeks/2026-W41")?.data).toMatchObject({ week: "2026-W41", atz: 1 })
    expect(r.warnings.some((w) => w.includes("Unbekannt"))).toBe(true)
    expect(find(r, "employees/lead/attendance/current")?.data).toMatchObject({ seminar: true })
    expect(find(r, "employees/lead/planAnnual/2026")).toBeDefined()
  })
  it("Todos gehören dem Board-Besitzer, Finanzierungen dem Betreuer inkl. ancestors", () => {
    expect(find(r, "employees/boss/todos/t1")).toBeDefined()
    expect(find(r, "financings/f1")?.data).toMatchObject({ ownerId: "m1", ancestors: ["lead", "boss"] })
  })
  it("schreibt Struktur und Teamziel nach org/*", () => {
    expect(find(r, "org/structure")?.data.tree).toBe(tree)
    expect(find(r, "org/teamGoal")).toBeDefined()
  })
  it("bricht ohne Strukturbaum ab", () => {
    expect(migrateToAccounts(legacy({ orgchart: null }), { boardOwnerId: "boss" }).docs).toEqual([])
  })
})

describe("Namens-Aliase", () => {
  it("ordnet Tippfehler-Namen über Aliase zu", () => {
    const l = legacy({ dashboard: { rows: [row("Anna Boss", 1), row("Mia Einss", 7)], teamGoal: STARTER_GOAL, history: [] } })
    const noAlias = migrateToAccounts(l, { boardOwnerId: "boss" })
    expect(find(noAlias, "employees/m1")?.data.atIst).not.toBe(7)
    const withAlias = migrateToAccounts(l, { boardOwnerId: "boss", aliases: { "Mia Einss": "Mia Eins" } })
    expect(find(withAlias, "employees/m1")?.data.atIst).toBe(7)
  })
})
