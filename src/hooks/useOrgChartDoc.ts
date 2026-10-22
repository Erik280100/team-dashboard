// Strukturbaum (Baum, Notizen, Verbindungen, Sätze) — Cloud-Modus: Dokument
// org/structure. Lesen: alle Eingeloggten; Schreiben: nur Admin (firestore.rules).
// Kein localStorage-Cache im Cloud-Modus (mehrere Konten pro Browser).
import { useCallback, useEffect, useRef, useState } from "react"
import { getDoc, onSnapshot, updateDoc } from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { CLOUD_CONFIGURED, functions, orgDocRef } from "@/lib/firebase"
import { sbAll, sbFind, withDefaultPlanRates } from "@/lib/calc/struktur"
import { diffFields, toUpdateArgs } from "@/lib/calc/fieldDiff"
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

/** Was ein Nicht-Admin an die Cloud Function schickt: die Kinder des eigenen Knotens + deren Notizen/Verbindungen. */
export function subtreePayload(doc: OrgChartDoc, myNodeId: string) {
  const me = sbFind(doc.tree, myNodeId)
  const children = JSON.parse(JSON.stringify(me?.children ?? [])) as OrgChartDoc["tree"][]
  const ids = new Set(children.flatMap((c) => sbAll(c).map((n) => n.id)))
  return {
    children,
    notes: Object.fromEntries(Object.entries(doc.notes).filter(([id]) => ids.has(id))),
    conns: doc.conns.filter((c) => ids.has(c.from) && ids.has(c.to)),
  }
}

/**
 * Admin schreibt org/structure direkt; alle anderen ändern über die Cloud Function updateSubtree nur
 * unterhalb ihres eigenen Knotens (`myNodeId` = Mitarbeiter-ID = Knoten-ID).
 */
export function useOrgChartDoc(isAdmin = false, myNodeId: string | null = null): UseOrgChartDocResult {
  const [doc, setDocState] = useState<OrgChartDoc>(loadLocalOrgChart)
  const cloudReady = useRef(false)
  const latest = useRef(doc)
  latest.current = doc
  // Zuletzt von der Cloud gesehener bzw. selbst geschriebener Stand: Grundlage für den feldgenauen Diff beim Speichern.
  const baseline = useRef<OrgChartDoc>(doc)

  function applyServerData(raw: unknown) {
    const data = (raw || {}) as Partial<OrgChartDoc>
    if (data.tree && typeof data.tree === "object") {
      baseline.current = {
        tree: data.tree,
        notes: data.notes || {},
        conns: data.conns || [],
        rates: data.rates || {},
        planRates: withDefaultPlanRates(data.planRates),
      }
      setDocState({
        tree: data.tree,
        notes: data.notes || {},
        conns: data.conns || [],
        rates: data.rates || {},
        planRates: withDefaultPlanRates(data.planRates),
      })
    }
  }

  useEffect(() => {
    const docRef = orgDocRef("structure")
    if (!CLOUD_CONFIGURED || !docRef) return
    const unsub = onSnapshot(
      docRef,
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.metadata.hasPendingWrites) return
        // Nur Server-Stände zählen: ein Cache-Snapshot ("Dokument fehlt"/veraltet) darf weder
        // die Cloud mit lokalem Altstand überschreiben (setDoc) noch Schreiben freischalten.
        if (snap.metadata.fromCache) return
        if (snap.exists()) applyServerData(snap.data())
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
    if (!cloudReady.current || !docRef) return
    if (isAdmin) {
      // Nur geänderte Felder schreiben (Notizen/Sätze je Eintrag, Baum/Verbindungen als Ganzes), nie das ganze Dokument.
      const args = toUpdateArgs(diffFields({ ...baseline.current }, { ...next }))
      baseline.current = next
      if (!args) return
      updateDoc(docRef, ...args).catch((err) =>
        console.warn("Strukturbaum: Cloud-Speichern fehlgeschlagen", err)
      )
      return
    }
    if (!myNodeId || !functions) return
    httpsCallable(functions, "updateSubtree")(subtreePayload(next, myNodeId)).catch(async (err) => {
      console.warn("Strukturbaum: Änderung abgelehnt", err)
      alert("Die Änderung konnte nicht gespeichert werden: " + (err instanceof Error ? err.message : String(err)))
      // Optimistische Anzeige zurücksetzen auf den Stand der Cloud.
      try { applyServerData((await getDoc(docRef)).data()) } catch { /* noop */ }
    })
  }, [isAdmin, myNodeId])

  return { ...doc, saveOrgChart }
}
