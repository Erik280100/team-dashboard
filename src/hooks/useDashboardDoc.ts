// Dashboard-Daten (rows/teamGoal/history) — Cloud-Modus liest/schreibt die
// Mitarbeiter-Dokumente employees/{id} (siehe firestore.rules) und org/teamGoal;
// die Schnittstelle bleibt die bisherige (rows als EmployeeRow-Liste), damit
// Sektionen und calc/* unverändert weiterlaufen.
//
// Wer was sieht: alle Eingeloggten sehen alle Mitarbeiter-Dokumente (Stammdaten, Einheiten,
// Monatssummen); geschrieben werden darf nur das eigene Dokument und die der Mitarbeiter darunter
// (erzwingen die Firestore-Regeln).
// Ohne Firebase-Config (lokaler Modus) bleibt es beim localStorage-Verhalten.
// Im Cloud-Modus wird bewusst NICHTS in localStorage gecacht: Der Browser kann von
// mehreren Konten benutzt werden, Zahlen dürfen nicht zwischen ihnen durchsickern.
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { onSnapshot, setDoc, writeBatch } from "firebase/firestore"
import { CLOUD_CONFIGURED, employeeDocRef, employeesCollection, firestore, orgDocRef } from "@/lib/firebase"
import { migrateRows, recordSnapshot, type HistoryEntry } from "@/lib/calc/format"
import { withCalendarPeriod } from "@/lib/calc/archive"
import {
  diffRowWrites, employeeDocToRow, employeeMetaOf, type EmployeeMeta,
} from "@/lib/calc/employees"
import type { AccountInfo } from "@/lib/calc/roles"
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
  /** Stammdaten (ID, Name, Vorgesetzte) aller für dieses Konto sichtbaren Mitarbeiter; leer im lokalen Modus. */
  employees: EmployeeMeta[]
  teamGoal: TeamGoal
  history: HistoryEntry[]
  syncStatus: SyncStatus
  /** rows ersetzen: geänderte Zeilen werden in ihre Mitarbeiter-Dokumente geschrieben. */
  saveRows: (next: EmployeeRow[]) => void
  /** teamGoal ersetzen (nur Admin; sonst wirkungslos). */
  saveGoal: (next: TeamGoal) => void
  /** rows+teamGoal+history in einem Zug ersetzen — Monatsabschluss-Reset (nur Admin). */
  saveAll: (next: DashboardDoc) => void
}

interface Stored { meta: EmployeeMeta; row: EmployeeRow }

export function useDashboardDoc(account: AccountInfo): UseDashboardDocResult {
  const cloud = CLOUD_CONFIGURED
  const isAdmin = account.role === "admin"
  const myId = account.employeeId

  const [local, setLocal] = useState(() =>
    cloud
      ? { rows: [] as EmployeeRow[] }
      : { rows: migrateRows(loadLocal(STORAGE_KEY, JSON.parse(JSON.stringify(STARTER_DATA)), isRowArray)) }
  )
  const [stored, setStored] = useState<Record<string, Stored>>({})
  // Gerechnet wird immer im Kalendermonat: ältere Stände (Umsatzmonat ab erstem Mittwoch) werden beim Laden
  // auf 1. bis letzter Tag des Startmonats gezogen.
  const [teamGoal, setTeamGoal] = useState<TeamGoal>(() => withCalendarPeriod({
    ...STARTER_GOAL,
    ...(cloud ? {} : loadLocal(GOAL_KEY, {}, isGoalObj)),
  }))
  const [history, setHistory] = useState<HistoryEntry[]>(() => (cloud ? [] : loadLocal(HISTORY_KEY, [], isHistoryArray)))
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(cloud ? "connecting" : "not-configured")
  const goalReady = useRef(false)

  // ---- Mitarbeiter lesen ----
  useEffect(() => {
    const col = employeesCollection()
    if (!cloud || !col) return
    const toMap = (docs: { id: string; data: () => Record<string, unknown> }[]) => {
      const out: Record<string, Stored> = {}
      for (const d of docs) {
        const data = d.data()
        out[d.id] = { meta: employeeMetaOf(d.id, data), row: employeeDocToRow(data) }
      }
      return out
    }
    const onError = (err: unknown) => { console.error("Cloud-Sync Fehler", err); setSyncStatus("error") }
    // Alle Eingeloggten sehen alle Mitarbeiter (Dashboard/Mitarbeiterseite); bearbeiten duerfen sie nur
    // die eigenen und die darunter (firestore.rules, canEditEmployee in roles.ts).
    const unsubs: (() => void)[] = []
    if (isAdmin || myId) {
      unsubs.push(onSnapshot(col, (snap) => {
        setStored(toMap(snap.docs))
        if (!snap.metadata.fromCache) setSyncStatus("connected")
      }, onError))
    } else {
      setSyncStatus("connected") // Konto ohne verknüpften Mitarbeiter: nichts zu laden
    }
    return () => unsubs.forEach((u) => u())
  }, [cloud, isAdmin, myId])

  // ---- Teamziel/Verlauf lesen (org/teamGoal, für alle Eingeloggten lesbar) ----
  useEffect(() => {
    const ref = orgDocRef("teamGoal")
    if (!cloud || !ref) return
    return onSnapshot(ref, (snap) => {
      if (snap.metadata.fromCache) return
      if (snap.exists()) {
        const data = snap.data() as Partial<DashboardDoc>
        if (data.teamGoal && typeof data.teamGoal === "object") setTeamGoal(withCalendarPeriod({ ...STARTER_GOAL, ...data.teamGoal }))
        if (Array.isArray(data.history)) setHistory(data.history)
      }
      goalReady.current = true
    }, (err) => console.warn("Teamziel konnte nicht geladen werden", err))
  }, [cloud])

  const employees = useMemo(
    () => Object.values(stored).map((s) => s.meta).sort((a, b) => a.name.localeCompare(b.name, "de")),
    [stored]
  )
  const cloudRows = useMemo(() => employees.map((m) => stored[m.id].row), [employees, stored])
  const rows = cloud ? cloudRows : local.rows

  const latest = useRef({ rows, employees, teamGoal, history })
  latest.current = { rows, employees, teamGoal, history }

  /** Nur die übergebenen Teile von org/teamGoal schreiben (merge) — nie das ganze Dokument aus einem evtl. veralteten Stand. */
  const pushGoal = useCallback((next: { teamGoal?: TeamGoal; history?: HistoryEntry[] }) => {
    const ref = orgDocRef("teamGoal")
    if (!ref || !isAdmin || !goalReady.current) return
    setDoc(ref, next, { merge: true }).catch((err) => { console.warn("Cloud-Speichern fehlgeschlagen", err); setSyncStatus("error") })
  }, [isAdmin])

  const writeRows = useCallback((writes: { id: string; data: Record<string, unknown> }[]) => {
    if (!firestore || writes.length === 0) return
    for (let i = 0; i < writes.length; i += 400) {
      const batch = writeBatch(firestore)
      for (const w of writes.slice(i, i + 400)) {
        const ref = employeeDocRef(w.id)
        if (ref) batch.update(ref, w.data)
      }
      batch.commit().catch((err) => { console.warn("Cloud-Speichern fehlgeschlagen", err); setSyncStatus("error") })
    }
  }, [])

  const saveRows = useCallback((next: EmployeeRow[]) => {
    const cur = latest.current
    if (!cloud) {
      setLocal({ rows: next })
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* noop */ }
      const h = recordSnapshot(next, cur.history)
      setHistory(h)
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)) } catch { /* noop */ }
      return
    }
    const { writes, skipped } = diffRowWrites(cur.rows, next, cur.employees)
    if (skipped.length) console.warn("Keine Mitarbeiter-Dokumente für:", skipped.join(", "))
    writeRows(writes)
    // Verlauf (Team-Gesamt-Ist) kennt nur der Admin vollständig — Teilsichten dürfen ihn nicht überschreiben.
    if (isAdmin) {
      const h = recordSnapshot(next, cur.history)
      setHistory(h)
      if (JSON.stringify(h) !== JSON.stringify(cur.history)) pushGoal({ history: h })
    }
  }, [cloud, isAdmin, pushGoal, writeRows])

  const saveGoal = useCallback((next: TeamGoal) => {
    setTeamGoal(next)
    if (!cloud) {
      try { localStorage.setItem(GOAL_KEY, JSON.stringify(next)) } catch { /* noop */ }
      return
    }
    pushGoal({ teamGoal: next })
  }, [cloud, pushGoal])

  const saveAll = useCallback((next: DashboardDoc) => {
    setTeamGoal(next.teamGoal)
    setHistory(next.history)
    if (!cloud) {
      setLocal({ rows: next.rows })
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next.rows))
        localStorage.setItem(GOAL_KEY, JSON.stringify(next.teamGoal))
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next.history))
      } catch { /* noop */ }
      return
    }
    if (!isAdmin) return
    const cur = latest.current
    const { writes } = diffRowWrites(cur.rows, next.rows, cur.employees)
    writeRows(writes)
    pushGoal({ teamGoal: next.teamGoal, history: next.history })
  }, [cloud, isAdmin, pushGoal, writeRows])

  return { rows, employees, teamGoal, history, syncStatus, saveRows, saveGoal, saveAll }
}
