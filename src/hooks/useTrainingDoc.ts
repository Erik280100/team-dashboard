// Training-Einteilung je Trainingstag: Dokument training/fr bzw. training/sa (Thema je Führungskraft, Trainee -> Führungskraft).
// Lesen/Schreiben: Führungskräfte und Admin, Lesemodus nur lesen (siehe firestore.rules).
// Geschrieben wird feldgenau (merge), damit zwei Führungskräfte, die gleichzeitig einteilen, einander nicht überschreiben.
// Kein localStorage-Cache (mehrere Konten pro Browser).
import { useCallback, useEffect, useRef, useState } from "react"
import { deleteField, onSnapshot, setDoc } from "firebase/firestore"
import { trainingDocRef } from "@/lib/firebase"
import type { TrainingDay, TrainingDoc, TrainingTopic } from "@/types/dashboard"

const EMPTY: TrainingDoc = { topics: {}, assignments: {} }

export interface UseTrainingDocResult extends TrainingDoc {
  /** Thema einer Führungskraft setzen (null = entfernen). */
  setTopic: (fkId: string, topic: TrainingTopic | null) => void
  /** Trainee einer Führungskraft zuteilen (null = Zuteilung aufheben). */
  assign: (traineeId: string, fkId: string | null) => void
  /** Gesamte Einteilung (Themen und Zuteilungen) löschen. */
  reset: () => void
}

export function useTrainingDoc(enabled: boolean, day: TrainingDay): UseTrainingDocResult {
  const [doc, setDocState] = useState<TrainingDoc>(EMPTY)
  const ready = useRef(false)
  const dayRef = useRef(day)
  dayRef.current = day

  useEffect(() => {
    ready.current = false
    setDocState(EMPTY) // beim Tageswechsel nicht kurz die Einteilung des anderen Tages zeigen
    if (!enabled) return
    const ref = trainingDocRef(day)
    if (!ref) return
    return onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) => {
        // Nur Server-Stände zählen (eigene, noch unbestätigte Schreibvorgänge zeigt die UI bereits optimistisch).
        if (snap.metadata.hasPendingWrites || snap.metadata.fromCache) return
        const data = (snap.data() ?? {}) as Partial<TrainingDoc>
        setDocState({ topics: data.topics ?? {}, assignments: data.assignments ?? {} })
        ready.current = true
      },
      (err) => console.warn("Training: Cloud-Verbindung fehlgeschlagen", err)
    )
  }, [enabled, day])

  const write = useCallback((data: Record<string, unknown>, merge = true) => {
    const ref = trainingDocRef(dayRef.current)
    if (!ref || !ready.current) return
    (merge ? setDoc(ref, data, { merge: true }) : setDoc(ref, data)).catch((err) =>
      console.warn("Training: Cloud-Speichern fehlgeschlagen", err)
    )
  }, [])

  const setTopic = useCallback((fkId: string, topic: TrainingTopic | null) => {
    setDocState((d) => {
      const topics = { ...d.topics }
      if (topic) topics[fkId] = topic
      else delete topics[fkId]
      return { ...d, topics }
    })
    write({ topics: { [fkId]: topic ?? deleteField() } })
  }, [write])

  const assign = useCallback((traineeId: string, fkId: string | null) => {
    setDocState((d) => {
      const assignments = { ...d.assignments }
      if (fkId) assignments[traineeId] = fkId
      else delete assignments[traineeId]
      return { ...d, assignments }
    })
    write({ assignments: { [traineeId]: fkId ?? deleteField() } })
  }, [write])

  const reset = useCallback(() => {
    setDocState(EMPTY)
    write({ topics: {}, assignments: {} }, false)
  }, [write])

  return { ...doc, setTopic, assign, reset }
}
