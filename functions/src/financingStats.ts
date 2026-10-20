// Gesamtzahlen aller Finanzierungsfälle für das Dashboard ("Gesamt"-Ansicht): Jeder sieht von den Fällen sonst nur
// die eigenen und die seiner Mitarbeiter (firestore.rules). Diese Zusammenfassung enthält keine Einzelfälle
// und liegt in org/financingStats (für alle Eingeloggten lesbar, nur Cloud Functions schreiben).
import { getFirestore } from "firebase-admin/firestore"
import { onDocumentWritten } from "firebase-functions/v2/firestore"

export interface FinancingStats {
  /** Offene (nicht archivierte) Fälle. */
  openCount: number
  /** Summe der Kreditsummen der offenen Fälle. */
  openVolume: number
  /** Offene Fälle der Art "anlegerwohnung". */
  anlegerwohnungen: number
}

/** Spiegel der Berechnung in src/App.tsx (offeneFinanzierungsfaelle/-volumen/-anlegerwohnungen). */
export function computeFinancingStats(cases: { archived?: unknown; betrag?: unknown; art?: unknown }[]): FinancingStats {
  const open = cases.filter((c) => !c.archived)
  return {
    openCount: open.length,
    openVolume: open.reduce((s, c) => s + (Number(c.betrag) || 0), 0),
    anlegerwohnungen: open.filter((c) => c.art === "anlegerwohnung").length,
  }
}

export async function refreshFinancingStats(): Promise<FinancingStats> {
  const db = getFirestore()
  const snap = await db.collection("financings").get()
  const stats = computeFinancingStats(snap.docs.map((d) => d.data()))
  await db.doc("org/financingStats").set({ ...stats, updatedAt: new Date().toISOString() })
  return stats
}

/** Bei jeder Änderung an einem Fall die Gesamtzahlen neu berechnen. */
export const onFinancingChange = onDocumentWritten(
  { document: "financings/{caseId}", region: "europe-west1" },
  async () => { await refreshFinancingStats() },
)
