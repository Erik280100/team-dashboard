// Beförderungs-Fortschritt je Mitarbeiter — Kriterien 1:1 aus dem Insurance-
// Karriereplan (Stand Februar 2022) übernommen; die Kundenberater-Schiene ist
// bewusst ausgelassen (siehe Kommentare unten). Gilt laut Nutzerangabe für alle
// vier Sparten gleichermaßen.
//
// Bewusst NICHT abgebildet (keine Datenbasis in der App bzw. explizit
// ausgeklammert): Realisierungsquote ≥80%, die Wartezeit von vier Quartalen ab
// Teamleiter, die Stichtage ("spätestens bis 1–2 Quartale vor der
// Beförderung"), die schriftliche Bestätigung durch die Geschäftsführung, der
// Maklergewerbe-Nachweis sowie die Sprungregel Trainee→Geschäftsstellenleiter.
//
// Getroffene Annahmen:
// 1. "Eigenproduktion" = die im Tool erfassten Insurance-Einheiten der Person
//    (ehByPlan.insurance bzw. bei Altbestand `ist`, siehe readPlanUnits in
//    verguetung.ts). Kein eigenes Historien-Feld — Zugriff ausschließlich über
//    eigenproduktion()/gesamtproduktion() unten, damit sich das bei Bedarf an
//    einer Stelle austauschen lässt.
// 2. Die Quartals-Schwellen (Gesamtproduktion über 1 bzw. 2 Quartale) werden
//    auf ein Monatsziel heruntergerechnet (Schwelle / (Quartale × 3)), weil die
//    App nur den laufenden Umsatzmonat führt, nicht die letzten Quartale.
// 3. Die im Original für Regionalleiter/Direktor genannte Punktregel "direkt
//    angeworbener Agent ab der Stufe Kundenberater = 1 Punkt" hat KEINE
//    Entsprechung in dieser App (die Kundenberater-Schiene entfällt) — FT-Agenten
//    zählen für Regionalleiter/Direktor daher 0 Punkte, anders als beim
//    Geschäftsstellenleiter, dessen eigene "ab FT2"-Regel unverändert gilt. Für
//    Regionalleiter/Direktor zählen nur direkt angeworbene Teamleiter,
//    Geschäftsstellenleiter (und für Direktor zusätzlich Regionalleiter) —
//    siehe pointWeights je StageRequirement unten.
// 4. Die Erleichterungs-Schwellen (65.000 / 350.000 / 1.000.000 EH) beziehen
//    sich im Original auf historische Gesamtproduktion; hier wird die im Tool
//    vorhandene (aktuelle) Gesamtproduktion des Unterbaus herangezogen.
// 5. Die im Original geforderten ≥300 EH Eigenumsatz/Quartal für die
//    punktemäßige Wertung eines einzelnen FT-Agenten werden NICHT geprüft
//    (Nutzerentscheidung) — ein Blick auf den Einzelumsatz einer dritten
//    Person wirkte im Panel verwirrender als hilfreich. Punkte richten sich
//    ausschließlich nach der Rolle (pointWeights je StageRequirement); die
//    Umsatz-Komponente der Beförderung läuft stattdessen vollständig über das
//    separate Gruppenproduktion-Kriterium (Person + gesamter Unterbau).
import type { MergedRow } from "./team"
import { readPlanUnits, sumPlanUnits } from "./verguetung"

/** Karriereleiter aufsteigend. Kundenberater ist bewusst nicht Teil der Leiter. */
export const CAREER_LADDER = [
  "FT1",
  "FT2",
  "FT3",
  "FT4",
  "Teamleiter",
  "Geschäftsstellenleiter",
  "Regionalleiter",
  "Direktor",
] as const

export interface StageRequirement {
  /** Stufe, die mit diesen Werten ERREICHT wird. */
  role: string
  /** Eigenproduktion (Insurance) — nur FT2..FT4. */
  ownUnits?: number
  /** Direkt oder indirekt (gesamter Unterbau) angeworbene Agenten ab FT2 — nur Teamleiter. */
  recruits?: number
  recruitsRelaxed?: number
  recruitsRelaxedFromOwnUnits?: number
  /** Punkte aus DIREKTEN Kindern. */
  points?: number
  pointsRelaxed?: number
  pointsRelaxedFromGroupUnits?: number
  /** Punktwert je Rolle eines direkten Kindes — pro Zielstufe unterschiedlich,
   * weil der Plan pro Ebene eine andere Einstiegsstufe für den ersten Punkt
   * definiert (siehe Modul-Kommentar Annahme 3). Rollen ohne Eintrag zählen 0. */
  pointWeights?: Record<string, number>
  /** Gesamtproduktion (alle Sparten, Person + gesamter Unterbau) über `quarters` Quartale. */
  groupUnits?: number
  quarters?: number
}

export const STAGE_REQUIREMENTS: StageRequirement[] = [
  { role: "FT2", ownUnits: 1000 },
  { role: "FT3", ownUnits: 2000 },
  { role: "FT4", ownUnits: 4000 },
  {
    role: "Teamleiter",
    recruits: 3,
    recruitsRelaxed: 2,
    recruitsRelaxedFromOwnUnits: 6000,
    groupUnits: 4000,
    quarters: 1,
  },
  {
    role: "Geschäftsstellenleiter",
    points: 4,
    pointWeights: { FT2: 1, FT3: 1, FT4: 1, Teamleiter: 2 },
    pointsRelaxed: 3,
    pointsRelaxedFromGroupUnits: 65000,
    groupUnits: 20000,
    quarters: 2,
  },
  {
    role: "Regionalleiter",
    points: 12,
    pointWeights: { Teamleiter: 2, Geschäftsstellenleiter: 4 },
    pointsRelaxed: 9,
    pointsRelaxedFromGroupUnits: 350000,
    groupUnits: 75000,
    quarters: 2,
  },
  {
    role: "Direktor",
    points: 20,
    pointWeights: { Teamleiter: 2, Geschäftsstellenleiter: 4, Regionalleiter: 8 },
    pointsRelaxed: 16,
    pointsRelaxedFromGroupUnits: 1000000,
    groupUnits: 150000,
    quarters: 2,
  },
]

/** "FT 2" -> "FT2", trimmt sonst nur. Deckt die gemischten Schreibweisen aus
 * SB_DEFAULT_TREE (types/dashboard.ts) ab. */
function normRole(role: string | undefined): string {
  const trimmed = (role || "").trim()
  const m = trimmed.match(/^FT\s*([1-4])$/i)
  return m ? `FT${m[1]}` : trimmed
}

/** Rang auf der Karriereleiter. Unbekannte Rollen (z. B. "Mitarbeiter") gelten
 * als FT1, damit auch neue Personen ein sichtbares nächstes Ziel bekommen. */
function rankOf(role: string): number {
  const idx = (CAREER_LADDER as readonly string[]).indexOf(role)
  return idx === -1 ? 0 : idx
}

/** Eigenproduktion = ausschließlich Insurance-Einheiten (siehe Modul-Kommentar Annahme 1). */
export function eigenproduktion(row: Pick<MergedRow, "ist" | "ehByPlan">): number {
  return readPlanUnits(row).insurance
}

/** Gesamtproduktion = Summe aller Karriereplan-Sparten. */
export function gesamtproduktion(row: Pick<MergedRow, "ist" | "ehByPlan">): number {
  return sumPlanUnits(readPlanUnits(row))
}

function pointsForChild(child: MergedRow, weights: Record<string, number>): number {
  return weights[normRole(child.role)] || 0
}

/** Niedrigste Rolle mit einem Punktwert > 0 in `weights` — für die
 * Ausschluss-Begründung ("zählt erst ab Teamleiter" statt einer Blackbox-0). */
function lowestQualifyingRole(weights: Record<string, number>): string | undefined {
  let best: string | undefined
  let bestRank = Infinity
  for (const role of Object.keys(weights)) {
    if (weights[role] <= 0) continue
    const r = rankOf(role)
    if (r < bestRank) {
      bestRank = r
      best = role
    }
  }
  return best
}

/** Warum ein direktes Kind 0 Punkte beiträgt — für die transparente Aufschlüsselung
 * im UI (siehe CriterionSource unten), damit z. B. "Erik = 4 Punkte" nicht als
 * Blackbox erscheint. Der individuelle Umsatz einer dritten Person fließt hier
 * bewusst nicht ein (siehe Annahme 5), die Umsatz-Komponente steckt separat im
 * Gruppenproduktion-Kriterium — einzige Ursache ist die Rolle. */
function pointExclusionReason(child: MergedRow, weights: Record<string, number>): string | undefined {
  if (pointsForChild(child, weights) > 0) return undefined
  const min = lowestQualifyingRole(weights)
  return min ? `zählt erst ab ${min}` : "Rolle zählt hier nicht"
}

interface SubtreeAgg {
  /** Gesamtproduktion: diese Person + gesamter Unterbau, alle Sparten. */
  groupUnits: number
  /** Direkt oder indirekt angeworbene Agenten ab FT2 im gesamten Unterbau. */
  recruits: number
}

// Schutz gegen zyklische managerName-Ketten (sollte im Strukturbaum nicht
// vorkommen, da Bäume kreisfrei sind — defensiv abgesichert, analog
// MAX_CHAIN_DEPTH in verguetung.ts).
const MAX_CHAIN_DEPTH = 64

function computeSubtree(
  name: string,
  childrenOf: Map<string, MergedRow[]>,
  byName: Map<string, MergedRow>,
  cache: Map<string, SubtreeAgg>,
  depth: number
): SubtreeAgg {
  const cached = cache.get(name)
  if (cached) return cached
  const self = byName.get(name)
  let groupUnits = self ? gesamtproduktion(self) : 0
  let recruits = 0
  if (depth < MAX_CHAIN_DEPTH) {
    const kids = childrenOf.get(name) || []
    for (const kid of kids) {
      if (rankOf(normRole(kid.role)) >= 1) recruits += 1 // FT2 oder höher
      const sub = computeSubtree(kid.name, childrenOf, byName, cache, depth + 1)
      groupUnits += sub.groupUnits
      recruits += sub.recruits
    }
  }
  const result = { groupUnits, recruits }
  cache.set(name, result)
  return result
}

export type CriterionKind = "eigenproduktion" | "mitarbeiter" | "punkte" | "gruppenproduktion"

/** Aufschlüsselung eines "punkte"/"mitarbeiter"-Kriteriums nach direkten Kindern —
 * macht z. B. "4 Punkte" oder "0 Punkte" nachvollziehbar statt einer Blackbox-Zahl. */
export interface CriterionSource {
  name: string
  role: string
  /** Beitrag dieser Person (+ bei "mitarbeiter" ihres Unterbaus) zum have-Wert. */
  value: number
  /** Gesetzt, wenn diese Person NICHT (oder nicht voll) mitzählt, mit Begründung. */
  excludedReason?: string
}

export interface Criterion {
  kind: CriterionKind
  label: string
  have: number
  need: number
  missing: number
  /** Gesetzt, wenn eine Erleichterungsregel den need-Wert gesenkt hat. */
  relaxed?: boolean
  /** Nur bei "punkte" und "mitarbeiter": Beitrag je direktem Kind. */
  sources?: CriterionSource[]
}

export interface PromotionProgress {
  currentRole: string
  /** Nächste Stufe auf der Leiter, oder null bei Direktor / unbekannter Rolle außerhalb der Leiter. */
  nextRole: string | null
  /** Nur die vom Plan tatsächlich geforderten Kriterien. */
  criteria: Criterion[]
  /** Schlechtestes Einzelkriterium (have/need), 0..1 — Basis für den Fortschrittsstreifen. */
  fraction: number
  ready: boolean
}

/**
 * Beförderungs-Fortschritt für alle Personen aus `merged` auf einmal. Baut den
 * Kinder-Index bewusst aus MergedRow.managerName (nicht aus dem Rohbaum via
 * sbAll) — sbRoster() blendet Status "vielleicht" aus und hängt deren Kinder an
 * den nächsten sichtbaren Vorgesetzten um; ein Rollup über den Rohbaum würde
 * versteckte Personen mitzählen.
 */
export function computePromotionProgress(
  merged: MergedRow[],
  requirements: StageRequirement[] = STAGE_REQUIREMENTS
): Map<string, PromotionProgress> {
  const byName = new Map<string, MergedRow>()
  const childrenOf = new Map<string, MergedRow[]>()
  merged.forEach((r) => {
    byName.set(r.name, r)
    if (r.managerName) {
      const list = childrenOf.get(r.managerName) || []
      list.push(r)
      childrenOf.set(r.managerName, list)
    }
  })

  const subtreeCache = new Map<string, SubtreeAgg>()
  const result = new Map<string, PromotionProgress>()

  merged.forEach((person) => {
    const currentRole = normRole(person.role)
    const idx = rankOf(currentRole)
    const nextRole = idx + 1 < CAREER_LADDER.length ? CAREER_LADDER[idx + 1] : null
    const requirement = nextRole ? requirements.find((r) => r.role === nextRole) ?? null : null

    const criteria: Criterion[] = []

    if (requirement?.ownUnits) {
      const have = eigenproduktion(person)
      const need = requirement.ownUnits
      criteria.push({
        kind: "eigenproduktion",
        label: "Eigenproduktion (Insurance)",
        have, need, missing: Math.max(0, need - have),
      })
    }

    if (requirement?.recruits) {
      const sub = computeSubtree(person.name, childrenOf, byName, subtreeCache, 0)
      const own = eigenproduktion(person)
      let need = requirement.recruits
      let relaxed = false
      if (
        requirement.recruitsRelaxed != null &&
        requirement.recruitsRelaxedFromOwnUnits != null &&
        own >= requirement.recruitsRelaxedFromOwnUnits
      ) {
        need = requirement.recruitsRelaxed
        relaxed = true
      }
      const kids = childrenOf.get(person.name) || []
      const sources: CriterionSource[] = kids.map((kid) => {
        const kidSub = computeSubtree(kid.name, childrenOf, byName, subtreeCache, 0)
        const value = (rankOf(normRole(kid.role)) >= 1 ? 1 : 0) + kidSub.recruits
        return {
          name: kid.name, role: normRole(kid.role), value,
          excludedReason: value === 0 ? "kein Agent ab FT2 in diesem Zweig" : undefined,
        }
      })
      criteria.push({
        kind: "mitarbeiter",
        label: "Geworbene Agenten ab FT2 (direkt oder indirekt)",
        have: sub.recruits, need, missing: Math.max(0, need - sub.recruits), relaxed, sources,
      })
    }

    if (requirement?.points) {
      const weights = requirement.pointWeights ?? {}
      const kids = childrenOf.get(person.name) || []
      const have = kids.reduce((s, k) => s + pointsForChild(k, weights), 0)
      const groupSub = computeSubtree(person.name, childrenOf, byName, subtreeCache, 0)
      let need = requirement.points
      let relaxed = false
      if (
        requirement.pointsRelaxed != null &&
        requirement.pointsRelaxedFromGroupUnits != null &&
        groupSub.groupUnits >= requirement.pointsRelaxedFromGroupUnits
      ) {
        need = requirement.pointsRelaxed
        relaxed = true
      }
      const sources: CriterionSource[] = kids.map((kid) => ({
        name: kid.name, role: normRole(kid.role),
        value: pointsForChild(kid, weights), excludedReason: pointExclusionReason(kid, weights),
      }))
      criteria.push({
        kind: "punkte",
        label: "Punkte (nur direkt angeworben)",
        have, need, missing: Math.max(0, need - have), relaxed, sources,
      })
    }

    if (requirement?.groupUnits && requirement.quarters) {
      const sub = computeSubtree(person.name, childrenOf, byName, subtreeCache, 0)
      const need = Math.round(requirement.groupUnits / (requirement.quarters * 3))
      criteria.push({
        kind: "gruppenproduktion",
        label: "Gruppenproduktion / Monat",
        have: sub.groupUnits, need, missing: Math.max(0, need - sub.groupUnits),
      })
    }

    const fraction = criteria.length === 0
      ? (nextRole ? 0 : 1)
      : Math.min(1, Math.min(...criteria.map((c) => (c.need > 0 ? c.have / c.need : 1))))
    const ready = criteria.length > 0 && criteria.every((c) => c.have >= c.need)

    result.set(person.name, { currentRole, nextRole, criteria, fraction, ready })
  })

  return result
}
