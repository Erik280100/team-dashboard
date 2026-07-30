// Firestore-Dokumentformen + Startdaten — 1:1 aus der Legacy-App übernommen
// (legacy/index.html:2248–2283, 4151–4177), damit neue und alte App exakt
// dieselben Datenstrukturen lesen/schreiben.
import { defaultPeriod, type EmployeeRow, type TeamGoal } from "@/lib/calc/format"
import type { PlanId, SbNode } from "@/lib/calc/struktur"

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

export const STORAGE_KEY = "finova_dashboard_data_v1"
export const GOAL_KEY = "finova_dashboard_goal_v1"
export const HISTORY_KEY = "finova_dashboard_history_v1"
export const ATTENDANCE_KEY = "finova_dashboard_attendance_v1"
export const SB_STORAGE_KEY = "finova_orgchart_data_v1"

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

export const STARTER_DATA: EmployeeRow[] = [
  starterEmployee("Georg Kögerl", false),
  starterEmployee("Elias Karner", false),
  starterEmployee("Michael Posch", false),
  starterEmployee("Tobias Zika", false),
  starterEmployee("Tobias Trinker", false),
  starterEmployee("David Lanicsek", false),
  starterEmployee("Theresa Wagner", false),
  starterEmployee("Isabella Zöhrer", false),
  starterEmployee("Floria Cotirla", false),
  starterEmployee("Delia Podlipnig", false),
  starterEmployee("Sito Eckelhardt", false),
  starterEmployee("Valentino Kahr", false),
  starterEmployee("Denise Stickl", false),
  starterEmployee("Madeleine Zugschwert", false),
  starterEmployee("Kevin Hödl", false),
  starterEmployee("Luis Simhandel", false),
  starterEmployee("David Schrey", true),
  starterEmployee("Erik Bindar", true),
  starterEmployee("Lisa Simeon", true),
  starterEmployee("Noah Vanek", true),
  starterEmployee("Nico Kiem", true),
  starterEmployee("Josef Nagel", true),
]

export const SB_DEFAULT_TREE: SbNode = {
  id: "koegerl",
  name: "Kögerl",
  role: "Geschäftsstellenleiter",
  children: [
    { id: "poetsn", name: "Pütün", role: "FT4", children: [] },
    {
      id: "bindlar",
      name: "Bindar",
      role: "Geschäftsstellenleiter",
      children: [
        { id: "vanek", name: "Vanek", role: "Mitarbeiter", children: [] },
        {
          id: "schrey",
          name: "Schrey",
          role: "Mitarbeiterin",
          children: [
            { id: "niem", name: "Niem", role: "Mitarbeiter", children: [] },
            { id: "nagl", name: "Nagl", role: "Mitarbeiterin", children: [] },
          ],
        },
      ],
    },
    {
      id: "posch",
      name: "Posch",
      role: "Teamleiter",
      children: [
        {
          id: "hoedl",
          name: "Hödl",
          role: "FT 2",
          children: [{ id: "skarget", name: "Skarget", role: "FT 1", children: [] }],
        },
        { id: "moser", name: "Moser", role: "FT 1", children: [] },
      ],
    },
    { id: "podlipnig", name: "Podlipnig", role: "FT 3", children: [] },
    {
      id: "karner",
      name: "Karner",
      role: "Geschäftsstellenleiter",
      children: [
        {
          id: "kahr",
          name: "Kahr",
          role: "FT 3",
          children: [{ id: "cortirila", name: "Cortirila", role: "FT 1", children: [] }],
        },
        { id: "ekelhardt", name: "Ekelhardt", role: "FT 4", children: [] },
        { id: "simion", name: "Simion", role: "FT 3", children: [] },
        { id: "gaenser", name: "Gänser", role: "FT 4", children: [] },
      ],
    },
  ],
}
