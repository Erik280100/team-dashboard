// Umsatzverfolgung — Cloud-Modus: ein Dokument je Zeile in sales/{id} mit ownerId (Mitarbeiter, auf den gebucht
// wurde) und ancestors (dessen Vorgesetzte), siehe firestore.rules. Sichtbar: Besitzer, dessen Vorgesetzte, Admin.
// Wie bei den Finanzierungen kein localStorage-Cache im Cloud-Modus (mehrere Konten pro Browser).
import { useCallback, useEffect, useRef, useState } from "react"
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, updateDoc, where } from "firebase/firestore"
import { CLOUD_CONFIGURED, firestore } from "@/lib/firebase"
import { idByName, type EmployeeMeta } from "@/lib/calc/employees"
import type { AccountInfo } from "@/lib/calc/roles"
import type { UmsatzDraft } from "@/lib/calc/umsatz"
import { UMSATZ_KEY, type UmsatzEntry } from "@/types/dashboard"

/** Nachträglich pflegbare Felder (alles andere ist nach der Buchung fix, auch in den Regeln). */
export type UmsatzPatch = Partial<Pick<UmsatzEntry, "kunde" | "beginn" | "policiert" | "ausbezahlt">>

export interface UseUmsaetzeDocResult {
  entries: UmsatzEntry[]
  addEntries: (mitarbeiter: string, drafts: UmsatzDraft[]) => void
  patchEntry: (id: string, patch: UmsatzPatch) => void
  removeEntry: (id: string) => void
}

type StoredEntry = UmsatzEntry & { ownerId?: string; ancestors?: string[] }

function stripOwner(e: StoredEntry): UmsatzEntry {
  const { ownerId: _o, ancestors: _a, ...rest } = e
  return rest
}

function loadLocalEntries(): UmsatzEntry[] {
  if (CLOUD_CONFIGURED) return []
  try {
    const raw = localStorage.getItem(UMSATZ_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch (e) {
    console.warn("Konnte Umsätze nicht laden", e)
  }
  return []
}

function newEntryId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `sale-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const byBookedAtDesc = (a: UmsatzEntry, b: UmsatzEntry) => b.bookedAt.localeCompare(a.bookedAt)

export function useUmsaetzeDoc(
  account: AccountInfo = { role: "admin", employeeId: null, mustChangePassword: false },
  employees: readonly EmployeeMeta[] = [],
): UseUmsaetzeDocResult {
  const isAdmin = account.role === "admin"
  const myId = account.employeeId
  const [entries, setEntries] = useState<UmsatzEntry[]>(loadLocalEntries)
  const [byOwner, setByOwner] = useState<Record<string, StoredEntry>>({})
  const [byAncestor, setByAncestor] = useState<Record<string, StoredEntry>>({})
  const latest = useRef(entries)
  latest.current = entries
  const employeesRef = useRef(employees)
  employeesRef.current = employees

  useEffect(() => {
    if (!CLOUD_CONFIGURED || !firestore) return
    const col = collection(firestore, "sales")
    const toMap = (docs: { data: () => unknown }[]) => {
      const out: Record<string, StoredEntry> = {}
      for (const d of docs) { const e = d.data() as StoredEntry; out[e.id] = e }
      return out
    }
    const onError = (err: unknown) => console.warn("Umsatzverfolgung: Cloud-Verbindung fehlgeschlagen", err)
    const unsubs: (() => void)[] = []
    if (isAdmin) {
      unsubs.push(onSnapshot(col, (snap) => { setByOwner(toMap(snap.docs)); setByAncestor({}) }, onError))
    } else if (myId) {
      unsubs.push(onSnapshot(query(col, where("ownerId", "==", myId)), (snap) => setByOwner(toMap(snap.docs)), onError))
      unsubs.push(onSnapshot(query(col, where("ancestors", "array-contains", myId)), (snap) => setByAncestor(toMap(snap.docs)), onError))
    }
    return () => unsubs.forEach((u) => u())
  }, [isAdmin, myId])

  useEffect(() => {
    if (!CLOUD_CONFIGURED) return
    setEntries(Object.values({ ...byAncestor, ...byOwner }).map(stripOwner).sort(byBookedAtDesc))
  }, [byOwner, byAncestor])

  const saveLocal = (next: UmsatzEntry[]) => {
    setEntries(next)
    try { localStorage.setItem(UMSATZ_KEY, JSON.stringify(next)) } catch { /* noop */ }
  }

  const addEntries = useCallback((mitarbeiter: string, drafts: UmsatzDraft[]) => {
    if (drafts.length === 0) return
    const bookedAt = new Date().toISOString()
    const created: UmsatzEntry[] = drafts.map((d) => ({
      id: newEntryId(), bookedAt, mitarbeiter, ...d, kunde: "", beginn: "", policiert: false, ausbezahlt: false,
    }))
    if (!CLOUD_CONFIGURED || !firestore) {
      saveLocal([...created, ...latest.current].sort(byBookedAtDesc))
      return
    }
    const ownerId = idByName(employeesRef.current).get(mitarbeiter.trim().toLowerCase())
    const owner = employeesRef.current.find((e) => e.id === ownerId)
    if (!ownerId || !owner) { console.warn(`Umsatzverfolgung: "${mitarbeiter}" nicht gefunden`); return }
    for (const e of created) {
      setDoc(doc(firestore, "sales", e.id), { ...e, ownerId, ancestors: owner.ancestors })
        .catch((err) => console.warn("Umsatzverfolgung: Speichern fehlgeschlagen", err))
    }
  }, [])

  const patchEntry = useCallback((id: string, patch: UmsatzPatch) => {
    if (!CLOUD_CONFIGURED || !firestore) {
      saveLocal(latest.current.map((e) => (e.id === id ? { ...e, ...patch } : e)))
      return
    }
    // Sofort anzeigen; der Snapshot bestätigt bzw. korrigiert (z. B. wenn die Regeln ablehnen).
    setEntries((cur) => cur.map((e) => (e.id === id ? { ...e, ...patch } : e)))
    updateDoc(doc(firestore, "sales", id), patch)
      .catch((err) => console.warn("Umsatzverfolgung: Speichern fehlgeschlagen", err))
  }, [])

  const removeEntry = useCallback((id: string) => {
    if (!CLOUD_CONFIGURED || !firestore) {
      saveLocal(latest.current.filter((e) => e.id !== id))
      return
    }
    deleteDoc(doc(firestore, "sales", id))
      .catch((err) => console.warn("Umsatzverfolgung: Löschen fehlgeschlagen", err))
  }, [])

  return { entries, addEntries, patchEntry, removeEntry }
}
