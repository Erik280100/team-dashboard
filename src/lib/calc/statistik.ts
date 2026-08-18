// Statistik-Seite — reine Ableitungsfunktionen für Team-Trend, Monatsvergleich,
// Mitarbeiter-Entwicklung und Karriereplan-Aufteilung über mehrere abgeschlossene
// Monate. Rechnet auf ArchiveIndexEntry (Trend/Vergleich/Split — kein
// Snapshot-Load nötig) bzw. MonthSnapshot (Mitarbeiter-Matrix). Kein
// Legacy-Äquivalent (neues Feature). Getestet in test/calc/statistik.test.ts.
import { PIE_COLORS } from "@/lib/calc/overview"
import { PLAN_IDS, sbRoster, type PlanId } from "@/lib/calc/struktur"
import { mergeRosterWithRows } from "@/lib/calc/team"
import { computeEarnings, readPlanUnits } from "@/lib/calc/verguetung"
import type { ArchiveIndexEntry, MonthKey, MonthSnapshot, MonthTotals } from "@/types/archive"

/** Farben je Karriereplan, aus PIE_COLORS (overview.ts) abgeleitet — konsistent
 * mit dem Umsatzanteil-Chart der Übersicht. */
export const PLAN_COLORS: Record<PlanId, string> = {
  insurance: PIE_COLORS[0],
  investment: PIE_COLORS[1],
  investmentVb: PIE_COLORS[8],
  credit: PIE_COLORS[2],
  realestate: PIE_COLORS[3],
}

function emptyPlanRecord(): Record<PlanId, number> {
  const out = {} as Record<PlanId, number>
  PLAN_IDS.forEach((p) => { out[p] = 0 })
  return out
}

/** Archiv-Einträge zwischen from..to (inklusive, unabhängig von der Reihenfolge
 * der Argumente). "YYYY-MM"-Strings sortieren lexikographisch = chronologisch. */
export function monthsInRange(index: ArchiveIndexEntry[], from: MonthKey, to: MonthKey): ArchiveIndexEntry[] {
  const [lo, hi] = from <= to ? [from, to] : [to, from]
  return index.filter((e) => e.month >= lo && e.month <= hi).sort((a, b) => a.month.localeCompare(b.month))
}

// ---- Feature 1: Team-Trend ----
export interface TrendPoint {
  month: MonthKey
  label: string
  soll: number
  ist: number
  pct: number
  atPlan: number
  atIst: number
  btIst: number
  etIst: number
  totalEur: number
  employeeCount: number
}

/** Team-Verlauf — allein aus dem Index, kein Snapshot-Load nötig. */
export function teamTrend(entries: ArchiveIndexEntry[]): TrendPoint[] {
  return entries.map((e) => ({
    month: e.month,
    label: e.label,
    soll: e.totals.soll,
    ist: e.totals.ist,
    pct: e.totals.pct,
    atPlan: e.totals.atPlan,
    atIst: e.totals.atIst,
    btIst: e.totals.btIst,
    etIst: e.totals.etIst,
    totalEur: e.totals.totalEur,
    employeeCount: e.totals.employeeCount,
  }))
}

// ---- Feature 2: A/B-Monatsvergleich ----
export type MetricUnit = "eh" | "eur" | "count" | "pct"

export interface MetricDelta {
  key: string
  label: string
  unit: MetricUnit
  a: number
  b: number
  delta: number
  /** null, wenn a === 0 (keine sinnvolle prozentuale Veränderung berechenbar). */
  pctChange: number | null
}

const COMPARE_METRICS: { key: keyof MonthTotals; label: string; unit: MetricUnit }[] = [
  { key: "ist", label: "Einheiten (Ist)", unit: "eh" },
  { key: "soll", label: "Einheiten (Soll)", unit: "eh" },
  { key: "pct", label: "Zielerreichung", unit: "pct" },
  { key: "atIst", label: "AT (Ist)", unit: "count" },
  { key: "btIst", label: "BT (Ist)", unit: "count" },
  { key: "etIst", label: "ET (Ist)", unit: "count" },
  { key: "totalEur", label: "Vergütung gesamt", unit: "eur" },
  { key: "employeeCount", label: "Mitarbeiter", unit: "count" },
  { key: "newHireCount", label: "Neue Mitarbeiter", unit: "count" },
]

/** A/B-Vergleich zweier Monate über alle relevanten MonthTotals-Kennzahlen. */
export function compareMonths(a: ArchiveIndexEntry, b: ArchiveIndexEntry): MetricDelta[] {
  return COMPARE_METRICS.map(({ key, label, unit }) => {
    const av = Number(a.totals[key]) || 0
    const bv = Number(b.totals[key]) || 0
    const delta = bv - av
    const pctChange = av === 0 ? null : Math.round((delta / av) * 1000) / 10
    return { key: String(key), label, unit, a: av, b: bv, delta, pctChange }
  })
}

// ---- Feature 3: Mitarbeiter-Entwicklung ----
export interface EmployeeMonthCell {
  month: MonthKey
  present: boolean
  ist: number
  soll: number
  pct: number
  eur: number
  ehByPlan: Record<PlanId, number>
}

export interface EmployeeSeries {
  name: string
  /** Rolle aus dem letzten Monat, in dem die Person im Strukturbaum vorkam. */
  role: string
  /** Einrücktiefe im aktuellen (letzten) Strukturbaum, für die Struktur-Sortierung. */
  depth: number
  /** Position in der Baum-Vorordnung des letzten Snapshots (Führungskraft vor
   * Untergebenen, analog Team.tsx-Sortierung "manager"). Personen, die im
   * letzten Monat nicht mehr im Strukturbaum standen, landen ans Ende. */
  structureIndex: number
  /** Gleiche Länge/Reihenfolge wie die übergebenen Snapshots (nach Monat sortiert). */
  cells: EmployeeMonthCell[]
  total: number
  avg: number
  /** Ist(letzter vorhandener Monat) − Ist(erster vorhandener Monat). */
  trend: number
}

/**
 * Mitarbeiter × Monat. Nutzt je Snapshot dieselbe Pipeline wie Team.tsx
 * (sbRoster -> mergeRosterWithRows -> computeEarnings/readPlanUnits), damit die
 * Zahlen zellengenau zur archivierten Mitarbeiterseite passen. Schlüssel ist
 * der exakte Name — eine Umbenennung erzeugt zwei Zeilen (bewusst kein
 * Fuzzy-Matching, das wäre in einer Statistik irreführend). Personen, die in
 * einem Monat nicht im Strukturbaum standen, bekommen present:false.
 */
export function employeeMatrix(snapshots: MonthSnapshot[]): EmployeeSeries[] {
  const ordered = [...snapshots].sort((a, b) => a.month.localeCompare(b.month))
  const names = new Set<string>()
  const perMonth = ordered.map((snap) => {
    const roster = sbRoster(snap.orgChart.tree)
    const merged = mergeRosterWithRows(roster, snap.rows)
    const earnings = computeEarnings(merged, snap.orgChart.planRates)
    merged.forEach((m) => names.add(m.name))
    return { snap, merged, earnings }
  })

  const latest = perMonth[perMonth.length - 1]
  const structureIndexByName = new Map<string, number>()
  const depthByName = new Map<string, number>()
  latest?.merged.forEach((m, i) => {
    structureIndexByName.set(m.name, i)
    depthByName.set(m.name, m.depth)
  })

  return [...names]
    .sort((a, b) => a.localeCompare(b, "de"))
    .map((name) => {
      let role = ""
      const cells: EmployeeMonthCell[] = perMonth.map(({ snap, merged, earnings }) => {
        const entry = merged.find((m) => m.name === name)
        if (!entry) {
          return { month: snap.month, present: false, ist: 0, soll: 0, pct: 0, eur: 0, ehByPlan: emptyPlanRecord() }
        }
        role = entry.role
        const units = readPlanUnits(entry)
        const eur = earnings.get(name)?.total ?? 0
        const pct = entry.soll > 0 ? Math.round((entry.ist / entry.soll) * 100) : 0
        return { month: snap.month, present: true, ist: entry.ist, soll: entry.soll, pct, eur, ehByPlan: units }
      })
      const present = cells.filter((c) => c.present)
      const total = present.reduce((s, c) => s + c.ist, 0)
      const avg = present.length > 0 ? total / present.length : 0
      const trend = present.length > 0 ? present[present.length - 1].ist - present[0].ist : 0
      const depth = depthByName.get(name) ?? 0
      const structureIndex = structureIndexByName.get(name) ?? Number.MAX_SAFE_INTEGER
      return { name, role, depth, structureIndex, cells, total, avg, trend }
    })
}

// ---- Feature 4: Karriereplan-Aufteilung ----
export interface PlanSplitPoint {
  month: MonthKey
  label: string
  units: Record<PlanId, number>
  total: number
  /** Anteil in Prozent je Plan, summiert exakt auf 100 (0 bei total === 0). */
  share: Record<PlanId, number>
}

/** Karriereplan-Aufteilung je Monat — allein aus dem Index (totals.ehByPlan). */
export function planSplit(entries: ArchiveIndexEntry[]): PlanSplitPoint[] {
  return entries.map((e) => {
    const units = e.totals.ehByPlan
    const total = PLAN_IDS.reduce((s, p) => s + (units[p] || 0), 0)
    const share = {} as Record<PlanId, number>
    PLAN_IDS.forEach((p) => { share[p] = total > 0 ? ((units[p] || 0) / total) * 100 : 0 })
    return { month: e.month, label: e.label, units, total, share }
  })
}
