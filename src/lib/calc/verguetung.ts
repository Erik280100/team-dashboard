// Vergütung je Karriereplan — Einheiten werden pro Sparte (Insurance/Investment/
// Credit/Real Estate) geführt und mit dem Stufensatz der jeweiligen Person
// bewertet. Zusätzlich verdienen Führungskräfte ab Teamleiter an der Produktion
// ihres gesamten Unterbaums die Satzdifferenz zur nächsttieferen Führungsebene
// (Differenzvergütung), analog zur Logik im Umdrehrechner (umdreh.ts), aber
// über beliebig viele Führungsebenen kaskadierend statt nur Berater→FK.
//
// Kernregel bei Gleichstand zweier Führungskräfte auf derselben Stufe (mit dem
// Nutzer abgestimmt): die untere Person wird um 0,50 €/EH aufgestockt, die
// direkt darüberliegende Person bekommt ebenfalls 0,50 €/EH — beides zusammen
// (1,00 €/EH) geht der nächsthöheren Ebene ab. In Summe wird über die ganze
// Kette stets exakt der Satz der obersten erreichten Stufe ausgeschüttet.
//
// Wichtig: Differenzvergütung läuft ausschließlich entlang der eigenen
// Vorgesetztenkette (MergedRow.managerName) des Produzenten — Führungskräfte in
// Seitenzweigen der Struktur werden nie erreicht und bekommen nichts.
import type { EmployeeRow } from "./format"
import { PLAN_IDS, isLeadRole, sbGetPlanRate, type PlanId } from "./struktur"
import type { MergedRow } from "./team"

/** Einheiten je Plan aus einer Mitarbeiterzeile lesen. Fehlt ehByPlan (Altbestand
 * vor der Karrierepläne-Aufteilung), gilt der bisherige Gesamtwert `ist` als
 * reine Insurance-Produktion — das reproduziert das bis dahin gültige Verhalten
 * (ist × Insurance-Satz), ohne dass eine Migration nötig ist. */
export function readPlanUnits(row: Pick<EmployeeRow, "ist" | "ehByPlan">): Record<PlanId, number> {
  const out = {} as Record<PlanId, number>
  PLAN_IDS.forEach((p) => (out[p] = 0))
  if (row.ehByPlan) {
    PLAN_IDS.forEach((p) => (out[p] = Number(row.ehByPlan?.[p]) || 0))
  } else {
    out.insurance = Number(row.ist) || 0
  }
  return out
}

export function sumPlanUnits(units: Record<PlanId, number>): number {
  return PLAN_IDS.reduce((s, p) => s + (Number(units[p]) || 0), 0)
}

/** Setzt die Plan-Einheiten einer Zeile und hält `ist` als Summe synchron.
 * Mutiert `row` nicht. */
export function withPlanUnits(row: EmployeeRow, units: Record<PlanId, number>): EmployeeRow {
  const ehByPlan: NonNullable<EmployeeRow["ehByPlan"]> = {}
  PLAN_IDS.forEach((p) => (ehByPlan[p] = Number(units[p]) || 0))
  return { ...row, ehByPlan, ist: sumPlanUnits(units) }
}

export type EarningKind = "eigen" | "differenz" | "gleichstand"

export interface PlanEarning {
  units: number
  rate: number
  amount: number
}

export interface DiffSource {
  /** Name der Person, deren Produktion diese Gutschrift ausgelöst hat. */
  fromName: string
  units: number
  ratePerUnit: number
  amount: number
  kind: EarningKind
}

export interface EmployeeEarnings {
  name: string
  /** Eigenproduktion je Plan (inkl. eigener Gleichstands-Aufstockung). */
  own: Record<PlanId, PlanEarning>
  /** Differenz-/Gleichstandsanteile aus fremder Produktion, je Plan mit Quellen. */
  diff: Record<PlanId, { amount: number; sources: DiffSource[] }>
  ownTotal: number
  diffTotal: number
  total: number
}

function emptyEarnings(name: string): EmployeeEarnings {
  const own = {} as Record<PlanId, PlanEarning>
  const diff = {} as Record<PlanId, { amount: number; sources: DiffSource[] }>
  PLAN_IDS.forEach((p) => {
    own[p] = { units: 0, rate: 0, amount: 0 }
    diff[p] = { amount: 0, sources: [] }
  })
  return { name, own, diff, ownTotal: 0, diffTotal: 0, total: 0 }
}

// Schutz gegen zyklische managerName-Ketten (sollte im Strukturbaum nicht
// vorkommen, da Bäume kreisfrei sind — trotzdem defensiv abgesichert).
const MAX_CHAIN_DEPTH = 64

/**
 * Berechnet für jede Person in `merged` die Vergütung je Karriereplan: eigene
 * Produktion zum eigenen Stufensatz, plus Differenzvergütung entlang der
 * eigenen Führungskette (siehe Modul-Kommentar oben für die Gleichstandsregel).
 */
export function computeEarnings(
  merged: MergedRow[],
  planRates: Record<PlanId, Record<string, number>>
): Map<string, EmployeeEarnings> {
  const byName = new Map<string, MergedRow>()
  merged.forEach((r) => byName.set(r.name, r))

  const result = new Map<string, EmployeeEarnings>()
  merged.forEach((r) => result.set(r.name, emptyEarnings(r.name)))

  function credit(
    name: string,
    planId: PlanId,
    kind: EarningKind,
    units: number,
    ratePerUnit: number,
    fromName: string
  ) {
    if (units <= 0 || ratePerUnit <= 0) return
    const amount = units * ratePerUnit
    const earnings = result.get(name)
    if (!earnings) return
    if (kind === "eigen") {
      earnings.own[planId].units += units
      earnings.own[planId].rate = ratePerUnit
      earnings.own[planId].amount += amount
      earnings.ownTotal += amount
    } else {
      earnings.diff[planId].amount += amount
      earnings.diff[planId].sources.push({ fromName, units, ratePerUnit, amount, kind })
      earnings.diffTotal += amount
    }
    earnings.total += amount
  }

  merged.forEach((producer) => {
    const units = readPlanUnits(producer)
    PLAN_IDS.forEach((planId) => {
      const u = units[planId]
      if (u <= 0) return

      const producerRate = sbGetPlanRate(planRates, producer.role, planId)
      credit(producer.name, planId, "eigen", u, producerRate, producer.name)

      // c: bereits durch die Kette abgedeckter Satz. base: höchster Stufensatz,
      // der (ohne Gleichstands-Zuschläge) in der Kette bisher erreicht wurde —
      // bestimmt, wer noch als "gleichauf" zählt.
      let c = producerRate
      let base = producerRate
      let lastName = producer.name // hält aktuell die Stufe `base`
      let managerName = producer.managerName
      const visited = new Set<string>([producer.name])
      let depth = 0

      while (managerName && depth < MAX_CHAIN_DEPTH) {
        if (visited.has(managerName)) break // Zyklenschutz
        visited.add(managerName)
        const manager = byName.get(managerName)
        if (!manager) break
        depth++

        if (isLeadRole(manager.role)) {
          const rA = sbGetPlanRate(planRates, manager.role, planId)
          if (rA > c) {
            credit(manager.name, planId, "differenz", u, rA - c, producer.name)
            c = rA
            base = rA
            lastName = manager.name
          } else if (rA > 0 && rA === base) {
            credit(lastName, planId, "gleichstand", u, 0.5, producer.name)
            credit(manager.name, planId, "gleichstand", u, 0.5, producer.name)
            c += 1
            lastName = manager.name
            // base bleibt bewusst unverändert: eine dritte gleichstufige Person
            // gilt wieder als "gleichauf" zu base, nicht zum bereits erhöhten c.
          }
        }
        managerName = manager.managerName
      }
    })
  })

  return result
}
