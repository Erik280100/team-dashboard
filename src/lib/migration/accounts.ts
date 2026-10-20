// Migration alt (finova/* Sammeldokumente, Zuordnung per Namen) -> neu
// (employees/{id}, Zuordnung per ID). Reine Funktion ohne Firestore-Zugriff,
// damit sie testbar ist; scripts/migrate-to-accounts.ts liest/schreibt nur.
import type { RosterEntry, SbNode } from "@/lib/calc/struktur"
import { isLeadRole } from "@/lib/calc/struktur"
import { mergeRosterWithRows, newRowFor } from "@/lib/calc/team"
import { planManagerKey } from "@/lib/calc/planung"
import type {
  AttendanceDoc, DashboardDoc, ErikTodosDoc, FinanzierungenDoc, OrgChartDoc,
  PlanAnnualDoc, PlanMonthNotesDoc, PlanWeekDoc,
} from "@/types/dashboard"
import type { ArchiveIndexDoc, MonthSnapshot } from "@/types/archive"

export interface LegacyData {
  dashboard: DashboardDoc | null
  orgchart: OrgChartDoc | null
  attendance: AttendanceDoc | null
  financings: FinanzierungenDoc | null
  erikTodos: ErikTodosDoc | null
  archiveIndex: ArchiveIndexDoc | null
  /** Schlüssel = Zeit-Suffix des alten Dokuments, z. B. "2026-W41". */
  planWeeks: Record<string, PlanWeekDoc>
  /** Schlüssel = "YYYY-MM". */
  planMonthNotes: Record<string, PlanMonthNotesDoc>
  /** Schlüssel = "<YYYY>_<managerKey>" (Rest des Dokumentnamens nach plan_annual_). */
  planAnnual: Record<string, PlanAnnualDoc>
  /** Schlüssel = "YYYY-MM". */
  snapshots: Record<string, MonthSnapshot>
}

export interface MigrationOptions {
  /** Mitarbeiter-ID, dem das bisherige Erik-Board gehört (Fallback-Besitzer für Finanzierungen ohne Zuordnung). */
  boardOwnerId: string
}

export interface MigratedDoc {
  /** Firestore-Pfad, z. B. "employees/koegerl/planWeeks/2026-W41". */
  path: string
  data: Record<string, unknown>
}

export interface MigrationResult {
  docs: MigratedDoc[]
  warnings: string[]
  /** Mitarbeiter mit vorgeschlagener Kontorolle (für inviteUser). */
  accounts: { employeeId: string; name: string; suggestedRole: "lead" | "member" }[]
}

interface Person {
  id: string
  entry: RosterEntry
  managerId: string | null
  ancestors: string[]
}

const norm = (s: string) => (s || "").trim().toLowerCase()
const lastWord = (s: string) => {
  const parts = (s || "").trim().split(/\s+/)
  return parts[parts.length - 1].toLowerCase()
}

/** Sichtbare Personen des Baums (gleiche Regeln wie sbRoster: "vielleicht" wird übersprungen, Kinder erben den nächsten sichtbaren Vorgesetzten). */
function collectPeople(tree: SbNode): Person[] {
  const out: Person[] = []
  function walk(n: SbNode, mgr: Person | null, depth: number) {
    const visible = n.status !== "vielleicht"
    let self: Person | null = mgr
    if (visible) {
      self = {
        id: n.id,
        entry: { name: n.name, role: n.role || "", status: n.status ?? null, managerName: mgr?.entry.name ?? null, depth },
        managerId: mgr?.id ?? null,
        ancestors: mgr ? [mgr.id, ...mgr.ancestors] : [],
      }
      out.push(self)
    }
    ;(n.children || []).forEach((c) => walk(c, self, visible ? depth + 1 : depth))
  }
  walk(tree, null, 0)
  return out
}

/** Namen (voll oder nur Nachname) auf Personen abbilden: erst exakt, dann Nachname, jeweils nur bei eindeutigem Treffer. */
function makeResolver(people: Person[]) {
  const exact = new Map<string, Person[]>()
  const last = new Map<string, Person[]>()
  for (const p of people) {
    const e = norm(p.entry.name)
    exact.set(e, [...(exact.get(e) ?? []), p])
    const l = lastWord(p.entry.name)
    last.set(l, [...(last.get(l) ?? []), p])
  }
  return (name: string): Person | null => {
    const e = exact.get(norm(name))
    if (e?.length === 1) return e[0]
    const l = last.get(lastWord(name))
    if (l?.length === 1) return l[0]
    return null
  }
}

export function migrateToAccounts(legacy: LegacyData, opts: MigrationOptions): MigrationResult {
  const docs: MigratedDoc[] = []
  const warnings: string[] = []
  const accounts: MigrationResult["accounts"] = []

  if (!legacy.orgchart?.tree) {
    return { docs, warnings: ["finova/orgchart fehlt oder hat keinen Baum — Abbruch."], accounts }
  }
  const people = collectPeople(legacy.orgchart.tree)
  const resolve = makeResolver(people)
  const byId = new Map(people.map((p) => [p.id, p]))
  if (!byId.has(opts.boardOwnerId)) {
    warnings.push(`boardOwnerId "${opts.boardOwnerId}" ist kein Knoten im Strukturbaum.`)
  }

  // ---- employees ----
  const rows = legacy.dashboard?.rows ?? []
  const merged = mergeRosterWithRows(people.map((p) => p.entry), rows)
  const usedRows = new Set<number>()
  people.forEach((p, i) => {
    const m = merged[i]
    const row = m.rowIndex !== null ? rows[m.rowIndex] : newRowFor(p.entry.name)
    if (m.rowIndex !== null) usedRows.add(m.rowIndex)
    else warnings.push(`Keine Leistungszahlen für "${p.entry.name}" gefunden — leerer Datensatz angelegt.`)
    const { name: _legacyName, ...numbers } = row
    docs.push({
      path: `employees/${p.id}`,
      data: {
        ...numbers,
        name: p.entry.name,
        role: p.entry.role,
        managerId: p.managerId,
        ancestors: p.ancestors,
        uid: null,
      },
    })
    accounts.push({ employeeId: p.id, name: p.entry.name, suggestedRole: isLeadRole(p.entry.role) ? "lead" : "member" })
  })
  rows.forEach((r, i) => {
    if (!usedRows.has(i)) warnings.push(`Zeile "${r.name}" in dashboard.rows ist keinem Strukturbaum-Knoten zugeordnet — NICHT migriert.`)
  })

  // ---- Planung (Einträge je Name -> je Mitarbeiter-ID) ----
  for (const [week, doc] of Object.entries(legacy.planWeeks)) {
    for (const [name, entry] of Object.entries(doc.entries ?? {})) {
      const p = resolve(name)
      if (!p) { warnings.push(`Wochenplanung ${week}: "${name}" nicht eindeutig zuordenbar — übersprungen.`); continue }
      docs.push({ path: `employees/${p.id}/planWeeks/${week}`, data: { week, ...entry } })
    }
  }
  for (const [month, doc] of Object.entries(legacy.planMonthNotes)) {
    for (const [name, entry] of Object.entries(doc.entries ?? {})) {
      const p = resolve(name)
      if (!p) { warnings.push(`Monatsplanung ${month}: "${name}" nicht eindeutig zuordenbar — übersprungen.`); continue }
      docs.push({ path: `employees/${p.id}/planMonthNotes/${month}`, data: { month, ...entry } })
    }
  }
  const byManagerKey = new Map<string, Person>()
  for (const p of people) {
    const k = planManagerKey(p.entry.name)
    if (!byManagerKey.has(k)) byManagerKey.set(k, p)
  }
  for (const [key, doc] of Object.entries(legacy.planAnnual)) {
    const sep = key.indexOf("_")
    const year = key.slice(0, sep)
    const mgr = byManagerKey.get(key.slice(sep + 1))
    if (!mgr) { warnings.push(`Jahresplanung ${key}: Führungskraft nicht gefunden — übersprungen.`); continue }
    docs.push({ path: `employees/${mgr.id}/planAnnual/${year}`, data: { ...doc } })
  }

  // ---- Anwesenheit ----
  for (const [name, entry] of Object.entries(legacy.attendance?.entries ?? {})) {
    const p = resolve(name)
    if (!p) { warnings.push(`Anwesenheit: "${name}" nicht eindeutig zuordenbar — übersprungen.`); continue }
    docs.push({ path: `employees/${p.id}/attendance/current`, data: { ...entry } })
  }

  // ---- Todos (bisher fix Erik) ----
  for (const todo of legacy.erikTodos?.todos ?? []) {
    docs.push({ path: `employees/${opts.boardOwnerId}/todos/${todo.id}`, data: { ...todo } })
  }

  // ---- Finanzierungen ----
  const fallback = byId.get(opts.boardOwnerId)
  for (const c of legacy.financings?.cases ?? []) {
    const owner = resolve(c.betreuer) ?? fallback ?? null
    if (!owner) { warnings.push(`Finanzierung "${c.name}": kein Besitzer ermittelbar — übersprungen.`); continue }
    if (owner !== resolve(c.betreuer)) warnings.push(`Finanzierung "${c.name}": Betreuer "${c.betreuer}" nicht zuordenbar — Besitzer = ${owner.entry.name}.`)
    docs.push({ path: `financings/${c.id}`, data: { ...c, ownerId: owner.id, ancestors: owner.ancestors } })
  }

  // ---- Struktur, Teamziel, Archiv ----
  const { tree, ...orgRest } = legacy.orgchart
  docs.push({ path: "org/structure", data: { tree, ...orgRest } })
  if (legacy.dashboard) {
    docs.push({ path: "org/teamGoal", data: { teamGoal: legacy.dashboard.teamGoal, history: legacy.dashboard.history } })
  }
  if (legacy.archiveIndex) docs.push({ path: "org/archiveIndex", data: { ...legacy.archiveIndex } })

  // ---- Monats-Snapshots: Meta + eine Zeile je Mitarbeiter ----
  for (const [month, snap] of Object.entries(legacy.snapshots)) {
    const { rows: snapRows, ...meta } = snap
    docs.push({ path: `snapshots/${month}`, data: { ...meta } })
    const snapPeople = collectPeople(snap.orgChart.tree)
    const snapMerged = mergeRosterWithRows(snapPeople.map((p) => p.entry), snapRows)
    snapPeople.forEach((p, i) => {
      const m = snapMerged[i]
      if (m.rowIndex === null) return
      const { name: _n, ...numbers } = snapRows[m.rowIndex]
      // IDs aus dem Snapshot-Baum können vom heutigen Baum abweichen -> über den Namen auf die aktuelle ID abbilden.
      const current = byId.get(p.id) ?? resolve(p.entry.name)
      if (!current) { warnings.push(`Snapshot ${month}: "${p.entry.name}" existiert heute nicht mehr — übersprungen.`); return }
      docs.push({ path: `snapshots/${month}/employees/${current.id}`, data: { ...numbers, name: p.entry.name, role: p.entry.role, ancestors: current.ancestors } })
    })
  }

  return { docs, warnings, accounts }
}
