// Zugriff auf die Unterkollektionen employees/{id}/<sub>/<key> (planWeeks,
// planMonthNotes, planAnnual, attendance, ...). Die bisherige App kennt Einträge je
// Mitarbeiter*name* in einem gemeinsamen Dokument; hier wird dieses Bild aus den
// Einzeldokumenten zusammengesetzt (Name -> Eintrag) bzw. beim Schreiben wieder
// auf das Dokument des jeweiligen Mitarbeiters verteilt.
import { doc, getDoc, onSnapshot, setDoc, type DocumentReference } from "firebase/firestore"
import { firestore } from "@/lib/firebase"
import type { EmployeeMeta } from "@/lib/calc/employees"

export function employeeSubDocRef(employeeId: string, sub: string, key: string): DocumentReference | null {
  return firestore ? doc(firestore, "employees", employeeId, sub, key) : null
}

/** Meta-Felder, die beim Zusammensetzen eines Eintrags wieder entfernt werden. */
function strip<T>(data: Record<string, unknown>, metaKey: string): T {
  const { [metaKey]: _meta, ...rest } = data
  return rest as T
}

/**
 * Live-Abo auf <sub>/<key> aller `employees`. Ruft `onData` mit allen vorhandenen
 * Einträgen (Name -> Eintrag) auf; `ready` ist true, sobald jedes Dokument einmal
 * vom Server bestätigt wurde (vorher darf nicht geschrieben werden).
 * Snapshots eigener, noch nicht bestätigter Schreibvorgänge werden übersprungen
 * (die UI zeigt sie bereits optimistisch).
 */
export function subscribeEmployeeDocs<T>(
  sub: string, key: string, metaKey: string, employees: readonly EmployeeMeta[],
  onData: (entries: Record<string, T>, ready: boolean) => void,
  onError: (err: unknown) => void,
): () => void {
  const entries = new Map<string, T>()
  const confirmed = new Set<string>()
  const emit = () => {
    const out: Record<string, T> = {}
    for (const e of employees) if (entries.has(e.id)) out[e.name] = entries.get(e.id) as T
    onData(out, confirmed.size >= employees.length)
  }
  if (employees.length === 0) { emit(); return () => {} }
  const unsubs = employees.map((e) => {
    const ref = employeeSubDocRef(e.id, sub, key)
    if (!ref) return () => {}
    return onSnapshot(ref, (snap) => {
      if (snap.metadata.hasPendingWrites) return
      if (snap.exists()) entries.set(e.id, strip<T>(snap.data(), metaKey))
      else entries.delete(e.id)
      if (!snap.metadata.fromCache) confirmed.add(e.id)
      emit()
    }, onError)
  })
  return () => unsubs.forEach((u) => u())
}

/** Einmaliges Laden von <sub>/<key> aller `employees` (Name -> Eintrag). Nicht lesbare Dokumente werden ausgelassen. */
export async function fetchEmployeeDocs<T>(
  sub: string, key: string, metaKey: string, employees: readonly EmployeeMeta[],
): Promise<Record<string, T>> {
  const out: Record<string, T> = {}
  await Promise.all(employees.map(async (e) => {
    const ref = employeeSubDocRef(e.id, sub, key)
    if (!ref) return
    try {
      const snap = await getDoc(ref)
      if (snap.exists()) out[e.name] = strip<T>(snap.data(), metaKey)
    } catch (err) {
      console.warn(`${sub}/${key} von ${e.name} nicht lesbar`, err)
    }
  }))
  return out
}

export function writeEmployeeSubDoc(employeeId: string, sub: string, key: string, data: Record<string, unknown>): Promise<void> {
  const ref = employeeSubDocRef(employeeId, sub, key)
  return ref ? setDoc(ref, data) : Promise.resolve()
}
