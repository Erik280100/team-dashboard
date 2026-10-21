// Firestore-Dokumentformen + Startdaten — 1:1 aus der Legacy-App übernommen
// (legacy/index.html:2248–2283, 4151–4177), damit neue und alte App exakt
// dieselben Datenstrukturen lesen/schreiben.
import { defaultPeriod, type EmployeeRow, type TeamGoal } from "@/lib/calc/format"
import type { PlanId, SbNode } from "@/lib/calc/struktur"
import type { Beschaeftigung } from "@/lib/data/finanzierung"

export type { EmployeeRow, TeamGoal }

export interface HistoryEntry {
  date: string
  ist: number
}

/** finova/dashboard */
export interface DashboardDoc {
  rows: EmployeeRow[]
  teamGoal: TeamGoal
  history: HistoryEntry[]
}

export interface AttendanceEntry {
  seminar: boolean
  seminarReason: string
  training: boolean
  trainingReason: string
}

/** finova/attendance */
export interface AttendanceDoc {
  entries: Record<string, AttendanceEntry>
}

export interface OrgChartNote {
  text: string
  date: string
}

export interface OrgChartConn {
  from: string
  to: string
  label?: string
}

/** finova/orgchart */
export interface OrgChartDoc {
  tree: SbNode
  notes: Record<string, OrgChartNote[]>
  conns: OrgChartConn[]
  /** Legacy-Feld: Insurance-Sätze je Stufe (Spiegel von planRates.insurance, siehe
   * useOrgChartDoc.saveOrgChart), damit legacy/index.html weiter funktioniert. */
  rates: Record<string, number>
  /** Euro pro Einheit je Karrierestufe und Karriereplan. Optional — fehlt es,
   * gelten die Default-Sätze aus DEFAULT_PLAN_RATES (struktur.ts). */
  planRates?: Record<PlanId, Record<string, number>>
}

export type FinanzierungArt = "hauskauf" | "wohnungskauf" | "hausbau" | "umbau" | "sanierung" | "umschuldung" | "anlegerwohnung"

export interface FinanzierungCase {
  id: string
  name: string
  betrag: number
  art: FinanzierungArt
  beschaeftigung: Beschaeftigung
  /** Name des zuständigen Mitarbeiters (aus dem Strukturbaum-Roster). */
  betreuer: string
  /** Name des Abwicklers (Georg/Sandro), der den Fall sieht und mitbearbeitet; leer = keiner zugewiesen. */
  abwickler?: string
  /** Item-ID (siehe lib/data/finanzierung.ts) -> abgehakt. */
  docs: Record<string, boolean>
  aufbereitet: boolean
  eingereicht: boolean
  kreditvertrag: boolean
  archived: boolean
  createdAt: string
}

/** finova/financings */
export interface FinanzierungenDoc {
  cases: FinanzierungCase[]
}

// Mein Board — persönliches Kanban-Board (siehe src/components/sections/MeinBoard.tsx).
// Keine Legacy-Entsprechung, neues Feature. Fixe Swimlanes/Kategorien/Farben (keine
// benutzerdefinierten Lanes), analog zum FinanzierungArt-Enum oben.
export const TODO_LANES = ["todo", "progress", "berechnung", "kunde", "fertig"] as const
export type TodoLane = (typeof TODO_LANES)[number]

export const TODO_LANE_LABELS: Record<TodoLane, string> = {
  todo: "Todo",
  progress: "In Berechnung",
  berechnung: "Warten auf BT",
  kunde: "Warte auf Kunden",
  fertig: "Fertig",
}

export const TODO_CATEGORIES = ["finanzierung", "kunde", "mitarbeiterkunde"] as const
export type TodoCategory = (typeof TODO_CATEGORIES)[number]

export const TODO_CATEGORY_LABELS: Record<TodoCategory, string> = {
  finanzierung: "Finanzierungen",
  kunde: "Kunden",
  mitarbeiterkunde: "Mitarbeiter-Kunden",
}

export const TODO_COLORS = ["grau", "gruen", "gelb", "rot", "blau"] as const
export type TodoColor = (typeof TODO_COLORS)[number]

export const TODO_COLOR_LABELS: Record<TodoColor, string> = {
  grau: "Grau",
  gruen: "Grün",
  gelb: "Gelb",
  rot: "Rot",
  blau: "Blau",
}

export interface BoardTodo {
  id: string
  title: string
  /** Optional, leer = keine Beschreibung. */
  description: string
  /** "YYYY-MM-DD", leer = kein Fälligkeitsdatum. */
  dueDate: string
  lane: TodoLane
  category: TodoCategory
  color: TodoColor
  flagged: boolean
  /** Position innerhalb der Lane (aufsteigend). */
  order: number
  createdAt: string
}

/** finova/erik_todos */
export interface ErikTodosDoc {
  todos: BoardTodo[]
}

// Planung — Wochen-/Monats-/Jahresplanung je Führungskraft (siehe
// src/components/sections/Planung.tsx). Keine Legacy-Entsprechung; Aufbau/
// Kennzahlen aus Finova_Controlling.html (Wochenplan/Monatsplan/Jahresplanung-
// Panels) übernommen, dabei "Umsatz €" durch Einheiten ersetzt, damit es zum
// Rest des Dashboards passt (Karrierepläne/Soll-Ist rechnen ebenfalls in EH).
// Bewusst komplett getrennt von finova/dashboard (rows/AT/BT/ET) — kein
// Rückschreiben, keine Berührung der Monatsabschluss-/Archiv-Logik.
export interface PlanWeekEntry {
  atz: number
  atg: number
  analysenZ: number
  analysen: number
  beratungenZ: number
  beratungen: number
  vertraege: number
  pg: number
  stz: number
  stg: number
  etz: number
  etg: number
  ehOffen: number
  ehGemacht: number
  aktivitaetenSoll: number
  aktivitaetenIst: number
  notes: string
  submitted: boolean
}

/** finova/plan_week_<YYYY-Www> — entries je Mitarbeitername (wie roster/rows per Name verknüpft). */
export interface PlanWeekDoc {
  week: string
  entries: Record<string, PlanWeekEntry>
}

/**
 * Freitext-Notizen je Mitarbeiter für einen Monat (Kachel-Ansicht der
 * Monatsplanung, analog zu den Wochenplanung-Karten, aber ohne Zahlenfelder —
 * hier werden Namen für Anruf-/Beratungs-/Service-/Einstellungstermine notiert).
 */
export interface PlanMonthNotesEntry {
  at: string
  bt: string
  st: string
  et: string
  feedback: string
  /** Einheitenziel (EH-Soll) des Monats — erscheint als Soll auf der Mitarbeiterseite. Ältere Dokumente haben es nicht. */
  ehZiel?: number
}

/** finova/plan_month_notes_<YYYY-MM> — entries je Mitarbeitername. */
export interface PlanMonthNotesDoc {
  month: string
  entries: Record<string, PlanMonthNotesEntry>
}

export const PLAN_TARGET_KEYS = ["vertraege", "einheiten", "atg", "analysen", "beratungen"] as const
export type PlanTargetKey = (typeof PLAN_TARGET_KEYS)[number]

export const PLAN_TARGET_LABELS: Record<PlanTargetKey, string> = {
  vertraege: "Verträge",
  einheiten: "Einheiten",
  atg: "Wählversuche",
  analysen: "AT",
  beratungen: "BT",
}

export const PLAN_QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const
export type PlanQuarter = (typeof PLAN_QUARTERS)[number]

export type PlanQuarterData = { milestone: string } & Record<PlanTargetKey, number>

/**
 * finova/plan_annual_<YYYY>_<managerKey> — je Führungskraft ein eigenes
 * Dokument (planManagerKey in lib/calc/planung.ts), sonst würden sich alle
 * Führungskräfte ein gemeinsames Jahresziel teilen.
 */
export interface PlanAnnualDoc {
  targets: Record<PlanTargetKey, number>
  quarters: Record<PlanQuarter, PlanQuarterData>
}

export function planWeekStorageKey(week: string): string {
  return `finova_plan_week_${week}_v1`
}
export function planAnnualStorageKey(year: number, managerKey: string): string {
  return `finova_plan_annual_${year}_${managerKey}_v1`
}
export function planMonthNotesStorageKey(month: string): string {
  return `finova_plan_month_notes_${month}_v1`
}

export const STORAGE_KEY = "finova_dashboard_data_v1"
export const GOAL_KEY = "finova_dashboard_goal_v1"
export const HISTORY_KEY = "finova_dashboard_history_v1"
export const ATTENDANCE_KEY = "finova_dashboard_attendance_v1"
export const SB_STORAGE_KEY = "finova_orgchart_data_v1"
export const FINANZIERUNGEN_KEY = "finova_finanzierungen_v1"
export const BOARD_TODOS_KEY = "finova_erik_todos_v1"

export const STARTER_GOAL: TeamGoal = {
  note: "",
  recruitGoal: 6,
  recruitActual: null,
  ...defaultPeriod(),
}

const STARTER_JOIN_DATE = defaultPeriod().periodStart

const starterEmployee = (name: string, isNew: boolean): EmployeeRow => ({
  name,
  isNew,
  atPlan: 0,
  atIst: 0,
  btPlan: 0,
  btIst: 0,
  etPlan: 0,
  etIst: 0,
  soll: 0,
  ist: 0,
  joinDate: isNew ? STARTER_JOIN_DATE : "",
})

/** Platzhalter für den lokalen Modus ohne Cloud — keine echten Personen. */
export const STARTER_DATA: EmployeeRow[] = [
  starterEmployee("Person A", false),
  starterEmployee("Person B", false),
  starterEmployee("Person C", false),
  starterEmployee("Person D", false),
  starterEmployee("Person E", true),
  starterEmployee("Person F", true),
]

export const SB_DEFAULT_TREE: SbNode = {
  id: "root",
  name: "Person A",
  role: "Geschäftsstellenleiter",
  children: [
    {
      id: "b",
      name: "Person B",
      role: "Teamleiter",
      children: [
        { id: "e", name: "Person E", role: "Mitarbeiter", children: [] },
        { id: "f", name: "Person F", role: "Mitarbeiter", children: [] },
      ],
    },
    { id: "c", name: "Person C", role: "FT 3", children: [] },
    { id: "d", name: "Person D", role: "FT 1", children: [] },
  ],
}

// Umsatzverfolgung (Controlling): eine Zeile je Rechner-Position, die im EH-Rechner gebucht wurde.
export const UMSATZ_KEY = "finova_umsaetze_v1"

export interface UmsatzEntry {
  id: string
  /** ISO-Zeitpunkt der Buchung. */
  bookedAt: string
  /** Mitarbeiter, auf den gebucht wurde. */
  mitarbeiter: string
  produkt: string
  /** Eingegebener Betrag aus dem Rechner (Prämie, Zuzahlung, Anlagebetrag …). */
  praemie: number
  /** Bezeichnung des Betrags, z. B. "Mtl. Prämie (€)". */
  praemieLabel: string
  einheiten: number
  /** Nachträglich eingetragen. */
  kunde: string
  /** "YYYY-MM-DD" oder "". */
  beginn: string
  policiert: boolean
  ausbezahlt: boolean
}
