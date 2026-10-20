// Anwesenheit (Seminar/Training) — Cloud-Modus: employees/{id}/attendance/current
// je sichtbarem Mitarbeiter (Zugriff: selbst, Vorgesetzte, Admin; siehe
// firestore.rules). Schnittstelle unverändert (Einträge je Mitarbeitername).
// Im Cloud-Modus kein localStorage-Cache (mehrere Konten pro Browser).
import { useCallback, useEffect, useRef, useState } from "react"
import { CLOUD_CONFIGURED } from "@/lib/firebase"
import { subscribeEmployeeDocs, writeEmployeeSubDoc } from "@/lib/employeeSubdocs"
import { idByName, type EmployeeMeta } from "@/lib/calc/employees"
import { ATTENDANCE_KEY, type AttendanceEntry } from "@/types/dashboard"

function loadLocalAttendance(): Record<string, AttendanceEntry> {
  if (CLOUD_CONFIGURED) return {}
  try {
    const raw = localStorage.getItem(ATTENDANCE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === "object") return parsed
    }
  } catch (e) {
    console.warn("Konnte Anwesenheitsdaten nicht laden", e)
  }
  return {}
}

function saveLocalAttendance(next: Record<string, AttendanceEntry>) {
  if (CLOUD_CONFIGURED) return
  try { localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(next)) } catch { /* noop */ }
}

/** Fehlende Felder eines Eintrags mit denselben Defaults wie getAttendanceEntry() füllen. */
export function getAttendanceEntry(
  attendance: Record<string, AttendanceEntry>,
  name: string
): AttendanceEntry {
  const e = attendance[name]
  return {
    seminar: e && e.seminar !== undefined ? !!e.seminar : true,
    seminarReason: (e && e.seminarReason) || "",
    training: e && e.training !== undefined ? !!e.training : true,
    trainingReason: (e && e.trainingReason) || "",
  }
}

export interface UseAttendanceDocResult {
  attendance: Record<string, AttendanceEntry>
  setAttendanceEntry: (name: string, patch: Partial<AttendanceEntry>) => void
  resetAttendance: () => void
}

export function useAttendanceDoc(employeesIn: readonly EmployeeMeta[] = []): UseAttendanceDocResult {
  // Stabile Liste (nur bei Änderung von ID/Name neu), damit die Abos nicht bei jeder Zahlenänderung neu starten.
  const key = employeesIn.map((e) => `${e.id}:${e.name}`).join("|")
  const empRef = useRef({ key, list: employeesIn })
  if (empRef.current.key !== key) empRef.current = { key, list: employeesIn }
  const employees = empRef.current.list

  const [attendance, setAttendance] = useState<Record<string, AttendanceEntry>>(loadLocalAttendance)
  const attendanceReady = useRef(false)
  const latest = useRef(attendance)
  latest.current = attendance
  const employeesRef = useRef(employees)
  employeesRef.current = employees

  useEffect(() => {
    if (!CLOUD_CONFIGURED) return
    attendanceReady.current = false
    return subscribeEmployeeDocs<AttendanceEntry>(
      "attendance", "current", "__none__", employees,
      (entries, ready) => {
        setAttendance(entries)
        attendanceReady.current = ready
      },
      (err) => console.warn("Anwesenheit: Cloud-Verbindung fehlgeschlagen", err)
    )
  }, [employees])

  const setAttendanceEntry = useCallback((name: string, patch: Partial<AttendanceEntry>) => {
    const entry = { ...getAttendanceEntry(latest.current, name), ...patch }
    const next = { ...latest.current, [name]: entry }
    setAttendance(next)
    saveLocalAttendance(next)
    if (!CLOUD_CONFIGURED || !attendanceReady.current) return
    const id = idByName(employeesRef.current).get(name.trim().toLowerCase())
    if (!id) { console.warn(`Anwesenheit: kein Mitarbeiter-Dokument für "${name}"`); return }
    writeEmployeeSubDoc(id, "attendance", "current", { ...entry }).catch((err) =>
      console.warn("Anwesenheit: Cloud-Speichern fehlgeschlagen", err)
    )
  }, [])

  /** Setzt alle sichtbaren Anwesenheits-Einträge auf die Defaults zurück (leere Dokumente). */
  const resetAttendance = useCallback(() => {
    setAttendance({})
    saveLocalAttendance({})
    if (!CLOUD_CONFIGURED || !attendanceReady.current) return
    for (const e of employeesRef.current) {
      writeEmployeeSubDoc(e.id, "attendance", "current", {}).catch((err) =>
        console.warn("Anwesenheit: Cloud-Speichern fehlgeschlagen", err)
      )
    }
  }, [])

  return { attendance, setAttendanceEntry, resetAttendance }
}
