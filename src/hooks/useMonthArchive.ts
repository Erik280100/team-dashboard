// Monats-Archiv — Cloud-Modus:
//   org/archiveIndex                      Liste abgeschlossener Monate + Aggregate
//   snapshots/{YYYY-MM}                   Meta (Teamziel, Verlauf, Strukturbaum des Monats)
//   snapshots/{YYYY-MM}/employees/{id}    eingefrorene Zahlen je Mitarbeiter (nur für Berechtigte lesbar)
// Ein Snapshot wird beim Laden aus Meta + den für dieses Konto sichtbaren Mitarbeiter-
// dokumenten zusammengesetzt, d. h. Führungskräfte sehen im Archiv nur ihre Unterstruktur.
// Schreiben (Monatsabschluss) darf nur der Admin. Snapshots sind unveränderlich (getDoc,
// Cache veraltet nie); ein leeres Archiv ist der Normalzustand (kein setDoc zum Anlegen).
// Kein localStorage-Cache im Cloud-Modus (mehrere Konten pro Browser).
import { useCallback, useEffect, useRef, useState } from "react"
import { collection, doc, getDoc, getDocs, onSnapshot, setDoc, writeBatch } from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { CLOUD_CONFIGURED, firestore, functions, orgDocRef } from "@/lib/firebase"
import { employeeDocToRow, idByName, rowToEmployeeData, type EmployeeMeta } from "@/lib/calc/employees"
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
  if (CLOUD_CONFIGURED) return []
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
  if (CLOUD_CONFIGURED) return null
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

export function useMonthArchive(isEditor: boolean, employees: readonly EmployeeMeta[] = []): UseMonthArchiveResult {
  const employeesRef = useRef(employees)
  employeesRef.current = employees
  const [index, setIndex] = useState<ArchiveIndexEntry[]>(loadLocalIndex)
  const [indexStatus, setIndexStatus] = useState<IndexStatus>(CLOUD_CONFIGURED ? "loading" : "ready")
  const [closing, setClosing] = useState(false)
  const [snapshotStatus, setSnapshotStatus] = useState<Record<MonthKey, SnapshotStatus>>({})
  const cacheRef = useRef<Map<MonthKey, MonthSnapshot>>(new Map())
  const [, bumpCacheVersion] = useState(0)
  const indexRef = useRef(index)
  indexRef.current = index
  const adminRef = useRef(isEditor) // App übergibt isAdmin: Monatsabschluss und Voll-Lesezugriff nur für Admin
  adminRef.current = isEditor

  useEffect(() => {
    const indexRef0 = orgDocRef("archiveIndex")
    if (!CLOUD_CONFIGURED || !indexRef0) {
      setIndexStatus("ready")
      return
    }
    const unsub = onSnapshot(
      indexRef0,
      (snap) => {
        if (snap.metadata.hasPendingWrites) return
        if (snap.exists()) {
          const data = snap.data() as { months?: ArchiveIndexEntry[] } | undefined
          const months = Array.isArray(data?.months) ? data!.months : []
          setIndex(months)
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
      if (!firestore) throw new Error("Firestore nicht verfügbar")
      const snap = await getDoc(doc(firestore, "snapshots", month))
      if (!snap.exists()) {
        setSnapshotStatus((s) => ({ ...s, [month]: "error" }))
        return null
      }
      // Zeilen: Admin liest alle, alle anderen nur die sichtbaren Mitarbeiter.
      const rowDocs: Record<string, unknown>[] = []
      if (adminRef.current) {
        const all = await getDocs(collection(firestore, "snapshots", month, "employees"))
        all.forEach((d) => rowDocs.push(d.data()))
      } else {
        await Promise.all(employeesRef.current.map(async (e) => {
          try {
            const d = await getDoc(doc(firestore!, "snapshots", month, "employees", e.id))
            if (d.exists()) rowDocs.push(d.data())
          } catch { /* für dieses Konto nicht lesbar */ }
        }))
      }
      const data = { ...(snap.data() as Omit<MonthSnapshot, "rows">), rows: rowDocs.map(employeeDocToRow) } as MonthSnapshot
      cacheRef.current.set(month, data)
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
      const indexDocRef = orgDocRef("archiveIndex")
      if (!CLOUD_CONFIGURED || !indexDocRef || !firestore) {
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
        // Sicherung vor dem riskantesten Schritt (setzt danach die Ist-Werte zurück).
        try {
          if (!functions) throw new Error("Functions nicht verfügbar")
          await httpsCallable(functions, "backupNow")()
        } catch (err) {
          console.error("Monatsabschluss: Sicherung fehlgeschlagen", err)
          return {
            ok: false, reason: "write-failed",
            message: "Die Sicherung vor dem Abschluss ist fehlgeschlagen — der Monat wurde nicht abgeschlossen und nichts verändert.",
          }
        }
        const snapshot = buildSnapshot({
          month: input.month,
          rows: input.rows,
          teamGoal: input.teamGoal,
          history: input.history,
          orgChart: input.orgChart,
          closedBy: input.closedBy,
        })

        try {
          const { rows: snapRows, ...meta } = snapshot
          const ids = idByName(employeesRef.current)
          const metaById = new Map(employeesRef.current.map((e) => [e.id, e]))
          await setDoc(doc(firestore, "snapshots", input.month), meta)
          for (let i = 0; i < snapRows.length; i += 400) {
            const batch = writeBatch(firestore)
            for (const r of snapRows.slice(i, i + 400)) {
              const id = ids.get(r.name.trim().toLowerCase())
              const e = id ? metaById.get(id) : undefined
              if (!id || !e) { console.warn(`Snapshot ${input.month}: kein Mitarbeiter für "${r.name}"`); continue }
              batch.set(doc(firestore, "snapshots", input.month, "employees", id), {
                ...rowToEmployeeData(r), name: e.name, role: e.role, ancestors: e.ancestors,
              })
            }
            await batch.commit()
          }
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
          await setDoc(indexDocRef, { version: 1, months: nextMonths })
        } catch (err) {
          console.error("Monatsabschluss: Index-Schreiben fehlgeschlagen", err)
          return {
            ok: false, reason: "write-failed",
            message: "Der Monat wurde gespeichert, aber der Archiv-Index konnte nicht aktualisiert werden. Bitte erneut versuchen.",
          }
        }

        cacheRef.current.set(input.month, snapshot)

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
