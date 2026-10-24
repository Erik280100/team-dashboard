// Konfettiregen bei Umsatzbuchungen: Die Buchung schreibt ein Ereignis nach celebrations/{id}; jeder eingeloggte
// Client hört darauf (useCelebrations) und löst den Regen aus.
import { addDoc, collection } from "firebase/firestore"
import { firestore } from "@/lib/firebase"

export const CELEBRATE_EVENT = "finova:celebrate"

/** Konfettiregen auf diesem Gerät auslösen (name = wer gebucht hat, für die Einblendung). */
export function celebrate(name?: string): void {
  window.dispatchEvent(new CustomEvent(CELEBRATE_EVENT, { detail: { name } }))
}

/** Buchung an alle melden. Fehler (z. B. Regeln noch nicht deployt) dürfen die Buchung nie stören. */
export function announceCelebration(name: string): void {
  if (!firestore) {
    celebrate(name)
    return
  }
  addDoc(collection(firestore, "celebrations"), { name, at: Date.now() }).catch((err) => {
    console.warn("Konfetti-Ereignis konnte nicht gesendet werden", err)
    celebrate(name) // wenigstens der Buchende sieht es
  })
}
