// Karrierepläne: org/careerPlans (für alle Eingeloggten lesbar, schreibt nur der Admin).
// Der Zugang ist der Login, es gibt kein Passwort.
import { useEffect, useState } from "react"
import { getDoc } from "firebase/firestore"
import { orgDocRef } from "@/lib/firebase"
import type { CareerPlan } from "@/lib/data/career"

export type CareerPlansState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error" }
  | { status: "ready"; plans: CareerPlan[] }

export function useCareerPlansDoc(): CareerPlansState {
  const [state, setState] = useState<CareerPlansState>({ status: "loading" })

  useEffect(() => {
    const ref = orgDocRef("careerPlans")
    if (!ref) return
    let cancelled = false
    getDoc(ref).then(
      (snap) => {
        if (cancelled) return
        const plans = snap.exists() ? (snap.data().plans as CareerPlan[] | undefined) : undefined
        setState(Array.isArray(plans) && plans.length > 0 ? { status: "ready", plans } : { status: "missing" })
      },
      (err) => {
        console.warn("Karrierepläne konnten nicht geladen werden", err)
        if (!cancelled) setState({ status: "error" })
      },
    )
    return () => { cancelled = true }
  }, [])

  return state
}
