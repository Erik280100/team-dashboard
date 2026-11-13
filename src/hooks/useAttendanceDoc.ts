// Anwesenheit (Seminar/Training): employees/{id}/attendance/current
// je sichtbarem Mitarbeiter (Zugriff: selbst, Vorgesetzte, Admin; siehe
// firestore.rules). Schnittstelle: Einträge je Mitarbeitername.
// Kein localStorage-Cache (mehrere Konten pro Browser).
import { useCallback, useEffect, useRef, useState } from "react"
import { subscribeEmployeeDocs, writeEmployeeSubDoc } from "@/lib/employeeSubdocs"
import type { EmployeeMeta } from "@/lib/calc/employees"
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
    // Freitag/Samstag getrennt. Standard: Freitag anwesend, Samstag nicht. Ältere Einträge kennen nur das gemeinsame
    // "training" — es gilt als Vorgabe für den Freitag.
    trainingFr: e && e.trainingFr !== undefined ? !!e.trainingFr : e && e.training !== undefined ? !!e.training : true,
    trainingFrReason: (e && (e.trainingFrReason || e.trainingReason)) || "",
    trainingSa: e && e.trainingSa !== undefined ? !!e.trainingSa : false,
    trainingSaReason: (e && e.trainingSaReason) || "",
    monatsauftakt: e && e.monatsauftakt !== undefined ? !!e.monatsauftakt : true,
    monatsauftaktReason: (e && e.monatsauftaktReason) || "",
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
    // Kein Warten auf "ready": Es wird nur das geänderte Feld per Merge geschrieben, ein veralteter Stand kann also
    // nichts überschreiben. Ein Abbruch hier ließ die Anzeige zurückspringen, ohne dass etwas gespeichert wurde.
    if (!attendanceReady.current) console.info("Anwesenheit: Stand noch nicht vollständig geladen, speichere trotzdem", name)
    // Alle Mitarbeiter-Dokumente mit diesem Namen beschreiben: Gibt es einen Namen doppelt, zeigt die Anzeige ein anderes
    // Dokument als das zuerst gefundene — der Haken sprang dann zurück, obwohl gespeichert wurde.
    const key = name.trim().toLowerCase()
    const ids = employeesRef.current.filter((e) => e.name.trim().toLowerCase() === key).map((e) => e.id)
    if (ids.length === 0) { console.warn(`Anwesenheit: kein Mitarbeiter-Dokument für "${name}"`); return }
    if (ids.length > 1) console.warn(`Anwesenheit: Name "${name}" gibt es ${ids.length}x als Mitarbeiter`, ids)
    for (const id of ids) {
      writeEmployeeSubDoc(id, "attendance", "current", { ...patch }, true).catch((err) =>
        console.warn("Anwesenheit: Cloud-Speichern fehlgeschlagen", err)
      )
    }
  }, [])

  /** Setzt bei allen sichtbaren Mitarbeitern alle Anwesenheiten (Seminar, Training Fr/Sa, Monatsauftakt) auf „nicht anwesend“. */
  const resetAttendance = useCallback(() => {
    const absent: AttendanceEntry = {
      seminar: false, seminarReason: "",
      trainingFr: false, trainingFrReason: "",
      trainingSa: false, trainingSaReason: "",
      monatsauftakt: false, monatsauftaktReason: "",
    }
    const next: Record<string, AttendanceEntry> = {}
    for (const e of employeesRef.current) next[e.name] = { ...absent }
    setAttendance(next)
    for (const e of employeesRef.current) {
      writeEmployeeSubDoc(e.id, "attendance", "current", { ...absent }).catch((err) =>
        console.warn("Anwesenheit: Cloud-Speichern fehlgeschlagen", err)
      )
    }
  }, [])

  return { attendance, setAttendanceEntry, resetAttendance }
}
