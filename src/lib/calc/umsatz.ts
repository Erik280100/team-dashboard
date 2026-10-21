// Umsatzverfolgung: aus den Eingaben des EH-Rechners die Zeilen ableiten, die bei einer Buchung
// in die Tabelle (Controlling → Umsatzverfolgung) wandern. Reine Funktion, siehe EhRechner.tsx.
import { EH_ITEMS, type EhResult } from "@/lib/calc/eh"

export interface UmsatzDraft {
  produkt: string
  praemie: number
  praemieLabel: string
  einheiten: number
}

/** Jede Position mit eingetragenem Betrag > 0 ergibt eine Zeile (in der Reihenfolge des Rechners). */
export function umsatzDrafts(j: Record<string, string>, perItem: EhResult["perItem"]): UmsatzDraft[] {
  const out: UmsatzDraft[] = []
  for (const it of EH_ITEMS) {
    if (it.disabled) continue
    const praemie = Number(j[it.id]) || 0
    if (praemie <= 0) continue
    out.push({ produkt: it.label, praemie, praemieLabel: it.jLabel, einheiten: perItem[it.id] ?? 0 })
  }
  return out
}
