// Training-Einteilung je Trainingstag: Dokument training/fr bzw. training/sa (topics: Trainee -> Thema, assignments: Thema -> Führungskraft/Trainer).
// Lesen/Schreiben: Führungskräfte und Admin, Lesemodus nur lesen (siehe firestore.rules).
// Geschrieben wird feldgenau (merge), damit zwei Führungskräfte, die gleichzeitig einteilen, einander nicht überschreiben.
// Kein localStorage-Cache (mehrere Konten pro Browser).
import { useCallback, useEffect, useRef, useState } from "react"
import { deleteField, onSnapshot, setDoc } from "firebase/firestore"
import { trainingDocRef } from "@/lib/firebase"
import type { TrainingDay, TrainingDoc, TrainingTopic } from "@/types/dashboard"

const EMPTY: TrainingDoc = { topics: {}, assignments: {} }

export interface UseTrainingDocResult extends TrainingDoc {
  /** Thema eines Trainees setzen (null = entfernen). */
  setTopic: (traineeId: string, topic: TrainingTopic | null) => void
  /** Thema einer Führungskraft (Trainer) zuteilen (null = Zuteilung aufheben). */
  assign: (topic: TrainingTopic, fkId: string | null) => void
  /** Gesamte Einteilung (Themen und Zuteilungen) löschen. */
  reset: () => void
  /** true, sobald der Stand vom Server da ist; vorher wird nicht geschrieben. */
  ready: boolean
  /** Laden oder Speichern in der Cloud fehlgeschlagen (null = alles in Ordnung). */
  error: "load" | "save" | null
}

export function useTrainingDoc(enabled: boolean, day: TrainingDay): UseTrainingDocResult {
  const [doc, setDocState] = useState<TrainingDoc>(EMPTY)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<UseTrainingDocResult["error"]>(null)
  const ready = useRef(false)
  const dayRef = useRef(day)
  dayRef.current = day

  useEffect(() => {
    ready.current = false
    setIsReady(false)
    setError(null)
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
        setIsReady(true)
      },
      (err) => {
        console.warn("Training: Cloud-Verbindung fehlgeschlagen", err)
        ready.current = false
        setIsReady(false)
        setError("load")
      }
    )
  }, [enabled, day])

  const write = useCallback((data: Record<string, unknown>, merge = true) => {
    const ref = trainingDocRef(dayRef.current)
    if (!ref || !ready.current) return
    const writtenDay = dayRef.current
    ;(merge ? setDoc(ref, data, { merge: true }) : setDoc(ref, data)).then(
      () => { if (dayRef.current === writtenDay) setError((e) => (e === "save" ? null : e)) },
      (err) => {
        console.warn("Training: Cloud-Speichern fehlgeschlagen", err)
        if (dayRef.current === writtenDay) setError("save") // Firestore liefert danach wieder den Serverstand
      }
    )
  }, [])

  const setTopic = useCallback((traineeId: string, topic: TrainingTopic | null) => {
    if (!ready.current) return // nichts anzeigen, was nicht gespeichert wird
    setDocState((d) => {
      const topics = { ...d.topics }
      if (topic) topics[traineeId] = topic
      else delete topics[traineeId]
      return { ...d, topics }
    })
    write({ topics: { [traineeId]: topic ?? deleteField() } })
  }, [write])

  const assign = useCallback((topic: TrainingTopic, fkId: string | null) => {
    if (!ready.current) return
    setDocState((d) => {
      const assignments = { ...d.assignments }
      if (fkId) assignments[topic] = fkId
      else delete assignments[topic]
      return { ...d, assignments }
    })
    write({ assignments: { [topic]: fkId ?? deleteField() } })
  }, [write])

  const reset = useCallback(() => {
    if (!ready.current) return
    setDocState(EMPTY)
    write({ topics: {}, assignments: {} }, false)
  }, [write])

  return { ...doc, setTopic, assign, reset, ready: isReady, error }
}
