// Stufe je Karriereplan. Ab Teamleiter gilt die Strukturbaum-Rolle in allen Plänen gleich; Trainees (FT1–FT4)
// sind in Investment, Credit und Real Estate getrennt eingestuft und starten dort bei FT1. Die Stufe ergibt
// sich aus den kumulierten Einheiten je Plan (EmployeeRow.careerUnits, wird beim Monatsabschluss nicht
// zurückgesetzt). Insurance folgt weiterhin der Strukturbaum-Rolle.
import { isLeadRole, type PlanId } from "./struktur"

export const TRAINEE_PLAN_IDS = ["investment", "credit", "realestate"] as const
export type TraineePlanId = (typeof TRAINEE_PLAN_IDS)[number]

export type CareerUnits = Partial<Record<TraineePlanId, number>>

export interface PlanStep {
  role: string
  /** Kumulierte Einheiten im Plan, ab denen diese Stufe gilt. */
  units: number
}

/** Aufsteigend je Plan; der letzte Eintrag ist das Ende der Plan-Leiter (danach nur noch über Teamleiter). */
export const PLAN_STAGE_LADDER: Record<TraineePlanId, PlanStep[]> = {
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

/** Karrierezähler, auf den ein Plan einzahlt: investmentVb läuft über Investment, Insurance hat keinen. */
export function basePlanOf(planId: PlanId): TraineePlanId | null {
  if (planId === "investmentVb") return "investment"
  return (TRAINEE_PLAN_IDS as readonly string[]).includes(planId) ? (planId as TraineePlanId) : null
}

/** Einheiten-Delta einer Buchung auf die Karrierezähler abbilden (investmentVb -> investment). */
export function careerDeltaOf(delta: Partial<Record<PlanId, number>>): Record<TraineePlanId, number> {
  return {
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

/** Stufe einer Person in einem Karriereplan (für den Stufensatz). */
export function planStageOf(row: { role: string; careerUnits?: CareerUnits }, planId: PlanId): string {
  const base = basePlanOf(planId)
  if (!base || !isTraineeRole(row.role)) return row.role
  return planLadderStage(base, Number(row.careerUnits?.[base]) || 0).step.role
}
