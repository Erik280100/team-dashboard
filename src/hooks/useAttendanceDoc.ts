// Anwesenheits-Cloud-Sync — Äquivalent zu initAttendanceSync()/pushAttendanceToCloud()/
// saveAttendance() aus legacy/index.html:2394–2417,2388–2392. Eigenes Firestore-
// Dokument finova/attendance, laut Firestore-Regeln offen beschreibbar, damit
// jeder Mitarbeiter ohne Login an-/abhaken kann.
import { useCallback, useEffect, useRef, useState } from "react"
import { onSnapshot, setDoc } from "firebase/firestore"
import { CLOUD_CONFIGURED, attendanceDocRef } from "@/lib/firebase"
import { saveMerged } from "@/lib/cloudMerge"
import { ATTENDANCE_KEY, type AttendanceDoc, type AttendanceEntry } from "@/types/dashboard"

function loadLocalAttendance(): Record<string, AttendanceEntry> {
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

export function useAttendanceDoc(): UseAttendanceDocResult {
  const [attendance, setAttendance] = useState<Record<string, AttendanceEntry>>(
    loadLocalAttendance
  )
  const attendanceReady = useRef(false)
  const latest = useRef(attendance)
  latest.current = attendance
  // Zuletzt von der Cloud gesehener bzw. selbst geschriebener Stand: Grundlage, um nur die eigenen Änderungen zu speichern.
  const baseline = useRef<AttendanceDoc>({ entries: attendance })

  useEffect(() => {
    const docRef = attendanceDocRef
    if (!CLOUD_CONFIGURED || !docRef) return
    const unsub = onSnapshot(
      docRef,
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.metadata.hasPendingWrites) return
        // Nur Server-Stände zählen: ein Cache-Snapshot ("Dokument fehlt"/veraltet) darf weder
        // die Cloud mit lokalem Altstand überschreiben (setDoc) noch Schreiben freischalten.
        if (snap.metadata.fromCache) return
        if (snap.exists()) {
          const data = (snap.data() || {}) as Partial<AttendanceDoc>
          if (data.entries && typeof data.entries === "object") {
            baseline.current = { entries: data.entries }
            setAttendance(data.entries)
            try { localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(data.entries)) } catch { /* noop */ }
          }
        } else {
          void setDoc(docRef, { entries: latest.current })
        }
        attendanceReady.current = true
      },
      (err) => console.warn("Anwesenheit: Cloud-Verbindung fehlgeschlagen", err)
    )
    return unsub
  }, [])

  const setAttendanceEntry = useCallback((name: string, patch: Partial<AttendanceEntry>) => {
    const next = {
      ...latest.current,
      [name]: { ...getAttendanceEntry(latest.current, name), ...patch },
    }
    setAttendance(next)
    try { localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(next)) } catch { /* noop */ }
    const docRef = attendanceDocRef
    if (CLOUD_CONFIGURED && attendanceReady.current && docRef) {
      const base = baseline.current
      baseline.current = { entries: next }
      saveMerged(docRef, base, { entries: next }).catch((err) => {
        baseline.current = base
        console.warn("Anwesenheit: Cloud-Speichern fehlgeschlagen", err)
      })
    }
  }, [])

  /** Setzt alle Anwesenheits-Einträge auf die Defaults zurück (leeres Dokument). */
  const resetAttendance = useCallback(() => {
    const next = {}
    setAttendance(next)
    try { localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(next)) } catch { /* noop */ }
    const docRef = attendanceDocRef
    if (CLOUD_CONFIGURED && attendanceReady.current && docRef) {
      const base = baseline.current
      baseline.current = { entries: next }
      saveMerged(docRef, base, { entries: next }).catch((err) => {
        baseline.current = base
        console.warn("Anwesenheit: Cloud-Speichern fehlgeschlagen", err)
      })
    }
  }, [])

  return { attendance, setAttendanceEntry, resetAttendance }
}
