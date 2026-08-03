// Finanzierungen/Kreditfälle — neue Sektion, keine Legacy-Entsprechung. Unterlagen-
// Checkliste 1:1 aus public/docs/Finanzierungscheckliste_finovacredit.pdf (Finova
// Credit), siehe lib/data/finanzierung.ts. Dumme/kontrollierte Sektion: Firestore-
// Zugriff läuft ausschließlich über useFinanzierungenDoc() in App.tsx.
import { Fragment, useState } from "react"
import { Archive, ArchiveRestore, ChevronDown, ChevronRight, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { initials } from "@/lib/calc/format"
import { relevantGroups, relevantItemIds, type Beschaeftigung } from "@/lib/data/finanzierung"
import type { FinanzierungArt, FinanzierungCase } from "@/types/dashboard"
import { useConfirm } from "@/hooks/useConfirm"
import { cn } from "@/lib/utils"

const ART_LABEL: Record<FinanzierungArt, string> = {
  neu: "Neu",
  umschuldung: "Umschuldung",
}

function fmtEur(n: number): string {
  return Number(n || 0).toLocaleString("de-AT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
}

function NewCaseForm({
  onAdd, isEditor,
}: {
  onAdd: (init: { name: string; betrag: number; art: FinanzierungArt; beschaeftigung: Beschaeftigung }) => void
  isEditor: boolean
}) {
  const [name, setName] = useState("")
  const [betrag, setBetrag] = useState("")
  const [art, setArt] = useState<FinanzierungArt>("neu")
  const [beschaeftigung, setBeschaeftigung] = useState<Beschaeftigung>("unselbststaendig")

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd({ name: trimmed, betrag: Number(betrag) || 0, art, beschaeftigung })
    setName("")
    setBetrag("")
    setArt("neu")
    setBeschaeftigung("unselbststaendig")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Neuer Kreditfall</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="fin-name">Person</label>
            <Input
              id="fin-name"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isEditor}
              className="w-48"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="fin-betrag">Kreditsumme</label>
            <Input
              id="fin-betrag"
              type="number"
              placeholder="0"
              value={betrag}
              onChange={(e) => setBetrag(e.target.value)}
              disabled={!isEditor}
              className="w-36"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="fin-art">Art</label>
            <Select
              id="fin-art"
              value={art}
              onChange={(e) => setArt(e.target.value as FinanzierungArt)}
              disabled={!isEditor}
              className="w-40"
            >
              <option value="neu">Neu aufgenommen</option>
              <option value="umschuldung">Umschuldung</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="fin-beschaeftigung">Beschäftigung</label>
            <Select
              id="fin-beschaeftigung"
              value={beschaeftigung}
              onChange={(e) => setBeschaeftigung(e.target.value as Beschaeftigung)}
              disabled={!isEditor}
              className="w-40"
            >
              <option value="unselbststaendig">Unselbstständig</option>
              <option value="selbststaendig">Selbstständig</option>
            </Select>
          </div>
          <Button onClick={submit} disabled={!isEditor || !name.trim()}>
            Anlegen
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ChecklistGrid({
  fc, isEditor, onToggleDoc,
}: {
  fc: FinanzierungCase
  isEditor: boolean
  onToggleDoc: (itemId: string, checked: boolean) => void
}) {
  const groups = relevantGroups(fc.beschaeftigung)
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <div key={g.id} className="flex flex-col gap-1.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</div>
            {g.items.map((item) => (
              <label key={item.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!fc.docs[item.id]}
                  onChange={(e) => onToggleDoc(item.id, e.target.checked)}
                  disabled={!isEditor}
                  aria-label={`${item.label} – ${fc.name}`}
                  className="mt-0.5 size-4 shrink-0"
                />
                <span>
                  {item.label}
                  {item.hint && <span className="ml-1 text-xs text-muted-foreground">({item.hint})</span>}
                </span>
              </label>
            ))}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Wichtig: alle Dateien in ein separates PDF.</p>
    </div>
  )
}

export function Finanzierungen({
  cases, addCase, patchCase, toggleDoc, removeCase, isEditor,
}: {
  cases: FinanzierungCase[]
  addCase: (init: { name: string; betrag: number; art: FinanzierungArt; beschaeftigung: Beschaeftigung }) => void
  patchCase: (id: string, patch: Partial<FinanzierungCase>) => void
  toggleDoc: (id: string, itemId: string, checked: boolean) => void
  removeCase: (id: string) => void
  isEditor: boolean
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const confirm = useConfirm()

  async function onRemove(fc: FinanzierungCase) {
    const ok = await confirm(`Kreditfall „${fc.name}" wirklich löschen?`)
    if (!ok) return
    removeCase(fc.id)
  }

  async function onArchive(fc: FinanzierungCase) {
    const ok = await confirm(`Kreditfall „${fc.name}" wirklich archivieren?`)
    if (!ok) return
    patchCase(fc.id, { archived: true })
  }

  const archivedCount = cases.filter((c) => c.archived).length
  const visibleCases = cases.filter((c) => !!c.archived === showArchived)
  const totalBetrag = visibleCases.reduce((s, c) => s + Number(c.betrag || 0), 0)

  return (
    <div className="flex flex-col gap-6">
      <NewCaseForm onAdd={addCase} isEditor={isEditor} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>{showArchived ? "Archivierte Kreditfälle" : "Kreditfälle"}</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowArchived((s) => !s)}>
                {showArchived ? "Zurück zu aktiven Fällen" : `Archiv anzeigen (${archivedCount})`}
              </Button>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                {visibleCases.length} Fälle
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {visibleCases.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {showArchived ? "Keine archivierten Kreditfälle." : "Noch keine Kreditfälle angelegt."}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/95 text-left text-xs font-semibold text-muted-foreground backdrop-blur">
                    <th className="w-8 px-2 py-2" />
                    <th className="px-2 py-2">Person</th>
                    <th className="px-2 py-2">Art</th>
                    <th className="px-3 py-2 text-right">Kreditsumme</th>
                    <th className="px-3 py-2">Unterlagen</th>
                    <th className="px-2 py-2 text-center">Daten aufbereitet</th>
                    <th className="px-2 py-2 text-center">Eingereicht</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {visibleCases.map((fc) => {
                    const relevant = relevantItemIds(fc.beschaeftigung)
                    const done = relevant.filter((id) => fc.docs[id]).length
                    const isOpen = expanded === fc.id
                    return (
                      <Fragment key={fc.id}>
                        <tr
                          className={cn("border-b last:border-0", fc.eingereicht && "opacity-60")}
                        >
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              onClick={() => setExpanded(isOpen ? null : fc.id)}
                              aria-label={isOpen ? `Checkliste ${fc.name} einklappen` : `Checkliste ${fc.name} aufklappen`}
                              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                            >
                              {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                            </button>
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-2">
                              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold">
                                {initials(fc.name)}
                              </div>
                              {fc.name}
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                              {ART_LABEL[fc.art]}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums">{fmtEur(fc.betrag)}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${relevant.length ? (done / relevant.length) * 100 : 0}%` }}
                                />
                              </div>
                              <span className="text-xs tabular-nums text-muted-foreground">
                                {done}/{relevant.length}
                              </span>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={fc.aufbereitet}
                              onChange={(e) => patchCase(fc.id, { aufbereitet: e.target.checked })}
                              disabled={!isEditor}
                              aria-label={`Daten aufbereitet – ${fc.name}`}
                              className="size-4"
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={fc.eingereicht}
                              onChange={(e) => patchCase(fc.id, { eingereicht: e.target.checked })}
                              disabled={!isEditor}
                              aria-label={`Eingereicht – ${fc.name}`}
                              className="size-4"
                            />
                          </td>
                          <td className="px-2 py-2 text-right">
                            {isEditor && (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => onRemove(fc)}
                                  aria-label={`Kreditfall ${fc.name} löschen`}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                                {fc.archived ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => patchCase(fc.id, { archived: false })}
                                    aria-label={`Kreditfall ${fc.name} wiederherstellen`}
                                  >
                                    <ArchiveRestore className="size-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onArchive(fc)}
                                    aria-label={`Kreditfall ${fc.name} archivieren`}
                                  >
                                    <Archive className="size-4" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="border-b bg-muted/30 last:border-0">
                            <td className="px-2 py-2" />
                            <td colSpan={7} className="px-3 py-3">
                              <div className="mb-3 flex flex-wrap items-end gap-3">
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-medium text-muted-foreground" htmlFor={`fin-edit-name-${fc.id}`}>Person</label>
                                  <Input
                                    id={`fin-edit-name-${fc.id}`}
                                    key={`name-${fc.id}-${fc.name}`}
                                    defaultValue={fc.name}
                                    onBlur={(e) => {
                                      const v = e.target.value.trim()
                                      if (v && v !== fc.name) patchCase(fc.id, { name: v })
                                    }}
                                    disabled={!isEditor}
                                    className="w-48"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-medium text-muted-foreground" htmlFor={`fin-edit-betrag-${fc.id}`}>Kreditsumme</label>
                                  <Input
                                    id={`fin-edit-betrag-${fc.id}`}
                                    key={`betrag-${fc.id}-${fc.betrag}`}
                                    type="number"
                                    defaultValue={fc.betrag}
                                    onBlur={(e) => patchCase(fc.id, { betrag: Number(e.target.value) || 0 })}
                                    disabled={!isEditor}
                                    className="w-36"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-medium text-muted-foreground" htmlFor={`fin-edit-art-${fc.id}`}>Art</label>
                                  <Select
                                    id={`fin-edit-art-${fc.id}`}
                                    value={fc.art}
                                    onChange={(e) => patchCase(fc.id, { art: e.target.value as FinanzierungArt })}
                                    disabled={!isEditor}
                                    className="w-40"
                                  >
                                    <option value="neu">Neu aufgenommen</option>
                                    <option value="umschuldung">Umschuldung</option>
                                  </Select>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-medium text-muted-foreground" htmlFor={`fin-edit-beschaeftigung-${fc.id}`}>Beschäftigung</label>
                                  <Select
                                    id={`fin-edit-beschaeftigung-${fc.id}`}
                                    value={fc.beschaeftigung}
                                    onChange={(e) => patchCase(fc.id, { beschaeftigung: e.target.value as Beschaeftigung })}
                                    disabled={!isEditor}
                                    className="w-40"
                                  >
                                    <option value="unselbststaendig">Unselbstständig</option>
                                    <option value="selbststaendig">Selbstständig</option>
                                  </Select>
                                </div>
                              </div>
                              <ChecklistGrid
                                fc={fc}
                                isEditor={isEditor}
                                onToggleDoc={(itemId, checked) => toggleDoc(fc.id, itemId, checked)}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t font-semibold">
                    <td className="px-2 py-2" />
                    <td className="px-2 py-2">Gesamt</td>
                    <td className="px-2 py-2" />
                    <td className="px-3 py-2 text-right tabular-nums">{fmtEur(totalBetrag)}</td>
                    <td className="px-3 py-2" />
                    <td className="px-2 py-2" />
                    <td className="px-2 py-2" />
                    <td className="px-2 py-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
