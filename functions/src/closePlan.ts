// Monatsabschluss, rein rechnerisch: aus dem Stand der Datenbank wird berechnet, was ins Archiv geschrieben
// und was für den neuen Monat zurückgesetzt wird. Kein Firestore-Zugriff hier (siehe monthClose.ts), damit es
// testbar ist. Die eigentliche Logik (buildSnapshot, nextMonthGoal, …) stammt aus dem Browser-Code in
// ../../src/lib/calc und wird beim Build mit esbuild nach lib/shared.cjs gebündelt (functions/build-shared.mjs) —
// so rechnen Server und Browser garantiert gleich. Die Funktionen kommen als `shared` herein.
import { computeMonthStats } from "./planStats"

type Obj = Record<string, unknown>
type Row = Obj & { name: string }

/** Die aus src/lib/calc gebündelten Funktionen (Typen bewusst grob — die Quelle ist streng getypt). */
export interface Shared {
  monthKeyOf: (goal: Obj) => string
  nextMonthGoal: (goal: Obj) => Obj & { periodStart: string }
  employeeDocToRow: (data: Obj) => Row
  rowToEmployeeData: (row: Row) => Obj
  resetRowsForNewMonth: (rows: Row[]) => Row[]
  buildSnapshot: (input: Obj) => Obj & { rows: Row[] }
  buildIndexEntry: (snapshot: Obj) => Obj & { month: string }
}

export interface EmployeeInput {
  id: string
  /** employees/{id} */
  data: Obj
  /** Wochendokumente (planWeeks) des Monats, die es gibt. */
  weeks: Obj[]
  /** planMonthNotes/{monat}, falls vorhanden. */
  monthNote?: Obj
}

export interface CloseInput {
  teamGoal: Obj
  history: { date: string; ist: number }[]
  /** org/structure */
  org: Obj
  employees: EmployeeInput[]
  /** org/archiveIndex.months */
  index: (Obj & { month: string })[]
  closedBy: string
  now: Date
}

export interface ClosePlan {
  month: string
  /** snapshots/{month} */
  snapshotMeta: Obj
  /** snapshots/{month}/employees/{id} */
  snapshotEmployees: { id: string; data: Obj }[]
  /** org/archiveIndex.months (neu, sortiert) */
  indexMonths: Obj[]
  /** employees/{id}: Ist-Werte für den neuen Monat zurückgesetzt (update, nicht set) */
  resetWrites: { id: string; data: Obj }[]
  /** org/teamGoal */
  next: { teamGoal: Obj; history: { date: string; ist: number }[] }
}

export function planClose(input: CloseInput, shared: Shared): ClosePlan {
  const { teamGoal, employees } = input
  const month = shared.monthKeyOf(teamGoal)
  const rows = employees.map((e) => shared.employeeDocToRow(e.data))

  // Archiviert wird, was die Leute zuletzt gesehen haben: AT/BT/ST/ET und Soll live aus der Planung des
  // Monats (nicht die möglicherweise veralteten gespeicherten Felder).
  const live = rows.map((r, i) => {
    const s = computeMonthStats(month, employees[i].weeks, employees[i].monthNote)
    return {
      ...r,
      atPlan: s.atPlan, atIst: s.atIst, btPlan: s.btPlan, btIst: s.btIst,
      stPlan: s.stPlan, stIst: s.stIst, etPlan: s.etPlan, etIst: s.etIst, soll: s.soll,
    }
  })

  const snapshot = shared.buildSnapshot({
    month, rows: live, teamGoal, history: input.history, orgChart: input.org, closedBy: input.closedBy, now: input.now,
  })
  const { rows: snapRows, ...snapshotMeta } = snapshot
  const snapshotEmployees = snapRows.map((r, i) => ({
    id: employees[i].id,
    data: {
      ...shared.rowToEmployeeData(r),
      name: employees[i].data.name,
      role: employees[i].data.role ?? "",
      ancestors: Array.isArray(employees[i].data.ancestors) ? employees[i].data.ancestors : [],
    },
  }))

  const entry = shared.buildIndexEntry(snapshot)
  const indexMonths = [...input.index.filter((e) => e.month !== month), entry].sort((a, b) =>
    a.month.localeCompare(b.month),
  )

  // Zurückgesetzt wird der gespeicherte Stand (nicht die Live-Überlagerung): Ist-Werte, Einheiten, Bonus auf 0.
  const resetWrites = shared.resetRowsForNewMonth(rows).map((r, i) => ({
    id: employees[i].id,
    data: shared.rowToEmployeeData(r),
  }))

  const nextGoal = shared.nextMonthGoal(teamGoal)
  return {
    month,
    snapshotMeta,
    snapshotEmployees,
    indexMonths,
    resetWrites,
    next: { teamGoal: nextGoal, history: input.history.filter((h) => h.date >= nextGoal.periodStart) },
  }
}
