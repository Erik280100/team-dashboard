// Zugriff auf die Unterkollektionen employees/{id}/<sub>/<key> (planWeeks,
// planMonthNotes, planAnnual, attendance, ...). Die bisherige App kennt Einträge je
// Mitarbeiter*name* in einem gemeinsamen Dokument; hier wird dieses Bild aus den
// Einzeldokumenten zusammengesetzt (Name -> Eintrag) bzw. beim Schreiben wieder
// auf das Dokument des jeweiligen Mitarbeiters verteilt.
import {
  collection, doc, documentId, getDoc, getDocs, onSnapshot, query, setDoc, where, type DocumentReference,
} from "firebase/firestore"
import { firestore } from "@/lib/firebase"
import type { EmployeeMeta } from "@/lib/calc/employees"

export function employeeSubDocRef(employeeId: string, sub: string, key: string): DocumentReference | null {
  return firestore ? doc(firestore, "employees", employeeId, sub, key) : null
}

/**
 * Gleichzeitige Einzelabrufe begrenzen: Die Jahresplanung lädt ~53 Wochen x alle Mitarbeiter (~2.500 getDoc).
 * Alle auf einmal zu starten überlastet den Firestore-Client (die Seite friert ein) — daher höchstens
 * MAX_PARALLEL_READS gleichzeitig, der Rest wartet in der Schlange.
 */
const MAX_PARALLEL_READS = 24
let activeReads = 0
const readQueue: (() => void)[] = []
async function limited<T>(read: () => Promise<T>): Promise<T> {
  if (activeReads >= MAX_PARALLEL_READS) await new Promise<void>((resolve) => readQueue.push(resolve))
  activeReads++
  try {
    return await read()
  } finally {
    activeReads--
    readQueue.shift()?.()
  }
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
    return onSnapshot(ref, { includeMetadataChanges: true }, (snap) => {
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
      const snap = await limited(() => getDoc(ref))
      if (snap.exists()) out[e.name] = strip<T>(snap.data(), metaKey)
    } catch (err) {
      console.warn(`${sub}/${key} von ${e.name} nicht lesbar`, err)
    }
  }))
  return out
}

/**
 * Dokument eines Mitarbeiters schreiben. `merge` = nur die übergebenen Felder ändern (Rest bleibt unangetastet):
 * so überschreibt ein veralteter Browser-Stand keine Werte, die inzwischen jemand anderes geändert hat.
 */
export function writeEmployeeSubDoc(
  employeeId: string, sub: string, key: string, data: Record<string, unknown>, merge = false,
): Promise<void> {
  const ref = employeeSubDocRef(employeeId, sub, key)
  if (!ref) return Promise.resolve()
  return merge ? setDoc(ref, data, { merge: true }) : setDoc(ref, data)
}

/**
 * Alle Dokumente <sub>/<key> mit from <= key <= to (Dokument-ID) aller `employees` in EINER Abfrage je Mitarbeiter —
 * statt je Schlüssel (z. B. Woche) und Mitarbeiter ein eigenes getDoc. Für die Jahresansicht: ~50 statt ~2.500 Abrufe.
 * Funktioniert ohne Index und ohne zusätzliche Regeln (Bereichsabfrage auf die Dokument-ID derselben Unterkollektion).
 */
export async function fetchEmployeeRange<T>(
  sub: string, metaKey: string, from: string, to: string, employees: readonly EmployeeMeta[],
  onDoc: (key: string, employeeName: string, entry: T) => void,
): Promise<void> {
  if (!firestore) return
  const db = firestore
  await Promise.all(employees.map(async (e) => {
    try {
      const q = query(collection(db, "employees", e.id, sub), where(documentId(), ">=", from), where(documentId(), "<=", to))
      const snap = await limited(() => getDocs(q))
      snap.forEach((d) => onDoc(d.id, e.name, strip<T>(d.data(), metaKey)))
    } catch (err) {
      console.warn(`${sub}/${from}…${to} von ${e.name} nicht lesbar`, err)
    }
  }))
}
