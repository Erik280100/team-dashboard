// Feldgenaue Änderungen für Firestore-updateDoc: nur das schreiben, was sich gegenüber dem zuletzt
// gesehenen Stand geändert hat, damit ein veralteter Browser-Stand fremde Änderungen nicht überschreibt.
import { deleteField, FieldPath } from "firebase/firestore"

export interface FieldChange { path: string[]; value: unknown }

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v)

/**
 * Pfade, an denen `next` von `prev` abweicht. Objekte werden bis in die Tiefe `depth` Feld für Feld
 * verglichen, Arrays und Werte darunter als Ganzes. Entfernte Felder kommen mit `deleteField()`.
 */
export function diffFields(prev: Record<string, unknown>, next: Record<string, unknown>, depth = 2): FieldChange[] {
  const out: FieldChange[] = []
  const walk = (a: Record<string, unknown>, b: Record<string, unknown>, path: string[], left: number) => {
    for (const k of Object.keys(b)) {
      const bv = b[k]
      if (bv === undefined) continue
      const av = a[k]
      if (left > 0 && isPlainObject(av) && isPlainObject(bv)) walk(av, bv, [...path, k], left - 1)
      else if (JSON.stringify(av) !== JSON.stringify(bv)) out.push({ path: [...path, k], value: bv })
    }
    for (const k of Object.keys(a)) {
      if (!(k in b) || b[k] === undefined) out.push({ path: [...path, k], value: deleteField() })
    }
  }
  walk(prev, next, [], depth)
  return out
}

/** Argumentliste für `updateDoc(ref, field, value, ...more)`; leer, wenn nichts zu schreiben ist. */
export function toUpdateArgs(changes: FieldChange[]): [FieldPath, unknown, ...unknown[]] | null {
  if (changes.length === 0) return null
  const [first, ...rest] = changes
  return [new FieldPath(...first.path), first.value, ...rest.flatMap((c) => [new FieldPath(...c.path), c.value])]
}
