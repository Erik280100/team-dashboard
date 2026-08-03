// Strukturbaum (Org-Chart) — reine Baum-Traversierungs- und Layout-Helfer,
// 1:1 portiert aus legacy/index.html:4113–4334 (sb*-Funktionsfamilie).
// sbGetRoleForName/sbGetRateForRole nahmen im Original die Module-globalen
// sbTree/sbRoleRates implizit entgegen — hier explizit parametrisiert, sonst
// identisches Verhalten. Golden-Master-Test: test/calc/struktur.golden.test.ts.

export interface SbNode {
  id: string
  name: string
  role?: string
  children?: SbNode[]
  color?: string | null
  status?: string | null
  notes?: { text: string }[]
  // Layout-Ausgabe von sbLayout (wird auf dem Knoten mutiert, wie im Original):
  x?: number
  y?: number
  d?: number
}

// ---- Layout-Konstanten (legacy/index.html:4120) ----
export const SB_NW = 138
export const SB_NH = 52
export const SB_HG = 32
export const SB_VG = 84

export const SB_AVATAR_COLORS = [
  "#0B1F2A",
  "#155767",
  "#6d28d9",
  "#0e7490",
  "#065f46",
  "#92400e",
]

export const SB_COLORS = [
  { key: "red", label: "Rot", hex: "#DC2626", text: "#fff" },
  { key: "orange", label: "Orange", hex: "#EA580C", text: "#fff" },
  { key: "yellow", label: "Gelb", hex: "#EAB308", text: "#1A1A1A" },
  { key: "green", label: "Grün", hex: "#16A34A", text: "#fff" },
  { key: "blue", label: "Blau", hex: "#2563EB", text: "#fff" },
  { key: "purple", label: "Lila", hex: "#7C3AED", text: "#fff" },
] as const

export const SB_STATUS: Record<string, { label: string; color: string }> = {
  neu: { label: "Neu", color: "#2563EB" },
  vollzeit: { label: "Vollzeit", color: "#16A34A" },
  teilzeit: { label: "Teilzeit", color: "#D97706" },
  keine: { label: "Keine Zeit", color: "#DC2626" },
  vielleicht: { label: "Kommt vielleicht", color: "#64748B" },
}

// Feste Karrierestufen zur Auswahl bei "Bezeichnung / Rolle" (legacy/index.html:4141)
export const SB_ROLES = [
  "Direktor",
  "Regionalleiter",
  "Geschäftsstellenleiter",
  "Teamleiter",
  "FT4",
  "FT3",
  "FT2",
  "FT1",
]

// Führungsstufen, die ab Teamleiter differenzberechtigt sind (siehe verguetung.ts).
export const SB_LEAD_ROLES = ["Direktor", "Regionalleiter", "Geschäftsstellenleiter", "Teamleiter"]

export function isLeadRole(role: string): boolean {
  return SB_LEAD_ROLES.includes(role)
}

// ---- Karrierepläne (Einheiten-Vergütung) ----
// Die vier Sparten aus den Karriereplänen (siehe src/lib/data/career.ts /
// src/lib/calc/eh.ts EH_GROUPS — dieselben ids, hier eigenständig deklariert,
// damit struktur.ts nicht von eh.ts abhängen muss).
export const PLAN_IDS = ["insurance", "investment", "credit", "realestate"] as const
export type PlanId = (typeof PLAN_IDS)[number]

export const PLAN_LABELS: Record<PlanId, string> = {
  insurance: "Insurance",
  investment: "Investment",
  credit: "Credit",
  realestate: "Real Estate",
}

/**
 * Euro pro Einheit je Karrierestufe und Karriereplan, aus den Karriereplänen
 * übernommen (Stand: Nutzerangabe 2026-07-30). Dient als Vorbelegung im
 * Stufensätze-Dialog (StrukturBaum.tsx) und als Fallback, solange kein
 * OrgChartDoc.planRates gespeichert ist.
 */
export const DEFAULT_PLAN_RATES: Record<PlanId, Record<string, number>> = {
  insurance: {
    Direktor: 8,
    Regionalleiter: 7,
    Geschäftsstellenleiter: 5.5,
    Teamleiter: 4,
    FT4: 3,
    FT3: 2.5,
    FT2: 2,
    FT1: 1,
  },
  investment: {
    Direktor: 6.5,
    Regionalleiter: 5.5,
    Geschäftsstellenleiter: 4.5,
    Teamleiter: 3.5,
    FT4: 2.5,
    FT3: 2.5,
    FT2: 2,
    FT1: 1,
  },
  credit: {
    Direktor: 4,
    Regionalleiter: 4,
    Geschäftsstellenleiter: 3,
    Teamleiter: 3,
    FT4: 2.5,
    FT3: 2.5,
    FT2: 2,
    FT1: 1,
  },
  realestate: {
    Direktor: 2.5,
    Regionalleiter: 2.25,
    Geschäftsstellenleiter: 2,
    Teamleiter: 1.75,
    FT4: 1.5,
    FT3: 1.5,
    FT2: 1.5,
    FT1: 1,
  },
}

export function sbGetPlanRate(
  planRates: Record<PlanId, Record<string, number>>,
  role: string,
  planId: PlanId
): number {
  return Number(planRates?.[planId]?.[role]) || 0
}

/** Alle Knoten des Teilbaums (inkl. n selbst) als flache Liste. */
export function sbAll(n: SbNode, a: SbNode[] = []): SbNode[] {
  a.push(n)
  ;(n.children || []).forEach((c) => sbAll(c, a))
  return a
}

/** Knoten mit gegebener id suchen (Tiefensuche). */
export function sbFind(n: SbNode, id: string): SbNode | null {
  if (n.id === id) return n
  for (const c of n.children || []) {
    const f = sbFind(c, id)
    if (f) return f
  }
  return null
}

/** Knoten mit exakt passendem (getrimmtem, case-insensitivem) Namen suchen. */
export function sbFindByName(n: SbNode | null, name: string): SbNode | null {
  const target = (name || "").trim().toLowerCase()
  if (!target || !n) return null
  if ((n.name || "").trim().toLowerCase() === target) return n
  for (const c of n.children || []) {
    const f = sbFindByName(c, name)
    if (f) return f
  }
  return null
}

export function sbLastWord(s: string): string {
  const parts = (s || "").trim().split(/\s+/)
  return parts[parts.length - 1].toLowerCase()
}

/** Knoten suchen, dessen letztes Namenswort (Nachname) passt. */
export function sbFindByLastName(n: SbNode | null, lastName: string): SbNode | null {
  if (!n || !lastName) return null
  if (sbLastWord(n.name) === lastName) return n
  for (const c of n.children || []) {
    const f = sbFindByLastName(c, lastName)
    if (f) return f
  }
  return null
}

/**
 * App-weiter Zugriff auf die im Strukturbaum hinterlegte Karrierestufe einer Person.
 * Strukturbaum-Knoten tragen oft nur den Nachnamen, die Mitarbeiterliste den vollen
 * Namen — daher erst exakter Abgleich, dann Fallback auf Nachnamen-Abgleich.
 */
export function sbGetRoleForName(tree: SbNode | null, name: string): string {
  if (!tree) return ""
  let n = sbFindByName(tree, name)
  if (!n) n = sbFindByLastName(tree, sbLastWord(name))
  return n ? n.role || "" : ""
}

export function sbGetRateForRole(
  roleRates: Record<string, number>,
  role: string
): number {
  return Number(roleRates[role]) || 0
}

export interface RosterEntry {
  name: string
  role: string
  status: string | null
  managerName: string | null
  depth: number
}

/**
 * Mitarbeiterliste aus dem Strukturbaum ableiten (Pre-Order, wie sbAll),
 * für die Spiegelung auf der Mitarbeiter-Seite (analog zur Anwesenheitsliste,
 * die sbAll direkt nutzt). Personen mit Status "vielleicht" (Kommt vielleicht)
 * werden ausgelassen — sie haben laut Fachlichkeit ohnehin keinen Unterbaum,
 * darunterliegende Kinder erben trotzdem den nächsten sichtbaren Vorgesetzten.
 */
export function sbRoster(tree: SbNode | null): RosterEntry[] {
  if (!tree) return []
  const out: RosterEntry[] = []
  function walk(n: SbNode, managerName: string | null, depth: number) {
    const visible = n.status !== "vielleicht"
    if (visible) {
      out.push({ name: n.name, role: n.role || "", status: n.status ?? null, managerName, depth })
    }
    const nextManager = visible ? n.name : managerName
    const nextDepth = visible ? depth + 1 : depth
    ;(n.children || []).forEach((c) => walk(c, nextManager, nextDepth))
  }
  walk(tree, null, 0)
  return out
}

/** Breite des Teilbaums unter n (für die horizontale Zentrierung beim Layout). */
export function sbSubtreeWidth(n: SbNode): number {
  if (!n.children || !n.children.length) return SB_NW
  return Math.max(
    SB_NW,
    n.children.reduce((s, c) => s + sbSubtreeWidth(c) + SB_HG, -SB_HG)
  )
}

/**
 * Weist jedem Knoten im Teilbaum x/y/d (Tiefe) zu — mutiert die Knoten wie im
 * Original (sb-Funktionen sind bewusst nicht rein, um Layout-State auf dem
 * bereits vorhandenen Baum-Objekt zu cachen).
 */
export function sbLayout(n: SbNode, x: number, y: number, d: number): void {
  const w = sbSubtreeWidth(n)
  n.x = x + (w - SB_NW) / 2
  n.y = y
  n.d = d
  if (n.children && n.children.length) {
    let cx = x
    n.children.forEach((c) => {
      const cw = sbSubtreeWidth(c)
      sbLayout(c, cx, y + SB_NH + SB_VG, d + 1)
      cx += cw + SB_HG
    })
  }
}

export function sbLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: string,
  w: number
): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"/>`
}

export function sbEsc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>")
}
