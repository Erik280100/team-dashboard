// Finanzierungen-Cloud-Sync — analog zu useOrgChartDoc.ts/useAttendanceDoc.ts.
// Eigenes Firestore-Dokument finova/financings, editor-geschützt (siehe
// Finanzierungen.tsx: Schreibzugriffe sind an isEditor gebunden). Keine
// Legacy-Entsprechung — neue Sektion.
import { useCallback, useEffect, useRef, useState } from "react"
import { onSnapshot, setDoc } from "firebase/firestore"
import { CLOUD_CONFIGURED, financingsDocRef } from "@/lib/firebase"
import {
  FINANZIERUNGEN_KEY,
  type FinanzierungArt,
  type FinanzierungCase,
  type FinanzierungenDoc,
} from "@/types/dashboard"
import type { Beschaeftigung } from "@/lib/data/finanzierung"

function loadLocalCases(): FinanzierungCase[] {
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

export function useFinanzierungenDoc(): UseFinanzierungenDocResult {
  const [cases, setCases] = useState<FinanzierungCase[]>(loadLocalCases)
  const cloudReady = useRef(false)
  const latest = useRef(cases)
  latest.current = cases

  useEffect(() => {
    const docRef = financingsDocRef
    if (!CLOUD_CONFIGURED || !docRef) return
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (snap.metadata.hasPendingWrites) return
        if (snap.exists()) {
          const data = (snap.data() || {}) as Partial<FinanzierungenDoc>
          if (Array.isArray(data.cases)) {
            setCases(data.cases)
            try { localStorage.setItem(FINANZIERUNGEN_KEY, JSON.stringify(data.cases)) } catch { /* noop */ }
          }
        } else {
          void setDoc(docRef, { cases: latest.current })
        }
        cloudReady.current = true
      },
      (err) => console.warn("Finanzierungen: Cloud-Verbindung fehlgeschlagen", err)
    )
    return unsub
  }, [])

  const commit = useCallback((next: FinanzierungCase[]) => {
    setCases(next)
    try { localStorage.setItem(FINANZIERUNGEN_KEY, JSON.stringify(next)) } catch { /* noop */ }
    const docRef = financingsDocRef
    if (CLOUD_CONFIGURED && cloudReady.current && docRef) {
      setDoc(docRef, { cases: next }).catch((err) =>
        console.warn("Finanzierungen: Cloud-Speichern fehlgeschlagen", err)
      )
    }
  }, [])

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
