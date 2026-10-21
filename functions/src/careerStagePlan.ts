// Automatische Insurance-Stufe für Trainees, rein rechnerisch (kein Firestore-Zugriff, siehe careerStage.ts).
// Die Entscheidung selbst (insuranceReconcile) stammt aus dem Browser-Code in ../../src/lib/calc/planStufen.ts
// und kommt über das gebündelte lib/shared.cjs herein — Server und Browser entscheiden damit gleich.
type Obj = Record<string, unknown>

export interface CareerShared {
  insuranceReconcile: (role: string, careerInsurance: number, monthInsuranceUnits: number) => { role?: string; careerInsurance?: number }
}

/** Insurance-Einheiten des laufenden Monats (Altbestand ohne ehByPlan: `ist` zählt als Insurance, wie readPlanUnits). */
export function monthInsuranceUnits(data: Obj): number {
  const byPlan = data.ehByPlan as Obj | undefined
  return Number(byPlan ? byPlan.insurance : data.ist) || 0
}

export interface CareerChange {
  id: string
  /** Neue Rolle im Strukturbaum (Zähler ist weiter als die Rolle). */
  role?: string
  /** Neuer Wert für careerUnits.insurance (Rolle ist weiter als der Zähler). */
  careerInsurance?: number
}

/** Was muss für diesen Mitarbeiter geändert werden? null = nichts. Nur Aufwärtsbewegungen, nur Trainees. */
export function planCareerChange(id: string, data: Obj, shared: CareerShared): CareerChange | null {
  if (data.active === false) return null
  const counter = Number((data.careerUnits as Obj | undefined)?.insurance) || 0
  const result = shared.insuranceReconcile(String(data.role ?? ""), counter, monthInsuranceUnits(data))
  if (result.role === undefined && result.careerInsurance === undefined) return null
  return { id, ...result }
}

interface TreeNode {
  id: string
  role?: string
  children?: TreeNode[]
}

/**
 * Rollen im Strukturbaum anheben (Knoten-ID = Mitarbeiter-ID). Mutiert `tree`, liefert die tatsächlich geänderten
 * IDs. Ein Knoten wird nur geändert, wenn seine aktuelle Rolle noch eine niedrigere FT-Stufe ist — so überschreibt
 * ein gleichzeitig von Hand geänderter Baum nichts.
 */
export function applyRoleChanges(tree: TreeNode, roles: Map<string, string>): string[] {
  const order = ["FT1", "FT2", "FT3", "FT4"]
  const rank = (r: string | undefined) => order.indexOf((r ?? "").replace(/\s+/g, "").toUpperCase())
  const changed: string[] = []
  const walk = (n: TreeNode) => {
    const next = roles.get(n.id)
    if (next !== undefined && rank(n.role) !== -1 && rank(next) > rank(n.role)) {
      n.role = next
      changed.push(n.id)
    }
    ;(n.children ?? []).forEach(walk)
  }
  walk(tree)
  return changed
}
