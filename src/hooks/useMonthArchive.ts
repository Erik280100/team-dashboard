// Monats-Archiv-Sync — verwaltet finova/archive_index (Liste abgeschlossener
// Monate + Aggregate) und lädt einzelne finova/snapshot_<month>-Dokumente lazy
// nach. Analog zu den übrigen *DocSync-Hooks (useDashboardDoc/useOrgChartDoc),
// aber mit zwei Unterschieden: Snapshots sind unveränderlich (getDoc statt
// onSnapshot, Cache veraltet nie) und ein leeres Archiv erzeugt KEIN setDoc
// (anders als bei den Live-Docs ist ein fehlendes Archiv der Normalzustand,
// und Lesezugriffs-Nutzer dürfen nicht schreiben).
import { useCallback, useEffect, useRef, useState } from "react"
import { getDoc, onSnapshot, setDoc } from "firebase/firestore"
import { CLOUD_CONFIGURED, archiveIndexDocRef, snapshotDocRef } from "@/lib/firebase"
import { buildIndexEntry, buildSnapshot, nextMonthGoal, resetRowsForNewMonth } from "@/lib/calc/archive"
import type { HistoryEntry } from "@/lib/calc/format"
import {
  ARCHIVE_INDEX_KEY, snapshotStorageKey,
  type ArchiveIndexEntry, type MonthKey, type MonthSnapshot,
} from "@/types/archive"
import type { DashboardDoc, EmployeeRow, OrgChartDoc, TeamGoal } from "@/types/dashboard"

export type IndexStatus = "loading" | "ready" | "error"
export type SnapshotStatus = "loading" | "ready" | "error"

function loadLocalIndex(): ArchiveIndexEntry[] {
  try {
    const raw = localStorage.getItem(ARCHIVE_INDEX_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && Array.isArray(parsed.months)) return parsed.months as ArchiveIndexEntry[]
    }
  } catch (e) {
    console.warn("Konnte Archiv-Index nicht laden", e)
  }
  return []
}

function loadLocalSnapshot(month: MonthKey): MonthSnapshot | null {
  try {
    const raw = localStorage.getItem(snapshotStorageKey(month))
    if (raw) return JSON.parse(raw) as MonthSnapshot
  } catch (e) {
    console.warn(`Konnte Snapshot ${month} nicht laden`, e)
  }
  return null
}

export interface CloseMonthInput {
  month: MonthKey
  rows: EmployeeRow[]
  teamGoal: TeamGoal
  history: HistoryEntry[]
  orgChart: OrgChartDoc
  closedBy: string | null
  /** Wird ERST nach erfolgreichem Archiv-Write aufgerufen (Reset der Livedaten). */
  commitReset: (next: DashboardDoc) => void
}

export type CloseMonthResult =
  | { ok: true; entry: ArchiveIndexEntry }
  | {
      ok: false
      reason: "not-editor" | "no-cloud" | "already-archived" | "write-failed"
      message: string
    }

export interface UseMonthArchiveResult {
  /** Aufsteigend nach Monat sortiert. */
  index: ArchiveIndexEntry[]
  indexStatus: IndexStatus
  /** Liest aus dem Cache; stößt bei Bedarf das Nachladen an und liefert bis dahin null. */
  getSnapshot: (month: MonthKey) => MonthSnapshot | null
  /** Mehrere Monate auf einmal anfordern (Statistik-Seite). */
  loadSnapshots: (months: MonthKey[]) => Promise<MonthSnapshot[]>
  snapshotStatus: Record<MonthKey, SnapshotStatus>
  closeMonth: (input: CloseMonthInput) => Promise<CloseMonthResult>
  closing: boolean
}

export function useMonthArchive(isEditor: boolean): UseMonthArchiveResult {
  const [index, setIndex] = useState<ArchiveIndexEntry[]>(loadLocalIndex)
  const [indexStatus, setIndexStatus] = useState<IndexStatus>(CLOUD_CONFIGURED ? "loading" : "ready")
  const [closing, setClosing] = useState(false)
  const [snapshotStatus, setSnapshotStatus] = useState<Record<MonthKey, SnapshotStatus>>({})
  const cacheRef = useRef<Map<MonthKey, MonthSnapshot>>(new Map())
  const [, bumpCacheVersion] = useState(0)
  const indexRef = useRef(index)
  indexRef.current = index

  useEffect(() => {
    if (!CLOUD_CONFIGURED || !archiveIndexDocRef) {
      setIndexStatus("ready")
      return
    }
    const unsub = onSnapshot(
      archiveIndexDocRef,
      (snap) => {
        if (snap.metadata.hasPendingWrites) return
        if (snap.exists()) {
          const data = snap.data() as { months?: ArchiveIndexEntry[] } | undefined
          const months = Array.isArray(data?.months) ? data!.months : []
          setIndex(months)
          try { localStorage.setItem(ARCHIVE_INDEX_KEY, JSON.stringify({ version: 1, months })) } catch { /* noop */ }
        } else {
          // Leeres Archiv ist der Normalzustand — kein setDoc hier (anders als
          // bei den Live-Docs), ein Leser darf/soll nichts anlegen.
          setIndex([])
        }
        setIndexStatus("ready")
      },
      (err) => {
        console.warn("Archiv-Index: Cloud-Verbindung fehlgeschlagen", err)
        setIndexStatus("error")
      }
    )
    return unsub
  }, [])

  const loadOne = useCallback(async (month: MonthKey): Promise<MonthSnapshot | null> => {
    const cached = cacheRef.current.get(month)
    if (cached) return cached

    const local = loadLocalSnapshot(month)
    if (local) {
      cacheRef.current.set(month, local)
      setSnapshotStatus((s) => ({ ...s, [month]: "ready" }))
      return local
    }

    if (!CLOUD_CONFIGURED) {
      setSnapshotStatus((s) => ({ ...s, [month]: "error" }))
      return null
    }

    setSnapshotStatus((s) => ({ ...s, [month]: "loading" }))
    try {
      const ref = snapshotDocRef(month)
      if (!ref) throw new Error("Firestore nicht verfügbar")
      const snap = await getDoc(ref)
      if (!snap.exists()) {
        setSnapshotStatus((s) => ({ ...s, [month]: "error" }))
        return null
      }
      const data = snap.data() as MonthSnapshot
      cacheRef.current.set(month, data)
      try { localStorage.setItem(snapshotStorageKey(month), JSON.stringify(data)) } catch { /* noop */ }
      setSnapshotStatus((s) => ({ ...s, [month]: "ready" }))
      bumpCacheVersion((n) => n + 1)
      return data
    } catch (err) {
      console.warn(`Snapshot ${month} konnte nicht geladen werden`, err)
      setSnapshotStatus((s) => ({ ...s, [month]: "error" }))
      return null
    }
  }, [])

  const getSnapshot = useCallback(
    (month: MonthKey): MonthSnapshot | null => {
      const cached = cacheRef.current.get(month)
      if (cached) return cached
      // Nachladen auf einen Mikrotask verschieben: getSnapshot wird oft direkt aus
      // dem Render-Body aufgerufen (App.tsx/Statistik.tsx), state-Updates dürfen
      // dort nicht synchron passieren (auch nicht im Local-Storage-Treffer-Zweig
      // von loadOne, der ohne "await" sonst noch im selben Tick liefe).
      if (!snapshotStatus[month]) queueMicrotask(() => { void loadOne(month) })
      return null
    },
    [loadOne, snapshotStatus]
  )

  const loadSnapshots = useCallback(
    async (months: MonthKey[]): Promise<MonthSnapshot[]> => {
      const results = await Promise.all(months.map((m) => loadOne(m)))
      return results.filter((s): s is MonthSnapshot => s !== null)
    },
    [loadOne]
  )

  const closeMonth = useCallback(
    async (input: CloseMonthInput): Promise<CloseMonthResult> => {
      if (!isEditor) {
        return { ok: false, reason: "not-editor", message: "Nur angemeldete Editoren können einen Monat abschließen." }
      }
      if (!CLOUD_CONFIGURED || !archiveIndexDocRef) {
        return {
          ok: false, reason: "no-cloud",
          message: "Cloud-Speicherung ist nicht eingerichtet — ein nur lokales Archiv wäre für das Team nicht sichtbar.",
        }
      }
      if (indexRef.current.some((e) => e.month === input.month)) {
        return { ok: false, reason: "already-archived", message: `Der Monat ${input.month} wurde bereits archiviert.` }
      }

      setClosing(true)
      try {
        const snapshot = buildSnapshot({
          month: input.month,
          rows: input.rows,
          teamGoal: input.teamGoal,
          history: input.history,
          orgChart: input.orgChart,
          closedBy: input.closedBy,
        })

        const snapRef = snapshotDocRef(input.month)
        if (!snapRef) {
          return { ok: false, reason: "write-failed", message: "Firestore ist nicht verfügbar." }
        }
        try {
          await setDoc(snapRef, snapshot)
        } catch (err) {
          console.error("Monatsabschluss: Snapshot-Schreiben fehlgeschlagen", err)
          return {
            ok: false, reason: "write-failed",
            message: "Snapshot konnte nicht gespeichert werden — die Livedaten wurden nicht verändert.",
          }
        }

        const entry = buildIndexEntry(snapshot)
        const nextMonths = [...indexRef.current.filter((e) => e.month !== input.month), entry]
          .sort((a, b) => a.month.localeCompare(b.month))
        try {
          await setDoc(archiveIndexDocRef, { version: 1, months: nextMonths })
        } catch (err) {
          console.error("Monatsabschluss: Index-Schreiben fehlgeschlagen", err)
          return {
            ok: false, reason: "write-failed",
            message: "Der Monat wurde gespeichert, aber der Archiv-Index konnte nicht aktualisiert werden. Bitte erneut versuchen.",
          }
        }

        cacheRef.current.set(input.month, snapshot)
        try { localStorage.setItem(snapshotStorageKey(input.month), JSON.stringify(snapshot)) } catch { /* noop */ }

        const nextGoal = nextMonthGoal(input.teamGoal)
        input.commitReset({
          rows: resetRowsForNewMonth(input.rows),
          teamGoal: nextGoal,
          history: input.history.filter((h) => h.date >= nextGoal.periodStart),
        })

        return { ok: true, entry }
      } finally {
        setClosing(false)
      }
    },
    [isEditor]
  )

  return { index, indexStatus, getSnapshot, loadSnapshots, snapshotStatus, closeMonth, closing }
}
