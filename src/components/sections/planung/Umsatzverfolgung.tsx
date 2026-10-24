// Umsatzverfolgung — stumpfe Tabelle aller im EH-Rechner gebuchten Umsätze (Datum, Produkt, Prämie). Kunde,
// Beginn, "policiert" und "ausbezahlt" werden nachträglich von Hand gepflegt. Welche Zeilen sichtbar sind,
// bestimmt Planung.tsx (gewählte Führungskraft/Filter) und die Regeln (eigene Zeilen + Unterstruktur).
// Sind "policiert" und "ausbezahlt" beide gesetzt, gilt der Umsatz als erledigt und wandert automatisch ins
// Archiv (abgeleitet, kein eigenes Feld); Häkchen wieder entfernen holt ihn zurück in die Liste.
import { useState } from "react"
import { Archive, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DARK_CARD, DARK_INPUT } from "@/components/ui/dark"
import { cn } from "@/lib/utils"
import { useConfirm } from "@/hooks/useConfirm"
import type { UseUmsaetzeDocResult } from "@/hooks/useUmsaetzeDoc"
import { ehFormatEH, ehFormatEUR } from "@/lib/calc/eh"
import { formatISODateDE } from "@/lib/calc/format"
import type { UmsatzEntry } from "@/types/dashboard"

const CELL_INPUT = cn(
  "h-8 w-full rounded-md border px-2 text-sm focus:outline-none focus:border-[#64DDA3] focus:ring-2 focus:ring-[#64DDA3]/25 disabled:opacity-60",
  DARK_INPUT
)

/** Freitext: lokal tippen, erst beim Verlassen des Feldes speichern (kein Schreibvorgang je Tastendruck). */
function KundeInput({ entry, disabled, onSave }: { entry: UmsatzEntry; disabled: boolean; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input
      type="text"
      aria-label={`Name zu ${entry.produkt} vom ${formatISODateDE(entry.bookedAt.slice(0, 10))}`}
      className={CELL_INPUT}
      value={draft ?? entry.kunde}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && draft.trim() !== entry.kunde) onSave(draft.trim())
        setDraft(null)
      }}
    />
  )
}

export function Umsatzverfolgung({
  entries: allEntries, isEditor, patchEntry, removeEntry,
}: {
  entries: UmsatzEntry[]
  isEditor: boolean
  patchEntry: UseUmsaetzeDocResult["patchEntry"]
  removeEntry: UseUmsaetzeDocResult["removeEntry"]
}) {
  const confirm = useConfirm()
  const [showArchive, setShowArchive] = useState(false)
  const archived = allEntries.filter((e) => e.policiert && e.ausbezahlt)
  const entries = showArchive ? archived : allEntries.filter((e) => !(e.policiert && e.ausbezahlt))

  async function onRemove(e: UmsatzEntry) {
    const ok = await confirm(`Umsatz „${e.produkt}“ (${e.mitarbeiter}, ${formatISODateDE(e.bookedAt.slice(0, 10))}) wirklich löschen?\n\nDie gebuchten Einheiten bleiben unverändert.`)
    if (ok) removeEntry(e.id)
  }

  const toggle = (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">
        {showArchive
          ? `Archiv: ${archived.length} erledigte Umsätze (policiert und ausbezahlt)`
          : "Sobald „Policiert“ und „Ausbezahlt“ gesetzt sind, wandert der Umsatz ins Archiv."}
      </span>
      <Button size="sm" variant="outline" onClick={() => setShowArchive((v) => !v)}>
        {showArchive ? "Zurück zur Liste" : (<><Archive className="size-4" /> Archiv öffnen ({archived.length})</>)}
      </Button>
    </div>
  )

  if (entries.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {toggle}
        <div className={cn(DARK_CARD, "rounded-xl border p-12 text-center text-sm text-white/90")}>
          {showArchive
            ? "Das Archiv ist leer."
            : allEntries.length > 0
              ? "Alle Umsätze sind erledigt und liegen im Archiv."
              : "Noch keine Umsätze gebucht. Sie erscheinen hier, sobald im EH-Rechner „Auf Mitarbeiter buchen“ verwendet wird."}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
    {toggle}
    <div className={cn(DARK_CARD, "overflow-x-auto rounded-xl border")}>
      <table className="w-full min-w-[60rem] border-collapse text-sm text-white">
        <thead>
          <tr className="bg-[#0f2633] text-left text-[11px] font-bold uppercase tracking-wide text-white/90">
            <th className="px-3 py-2">Gebucht am</th>
            <th className="px-3 py-2">Mitarbeiter</th>
            <th className="px-3 py-2">Produkt</th>
            <th className="px-3 py-2 text-right">Prämie (€)</th>
            <th className="px-3 py-2 text-right">EH</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Beginn</th>
            <th className="px-3 py-2 text-center">Policiert</th>
            <th className="px-3 py-2 text-center">Ausbezahlt</th>
            <th className="w-10 px-3 py-2"><span className="sr-only">Löschen</span></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-t border-white/15 transition-colors even:bg-white/[.04] hover:bg-white/[.08]">
              <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{formatISODateDE(e.bookedAt.slice(0, 10))}</td>
              <td className="px-3 py-1.5">{e.mitarbeiter}</td>
              <td className="px-3 py-1.5">{e.produkt}</td>
              <td className="px-3 py-1.5 text-right tabular-nums" title={e.praemieLabel}>{ehFormatEUR(e.praemie)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{ehFormatEH(e.einheiten)}</td>
              <td className="min-w-40 px-3 py-1.5">
                <KundeInput entry={e} disabled={!isEditor} onSave={(kunde) => patchEntry(e.id, { kunde })} />
              </td>
              <td className="px-3 py-1.5">
                <input
                  type="date"
                  aria-label="Beginn"
                  className={`${CELL_INPUT} w-40`}
                  value={e.beginn}
                  disabled={!isEditor}
                  onChange={(ev) => patchEntry(e.id, { beginn: ev.target.value })}
                />
              </td>
              <td className="px-3 py-1.5 text-center">
                <input
                  type="checkbox"
                  aria-label="Policiert"
                  checked={e.policiert}
                  disabled={!isEditor}
                  onChange={(ev) => patchEntry(e.id, { policiert: ev.target.checked })}
                />
              </td>
              <td className="px-3 py-1.5 text-center">
                <input
                  type="checkbox"
                  aria-label="Ausbezahlt"
                  checked={e.ausbezahlt}
                  disabled={!isEditor}
                  onChange={(ev) => patchEntry(e.id, { ausbezahlt: ev.target.checked })}
                />
              </td>
              <td className="px-3 py-1.5 text-right">
                {isEditor && (
                  <Button size="sm" variant="ghost" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white" aria-label="Umsatz löschen" onClick={() => onRemove(e)}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  )
}
