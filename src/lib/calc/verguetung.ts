// Vergütung je Karriereplan — Einheiten werden pro Sparte (Insurance/Investment/
// Credit/Real Estate) geführt und mit dem Stufensatz der jeweiligen Person
// bewertet. Zusätzlich verdienen Führungskräfte ab Teamleiter an der Produktion
// ihres gesamten Unterbaums die Satzdifferenz zur nächsttieferen Führungsebene
// (Differenzvergütung), analog zur Logik im Umdrehrechner (umdreh.ts), aber
// über beliebig viele Führungsebenen kaskadierend statt nur Berater→FK.
//
// Kernregel bei Gleichstand zweier Führungskräfte auf derselben Stufe (mit dem
// Nutzer abgestimmt): NUR die obere der beiden gleichrangigen Führungskräfte
// bekommt einen Bonus von 0,50 €/EH — die untere (die den Satz bereits über
// eine echte Differenz oder als Produzent erreicht hat) bekommt nichts on top.
// Dieser Bonus ist ein reiner Zuschlag, kein Abzug von einer höheren Ebene: die
// Differenzbeträge selbst bleiben immer exakt Satz-oben minus Satz-unten.
// Pro erreichter Satzstufe (Kette-Plateau) ist höchstens 1x ein Gleichstand-
// Bonus möglich — eine dritte gleichrangige Person auf derselben Stufe bekommt
// nichts mehr, erst eine echte höhere Stufe eröffnet wieder eine neue Chance.
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
      // Pro direktem Unterbau-Kind (fromName) und Art (kind) nur eine Zeile:
      // Produktion, die tiefer im Unterbaum dieses Kindes entsteht, wird hier
      // dazugerechnet statt als eigene Zeile je Ursprungs-Produzent zu erscheinen.
      const sources = earnings.diff[planId].sources
      const existing = sources.find((s) => s.fromName === fromName && s.kind === kind)
      if (existing) {
        existing.units += units
        existing.amount += amount
      } else {
        sources.push({ fromName, units, ratePerUnit, amount, kind })
      }
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

      // c: bereits durch echte Differenz abgedeckter Satz (startet beim eigenen
      // Satz des Produzenten). tieUsedAtLevel: ob auf dem aktuellen Satz-Plateau
      // bereits ein Gleichstand-Bonus vergeben wurde — wird bei jeder echten
      // Differenz (neues Plateau) zurückgesetzt, sodass pro Stufe höchstens 1x
      // ein Bonus möglich ist.
      let c = producerRate
      let tieUsedAtLevel = false
      // Wer in der Anzeige als "Von" erscheint: das direkte Unterbau-Kind auf
      // dem Weg zur jeweils gutgeschriebenen Führungskraft, nicht der ganz
      // unten stehende Ursprungs-Produzent — Produktion, die tiefer im
      // Unterbau dieses Kindes entsteht, wird so bei dessen direktem Chef
      // gebündelt (z. B. Josef/Nico unter David, David/Noah unter Erik) statt
      // als einzelne Zeile je Ursprungs-Produzent aufzuscheinen.
      let fromName = producer.name
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
            credit(manager.name, planId, "differenz", u, rA - c, fromName)
            c = rA
            tieUsedAtLevel = false
          } else if (rA > 0 && rA === c && !tieUsedAtLevel) {
            // Nur die obere Seite des Gleichstands bekommt den Bonus — die
            // untere (Produzent oder bereits per Differenz bezahlte Führungs-
            // kraft) hat ihren Anteil schon erhalten.
            credit(manager.name, planId, "gleichstand", u, 0.5, fromName)
            tieUsedAtLevel = true
          }
        }
        fromName = manager.name
        managerName = manager.managerName
      }
    })
  })

  return result
}
