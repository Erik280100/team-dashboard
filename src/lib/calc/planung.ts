// Planung — reine Ableitungsfunktionen für Wochen-/Monats-/Jahresplanung je
// Führungskraft (siehe src/components/sections/Planung.tsx). Portiert aus
// Finova_Controlling.html (Wochenplan/Monatsplan/Jahresplanung-Panels), dabei
// "Umsatz €" durch Einheiten ersetzt (siehe types/dashboard.ts PlanTargetKey).
// Keine React-/Firebase-Abhängigkeit — analog zu lib/calc/statistik.ts.
import { addDays, defaultPeriod, parseISODate } from "@/lib/calc/format"
import {
  PLAN_QUARTERS,
  type PlanAnnualDoc,
  type PlanMonthNotesEntry,
  type PlanQuarter,
  type PlanWeekDoc,
  type PlanWeekEntry,
} from "@/types/dashboard"

/**
 * URL-/Dokument-ID-sichere Kurzform eines Führungskraft-Namens — die
 * Jahresplanung ist je Führungskraft eigenständig (jede FK hat ihre eigenen
 * Jahresziele für ihren Teilbaum), das Dokument muss also je Name getrennt
 * sein, nicht nur je Jahr.
 */
export function planManagerKey(managerName: string): string {
  const combiningMarks = /[̀-ͯ]/g
  const slug = managerName
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(combiningMarks, "") // Umlaute/Akzente -> Basisbuchstabe
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || "unbekannt"
}

// ---- ISO-Wochen (portiert aus Finova_Controlling.html:960-991) ----

/** ISO-8601-Kalenderwoche von d (1..53). */
export function isoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/** "YYYY-Www" für den Montag der Woche, in der d liegt (ISO-Wochenjahr, kann von d.getFullYear() abweichen). */
export function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const isoYear = date.getUTCFullYear()
  return `${isoYear}-W${String(isoWeekNumber(d)).padStart(2, "0")}`
}

/** Montag 00:00 UTC der gegebenen "YYYY-Www"-Woche. */
export function weekStartDate(week: string): Date {
  const [year, w] = week.split("-W").map(Number)
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const monday = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - (jan4.getUTCDay() || 7) + 1 + (w - 1) * 7)
  return monday
}

/** Wochenschlüssel um n Wochen verschoben (n negativ = zurück). */
export function shiftWeek(week: string, n: number): string {
  const d = weekStartDate(week)
  d.setUTCDate(d.getUTCDate() + n * 7)
  return isoWeekKey(d)
}

/** "KW 38 · 15.09.–21.09." */
export function weekLabel(week: string): string {
  const start = weekStartDate(week)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  const [, w] = week.split("-W")
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit" }
  return `KW ${w} · ${start.toLocaleDateString("de-AT", opts)}–${end.toLocaleDateString("de-AT", opts)}`
}

/** "YYYY-MM" -> "September 2026" */
export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("de-AT", { month: "long", year: "numeric" })
}

/** "YYYY-MM" des laufenden Kalendermonats. */
export function currentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

/**
 * Alle ISO-Wochenschlüssel, die mindestens einen Tag des Monats enthalten
 * (Logik aus Finova_Controlling.html:1106-1112, loadMonthData). Randwochen
 * zählen bewusst in beide angrenzenden Monate.
 */
export function monthWeekKeys(monthKey: string): string[] {
  const [yr, mo] = monthKey.split("-").map(Number)
  const daysInMonth = new Date(yr, mo, 0).getDate()
  const weeks = new Set<string>()
  for (let day = 1; day <= daysInMonth; day++) {
    weeks.add(isoWeekKey(new Date(yr, mo - 1, day)))
  }
  return [...weeks].sort()
}

/**
 * Alle ISO-Wochenschlüssel, die mindestens einen Tag des eingestellten
 * Umsatzmonats (periodStart..periodEnd, siehe TeamGoal/archive.ts
 * monthKeyOf) enthalten — Grundlage für die Wochenfreischaltung in der
 * Wochenplanung (nur Wochen des laufenden Umsatzmonats sind editierbar,
 * nicht des Kalendermonats).
 */
export function periodWeekKeys(periodStart: string, periodEnd: string): string[] {
  const def = defaultPeriod()
  const start = parseISODate(periodStart || def.periodStart)
  const end = parseISODate(periodEnd || def.periodEnd)
  if (!(end >= start)) return []
  const weeks = new Set<string>()
  for (let d = start; d <= end; d = addDays(d, 1)) {
    weeks.add(isoWeekKey(d))
  }
  return [...weeks].sort()
}

/** Alle ISO-Wochenschlüssel, deren Wochenjahr (Montag) year entspricht. */
export function yearWeekKeys(year: number): string[] {
  const weeks = new Set<string>()
  const jan1 = new Date(year, 0, 1)
  const dec31 = new Date(year, 11, 31)
  const cur = new Date(jan1)
  cur.setDate(cur.getDate() - 7) // eine Woche Puffer für ISO-Randwochen am Jahresanfang
  const end = new Date(dec31)
  end.setDate(end.getDate() + 7)
  while (cur <= end) {
    const key = isoWeekKey(cur)
    if (key.startsWith(`${year}-W`)) weeks.add(key)
    cur.setDate(cur.getDate() + 1)
  }
  return [...weeks].sort()
}

// ---- Quartale (Finova_Controlling.html:2832-2842) ----

export const Q_MONTHS: Record<PlanQuarter, string> = {
  Q1: "Jan–Mär",
  Q2: "Apr–Jun",
  Q3: "Jul–Sep",
  Q4: "Okt–Dez",
}

export const Q_WEEKS: Record<PlanQuarter, [number, number]> = {
  Q1: [1, 13],
  Q2: [14, 26],
  Q3: [27, 39],
  Q4: [40, 53],
}

export function weekToQuarter(week: string): PlanQuarter {
  const n = Number(week.split("-W")[1] || 0)
  if (n <= 13) return "Q1"
  if (n <= 26) return "Q2"
  if (n <= 39) return "Q3"
  return "Q4"
}

// ---- Wocheneinträge ----

export function emptyWeekEntry(): PlanWeekEntry {
  return {
    atz: 0, atg: 0,
    analysenZ: 0, analysen: 0,
    beratungenZ: 0, beratungen: 0,
    vertraege: 0, pg: 0,
    stz: 0, stg: 0,
    etz: 0, etg: 0,
    ehOffen: 0, ehGemacht: 0,
    aktivitaetenSoll: 0, aktivitaetenIst: 0,
    notes: "",
    submitted: false,
  }
}

const SUM_FIELDS = [
  "atz", "atg", "analysenZ", "analysen", "beratungenZ", "beratungen",
  "vertraege", "pg", "stz", "stg", "etz", "etg", "ehOffen", "ehGemacht",
  "aktivitaetenSoll", "aktivitaetenIst",
] as const

/** Summiert die Zahlenfelder mehrerer Wocheneinträge (notes/submitted bleiben leer/false). */
export function sumWeekEntries(entries: PlanWeekEntry[]): PlanWeekEntry {
  const out = emptyWeekEntry()
  for (const e of entries) {
    for (const f of SUM_FIELDS) out[f] += Number(e[f]) || 0
  }
  return out
}

/**
 * Verdichtet mehrere Wochendokumente je Person (aus `names`) zu einer Summe.
 * Personen ohne Eintrag in einer Woche zählen dort mit 0 (kein Fehler).
 */
export function aggregateByName(docs: PlanWeekDoc[], names: string[]): Map<string, PlanWeekEntry> {
  const out = new Map<string, PlanWeekEntry>()
  for (const name of names) {
    const entries = docs.map((d) => d.entries[name]).filter((e): e is PlanWeekEntry => !!e)
    out.set(name, sumWeekEntries(entries))
  }
  return out
}

/** Eine Rollup-Gruppe für die "Nach Führungskräften"-Ansicht — eine
 * Führungskraft mit allen Namen ihres Teilbaums (inkl. ihr selbst). */
export interface PlanTeamGroup {
  name: string
  role: string
  names: string[]
}

/**
 * Wie aggregateByName, aber je Gruppe (mehrere Namen, z. B. eine
 * Führungskraft + ihr gesamtes Team) statt je Einzelperson — für die
 * "Nach Führungskräften"-Rollup-Ansicht der Wochen-/Monats-/Jahresplanung.
 */
export function aggregateByGroup(docs: PlanWeekDoc[], groups: PlanTeamGroup[]): Map<string, PlanWeekEntry> {
  const out = new Map<string, PlanWeekEntry>()
  for (const g of groups) {
    const entries: PlanWeekEntry[] = []
    for (const doc of docs) {
      for (const name of g.names) {
        const e = doc.entries[name]
        if (e) entries.push(e)
      }
    }
    out.set(g.name, sumWeekEntries(entries))
  }
  return out
}

/** Leerer Monats-Notizeintrag (AT/BT/ST-Kacheln der Monatsplanung). */
export function emptyMonthNoteEntry(): PlanMonthNotesEntry {
  return { at: "", bt: "", st: "", et: "", feedback: "" }
}

/** Quote in Prozent (a / b), 0 bei b <= 0 — z. B. AT-Quote (Ist / Soll). */
export function quotePct(a: number, b: number): number {
  if (!b) return 0
  return Math.round((a / b) * 100)
}

// ---- Jahresplanung ----

/** Vorbelegung für ein neues Planungsjahr — Umsatz aus der Vorlage durch Einheiten ersetzt. */
export function defaultAnnual(): PlanAnnualDoc {
  return {
    targets: { vertraege: 200, einheiten: 500, atg: 1000, analysen: 800, beratungen: 600 },
    quarters: {
      Q1: { milestone: "Teamaufbau & Grundlagen", vertraege: 40, einheiten: 100, atg: 200, analysen: 160, beratungen: 120 },
      Q2: { milestone: "Wachstum & erste Abschlüsse", vertraege: 50, einheiten: 125, atg: 250, analysen: 200, beratungen: 150 },
      Q3: { milestone: "Skalierung & Momentum", vertraege: 55, einheiten: 130, atg: 270, analysen: 220, beratungen: 165 },
      Q4: { milestone: "Jahresendspurt & Abschluss", vertraege: 55, einheiten: 145, atg: 280, analysen: 220, beratungen: 165 },
    },
  }
}

export type QuarterStatus = "on-track" | "behind" | "completed" | "upcoming"

export interface QuarterActuals {
  vertraege: number
  einheiten: number
  atg: number
  analysen: number
  beratungen: number
}

/**
 * Status eines Quartals relativ zum aktuellen Datum, nach Verträge-Zielerreichung
 * (Finova_Controlling.html:2951-2966): künftige Jahre "upcoming", vergangene Jahre
 * "completed"/"behind" nach 95%-Schwelle, das laufende Jahr wochenanteilig
 * pro-rata (90% des erwarteten Anteils) gegen den Verträge-Ist-Wert.
 */
export function quarterStatus(
  quarter: PlanQuarter,
  actuals: Pick<QuarterActuals, "vertraege">,
  targets: { vertraege: number },
  year: number,
  now: Date = new Date()
): QuarterStatus {
  const curYear = now.getFullYear()
  const [wkMin, wkMax] = Q_WEEKS[quarter]
  const curWk = isoWeekNumber(now)
  const pct = targets.vertraege > 0 ? actuals.vertraege / targets.vertraege : 0

  if (year > curYear) return "upcoming"
  if (year < curYear) return pct >= 0.95 ? "completed" : "behind"
  if (curWk < wkMin) return "upcoming"
  if (curWk > wkMax) return pct >= 0.95 ? "completed" : "behind"
  return pct >= ((curWk - wkMin) / (wkMax - wkMin)) * 0.9 ? "on-track" : "behind"
}

/** Alle vier Quartale in fester Reihenfolge — für UI-Iteration. */
export const QUARTER_LIST: readonly PlanQuarter[] = PLAN_QUARTERS
