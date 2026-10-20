// Finanzierungen — Cloud-Modus: ein Dokument je Fall in financings/{id} mit
// ownerId (Betreuer) und ancestors (dessen Vorgesetzte), siehe firestore.rules.
// Sichtbar: Besitzer, dessen Vorgesetzte, Admin. Kein localStorage-Cache im
// Cloud-Modus (mehrere Konten pro Browser).
import { useCallback, useEffect, useRef, useState } from "react"
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, where } from "firebase/firestore"
import { CLOUD_CONFIGURED, firestore } from "@/lib/firebase"
import { idByName, type EmployeeMeta } from "@/lib/calc/employees"
import type { AccountInfo } from "@/lib/calc/roles"
import {
  FINANZIERUNGEN_KEY,
  type FinanzierungArt,
  type FinanzierungCase,
} from "@/types/dashboard"
import type { Beschaeftigung } from "@/lib/data/finanzierung"

function loadLocalCases(): FinanzierungCase[] {
  if (CLOUD_CONFIGURED) return []
  try {
    const raw = localStorage.getItem(FINANZIERUNGEN_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch (e) {
    console.warn("Konnte Finanzierungen nicht laden", e)
  }
  return []
}

function newCaseId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `case-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export interface UseFinanzierungenDocResult {
  cases: FinanzierungCase[]
  addCase: (init: {
    name: string
    betrag: number
    art: FinanzierungArt
    beschaeftigung: Beschaeftigung
    betreuer: string
  }) => void
  patchCase: (id: string, patch: Partial<FinanzierungCase>) => void
  toggleDoc: (id: string, itemId: string, checked: boolean) => void
  removeCase: (id: string) => void
}

type StoredCase = FinanzierungCase & { ownerId?: string; ancestors?: string[]; abwicklerId?: string }

function stripOwner(c: StoredCase): FinanzierungCase {
  const { ownerId: _o, ancestors: _a, abwicklerId: _w, ...rest } = c
  return rest
}

export function useFinanzierungenDoc(account: AccountInfo = { role: "admin", employeeId: null, mustChangePassword: false }, employees: readonly EmployeeMeta[] = []): UseFinanzierungenDocResult {
  const isAdmin = account.role === "admin"
  const myId = account.employeeId
  const [cases, setCases] = useState<FinanzierungCase[]>(loadLocalCases)
  const [byOwner, setByOwner] = useState<Record<string, StoredCase>>({})
  const [byAncestor, setByAncestor] = useState<Record<string, StoredCase>>({})
  const [byAbwickler, setByAbwickler] = useState<Record<string, StoredCase>>({})
  const cloudReady = useRef(false)
  const latest = useRef(cases)
  latest.current = cases
  const stored = useRef<Record<string, StoredCase>>({})
  const employeesRef = useRef(employees)
  employeesRef.current = employees

  useEffect(() => {
    if (!CLOUD_CONFIGURED || !firestore) return
    cloudReady.current = false
    const col = collection(firestore, "financings")
    const toMap = (docs: { data: () => unknown }[]) => {
      const out: Record<string, StoredCase> = {}
      for (const d of docs) { const c = d.data() as StoredCase; out[c.id] = c }
      return out
    }
    const onError = (err: unknown) => console.warn("Finanzierungen: Cloud-Verbindung fehlgeschlagen", err)
    const unsubs: (() => void)[] = []
    if (isAdmin) {
      unsubs.push(onSnapshot(col, (snap) => {
        setByOwner(toMap(snap.docs)); setByAncestor({})
        if (!snap.metadata.fromCache) cloudReady.current = true
      }, onError))
    } else if (myId) {
      unsubs.push(onSnapshot(query(col, where("ownerId", "==", myId)), (snap) => {
        setByOwner(toMap(snap.docs))
        if (!snap.metadata.fromCache) cloudReady.current = true
      }, onError))
      unsubs.push(onSnapshot(query(col, where("ancestors", "array-contains", myId)), (snap) => {
        setByAncestor(toMap(snap.docs))
      }, onError))
      // Fälle, bei denen man als Abwickler eingetragen ist (auch außerhalb der eigenen Struktur).
      unsubs.push(onSnapshot(query(col, where("abwicklerId", "==", myId)), (snap) => {
        setByAbwickler(toMap(snap.docs))
      }, onError))
    }
    return () => unsubs.forEach((u) => u())
  }, [isAdmin, myId])

  useEffect(() => {
    if (!CLOUD_CONFIGURED) return
    const merged = { ...byAbwickler, ...byAncestor, ...byOwner }
    stored.current = merged
    setCases(Object.values(merged).map(stripOwner).sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
  }, [byOwner, byAncestor, byAbwickler])

  const commit = useCallback((next: FinanzierungCase[]) => {
    const prev = latest.current
    setCases(next)
    if (!CLOUD_CONFIGURED) {
      try { localStorage.setItem(FINANZIERUNGEN_KEY, JSON.stringify(next)) } catch { /* noop */ }
      return
    }
    if (!cloudReady.current || !firestore) return
    const fail = (err: unknown) => console.warn("Finanzierungen: Cloud-Speichern fehlgeschlagen", err)
    const prevById = new Map(prev.map((c) => [c.id, JSON.stringify(c)]))
    const nextIds = new Set(next.map((c) => c.id))
    const ids = idByName(employeesRef.current)
    const metaById = new Map(employeesRef.current.map((e) => [e.id, e]))
    for (const c of next) {
      if (prevById.get(c.id) === JSON.stringify(c)) continue
      // Besitzer = Betreuer (per Name); unbekannt -> bisheriger Besitzer bzw. das eigene Konto.
      const known = stored.current[c.id]
      const ownerId = ids.get(c.betreuer.trim().toLowerCase()) ?? known?.ownerId ?? myId
      const owner = ownerId ? metaById.get(ownerId) : undefined
      if (!ownerId || !owner) { console.warn(`Finanzierung "${c.name}": kein Besitzer ermittelbar`); continue }
      const abwicklerId = c.abwickler ? ids.get(c.abwickler.trim().toLowerCase()) : undefined
      setDoc(doc(firestore, "financings", c.id), {
        ...c, ownerId, ancestors: owner.ancestors, ...(abwicklerId ? { abwicklerId } : {}),
      }).catch(fail)
    }
    for (const c of prev) {
      if (!nextIds.has(c.id)) deleteDoc(doc(firestore, "financings", c.id)).catch(fail)
    }
  }, [myId])

  const addCase = useCallback(
    (init: { name: string; betrag: number; art: FinanzierungArt; beschaeftigung: Beschaeftigung; betreuer: string }) => {
      const next: FinanzierungCase = {
        id: newCaseId(),
        name: init.name,
        betrag: init.betrag,
        art: init.art,
        beschaeftigung: init.beschaeftigung,
        betreuer: init.betreuer,
        docs: {},
        aufbereitet: false,
        eingereicht: false,
        kreditvertrag: false,
        archived: false,
        createdAt: new Date().toISOString(),
      }
      commit([...latest.current, next])
    },
    [commit]
  )

  const patchCase = useCallback(
    (id: string, patch: Partial<FinanzierungCase>) => {
      commit(latest.current.map((c) => (c.id === id ? { ...c, ...patch } : c)))
    },
    [commit]
  )

  const toggleDoc = useCallback(
    (id: string, itemId: string, checked: boolean) => {
      commit(
        latest.current.map((c) =>
          c.id === id ? { ...c, docs: { ...c.docs, [itemId]: checked } } : c
        )
      )
    },
    [commit]
  )

  const removeCase = useCallback(
    (id: string) => {
      commit(latest.current.filter((c) => c.id !== id))
    },
    [commit]
  )

  return { cases, addCase, patchCase, toggleDoc, removeCase }
}
