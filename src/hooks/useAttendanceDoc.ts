// Anwesenheit (Seminar/Training): employees/{id}/attendance/current
// je sichtbarem Mitarbeiter (Zugriff: selbst, Vorgesetzte, Admin; siehe
// firestore.rules). Schnittstelle: Einträge je Mitarbeitername.
// Kein localStorage-Cache (mehrere Konten pro Browser).
import { useCallback, useEffect, useRef, useState } from "react"
import { subscribeEmployeeDocs, writeEmployeeSubDoc } from "@/lib/employeeSubdocs"
import { idByName, type EmployeeMeta } from "@/lib/calc/employees"
import type { AttendanceEntry } from "@/types/dashboard"

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

  const [attendance, setAttendance] = useState<Record<string, AttendanceEntry>>({})
  const attendanceReady = useRef(false)
  const latest = useRef(attendance)
  latest.current = attendance
  const employeesRef = useRef(employees)
  employeesRef.current = employees

  useEffect(() => {
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
    if (!attendanceReady.current) return
    const id = idByName(employeesRef.current).get(name.trim().toLowerCase())
    if (!id) { console.warn(`Anwesenheit: kein Mitarbeiter-Dokument für "${name}"`); return }
    writeEmployeeSubDoc(id, "attendance", "current", { ...patch }, true).catch((err) =>
      console.warn("Anwesenheit: Cloud-Speichern fehlgeschlagen", err)
    )
  }, [])

  /** Setzt alle sichtbaren Anwesenheits-Einträge auf die Defaults zurück (leere Dokumente). */
  const resetAttendance = useCallback(() => {
    setAttendance({})
    if (!attendanceReady.current) return
    for (const e of employeesRef.current) {
      writeEmployeeSubDoc(e.id, "attendance", "current", {}).catch((err) =>
        console.warn("Anwesenheit: Cloud-Speichern fehlgeschlagen", err)
      )
    }
  }, [])

  return { attendance, setAttendanceEntry, resetAttendance }
}
