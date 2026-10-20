// Ableitung von managerId/ancestors aus dem Strukturbaum (org/structure).
// ACHTUNG: Spiegel von collectPeople() in ../../src/lib/migration/accounts.ts —
// beide Fassungen müssen gleich bleiben (Knoten-ID = Mitarbeiter-ID, Knoten mit
// status "vielleicht" werden übersprungen, ihre Kinder erben den nächsten sichtbaren Vorgesetzten).
export interface SbNode {
  id: string
  name: string
  role?: string
  status?: string | null
  children?: SbNode[]
}

export interface Person {
  id: string
  name: string
  role: string
  managerId: string | null
  ancestors: string[]
}

export function collectPeople(tree: SbNode): Person[] {
  const out: Person[] = []
  function walk(n: SbNode, mgr: Person | null) {
    const visible = n.status !== "vielleicht"
    let self: Person | null = mgr
    if (visible) {
      self = {
        id: n.id,
        name: n.name,
        role: n.role || "",
        managerId: mgr?.id ?? null,
        ancestors: mgr ? [mgr.id, ...mgr.ancestors] : [],
      }
      out.push(self)
    }
    ;(n.children || []).forEach((c) => walk(c, self))
  }
  walk(tree, null)
  return out
}

// Spiegel von SB_LEAD_ROLES/isLeadRole() in ../../src/lib/calc/struktur.ts (Führungsstufen -> Kontorolle "lead").
const SB_LEAD_ROLES = ["Direktor", "Regionalleiter", "Geschäftsstellenleiter", "Teamleiter"]
export const isLeadRole = (role: string): boolean => SB_LEAD_ROLES.includes(role)
