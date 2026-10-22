// Speichern ohne fremde Änderungen zu überschreiben: liest den aktuellen Cloud-Stand in einer
// Transaktion, arbeitet nur die eigenen Änderungen (mine gegenüber base) ein und schreibt das Ergebnis.
import { runTransaction, type DocumentReference } from "firebase/firestore"
import { firestore } from "@/lib/firebase"
import { mergeThreeWay } from "@/lib/calc/threeWayMerge"

export async function saveMerged<T extends object>(ref: DocumentReference, base: T, mine: T): Promise<T> {
  if (!firestore) throw new Error("Firestore nicht initialisiert")
  return runTransaction(firestore, async (tx) => {
    const snap = await tx.get(ref)
    const merged = (snap.exists() ? mergeThreeWay(base, mine, snap.data()) : mine) as T
    tx.set(ref, merged)
    return merged
  })
}
