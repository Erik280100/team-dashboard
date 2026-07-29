// Dashboard-Cloud-Sync — Äquivalent zu initCloudSync()/pushToCloud()/saveData()
// aus legacy/index.html:2307–2355,2493–2551. Hält rows/teamGoal/history im
// React-State, spiegelt sie nach localStorage und synchronisiert bidirektional
// über das Firestore-Dokument finova/dashboard (identisch zur Legacy-App).
import { useCallback, useEffect, useRef, useState } from "react"
import { onSnapshot, setDoc } from "firebase/firestore"
import { CLOUD_CONFIGURED, stateDocRef } from "@/lib/firebase"
import { migrateRows, recordSnapshot, type HistoryEntry } from "@/lib/calc/format"
import {
  STARTER_DATA, STARTER_GOAL, STORAGE_KEY, GOAL_KEY, HISTORY_KEY,
  type DashboardDoc, type EmployeeRow, type TeamGoal,
} from "@/types/dashboard"

function loadLocal<T>(key: string, fallback: T, validate: (v: unknown) => v is T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (validate(parsed)) return parsed
    }
  } catch (e) {
    console.warn(`Konnte ${key} nicht laden`, e)
  }
  return fallback
}

const isRowArray = (v: unknown): v is EmployeeRow[] => Array.isArray(v) && v.length > 0
const isGoalObj = (v: unknown): v is Partial<TeamGoal> => !!v && typeof v === "object"
const isHistoryArray = (v: unknown): v is HistoryEntry[] => Array.isArray(v)

export type SyncStatus = "not-configured" | "connecting" | "connected" | "error"

export interface UseDashboardDocResult {
  rows: EmployeeRow[]
  teamGoal: TeamGoal
  history: HistoryEntry[]
  syncStatus: SyncStatus
  /** rows ersetzen, lokal cachen, Tages-Snapshot fortschreiben, in die Cloud pushen. */
  saveRows: (next: EmployeeRow[]) => void
  /** teamGoal ersetzen, lokal cachen, in die Cloud pushen. */
  saveGoal: (next: TeamGoal) => void
}

export function useDashboardDoc(): UseDashboardDocResult {
  const [rows, setRows] = useState<EmployeeRow[]>(() =>
    migrateRows(loadLocal(STORAGE_KEY, JSON.parse(JSON.stringify(STARTER_DATA)), isRowArray))
  )
  const [teamGoal, setTeamGoal] = useState<TeamGoal>(() => ({
    ...STARTER_GOAL,
    ...loadLocal(GOAL_KEY, {}, isGoalObj),
  }))
  const [history, setHistory] = useState<HistoryEntry[]>(() =>
    loadLocal(HISTORY_KEY, [], isHistoryArray)
  )
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    CLOUD_CONFIGURED ? "connecting" : "not-configured"
  )
  const cloudReady = useRef(false)

  // Aktuellste Werte für den Cloud-Push griffbereit halten, ohne den Effect erneut zu binden.
  const latest = useRef({ rows, teamGoal, history })
  latest.current = { rows, teamGoal, history }

  useEffect(() => {
    const docRef = stateDocRef
    if (!CLOUD_CONFIGURED || !docRef) return
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (snap.metadata.hasPendingWrites) return // eigene, bereits lokal dargestellte Änderung
        if (snap.exists()) {
          const data = (snap.data() || {}) as Partial<DashboardDoc>
          if (Array.isArray(data.rows) && data.rows.length) {
            const migrated = migrateRows(data.rows)
            setRows(migrated)
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated)) } catch { /* noop */ }
          }
          if (data.teamGoal && typeof data.teamGoal === "object") {
            const merged = { ...STARTER_GOAL, ...data.teamGoal }
            setTeamGoal(merged)
            try { localStorage.setItem(GOAL_KEY, JSON.stringify(merged)) } catch { /* noop */ }
          }
          if (Array.isArray(data.history)) {
            setHistory(data.history)
            try { localStorage.setItem(HISTORY_KEY, JSON.stringify(data.history)) } catch { /* noop */ }
          }
        } else {
          void setDoc(docRef, latest.current)
        }
        cloudReady.current = true
        setSyncStatus("connected")
      },
      (err) => {
        console.error("Cloud-Sync Fehler", err)
        setSyncStatus("error")
      }
    )
    return unsub
  }, [])

  const pushToCloud = useCallback((doc: DashboardDoc) => {
    const docRef = stateDocRef
    if (!CLOUD_CONFIGURED || !cloudReady.current || !docRef) return
    setDoc(docRef, doc).catch((err) => {
      console.warn("Cloud-Speichern fehlgeschlagen", err)
      setSyncStatus("error")
    })
  }, [])

  const saveRows = useCallback(
    (next: EmployeeRow[]) => {
      setRows(next)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* noop */ }
      const nextHistory = recordSnapshot(next, latest.current.history)
      setHistory(nextHistory)
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory)) } catch { /* noop */ }
      pushToCloud({ rows: next, teamGoal: latest.current.teamGoal, history: nextHistory })
    },
    [pushToCloud]
  )

  const saveGoal = useCallback(
    (next: TeamGoal) => {
      setTeamGoal(next)
      try { localStorage.setItem(GOAL_KEY, JSON.stringify(next)) } catch { /* noop */ }
      pushToCloud({ rows: latest.current.rows, teamGoal: next, history: latest.current.history })
    },
    [pushToCloud]
  )

  return { rows, teamGoal, history, syncStatus, saveRows, saveGoal }
}
