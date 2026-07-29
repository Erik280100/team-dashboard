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
  "Kundenberater",
  "FT4",
  "FT3",
  "FT2",
  "FT1",
]

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
