// Monats-Archiv — reine Ableitungsfunktionen für den Monatsabschluss und die
// Anzeige archivierter Monate. Ergänzt format.ts/team.ts/verguetung.ts um eine
// Zeitdimension, ohne deren Signaturen zu verändern (monthWeekProgress/
// timelineData nehmen `now` bereits als optionalen Parameter entgegen).
// Getestet in test/calc/archive.test.ts (kein Legacy-Äquivalent — neues Feature).
import {
  addDays, defaultPeriod, parseISODate, recruitActualValue, toISODate,
  type EmployeeRow, type HistoryEntry, type TeamGoal,
} from "@/lib/calc/format"
import {
  PLAN_IDS, sbRoster, withDefaultPlanRates, type PlanId, type SbNode,
} from "@/lib/calc/struktur"
import { mergeRosterWithRows, teamTotals } from "@/lib/calc/team"
import { computeEarnings, readPlanUnits } from "@/lib/calc/verguetung"
import type { OrgChartDoc } from "@/types/dashboard"
import type {
  ArchiveIndexEntry, MonthKey, MonthSnapshot, MonthTotals,
} from "@/types/archive"

/**
 * Setzt die Ist-Werte einer Mitarbeiterzeile für den neuen Monat zurück
 * (Einheiten je Plan, AT/BT/ET-Ist, manueller Bonus) — Soll/Plan-Werte, Name,
 * isNew und joinDate bleiben unangetastet. Der Bonus wird mitzurückgesetzt,
 * weil er bereits im Snapshot des abgeschlossenen Monats archiviert ist —
 * bliebe er stehen, würde er in jedem Folgemonat erneut in die €-Summe
 * einfließen, obwohl keine neue Leistung dahintersteckt. Mutiert `rows` nicht.
 */
export function resetRowsForNewMonth(rows: EmployeeRow[]): EmployeeRow[] {
  return rows.map((r) => {
    const next: EmployeeRow = { ...r, ist: 0, atIst: 0, btIst: 0, stIst: 0, etIst: 0, bonus: 0 }
    if (r.ehByPlan) {
      const ehByPlan: NonNullable<EmployeeRow["ehByPlan"]> = {}
      PLAN_IDS.forEach((p) => { ehByPlan[p] = 0 })
      next.ehByPlan = ehByPlan
    }
    if (r.vbByAbwickler) next.vbByAbwickler = {}
    return next
  })
}

/**
 * Verschiebt den Umsatzmonat auf den Folgezeitraum: Start = Tag nach dem bisherigen Ende, Ende = einen
 * Monat später minus einen Tag (07.10.–06.11. -> 07.11.–06.12.). Der Admin kann den Zeitraum danach auf dem
 * Dashboard anpassen. Läge der neue Start noch im Monat des alten Zeitraums (verkürzter Umsatzmonat), würde
 * derselbe Archivschlüssel zweimal vergeben — dann beginnt der Folgezeitraum am 1. des Folgemonats.
 * `note`/`recruitGoal` bleiben erhalten, `recruitActual` wird auf null gesetzt (wieder automatische Zählung
 * der "NEU"-markierten Mitarbeiter im neuen Zeitraum).
 */
export function nextMonthGoal<T extends Pick<TeamGoal, "periodStart" | "periodEnd">>(goal: T): T {
  const def = defaultPeriod()
  const curKey = monthKeyOf(goal)
  let start = addDays(parseISODate(goal.periodEnd || def.periodEnd), 1)
  if (`${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}` <= curKey) {
    const [y, m] = curKey.split("-").map(Number)
    start = new Date(y, m, 1) // m ist 1-basiert, also ist Index m der Folgemonat
  }
  // Gleicher Tag im Folgemonat (bei kürzeren Monaten dessen letzter Tag), davon der Vortag.
  const lastDay = new Date(start.getFullYear(), start.getMonth() + 2, 0).getDate()
  const sameDayNext = new Date(start.getFullYear(), start.getMonth() + 1, Math.min(start.getDate(), lastDay))
  return {
    ...goal,
    recruitActual: null,
    periodStart: toISODate(start),
    periodEnd: toISODate(addDays(sameDayNext, -1)),
  }
}

/**
 * Prüft einen vom Admin eingestellten Umsatzmonat. Liefert einen Fehlertext oder null.
 * `lastArchivedMonth` ("YYYY-MM"): der Startmonat muss danach liegen, sonst würde ein Archiv überschrieben.
 */
export function validatePeriod(start: string, end: string, lastArchivedMonth?: MonthKey | null): string | null {
  if (!start || !end) return "Start und Ende müssen gesetzt sein."
  const s = parseISODate(start)
  const e = parseISODate(end)
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "Ungültiges Datum."
  if (e < s) return "Das Ende muss am oder nach dem Start liegen."
  if (Math.round((e.getTime() - s.getTime()) / 86400000) + 1 > 62) return "Ein Umsatzmonat darf höchstens 62 Tage lang sein."
  if (lastArchivedMonth && monthKeyOf({ periodStart: start }) <= lastArchivedMonth) {
    return `Der Monat ${monthLabel(lastArchivedMonth)} ist bereits abgeschlossen — der Start muss in einem späteren Monat liegen.`
  }
  return null
}

/** Monatsschlüssel ("YYYY-MM") eines Zeitraums, abgeleitet aus periodStart (Name = Monat des Starttags). */
export function monthKeyOf(goal: Pick<TeamGoal, "periodStart">): MonthKey {
  const def = defaultPeriod()
  const start = parseISODate(goal.periodStart || def.periodStart)
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`
}

/** "2026-06" -> "Juni 2026" (de-AT). */
export function monthLabel(month: MonthKey): string {
  const [y, m] = month.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("de-AT", { month: "long", year: "numeric" })
}

/**
 * Zeitpunkt, der für Archiv-Ansichten als "jetzt" gilt: ein Tag nach
 * periodEnd, damit monthWeekProgress().fraction exakt 1 ergibt (Zweig
 * `today > end`) und timelineData() die volle Ist-Kurve statt eines beim
 * heutigen Datum abgeschnittenen Verlaufs zeichnet.
 */
export function archiveNow(goal: Pick<TeamGoal, "periodEnd">): Date {
  const def = defaultPeriod()
  const end = parseISODate(goal.periodEnd || def.periodEnd)
  return addDays(end, 1)
}

/**
 * Aggregate für einen Monat — nutzt dieselbe Pipeline wie Team.tsx
 * (sbRoster -> mergeRosterWithRows -> teamTotals + computeEarnings +
 * readPlanUnits), damit Statistik-Seite und archivierte Mitarbeiterseite nie
 * auseinanderlaufen. `employeeCount`/`pct` folgen summaryKpis()/goalProgress()
 * (overview.ts), die auf den rohen `rows` statt dem Roster rechnen.
 */
export function monthTotals(
  rows: EmployeeRow[],
  teamGoal: TeamGoal,
  tree: SbNode,
  planRates: Record<PlanId, Record<string, number>>
): MonthTotals {
  const roster = sbRoster(tree)
  const merged = mergeRosterWithRows(roster, rows)
  const totals = teamTotals(merged)
  const earnings = computeEarnings(merged, planRates)
  const totalEur = [...earnings.values()].reduce((s, e) => s + e.total, 0)

  const ehByPlan = {} as Record<PlanId, number>
  PLAN_IDS.forEach((p) => { ehByPlan[p] = 0 })
  merged.forEach((m) => {
    const units = readPlanUnits(m)
    PLAN_IDS.forEach((p) => { ehByPlan[p] += units[p] })
  })

  return {
    soll: totals.soll,
    ist: totals.ist,
    pct: totals.soll > 0 ? Math.round((totals.ist / totals.soll) * 100) : 0,
    atPlan: totals.atPlan, atIst: totals.atIst,
    btPlan: totals.btPlan, btIst: totals.btIst,
    etPlan: totals.etPlan, etIst: totals.etIst,
    ehByPlan,
    totalEur,
    employeeCount: rows.length,
    newHireCount: rows.filter((r) => r.isNew).length,
    recruitGoal: Number(teamGoal.recruitGoal || 0),
    recruitActual: recruitActualValue(rows, teamGoal),
  }
}

export interface BuildSnapshotInput {
  month: MonthKey
  rows: EmployeeRow[]
  teamGoal: TeamGoal
  history: HistoryEntry[]
  orgChart: OrgChartDoc
  closedBy: string | null
  now?: Date
}

/** Baut das unveränderliche Snapshot-Dokument für den Monatsabschluss. */
export function buildSnapshot(input: BuildSnapshotInput): MonthSnapshot {
  const now = input.now ?? new Date()
  const def = defaultPeriod()
  const start = input.teamGoal.periodStart || def.periodStart
  const end = input.teamGoal.periodEnd || def.periodEnd
  const history = input.history.filter((h) => h.date >= start && h.date <= end)

  return {
    version: 1,
    month: input.month,
    closedAt: now.toISOString(),
    closedBy: input.closedBy,
    rows: JSON.parse(JSON.stringify(input.rows)),
    teamGoal: { ...input.teamGoal },
    history: JSON.parse(JSON.stringify(history)),
    orgChart: {
      tree: JSON.parse(JSON.stringify(input.orgChart.tree)),
      notes: JSON.parse(JSON.stringify(input.orgChart.notes || {})),
      conns: JSON.parse(JSON.stringify(input.orgChart.conns || [])),
      rates: { ...(input.orgChart.rates || {}) },
      planRates: withDefaultPlanRates(input.orgChart.planRates),
    },
  }
}

/** Leitet den Index-Eintrag (vorberechnete Aggregate) aus einem Snapshot ab. */
export function buildIndexEntry(snapshot: MonthSnapshot): ArchiveIndexEntry {
  return {
    month: snapshot.month,
    label: monthLabel(snapshot.month),
    periodStart: snapshot.teamGoal.periodStart,
    periodEnd: snapshot.teamGoal.periodEnd,
    closedAt: snapshot.closedAt,
    totals: monthTotals(snapshot.rows, snapshot.teamGoal, snapshot.orgChart.tree, snapshot.orgChart.planRates),
  }
}

/**
 * Darf der Umsatzmonat abgeschlossen werden? Erst wenn das eingestellte Ende (periodEnd) vorbei ist.
 * Normalerweise schließt die Cloud Function closeMonthAuto automatisch; der Button ist nur der
 * Notfall-Weg für den Admin.
 */
export function canCloseMonth(goal: Pick<TeamGoal, "periodEnd">, now: Date = new Date()): boolean {
  const def = defaultPeriod()
  const end = parseISODate(goal.periodEnd || def.periodEnd)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  return today > end
}

/**
 * Ist der eingestellte Umsatzmonat vorbei, ohne dass dafür schon ein
 * Archiv-Eintrag existiert? Steuert das Erinnerungs-Banner "Monat abschließen".
 */
export function isMonthCloseDue(
  goal: TeamGoal,
  index: ArchiveIndexEntry[],
  now: Date = new Date()
): boolean {
  const def = defaultPeriod()
  const end = parseISODate(goal.periodEnd || def.periodEnd)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  if (!(today > end)) return false
  const month = monthKeyOf(goal)
  return !index.some((e) => e.month === month)
}
