// Hört auf neue Buchungs-Ereignisse (celebrations) und löst den Konfettiregen aus. Das Laden der Seite löst
// nichts aus: Ereignisse, die beim Start schon da waren (oder älter als 1 Minute sind), werden ignoriert.
import { useEffect } from "react"
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore"
import { CLOUD_CONFIGURED, firestore } from "@/lib/firebase"
import { celebrate } from "@/lib/celebrate"

const MAX_AGE_MS = 60_000

export function useCelebrations(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !CLOUD_CONFIGURED || !firestore) return
    let first = true
    return onSnapshot(
      query(collection(firestore, "celebrations"), orderBy("at", "desc"), limit(5)),
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type !== "added" || first) return
          const data = change.doc.data() as { name?: string; at?: number }
          if (typeof data.at === "number" && Date.now() - data.at > MAX_AGE_MS) return
          celebrate(typeof data.name === "string" ? data.name : undefined)
        })
        first = false
      },
      (err) => console.warn("Konfetti: Verbindung fehlgeschlagen", err),
    )
  }, [enabled])
}
