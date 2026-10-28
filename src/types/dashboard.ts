// Firestore-Dokumentformen + Startdaten — 1:1 aus der Legacy-App übernommen
// (der früheren Einzeldatei-App), damit neue und alte App exakt
// dieselben Datenstrukturen lesen/schreiben.
import { defaultPeriod, type EmployeeRow, type TeamGoal } from "@/lib/calc/format"
import type { PlanId, SbNode } from "@/lib/calc/struktur"
import type { Beschaeftigung } from "@/lib/data/finanzierung"

export type { EmployeeRow, TeamGoal }

export interface HistoryEntry {
  date: string
  ist: number
}

/** Dashboard-Daten: rows aus employees/{id}, teamGoal und history aus org/teamGoal. */
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

/** org/structure */
export interface OrgChartDoc {
  tree: SbNode
  notes: Record<string, OrgChartNote[]>
  conns: OrgChartConn[]
  /** Altfeld: Insurance-Sätze je Stufe (Spiegel von planRates.insurance); bleibt für ältere Archiv-Snapshots erhalten. */
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

/** financings/{id} — ein Dokument je Fall. */
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
  /** Abgehakt in der Lane "fertig": aus dem Board ausgeblendet, über "Erledigte anzeigen" wieder sichtbar. */
  completed?: boolean
  /** Archiviert (aus jeder Lane möglich): nur im Archiv sichtbar; die Lane bleibt für die Wiederherstellung erhalten. */
  archived?: boolean
  /** Position innerhalb der Lane (aufsteigend). */
  order: number
  createdAt: string
}

/** employees/{id}/todos/{todoId} — ein Dokument je Todo. */
export interface BoardTodosDoc {
  todos: BoardTodo[]
}

// Planung — Wochen-/Monats-/Jahresplanung je Führungskraft (siehe
// src/components/sections/Planung.tsx). Keine Legacy-Entsprechung; Aufbau/
// Kennzahlen aus Finova_Controlling.html (Wochenplan/Monatsplan/Jahresplanung-
// Panels) übernommen, dabei "Umsatz €" durch Einheiten ersetzt, damit es zum
// Rest des Dashboards passt (Karrierepläne/Soll-Ist rechnen ebenfalls in EH).
// Bewusst komplett getrennt von den Einheiten (rows/AT/BT/ET) — kein
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

/** employees/{id}/planWeeks/{YYYY-Www} — in der App zu entries je Mitarbeitername zusammengesetzt. */
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

/** employees/{id}/planMonthNotes/{YYYY-MM} — in der App zu entries je Mitarbeitername zusammengesetzt. */
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
 * employees/{fkId}/planAnnual/{YYYY} — je Führungskraft ein eigenes
 * Dokument (planManagerKey in lib/calc/planung.ts), sonst würden sich alle
 * Führungskräfte ein gemeinsames Jahresziel teilen.
 */
export interface PlanAnnualDoc {
  targets: Record<PlanTargetKey, number>
  quarters: Record<PlanQuarter, PlanQuarterData>
}

export const STARTER_GOAL: TeamGoal = {
  note: "",
  recruitGoal: 6,
  recruitActual: null,
  ...defaultPeriod(),
}

// Umsatzverfolgung (Controlling): eine Zeile je Rechner-Position, die im EH-Rechner gebucht wurde.
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
