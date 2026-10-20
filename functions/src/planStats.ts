// Monatssummen aus dem Controlling (employees/{id}.monthStats), damit alle Eingeloggten AT/BT/ST/ET und
// Soll jedes Mitarbeiters sehen, ohne die Wochen-/Jahresplanung selbst lesen zu dürfen.
// ACHTUNG: Spiegel von isoWeekNumber/isoWeekKey/monthWeekKeys/sumWeekEntries in
// ../../src/lib/calc/planung.ts und der Zuordnung in src/components/sections/Team.tsx
// (AT = analysen, BT = beratungen, ST = stg, ET = etg; "…Plan" = analysenZ/beratungenZ/stz/etz).
// Beide Fassungen müssen gleich bleiben (test/calc/planStats.test.ts vergleicht sie).
export interface MonthStats {
  month: string
  atPlan: number; atIst: number
  btPlan: number; btIst: number
  stPlan: number; stIst: number
  etPlan: number; etIst: number
  soll: number
}

type WeekEntry = Record<string, unknown>

function isoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  return `${date.getUTCFullYear()}-W${String(isoWeekNumber(d)).padStart(2, "0")}`
}

/** Umsatzmonat "YYYY-MM" aus dem Teamziel (wie monthKeyOf in src/lib/calc/archive.ts). */
export function monthKeyFromGoal(goal: { periodStart?: string } | undefined, now = new Date()): string {
  const start = goal?.periodStart
  if (start && /^\d{4}-\d{2}/.test(start)) return start.slice(0, 7)
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

/** Alle ISO-Wochen, die einen Tag des Kalendermonats enthalten. */
export function monthWeekKeys(monthKey: string): string[] {
  const [yr, mo] = monthKey.split("-").map(Number)
  const daysInMonth = new Date(yr, mo, 0).getDate()
  const weeks = new Set<string>()
  for (let day = 1; day <= daysInMonth; day++) weeks.add(isoWeekKey(new Date(yr, mo - 1, day)))
  return [...weeks].sort()
}

const sum = (entries: (WeekEntry | undefined)[], field: string) =>
  entries.reduce((s, e) => s + (Number(e?.[field]) || 0), 0)

/** weeks: Wocheneinträge des Mitarbeiters (fehlende Wochen weglassen), monthNote: planMonthNotes/{monat}. */
export function computeMonthStats(month: string, weeks: WeekEntry[], monthNote: WeekEntry | undefined): MonthStats {
  return {
    month,
    atPlan: sum(weeks, "analysenZ"), atIst: sum(weeks, "analysen"),
    btPlan: sum(weeks, "beratungenZ"), btIst: sum(weeks, "beratungen"),
    stPlan: sum(weeks, "stz"), stIst: sum(weeks, "stg"),
    etPlan: sum(weeks, "etz"), etIst: sum(weeks, "etg"),
    soll: Number(monthNote?.ehZiel) || 0,
  }
}
