// Gesamtzahlen aller Finanzierungsfälle (org/financingStats, von der Cloud Function onFinancingChange gepflegt).
// Einzelne Fälle sieht man nur für das eigene Team; für die Gesamtansicht des Dashboards reichen diese Summen.
import { useEffect, useState } from "react"
import { onSnapshot } from "firebase/firestore"
import { orgDocRef } from "@/lib/firebase"

export interface FinancingStats {
  openCount: number
  openVolume: number
  anlegerwohnungen: number
}

/** null, solange (noch) keine Gesamtzahlen vorliegen — dann gelten ersatzweise die sichtbaren Fälle. */
export function useFinancingStats(): FinancingStats | null {
  const [stats, setStats] = useState<FinancingStats | null>(null)

  useEffect(() => {
    const ref = orgDocRef("financingStats")
    if (!ref) return
    return onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.metadata.fromCache) return
        const d = snap.data()
        setStats(
          d
            ? {
                openCount: Number(d.openCount) || 0,
                openVolume: Number(d.openVolume) || 0,
                anlegerwohnungen: Number(d.anlegerwohnungen) || 0,
              }
            : null
        )
      },
      (err) => console.warn("Finanzierungs-Gesamtzahlen nicht lesbar", err)
    )
  }, [])

  return stats
}
