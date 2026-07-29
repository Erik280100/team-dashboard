// Übersicht — reine Ableitungsfunktionen für KPIs, Goal-/Recruit-Fortschritt,
// Zielverlauf-Prognose und Chart-Datensätze. 1:1 portiert aus legacy/index.html
// (renderSummary, renderCharts, renderTimeline, renderGoalProgress,
// renderRecruitPanel: :2587–2634, 2853–2973, 3006–3130, 3187–3222).
// Golden-Master-Test: test/calc/overview.golden.test.ts.
import {
  addDays, defaultPeriod, fmt, parseISODate, pctOf, recruitActualValue,
  teamTarget, toISODate, type EmployeeRow, type HistoryEntry, type TeamGoal,
} from "@/lib/calc/format"

export const PIE_COLORS = [
  "#64DDA3", "#5BB8E8", "#F2B84B", "#E8735B", "#B48EE0",
  "#4BD1C5", "#E85B9C", "#8FD14B", "#5B7FE8", "#D1A64B",
]

// ---- KPI-Kacheln (renderSummary) ----
export interface SummaryKpis {
  employeeCount: number
  onTrackCount: number
}

export function summaryKpis(rows: EmployeeRow[]): SummaryKpis {
  const onTrack = rows.filter((r) => pctOf(r) >= 70).length
  return { employeeCount: rows.length, onTrackCount: onTrack }
}

// ---- Team-Ziel-Fortschritt (renderGoalProgress) ----
export interface GoalProgress {
  totalIst: number
  target: number
  pct: number
  remainingText: string
}

export function goalProgress(rows: EmployeeRow[]): GoalProgress {
  const totalIst = rows.reduce((s, r) => s + Number(r.ist || 0), 0)
  const target = teamTarget(rows)
  const pct = target > 0 ? Math.round((totalIst / target) * 100) : 0
  let remainingText: string
  if (target <= 0) remainingText = 'Noch kein Team-Ziel — bei den Mitarbeitern „Soll"-Werte eintragen.'
  else if (totalIst >= target) remainingText = "Ziel erreicht — stark!"
  else remainingText = "Noch " + fmt(target - totalIst) + " Einheiten bis zum Ziel."
  return { totalIst, target, pct, remainingText }
}

// ---- Recruiting-Fortschritt (renderRecruitPanel) ----
export interface RecruitListItem {
  name: string
  dateLabel: string
  hasDate: boolean
  inPeriod: boolean
}

export interface RecruitProgress {
  count: number
  target: number
  pct: number
  items: RecruitListItem[]
}

export function recruitProgress(
  rows: EmployeeRow[],
  teamGoal: Pick<TeamGoal, "recruitGoal" | "recruitActual" | "periodStart" | "periodEnd">
): RecruitProgress {
  const def = defaultPeriod()
  const start = parseISODate(teamGoal.periodStart || def.periodStart)
  const end = parseISODate(teamGoal.periodEnd || def.periodEnd)

  const newHires = rows.filter((r) => r.isNew)
  const count = recruitActualValue(rows, teamGoal)
  const target = Number(teamGoal.recruitGoal || 0)
  const pct = target > 0 ? Math.round((count / target) * 100) : 0

  const withDate = newHires
    .filter((r) => r.joinDate)
    .map((r) => ({ r, d: parseISODate(r.joinDate as string) }))
    .sort((a, b) => a.d.getTime() - b.d.getTime())
  const withoutDate = newHires.filter((r) => !r.joinDate)

  const items: RecruitListItem[] = [
    ...withDate.map(({ r, d }) => ({
      name: r.name as string,
      dateLabel: d.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit" }),
      hasDate: true,
      inPeriod: d >= start && d <= end,
    })),
    ...withoutDate.map((r) => ({
      name: r.name as string,
      dateLabel: "Datum unbekannt",
      hasDate: false,
      inPeriod: false,
    })),
  ]

  return { count, target, pct, items }
}

// ---- Zielverlauf & Prognose (renderTimeline) ----
export interface TimelinePoint {
  label: string
  idealPath: number | null
  actual: number | null
  forecast: number | null
}

export interface TimelineResult {
  valid: boolean
  points: TimelinePoint[]
  forecastText: string
}

export function timelineData(
  teamGoal: Pick<TeamGoal, "periodStart" | "periodEnd">,
  rows: EmployeeRow[],
  history: HistoryEntry[],
  now: Date = new Date()
): TimelineResult {
  const def = defaultPeriod()
  const start = parseISODate(teamGoal.periodStart || def.periodStart)
  const end = parseISODate(teamGoal.periodEnd || def.periodEnd)
  const target = teamTarget(rows)

  if (!(end > start)) {
    return {
      valid: false,
      points: [],
      forecastText: "Ende des Zeitraums muss nach dem Start liegen — bitte Datum oben prüfen.",
    }
  }

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
  let todayIdx: number
  if (today < start) todayIdx = 0
  else if (today > end) todayIdx = totalDays - 1
  else todayIdx = Math.round((today.getTime() - start.getTime()) / 86400000)

  const dateList = Array.from({ length: totalDays }, (_, i) => addDays(start, i))
  const labels = dateList.map((d) => d.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit" }))

  const idealPath = dateList.map((_, i) =>
    target > 0 ? Math.round((target / (totalDays - 1 || 1)) * i) : null
  )

  const histByISO: Record<string, number> = {}
  history.forEach((h) => { histByISO[h.date] = h.ist })
  let lastKnown = 0
  let lastKnownIdx: number | null = null
  const actualSeries = dateList.map((d, i) => {
    if (i > todayIdx) return null
    const iso = toISODate(d)
    if (histByISO[iso] !== undefined) {
      lastKnown = histByISO[iso]
      lastKnownIdx = i
    }
    return lastKnown
  })

  const forecastSeries: (number | null)[] = dateList.map(() => null)
  let forecastText = "Noch keine Verlaufsdaten — Wert wird bei jedem Speichern automatisch erfasst."
  if (lastKnownIdx !== null && lastKnown > 0) {
    const elapsedDays = lastKnownIdx + 1
    const dailyRate = lastKnown / elapsedDays
    for (let i = lastKnownIdx; i < totalDays; i++) {
      forecastSeries[i] = Math.round(dailyRate * (i + 1))
    }
    if (target > 0) {
      if (dailyRate <= 0) {
        forecastText = "Bei aktuellem Tempo (0 Einheiten/Tag) wird das Ziel im gewählten Zeitraum nicht erreicht."
      } else {
        const projectedIdx = Math.ceil(target / dailyRate) - 1
        if (projectedIdx <= totalDays - 1) {
          const projDate = addDays(start, projectedIdx)
          forecastText =
            "Bei aktuellem Tempo (" + fmt(Math.round(dailyRate)) + " Einheiten/Tag) wird das Ziel voraussichtlich am <strong>" +
            projDate.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }) +
            "</strong> erreicht."
        } else {
          const shortfall = Math.round(target - dailyRate * totalDays)
          forecastText =
            "Bei aktuellem Tempo (" + fmt(Math.round(dailyRate)) + " Einheiten/Tag) fehlen am Ende des Zeitraums voraussichtlich <strong>" +
            fmt(shortfall) + " Einheiten</strong> zum Ziel."
        }
      }
    }
  }

  const points: TimelinePoint[] = labels.map((label, i) => ({
    label,
    idealPath: idealPath[i],
    actual: actualSeries[i],
    forecast: forecastSeries[i],
  }))

  return { valid: true, points, forecastText }
}

// ---- Bar-Chart: Soll vs. Ist pro Mitarbeiter, absteigend nach Ist ----
export interface BarChartRow {
  shortName: string
  fullName: string
  soll: number
  ist: number
}

export function barChartData(rows: EmployeeRow[]): BarChartRow[] {
  const sorted = [...rows].sort((a, b) => Number(b.ist || 0) - Number(a.ist || 0))
  return sorted.map((r) => {
    const parts = (r.name as string).split(" ")
    const shortName = parts[0] + (parts[1] ? " " + parts[1][0] + "." : "")
    return { shortName, fullName: r.name as string, soll: Number(r.soll || 0), ist: Number(r.ist || 0) }
  })
}

// ---- Doughnut: Team-Fortschritt ----
export interface DoughnutData {
  hasData: boolean
  totalIst: number
  target: number
  pct: number
  rest: number
}

export function doughnutData(rows: EmployeeRow[]): DoughnutData {
  const totalIst = rows.reduce((s, r) => s + Number(r.ist || 0), 0)
  const target = teamTarget(rows)
  const rest = Math.max(target - totalIst, 0)
  const pct = target > 0 ? Math.round((totalIst / target) * 100) : 0
  const hasData = target > 0 || totalIst > 0
  return { hasData, totalIst, target, pct, rest }
}

// ---- Pie: Umsatzanteil je Mitarbeiter ----
export interface RevenueShareRow {
  name: string
  value: number
  pct: number
  color: string
}

export function revenueShareData(rows: EmployeeRow[]): RevenueShareRow[] {
  const contributors = rows.filter((r) => Number(r.ist || 0) > 0)
  const shareRows = (contributors.length ? contributors : [...rows]).sort(
    (a, b) => Number(b.ist || 0) - Number(a.ist || 0)
  )
  const shareTotal = shareRows.reduce((s, r) => s + Number(r.ist || 0), 0)
  return shareRows.map((r, i) => {
    const value = Number(r.ist || 0)
    const pct = shareTotal > 0 ? Math.round((value / shareTotal) * 100) : 0
    return { name: r.name as string, value, pct, color: PIE_COLORS[i % PIE_COLORS.length] }
  })
}

// ---- Leaderboard: Ranking nach Ist AT ----
export interface LeaderboardRow {
  name: string
  atIst: number
}

export function leaderboardData(rows: EmployeeRow[]): LeaderboardRow[] {
  return [...rows]
    .sort((a, b) => Number(b.atIst || 0) - Number(a.atIst || 0))
    .map((r) => ({ name: r.name as string, atIst: Number(r.atIst || 0) }))
}
