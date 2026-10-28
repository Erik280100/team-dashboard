// Umsatzverfolgung: aus den Eingaben des EH-Rechners die Zeilen ableiten, die bei einer Buchung
// in die Tabelle (Seite Umsatzverfolgung) wandern. Reine Funktion, siehe EhRechner.tsx.
import { EH_ITEMS, type EhResult } from "@/lib/calc/eh"

export interface UmsatzDraft {
  produkt: string
  praemie: number
  praemieLabel: string
  einheiten: number
  /** Optional beim Buchen im EH-Rechner eingetragen; leer = später in der Umsatzverfolgung pflegen. */
  kunde?: string
}

/**
 * Suche in der Umsatzverfolgung: Text trifft Kunde, Mitarbeiter und Produkt; eine Zahl (Komma oder Punkt)
 * trifft zusätzlich Einheiten oder Prämie, wenn sie dem Wert entspricht oder am Anfang der Zahl steht.
 */
export function umsatzMatches(
  e: { kunde: string; mitarbeiter: string; produkt: string; praemie: number; einheiten: number },
  query: string
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if ([e.kunde, e.mitarbeiter, e.produkt].some((s) => s.toLowerCase().includes(q))) return true
  const num = q.replace(/\s/g, "").replace(",", ".")
  if (!/^\d+(\.\d*)?$/.test(num)) return false
  return [e.praemie, e.einheiten].some((v) => {
    const rounded = String(Math.round(v * 100) / 100)
    return rounded.startsWith(num) || Math.abs(v - Number(num)) < 0.005
  })
}

/** Jede Position mit eingetragenem Betrag > 0 ergibt eine Zeile (in der Reihenfolge des Rechners). */
export function umsatzDrafts(j: Record<string, string>, perItem: EhResult["perItem"], kunde = ""): UmsatzDraft[] {
  const out: UmsatzDraft[] = []
  const name = kunde.trim()
  for (const it of EH_ITEMS) {
    if (it.disabled) continue
    const praemie = Number(j[it.id]) || 0
    if (praemie <= 0) continue
    out.push({ produkt: it.label, praemie, praemieLabel: it.jLabel, einheiten: perItem[it.id] ?? 0, ...(name ? { kunde: name } : {}) })
  }
  return out
}
