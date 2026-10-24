// Dashboard-Daten (rows/teamGoal/history): liest/schreibt die
// Mitarbeiter-Dokumente employees/{id} (siehe firestore.rules) und org/teamGoal;
// die Schnittstelle liefert rows als EmployeeRow-Liste, damit Sektionen und calc/* damit rechnen.
//
// Wer was sieht: alle Eingeloggten sehen alle Mitarbeiter-Dokumente (Stammdaten, Einheiten,
// Monatssummen); geschrieben werden darf nur das eigene Dokument und die der Mitarbeiter darunter
// (erzwingen die Firestore-Regeln).
// Es wird bewusst NICHTS in localStorage gecacht: Der Browser kann von
// mehreren Konten benutzt werden, Zahlen dürfen nicht zwischen ihnen durchsickern.
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { FieldPath, increment, onSnapshot, setDoc, updateDoc, writeBatch } from "firebase/firestore"
import { employeeDocRef, employeesCollection, firestore, orgDocRef } from "@/lib/firebase"
import { recordSnapshot, type HistoryEntry } from "@/lib/calc/format"
import { withCalendarPeriod } from "@/lib/calc/archive"
import {
  diffRowWrites, employeeDocToRow, employeeMetaOf, idByName, type EmployeeMeta,
} from "@/lib/calc/employees"
import { newRowFor } from "@/lib/calc/team"
import { applyUnitDelta, unitBookingOps } from "@/lib/calc/verguetung"
import type { PlanId } from "@/lib/calc/struktur"
import type { AccountInfo } from "@/lib/calc/roles"
import { STARTER_GOAL, type DashboardDoc, type EmployeeRow, type TeamGoal } from "@/types/dashboard"

export type SyncStatus = "connecting" | "connected" | "error"

export interface UseDashboardDocResult {
  rows: EmployeeRow[]
  /** Stammdaten (ID, Name, Vorgesetzte) aller für dieses Konto sichtbaren Mitarbeiter. */
  employees: EmployeeMeta[]
  teamGoal: TeamGoal
  history: HistoryEntry[]
  syncStatus: SyncStatus
  /** rows ersetzen: geänderte Zeilen werden in ihre Mitarbeiter-Dokumente geschrieben. */
  saveRows: (next: EmployeeRow[]) => void
  /** Einheiten (EH-Rechner) additiv auf einen Mitarbeiter buchen. In der Cloud wird atomar hochgezählt
   * (increment): gleichzeitige Buchungen mehrerer Personen auf dieselbe Person gehen nicht verloren. */
  bookUnits: (name: string, delta: Record<PlanId, number>, abwickler?: string) => void
  /** teamGoal ersetzen (nur Admin; sonst wirkungslos). */
  saveGoal: (next: TeamGoal) => void
  /** rows+teamGoal+history in einem Zug ersetzen — Monatsabschluss-Reset (nur Admin). */
  saveAll: (next: DashboardDoc) => void
}

interface Stored { meta: EmployeeMeta; row: EmployeeRow }

export function useDashboardDoc(account: AccountInfo): UseDashboardDocResult {
  const isAdmin = account.role === "admin"
  const myId = account.employeeId

  const [stored, setStored] = useState<Record<string, Stored>>({})
  // Gerechnet wird immer im Kalendermonat: ältere Stände (Umsatzmonat ab erstem Mittwoch) werden beim Laden
  // auf 1. bis letzter Tag des Startmonats gezogen.
  const [teamGoal, setTeamGoal] = useState<TeamGoal>(() => withCalendarPeriod({ ...STARTER_GOAL }))
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("connecting")
  const goalReady = useRef(false)

  // ---- Mitarbeiter lesen ----
  useEffect(() => {
    const col = employeesCollection()
    if (!col) return
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
      unsubs.push(onSnapshot(col, { includeMetadataChanges: true }, (snap) => {
        setStored(toMap(snap.docs))
        if (!snap.metadata.fromCache) setSyncStatus("connected")
      }, onError))
    } else {
      setSyncStatus("connected") // Konto ohne verknüpften Mitarbeiter: nichts zu laden
    }
    return () => unsubs.forEach((u) => u())
  }, [isAdmin, myId])

  // ---- Teamziel/Verlauf lesen (org/teamGoal, für alle Eingeloggten lesbar) ----
  useEffect(() => {
    const ref = orgDocRef("teamGoal")
    if (!ref) return
    return onSnapshot(ref, { includeMetadataChanges: true }, (snap) => {
      if (snap.metadata.fromCache) return
      if (snap.exists()) {
        const data = snap.data() as Partial<DashboardDoc>
        if (data.teamGoal && typeof data.teamGoal === "object") setTeamGoal(withCalendarPeriod({ ...STARTER_GOAL, ...data.teamGoal }))
        if (Array.isArray(data.history)) setHistory(data.history)
      }
      goalReady.current = true
    }, (err) => console.warn("Teamziel konnte nicht geladen werden", err))
  }, [])

  const employees = useMemo(
    () => Object.values(stored).map((s) => s.meta).sort((a, b) => a.name.localeCompare(b.name, "de")),
    [stored]
  )
  const rows = useMemo(() => employees.map((m) => stored[m.id].row), [employees, stored])

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
    const { writes, skipped } = diffRowWrites(cur.rows, next, cur.employees)
    if (skipped.length) console.warn("Keine Mitarbeiter-Dokumente für:", skipped.join(", "))
    writeRows(writes)
    // Verlauf (Team-Gesamt-Ist) kennt nur der Admin vollständig — Teilsichten dürfen ihn nicht überschreiben.
    if (isAdmin) {
      const h = recordSnapshot(next, cur.history)
      setHistory(h)
      if (JSON.stringify(h) !== JSON.stringify(cur.history)) pushGoal({ history: h })
    }
  }, [isAdmin, pushGoal, writeRows])

  const bookUnits = useCallback((name: string, delta: Record<PlanId, number>, abwickler?: string) => {
    const cur = latest.current
    const key = name.trim().toLowerCase()
    const idx = cur.rows.findIndex((r) => r.name.trim().toLowerCase() === key)
    const row = idx >= 0 ? cur.rows[idx] : newRowFor(name)
    const nextRows = idx >= 0 ? cur.rows.map((r, i) => (i === idx ? applyUnitDelta(r, delta, abwickler) : r)) : [...cur.rows, applyUnitDelta(row, delta, abwickler)]
    const id = idByName(cur.employees).get(key)
    const ref = id ? employeeDocRef(id) : null
    if (!ref) { console.warn(`Einheiten buchen: kein Mitarbeiter-Dokument für "${name}"`); return }
    const { increments, absolute } = unitBookingOps(row, delta, abwickler)
    const args: unknown[] = []
    for (const [k, v] of Object.entries(absolute)) args.push(k, v)
    for (const inc of increments) args.push(new FieldPath(...inc.path), increment(inc.by))
    if (args.length > 0) {
      const [field, value, ...more] = args as [string | FieldPath, unknown, ...unknown[]]
      updateDoc(ref, field, value, ...more).catch((err) => { console.warn("Cloud-Speichern fehlgeschlagen", err); setSyncStatus("error") })
    }
    // Verlauf (Team-Gesamt-Ist) wie in saveRows: nur der Admin kennt ihn vollständig.
    if (isAdmin) {
      const h = recordSnapshot(nextRows, cur.history)
      setHistory(h)
      if (JSON.stringify(h) !== JSON.stringify(cur.history)) pushGoal({ history: h })
    }
  }, [isAdmin, pushGoal])

  const saveGoal = useCallback((next: TeamGoal) => {
    setTeamGoal(next)
    pushGoal({ teamGoal: next })
  }, [pushGoal])

  const saveAll = useCallback((next: DashboardDoc) => {
    setTeamGoal(next.teamGoal)
    setHistory(next.history)
    if (!isAdmin) return
    const cur = latest.current
    const { writes } = diffRowWrites(cur.rows, next.rows, cur.employees)
    writeRows(writes)
    pushGoal({ teamGoal: next.teamGoal, history: next.history })
  }, [isAdmin, pushGoal, writeRows])

  return { rows, employees, teamGoal, history, syncStatus, saveRows, bookUnits, saveGoal, saveAll }
}
