// Strukturbaum-Cloud-Sync — Äquivalent zu initOrgChartSync()/sbPushToCloud()/
// sbSaveAll() aus legacy/index.html:4179–4232. Eigenes Firestore-Dokument
// finova/orgchart (editor-geschützt wie das Dashboard-Dokument).
import { useCallback, useEffect, useRef, useState } from "react"
import { onSnapshot, setDoc } from "firebase/firestore"
import { CLOUD_CONFIGURED, orgChartDocRef } from "@/lib/firebase"
import { withDefaultPlanRates } from "@/lib/calc/struktur"
import { SB_DEFAULT_TREE, SB_STORAGE_KEY, type OrgChartDoc } from "@/types/dashboard"

function loadLocalOrgChart(): OrgChartDoc {
  try {
    const raw = localStorage.getItem(SB_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && parsed.tree) {
        return {
          tree: parsed.tree,
          notes: parsed.notes || {},
          conns: parsed.conns || [],
          rates: parsed.rates || {},
          planRates: withDefaultPlanRates(parsed.planRates),
        }
      }
    }
  } catch (e) {
    console.warn("Konnte Strukturbaum nicht laden", e)
  }
  return {
    tree: JSON.parse(JSON.stringify(SB_DEFAULT_TREE)),
    notes: {},
    conns: [],
    rates: {},
    planRates: withDefaultPlanRates(),
  }
}

export interface UseOrgChartDocResult extends OrgChartDoc {
  /** Kompletten Strukturbaum-Zustand ersetzen, lokal cachen, in die Cloud pushen. */
  saveOrgChart: (next: OrgChartDoc) => void
}

export function useOrgChartDoc(): UseOrgChartDocResult {
  const [doc, setDocState] = useState<OrgChartDoc>(loadLocalOrgChart)
  const cloudReady = useRef(false)
  const latest = useRef(doc)
  latest.current = doc

  useEffect(() => {
    const docRef = orgChartDocRef
    if (!CLOUD_CONFIGURED || !docRef) return
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (snap.metadata.hasPendingWrites) return
        if (snap.exists()) {
          const data = (snap.data() || {}) as Partial<OrgChartDoc>
          if (data.tree && typeof data.tree === "object") {
            const next: OrgChartDoc = {
              tree: data.tree,
              notes: data.notes || {},
              conns: data.conns || [],
              rates: data.rates || {},
              planRates: withDefaultPlanRates(data.planRates),
            }
            setDocState(next)
            try { localStorage.setItem(SB_STORAGE_KEY, JSON.stringify(next)) } catch { /* noop */ }
          }
        } else {
          void setDoc(docRef, latest.current)
        }
        cloudReady.current = true
      },
      (err) => console.warn("Strukturbaum: Cloud-Verbindung fehlgeschlagen", err)
    )
    return unsub
  }, [])

  const saveOrgChart = useCallback((next: OrgChartDoc) => {
    setDocState(next)
    try { localStorage.setItem(SB_STORAGE_KEY, JSON.stringify(next)) } catch { /* noop */ }
    const docRef = orgChartDocRef
    if (CLOUD_CONFIGURED && cloudReady.current && docRef) {
      setDoc(docRef, next).catch((err) =>
        console.warn("Strukturbaum: Cloud-Speichern fehlgeschlagen", err)
      )
    }
  }, [])

  return { ...doc, saveOrgChart }
}
