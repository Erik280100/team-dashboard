// Stufe je Karriereplan. Ab Teamleiter gilt die Strukturbaum-Rolle in allen Plänen gleich; Trainees (FT1–FT4)
// sind in jedem Plan getrennt eingestuft und starten dort bei FT1. Die Stufe ergibt sich aus den kumulierten
// Einheiten je Plan (EmployeeRow.careerUnits, wird beim Monatsabschluss nicht zurückgesetzt).
//
// Steigt ein Trainee mitten im Monat auf, bekommen nur die Einheiten ab Erreichen der Schwelle den höheren
// Satz (stageSegments): Die Monatseinheiten `u` belegen auf der Zähler-Achse das Intervall [C − u, C]; je Stufe
// zählt die Überlappung mit dem Stufen-Intervall. Dafür braucht es keine Zeitstempel.
import { isLeadRole, type PlanId } from "./struktur"

export const TRAINEE_PLAN_IDS = ["insurance", "investment", "credit", "realestate"] as const
export type TraineePlanId = (typeof TRAINEE_PLAN_IDS)[number]

export type CareerUnits = Partial<Record<TraineePlanId, number>>

export interface PlanStep {
  role: string
  /** Kumulierte Einheiten im Plan, ab denen diese Stufe gilt. */
  units: number
}

/** Aufsteigend je Plan; der letzte Eintrag ist das Ende der Plan-Leiter (danach nur noch über Teamleiter). */
export const PLAN_STAGE_LADDER: Record<TraineePlanId, PlanStep[]> = {
  insurance: [
    { role: "FT1", units: 0 },
    { role: "FT2", units: 1000 },
    { role: "FT3", units: 2000 },
    { role: "FT4", units: 4000 },
  ],
  realestate: [
    { role: "FT1", units: 0 },
    { role: "FT2", units: 1000 },
  ],
  credit: [
    { role: "FT1", units: 0 },
    { role: "FT2", units: 2000 },
    { role: "FT3", units: 4000 },
  ],
  // investment und investmentVb zählen zusammen (siehe basePlanOf).
  investment: [
    { role: "FT1", units: 0 },
    { role: "FT2", units: 1000 },
    { role: "FT3", units: 2000 },
  ],
}

/** Trainee = alles unterhalb von Teamleiter (FT1–FT4, unbekannte Rollen zählen wie FT1). */
export function isTraineeRole(role: string): boolean {
  return !isLeadRole(role)
}

/** "FT 2" -> "FT2"; liefert null, wenn die Rolle keine FT1–FT4-Stufe ist. */
function ftRole(role: string): string | null {
  const m = (role || "").replace(/\s+/g, "").match(/^FT([1-4])$/i)
  return m ? `FT${m[1]}` : null
}

/** Karrierezähler, auf den ein Plan einzahlt: investmentVb läuft über Investment. */
export function basePlanOf(planId: PlanId): TraineePlanId | null {
  if (planId === "investmentVb") return "investment"
  return (TRAINEE_PLAN_IDS as readonly string[]).includes(planId) ? (planId as TraineePlanId) : null
}

/** Einheiten-Delta einer Buchung auf die Karrierezähler abbilden (investmentVb -> investment). */
export function careerDeltaOf(delta: Partial<Record<PlanId, number>>): Record<TraineePlanId, number> {
  return {
    insurance: Number(delta.insurance) || 0,
    investment: (Number(delta.investment) || 0) + (Number(delta.investmentVb) || 0),
    credit: Number(delta.credit) || 0,
    realestate: Number(delta.realestate) || 0,
  }
}

export function planLadderStage(planId: TraineePlanId, units: number): { index: number; step: PlanStep; next: PlanStep | null } {
  const ladder = PLAN_STAGE_LADDER[planId]
  let index = 0
  ladder.forEach((s, i) => { if (units >= s.units) index = i })
  return { index, step: ladder[index], next: ladder[index + 1] ?? null }
}

/** Einheiten-Schwelle der Insurance-Stufe einer FT-Rolle (0 für alles andere). */
function insuranceThreshold(role: string): number {
  const r = ftRole(role)
  return PLAN_STAGE_LADDER.insurance.find((s) => s.role === r)?.units ?? 0
}

/**
 * Kumulierter Stand einer Person in einem Plan. In Insurance ist die Strukturbaum-Rolle (FT1–FT4) die
 * Untergrenze — Altbestand ohne Zähler und manuelle Beförderungen fallen so nie auf eine niedrigere Stufe zurück.
 */
export function careerTotal(row: { role: string; careerUnits?: CareerUnits }, base: TraineePlanId): number {
  const counter = Number(row.careerUnits?.[base]) || 0
  return base === "insurance" ? Math.max(counter, insuranceThreshold(row.role)) : counter
}

/** Stufe einer Person in einem Karriereplan (für den Stufensatz, aktueller Stand). */
export function planStageOf(row: { role: string; careerUnits?: CareerUnits }, planId: PlanId): string {
  const base = basePlanOf(planId)
  if (!base || !isTraineeRole(row.role)) return row.role
  // Insurance: nur FT-Rollen sind Plan-Stufen, andere Rollenbezeichnungen behalten ihr bisheriges Verhalten.
  if (base === "insurance" && !ftRole(row.role)) return row.role
  return planLadderStage(base, careerTotal(row, base)).step.role
}

export interface StageSegment {
  role: string
  units: number
}

/**
 * Teilt die Monatseinheiten einer Person in einem Plan nach Stufe auf: erst die Einheiten bis zur Schwelle zum
 * Satz der alten Stufe, die danach zum Satz der neuen. `units` sind die Monatseinheiten je Plan der Person
 * (readPlanUnits). Investment und Investment mit VB teilen einen Zähler; ihre Anteile werden proportional
 * zu ihren Einheiten verteilt. Führungskräfte (und Rollen ohne Plan-Stufen) liefern ein Segment mit ihrer Rolle.
 */
export function stageSegments(
  row: { role: string; careerUnits?: CareerUnits },
  planId: PlanId,
  units: Record<PlanId, number>
): StageSegment[] {
  const u = Number(units[planId]) || 0
  if (u <= 0) return []
  const base = basePlanOf(planId)
  if (!base || !isTraineeRole(row.role) || (base === "insurance" && !ftRole(row.role))) {
    return [{ role: row.role, units: u }]
  }
  const group = base === "investment" ? (Number(units.investment) || 0) + (Number(units.investmentVb) || 0) : u
  const counter = Number(row.careerUnits?.[base]) || 0
  // Zähler noch nicht nachgezogen (Altbestand / manuelle Beförderung): nichts rückwirkend billiger rechnen.
  const behindRole = base === "insurance" && counter < insuranceThreshold(row.role)
  const end = behindRole ? insuranceThreshold(row.role) + group : Math.max(counter, group)
  const start = end - group
  const ladder = PLAN_STAGE_LADDER[base]
  const out: StageSegment[] = []
  ladder.forEach((step, i) => {
    const hi = ladder[i + 1]?.units ?? Infinity
    const overlap = Math.min(end, hi) - Math.max(start, step.units)
    if (overlap > 0) out.push({ role: step.role, units: (overlap / group) * u })
  })
  return out
}

/**
 * Abgleich der Insurance-Stufe eines Trainees zwischen Strukturbaum-Rolle und Zähler (nur aufwärts):
 * - Zähler über der Rolle -> Rolle im Strukturbaum anheben,
 * - Rolle über dem Zähler (manuell befördert / Altbestand) -> Zähler auf die Schwelle der Rolle plus die
 *   bereits gebuchten Monatseinheiten nachziehen.
 * Führungskräfte und Rollen außerhalb FT1–FT4 bleiben unberührt.
 */
export function insuranceReconcile(
  role: string,
  careerInsurance: number,
  monthInsuranceUnits: number
): { role?: string; careerInsurance?: number } {
  const r = ftRole(role)
  if (!r) return {}
  const ladder = PLAN_STAGE_LADDER.insurance
  const roleIdx = ladder.findIndex((s) => s.role === r)
  const counterIdx = planLadderStage("insurance", Number(careerInsurance) || 0).index
  if (counterIdx > roleIdx) return { role: ladder[counterIdx].role }
  if (roleIdx > counterIdx) return { careerInsurance: ladder[roleIdx].units + Math.max(0, Number(monthInsuranceUnits) || 0) }
  return {}
}
