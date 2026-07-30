// Allgemeine Formatter/Helfer — 1:1 portiert aus legacy/index.html (fmt, pctOf,
// teamTarget, progressClass, initials, recruitActualValue, monthWeekProgress,
// migrateRow/migrateRows, Datums-Helfer). Funktionen, die im Original auf
// Modul-globalen `rows`/`teamGoal` operierten, nehmen diese hier explizit als
// Parameter entgegen — Verhalten sonst identisch.
// Golden-Master-Test: test/calc/format.golden.test.ts.
import type { PlanId } from "./struktur"

export interface EmployeeRow {
  name: string
  soll: number
  /** Gesamteinheiten — denormalisierte Summe von ehByPlan, siehe verguetung.ts. */
  ist: number
  /** Einheiten je Karriereplan (insurance/investment/credit/realestate). Fehlt dieses
   * Feld (Altbestand vor der Karrierepläne-Aufteilung), gilt ist als reiner
   * Insurance-Wert — siehe readPlanUnits() in verguetung.ts. */
  ehByPlan?: Partial<Record<PlanId, number>>
  isNew?: boolean
  joinDate?: string
  at?: number
  atPlan?: number
  atIst?: number
  bt?: number
  btPlan?: number
  btIst?: number
  et?: number
  etPlan?: number
  etIst?: number
  [key: string]: unknown
}

export interface TeamGoal {
  note: string
  recruitGoal: number
  recruitActual: number | null
  periodStart: string
  periodEnd: string
}

export function fmt(n: number | undefined | null): string {
  return Number(n || 0).toLocaleString("de-AT")
}

export function pctOf(r: Pick<EmployeeRow, "soll" | "ist">): number {
  return r.soll > 0 ? Math.round((r.ist / r.soll) * 100) : 0
}

/** Team-Ziel ergibt sich aus der Summe der Einzel-Soll-Werte pro Mitarbeiter. */
export function teamTarget(rows: Pick<EmployeeRow, "soll">[]): number {
  return rows.reduce((s, r) => s + Number(r.soll || 0), 0)
}

export function progressClass(pct: number): "low" | "high" | "" {
  if (pct < 50) return "low"
  if (pct >= 90) return "high"
  return ""
}

export function initials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean)
  if (parts.length === 0) return "?"
  return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase()
}

export function recruitActualValue(
  rows: Pick<EmployeeRow, "isNew">[],
  teamGoal: Pick<TeamGoal, "recruitActual">
): number {
  const newHiresCount = rows.filter((r) => r.isNew).length
  return teamGoal.recruitActual !== null && teamGoal.recruitActual !== undefined
    ? Number(teamGoal.recruitActual)
    : newHiresCount
}

/** 'YYYY-MM-DD' als lokales Datum parsen (vermeidet UTC-Off-by-one). */
export function parseISODate(str: string): Date {
  const [y, m, d] = str.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export function toISODate(d: Date): string {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  )
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function defaultPeriod(): { periodStart: string; periodEnd: string } {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const toISO = (d: Date) => d.toISOString().slice(0, 10)
  return { periodStart: toISO(first), periodEnd: toISO(last) }
}

export interface MonthWeekProgress {
  active: boolean
  fraction: number
}

/**
 * Wie weit ist der eingestellte Umsatzmonat wochen-anteilig fortgeschritten (0..1)?
 * Dient als Basis für die Rot/Grün-Einfärbung der Mitarbeiterzeilen nach AT-Fortschritt.
 */
export function monthWeekProgress(
  teamGoal: Pick<TeamGoal, "periodStart" | "periodEnd">,
  now: Date = new Date()
): MonthWeekProgress {
  const def = defaultPeriod()
  const start = parseISODate(teamGoal.periodStart || def.periodStart)
  const end = parseISODate(teamGoal.periodEnd || def.periodEnd)
  if (!(end >= start)) return { active: false, fraction: 0 }
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  if (today < start) return { active: false, fraction: 0 } // Monat noch nicht begonnen
  const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
  const totalWeeks = Math.max(1, Math.ceil(totalDays / 7))
  let currentWeek: number
  if (today > end) currentWeek = totalWeeks // Monat vorbei -> voller Plan erwartet
  else
    currentWeek = Math.min(
      totalWeeks,
      Math.ceil((Math.round((today.getTime() - start.getTime()) / 86400000) + 1) / 7)
    )
  return { active: true, fraction: currentWeek / totalWeeks }
}

/** Ergänzt fehlende Plan/Ist-Felder einer Mitarbeiterzeile (Schema-Migration). */
export function migrateRow(r: EmployeeRow): EmployeeRow {
  if (r.atPlan === undefined) r.atPlan = Number(r.at) || 0
  if (r.atIst === undefined) r.atIst = 0
  if (r.btPlan === undefined) r.btPlan = Number(r.bt) || 0
  if (r.btIst === undefined) r.btIst = 0
  if (r.etPlan === undefined) r.etPlan = Number(r.et) || 0
  if (r.etIst === undefined) r.etIst = 0
  return r
}

export function migrateRows(list: EmployeeRow[]): EmployeeRow[] {
  return list.map(migrateRow)
}

export interface HistoryEntry {
  date: string
  ist: number
}

/**
 * Trägt den heutigen Gesamt-Ist-Wert in die Verlaufshistorie ein (überschreibt
 * einen bereits vorhandenen Eintrag für heute) und sortiert nach Datum.
 * Mutiert `history` nicht — gibt ein neues, sortiertes Array zurück.
 */
export function recordSnapshot(
  rows: Pick<EmployeeRow, "ist">[],
  history: HistoryEntry[],
  today: string = new Date().toISOString().slice(0, 10)
): HistoryEntry[] {
  const totalIst = rows.reduce((s, r) => s + Number(r.ist || 0), 0)
  const next = history.map((h) => ({ ...h }))
  const existing = next.find((h) => h.date === today)
  if (existing) existing.ist = totalIst
  else next.push({ date: today, ist: totalIst })
  next.sort((a, b) => a.date.localeCompare(b.date))
  return next
}
