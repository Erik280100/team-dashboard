// Strukturbaum-Änderungen von Nicht-Admins: Wer im Baum steht, darf unterhalb des eigenen Knotens Personen
// hinzufügen, ändern, verschieben und entfernen — alles andere bleibt unberührt. Der Client schickt nur die
// Kinder des eigenen Knotens (samt Notizen/Verbindungen dieser Unterstruktur); hier wird das in den aktuellen
// Stand von org/structure eingemischt und geprüft, dass nichts außerhalb verändert wird.
export interface SbNode {
  id: string
  name: string
  role?: string
  status?: string | null
  color?: string | null
  color2?: string | null
  children?: SbNode[]
  [key: string]: unknown
}

export interface OrgNote { text: string; date: string }
export interface OrgConn { from: string; to: string; label?: string }

export interface SubtreeInput {
  children: SbNode[]
  notes: Record<string, OrgNote[]>
  conns: OrgConn[]
}

export interface OrgStructure {
  tree: SbNode
  notes: Record<string, OrgNote[]>
  conns: OrgConn[]
}

export class SubtreeError extends Error {}

const MAX_NODES = 500
const MAX_TEXT = 100
const MAX_NOTES_PER_PERSON = 50
const MAX_NOTE_LENGTH = 2000
const MAX_CONNS = 200
const LAYOUT_KEYS = ["x", "y", "d"]

/** IDs werden als Firestore-Dokumentpfad verwendet (employees/{id}) — keine "/" oder Sonderzeichen zulassen. */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
export const isValidId = (id: unknown): id is string => typeof id === "string" && ID_PATTERN.test(id)

function find(n: SbNode, id: string): SbNode | null {
  if (n.id === id) return n
  for (const c of n.children ?? []) {
    const f = find(c, id)
    if (f) return f
  }
  return null
}

function ids(n: SbNode, out = new Set<string>()): Set<string> {
  out.add(n.id)
  for (const c of n.children ?? []) ids(c, out)
  return out
}

/** Prüft und bereinigt einen eingehenden Knoten (nur bekannte Felder, keine Layout-Daten, eindeutige IDs). */
function clean(n: SbNode, seen: Set<string>): SbNode {
  if (!n || typeof n !== "object") throw new SubtreeError("Ungültiger Knoten.")
  if (!isValidId(n.id)) throw new SubtreeError("Ungültige ID (erlaubt: Buchstaben, Ziffern, _ und -, max. 64 Zeichen).")
  if (typeof n.name !== "string" || !n.name.trim()) throw new SubtreeError("Knoten ohne Namen.")
  if (n.name.length > MAX_TEXT) throw new SubtreeError("Name zu lang.")
  if (seen.has(n.id)) throw new SubtreeError(`ID doppelt: ${n.id}`)
  seen.add(n.id)
  if (seen.size > MAX_NODES) throw new SubtreeError("Zu viele Knoten.")
  const out: SbNode = { id: n.id, name: n.name }
  if (n.role !== undefined) {
    if (typeof n.role !== "string" || n.role.length > MAX_TEXT) throw new SubtreeError("Ungültiges Feld role.")
    out.role = n.role
  }
  for (const k of ["status", "color", "color2"] as const) {
    const v = n[k]
    if (v === undefined) continue
    if (v !== null && (typeof v !== "string" || v.length > MAX_TEXT)) throw new SubtreeError(`Ungültiges Feld ${k}.`)
    out[k] = v
  }
  out.children = (Array.isArray(n.children) ? n.children : []).map((c) => clean(c, seen))
  for (const k of LAYOUT_KEYS) delete out[k]
  return out
}

function cleanNotes(v: unknown): OrgNote[] {
  if (!Array.isArray(v) || v.length > MAX_NOTES_PER_PERSON) throw new SubtreeError("Ungültige Notizen.")
  return v.map((x) => {
    if (!x || typeof x.text !== "string" || typeof x.date !== "string") throw new SubtreeError("Ungültige Notiz.")
    if (x.text.length > MAX_NOTE_LENGTH || x.date.length > MAX_TEXT) throw new SubtreeError("Notiz zu lang.")
    return { text: x.text, date: x.date }
  })
}

/**
 * Mischt die Unterstruktur von `meId` in `current` ein. Wirft SubtreeError bei Verstößen:
 * unbekannter Aufrufer, doppelte IDs, IDs die schon außerhalb der eigenen Unterstruktur existieren
 * (man kann niemanden „herüberziehen“ oder überschreiben). `employeeIds` sind alle vorhandenen
 * employees/{id}-Dokumente (auch inaktive, nicht mehr im Baum stehende): solche IDs dürfen nur
 * wiederverwendet werden, wenn sie bisher in der eigenen Unterstruktur lagen.
 */
export function applySubtreeUpdate(
  current: OrgStructure, meId: string, input: SubtreeInput, employeeIds: ReadonlySet<string> = new Set(),
): OrgStructure {
  const tree: SbNode = JSON.parse(JSON.stringify(current.tree))
  const me = find(tree, meId)
  if (!me) throw new SubtreeError("Dein Knoten fehlt im Strukturbaum.")

  const oldIds = ids(me)
  oldIds.delete(meId)
  const outsideIds = ids(tree)
  for (const id of oldIds) outsideIds.delete(id)

  const seen = new Set<string>([meId])
  const children = (Array.isArray(input.children) ? input.children : []).map((c) => clean(c, seen))
  seen.delete(meId)
  const newIds = seen
  for (const id of newIds) {
    if (outsideIds.has(id) || (employeeIds.has(id) && !oldIds.has(id))) {
      throw new SubtreeError(`ID existiert außerhalb deiner Unterstruktur: ${id}`)
    }
  }
  me.children = children

  const removed = new Set([...oldIds].filter((id) => !newIds.has(id)))

  const notes: Record<string, OrgNote[]> = {}
  for (const [id, list] of Object.entries(current.notes ?? {})) {
    if (!removed.has(id) && !newIds.has(id)) notes[id] = list
  }
  for (const [id, list] of Object.entries(input.notes ?? {})) {
    if (!newIds.has(id)) continue
    const cleaned = cleanNotes(list)
    if (cleaned.length) notes[id] = cleaned
  }

  const conns = (current.conns ?? []).filter(
    (c) =>
      !(oldIds.has(c.from) && oldIds.has(c.to)) && !removed.has(c.from) && !removed.has(c.to),
  )
  if ((input.conns ?? []).length > MAX_CONNS) throw new SubtreeError("Zu viele Verbindungen.")
  for (const c of input.conns ?? []) {
    if (!newIds.has(c.from) || !newIds.has(c.to)) continue
    if (c.label !== undefined && (typeof c.label !== "string" || c.label.length > MAX_TEXT)) throw new SubtreeError("Ungültige Verbindung.")
    conns.push({ from: c.from, to: c.to, ...(c.label ? { label: c.label } : { label: "" }) })
  }

  return { tree, notes, conns }
}
