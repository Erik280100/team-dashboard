// Strukturbaum (Baum, Notizen, Verbindungen, Sätze) — Cloud-Modus: Dokument
// org/structure. Lesen: alle Eingeloggten; Schreiben: nur Admin (firestore.rules).
// Kein localStorage-Cache im Cloud-Modus (mehrere Konten pro Browser).
import { useCallback, useEffect, useRef, useState } from "react"
import { onSnapshot, setDoc } from "firebase/firestore"
import { CLOUD_CONFIGURED, orgDocRef } from "@/lib/firebase"
import { withDefaultPlanRates } from "@/lib/calc/struktur"
import { SB_DEFAULT_TREE, SB_STORAGE_KEY, type OrgChartDoc } from "@/types/dashboard"

function loadLocalOrgChart(): OrgChartDoc {
  if (CLOUD_CONFIGURED) return emptyOrgChart()
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

/** Platzhalter bis der Cloud-Stand da ist — bewusst ohne Personen (kein Default-Baum im Cloud-Modus). */
function emptyOrgChart(): OrgChartDoc {
  return { tree: { id: "root", name: "", role: "", status: "vielleicht", children: [] }, notes: {}, conns: [], rates: {}, planRates: withDefaultPlanRates() }
}

export interface UseOrgChartDocResult extends OrgChartDoc {
  /** Kompletten Strukturbaum-Zustand ersetzen, lokal cachen, in die Cloud pushen. */
  saveOrgChart: (next: OrgChartDoc) => void
}

export function useOrgChartDoc(isAdmin = false): UseOrgChartDocResult {
  const [doc, setDocState] = useState<OrgChartDoc>(loadLocalOrgChart)
  const cloudReady = useRef(false)
  const latest = useRef(doc)
  latest.current = doc

  useEffect(() => {
    const docRef = orgDocRef("structure")
    if (!CLOUD_CONFIGURED || !docRef) return
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (snap.metadata.hasPendingWrites) return
        // Nur Server-Stände zählen: ein Cache-Snapshot ("Dokument fehlt"/veraltet) darf weder
        // die Cloud mit lokalem Altstand überschreiben (setDoc) noch Schreiben freischalten.
        if (snap.metadata.fromCache) return
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
          }
        }
        // Kein Anlegen bei fehlendem Dokument: org/structure erzeugt die Migration, nie ein leerer Client-Stand.
        cloudReady.current = true
      },
      (err) => console.warn("Strukturbaum: Cloud-Verbindung fehlgeschlagen", err)
    )
    return unsub
  }, [])

  const saveOrgChart = useCallback((next: OrgChartDoc) => {
    setDocState(next)
    if (!CLOUD_CONFIGURED) {
      try { localStorage.setItem(SB_STORAGE_KEY, JSON.stringify(next)) } catch { /* noop */ }
      return
    }
    const docRef = orgDocRef("structure")
    if (isAdmin && cloudReady.current && docRef) {
      setDoc(docRef, next).catch((err) =>
        console.warn("Strukturbaum: Cloud-Speichern fehlgeschlagen", err)
      )
    }
  }, [isAdmin])

  return { ...doc, saveOrgChart }
}
