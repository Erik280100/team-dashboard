// Kontodaten (uid, E-Mail, "wartet auf erste Anmeldung") aus employees/{id}/private/account.
// Diese Dokumente lesen nur der Mitarbeiter selbst, Vorgesetzte und Admin (firestore.rules) — deshalb
// nur für die übergebenen IDs abonnieren (Strukturbaum: die gewählte Person, Konten: alle für den Admin).
import { useEffect, useState } from "react"
import { onSnapshot } from "firebase/firestore"
import { employeeSubDocRef } from "@/lib/employeeSubdocs"
import { accountStateOf, type AccountState } from "@/lib/calc/employees"

export function useAccountStates(ids: readonly string[]): Record<string, AccountState> {
  const key = ids.join("|")
  const [states, setStates] = useState<Record<string, AccountState>>({})

  useEffect(() => {
    setStates({})
    if (!key) return
    const unsubs = key.split("|").map((id) => {
      const ref = employeeSubDocRef(id, "private", "account")
      if (!ref) return () => {}
      return onSnapshot(
        ref,
        (snap) => setStates((prev) => ({ ...prev, [id]: accountStateOf(snap.exists() ? snap.data() : undefined) })),
        (err) => console.warn(`Konto-Daten von ${id} nicht lesbar`, err),
      )
    })
    return () => unsubs.forEach((u) => u())
  }, [key])

  return states
}
