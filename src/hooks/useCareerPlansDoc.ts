// Karrierepläne im Cloud-Modus: org/careerPlans (für alle Eingeloggten lesbar, schreibt nur der Admin —
// per scripts/publish-career-plans.mjs). Kein Passwort mehr: der Zugang ist der Login.
// Ohne Firebase-Config (lokaler Modus) bleibt es beim passwortgeschützten Inhalt aus career.ts.
import { useEffect, useState } from "react"
import { getDoc } from "firebase/firestore"
import { CLOUD_CONFIGURED, orgDocRef } from "@/lib/firebase"
import type { CareerPlan } from "@/lib/data/career"

export type CareerPlansState =
  | { status: "local" }
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error" }
  | { status: "ready"; plans: CareerPlan[] }

export function useCareerPlansDoc(): CareerPlansState {
  const [state, setState] = useState<CareerPlansState>(CLOUD_CONFIGURED ? { status: "loading" } : { status: "local" })

  useEffect(() => {
    const ref = orgDocRef("careerPlans")
    if (!CLOUD_CONFIGURED || !ref) return
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
