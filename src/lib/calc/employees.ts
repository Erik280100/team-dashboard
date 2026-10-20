// Brücke zwischen den Mitarbeiter-Dokumenten (employees/{id}) und der bisherigen
// Zeilenform (EmployeeRow, Zuordnung per Name), damit Sektionen und calc/* nahezu
// unverändert weiterlaufen. Reine Funktionen — Firestore-Zugriff liegt in den Hooks.
import { migrateRow, type EmployeeRow } from "@/lib/calc/format"

/** Stammdaten eines Mitarbeiters (Struktur/Identität) — nur Admin/Function schreiben diese Felder. */
export interface EmployeeMeta {
  id: string
  name: string
  role: string
  managerId: string | null
  ancestors: string[]
}

/** Kontodaten (employees/{id}/private/account) — nur self/Vorgesetzte/Admin lesbar, daher nicht Teil von EmployeeMeta. */
export interface AccountState {
  uid: string | null
  email: string | null
  /** Konto erstellt, aber das Einmal-Passwort wurde noch nicht durch ein eigenes ersetzt. */
  accountPending: boolean
}

export function accountStateOf(data: Record<string, unknown> | undefined): AccountState {
  return {
    uid: typeof data?.uid === "string" ? data.uid : null,
    email: typeof data?.email === "string" ? data.email : null,
    accountPending: data?.accountPending === true,
  }
}

/** Felder, die nie Teil einer EmployeeRow sind (gesperrt in firestore.rules). uid/email/accountPending nur für Altbestand. */
const META_KEYS = ["name", "role", "managerId", "ancestors", "uid", "email", "accountPending", "active", "createdAt"] as const

export function employeeMetaOf(id: string, data: Record<string, unknown>): EmployeeMeta {
  return {
    id,
    name: String(data.name ?? ""),
    role: String(data.role ?? ""),
    managerId: typeof data.managerId === "string" ? data.managerId : null,
    ancestors: Array.isArray(data.ancestors) ? data.ancestors.map(String) : [],
  }
}

export function employeeDocToRow(data: Record<string, unknown>): EmployeeRow {
  const rest: Record<string, unknown> = { ...data }
  for (const k of META_KEYS) delete rest[k]
  return migrateRow({ ...(rest as Partial<EmployeeRow>), name: String(data.name ?? "") } as EmployeeRow)
}

/** Schreibbare Felder einer Zeile (ohne Meta-Felder, ohne undefined — Firestore lehnt undefined ab). */
export function rowToEmployeeData(row: EmployeeRow): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    if ((META_KEYS as readonly string[]).includes(k) || k === "monthStats" || v === undefined) continue
    out[k] = v
  }
  return out
}

const norm = (s: string) => (s || "").trim().toLowerCase()

export function idByName(employees: readonly EmployeeMeta[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const e of employees) {
    const k = norm(e.name)
    if (!m.has(k)) m.set(k, e.id)
  }
  return m
}

export interface EmployeeWrite {
  id: string
  data: Record<string, unknown>
}

/**
 * Welche Mitarbeiter-Dokumente müssen geschrieben werden, damit `next` gilt?
 * Nur geänderte oder neue Zeilen; Zeilen ohne bekannten Mitarbeiter (Name nicht
 * in `employees`) und entfernte Zeilen werden ignoriert — Anlegen/Löschen von
 * Mitarbeitern ist Sache des Admins über den Strukturbaum.
 */
export function diffRowWrites(
  prev: readonly EmployeeRow[],
  next: readonly EmployeeRow[],
  employees: readonly EmployeeMeta[],
): { writes: EmployeeWrite[]; skipped: string[] } {
  const ids = idByName(employees)
  const prevByName = new Map(prev.map((r) => [norm(r.name), JSON.stringify(rowToEmployeeData(r))]))
  const writes: EmployeeWrite[] = []
  const skipped: string[] = []
  for (const row of next) {
    const key = norm(row.name)
    const data = rowToEmployeeData(row)
    if (prevByName.get(key) === JSON.stringify(data)) continue
    const id = ids.get(key)
    if (!id) { skipped.push(row.name); continue }
    writes.push({ id, data })
  }
  return { writes, skipped }
}
