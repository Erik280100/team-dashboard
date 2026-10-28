// Offene Abwicklungen (Kreditfälle) — Unterreiter der Finanzierungen-Sektion, siehe
// components/sections/Finanzierungen.tsx. Unterlagen-Checkliste 1:1 aus
// public/docs/Finanzierungscheckliste_finovacredit.pdf (Finova Credit), siehe
// lib/data/finanzierung.ts. Dumme/kontrollierte Sektion: Firestore-Zugriff läuft
// ausschließlich über useFinanzierungenDoc() in App.tsx.
import { Fragment, useState } from "react"
import { Archive, ArchiveRestore, Check, ChevronDown, ChevronRight, FileText, Landmark, Trash2, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { DARK_CARD, DARK_INPUT, DARK_OPTION, DARK_SELECT, DARK_TABLE, KpiTile, MintBar, SectionHero } from "@/components/ui/dark"
import { fmtEurRound as fmtEur, initials } from "@/lib/calc/format"
import { relevantGroups, relevantItemIds, type Beschaeftigung } from "@/lib/data/finanzierung"
import type { FinanzierungArt, FinanzierungCase } from "@/types/dashboard"
import type { RosterEntry } from "@/lib/calc/struktur"
import { useConfirm } from "@/hooks/useConfirm"
import { cn } from "@/lib/utils"

const ART_LABEL: Record<FinanzierungArt, string> = {
  hauskauf: "Hauskauf",
  wohnungskauf: "Wohnungskauf",
  hausbau: "Hausbau",
  umbau: "Umbau",
  sanierung: "Sanierung",
  umschuldung: "Umschuldung",
  anlegerwohnung: "Anlegerwohnung",
}

const ART_OPTIONS: FinanzierungArt[] = ["hauskauf", "wohnungskauf", "hausbau", "umbau", "sanierung", "umschuldung", "anlegerwohnung"]

type SortKey = "standard" | "betreuer-asc" | "offen-asc" | "offen-desc"

const SORT_LABEL: Record<SortKey, string> = {
  standard: "Standard",
  "betreuer-asc": "Betreuer (A-Z)",
  "offen-asc": "Offene Unterlagen (wenig → viel)",
  "offen-desc": "Offene Unterlagen (viel → wenig)",
}

const SORT_OPTIONS: SortKey[] = ["standard", "betreuer-asc", "offen-asc", "offen-desc"]

const GHOST_DARK = "border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"

/** Status-Häkchen als Pill statt Browser-Checkbox. */
function StatusPill({
  checked, onChange, disabled, label,
}: { checked: boolean; onChange: (next: boolean) => void; disabled: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-full border transition-colors disabled:opacity-60",
        checked
          ? "border-transparent bg-[#3FCB8E] text-[#0b1f2a]"
          : "border-white/20 bg-white/5 text-transparent hover:border-[#64DDA3]/50"
      )}
    >
      <Check className="size-4" aria-hidden="true" />
    </button>
  )
}

function NewCaseForm({
  onAdd, canWrite, employeeNames,
}: {
  onAdd: (init: { name: string; betrag: number; art: FinanzierungArt; beschaeftigung: Beschaeftigung; betreuer: string }) => void
  canWrite: boolean
  employeeNames: string[]
}) {
  const [name, setName] = useState("")
  const [betrag, setBetrag] = useState("")
  const [art, setArt] = useState<FinanzierungArt>("hauskauf")
  const [beschaeftigung, setBeschaeftigung] = useState<Beschaeftigung>("unselbststaendig")
  const [betreuer, setBetreuer] = useState("")

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd({ name: trimmed, betrag: Number(betrag) || 0, art, beschaeftigung, betreuer })
    setName("")
    setBetrag("")
    setArt("hauskauf")
    setBeschaeftigung("unselbststaendig")
    setBetreuer("")
  }

  return (
    <Card className={DARK_CARD}>
      <CardHeader>
        <CardTitle className="text-white">Neuer Kreditfall</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-white" htmlFor="fin-name">Person</label>
            <Input
              id="fin-name"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canWrite}
              className={cn("w-48", DARK_INPUT)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-white" htmlFor="fin-betrag">Kreditsumme</label>
            <Input
              id="fin-betrag"
              type="number"
              placeholder="0"
              value={betrag}
              onChange={(e) => setBetrag(e.target.value)}
              disabled={!canWrite}
              className={cn("w-36", DARK_INPUT)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-white" htmlFor="fin-art">Art</label>
            <Select
              id="fin-art"
              value={art}
              onChange={(e) => setArt(e.target.value as FinanzierungArt)}
              disabled={!canWrite}
              className={cn("w-40", DARK_SELECT)}
            >
              {ART_OPTIONS.map((a) => (
                <option className={DARK_OPTION} key={a} value={a}>{ART_LABEL[a]}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-white" htmlFor="fin-beschaeftigung">Beschäftigung</label>
            <Select
              id="fin-beschaeftigung"
              value={beschaeftigung}
              onChange={(e) => setBeschaeftigung(e.target.value as Beschaeftigung)}
              disabled={!canWrite}
              className={cn("w-40", DARK_SELECT)}
            >
              <option className={DARK_OPTION} value="unselbststaendig">Unselbstständig</option>
              <option className={DARK_OPTION} value="selbststaendig">Selbstständig</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-white" htmlFor="fin-betreuer">Zuständiger Mitarbeiter</label>
            <Select
              id="fin-betreuer"
              value={betreuer}
              onChange={(e) => setBetreuer(e.target.value)}
              disabled={!canWrite}
              className={cn("w-48", DARK_SELECT)}
            >
              <option className={DARK_OPTION} value="">– auswählen –</option>
              {employeeNames.map((n) => (
                <option className={DARK_OPTION} key={n} value={n}>{n}</option>
              ))}
            </Select>
          </div>
          <Button
            onClick={submit}
            disabled={!canWrite || !name.trim()}
            className="border-0 bg-[linear-gradient(135deg,#64DDA3,#3FCB8E)] font-bold text-[#0b1f2a] shadow-[0_4px_14px_rgba(63,203,142,.3)] hover:opacity-90"
          >
            Anlegen
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ChecklistGrid({
  fc, canWrite, onToggleDoc,
}: {
  fc: FinanzierungCase
  canWrite: boolean
  onToggleDoc: (itemId: string, checked: boolean) => void
}) {
  const groups = relevantGroups(fc.beschaeftigung)
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <div key={g.id} className="flex flex-col gap-1.5">
            <div className="text-xs font-bold uppercase tracking-wide text-[#64DDA3]">{g.title}</div>
            {g.items.map((item) => (
              <label key={item.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!fc.docs[item.id]}
                  onChange={(e) => onToggleDoc(item.id, e.target.checked)}
                  disabled={!canWrite}
                  aria-label={`${item.label} – ${fc.name}`}
                  className="mt-0.5"
                />
                <span>
                  {item.label}
                  {item.hint && <span className="ml-1 text-xs text-white/90">({item.hint})</span>}
                </span>
              </label>
            ))}
          </div>
        ))}
      </div>
      <p className="text-xs font-bold text-[#E7A94C]">Wichtig: alle Dateien in ein separates PDF.</p>
    </div>
  )
}

export function OffeneAbwicklungen({
  cases, addCase, patchCase, toggleDoc, removeCase, isEditor, canWrite, employeeRoster, abwicklerNames,
}: {
  cases: FinanzierungCase[]
  addCase: (init: { name: string; betrag: number; art: FinanzierungArt; beschaeftigung: Beschaeftigung; betreuer: string }) => void
  patchCase: (id: string, patch: Partial<FinanzierungCase>) => void
  toggleDoc: (id: string, itemId: string, checked: boolean) => void
  removeCase: (id: string) => void
  /** Stammdaten bearbeiten, Archivieren, Löschen — nur echte Logins. */
  isEditor: boolean
  /** Anlegen + Checkliste/Status — auch anonym (siehe useAuth.ts). */
  canWrite: boolean
  /** Aktive Mitarbeiter aus dem Strukturbaum-Roster (siehe App.tsx `roster`), für die Betreuer-Auswahl. */
  employeeRoster: RosterEntry[]
  abwicklerNames: string[]
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>("standard")
  const confirm = useConfirm()

  const employeeNames = [...employeeRoster].map((e) => e.name).sort((a, b) => a.localeCompare(b, "de"))

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

  const decoratedCases = visibleCases.map((fc) => {
    const relevant = relevantItemIds(fc.beschaeftigung)
    const done = relevant.filter((id) => fc.docs[id]).length
    return { fc, relevant, done, offen: relevant.length - done }
  })
  const sortedCases = [...decoratedCases].sort((a, b) => {
    if (sortKey === "betreuer-asc") return (a.fc.betreuer || "").localeCompare(b.fc.betreuer || "", "de")
    if (sortKey === "offen-asc") return a.offen - b.offen
    if (sortKey === "offen-desc") return b.offen - a.offen
    return 0
  })

  const offeneUnterlagen = decoratedCases.reduce((sum, d) => sum + d.offen, 0)

  return (
    <div className="flex flex-col gap-6">
      <SectionHero
        eyebrow="Finanzierungen"
        title={showArchived ? "Archivierte Abwicklungen" : "Offene Abwicklungen"}
        badge={`${visibleCases.length} Fälle`}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiTile icon={Layers} label="Kreditfälle" value={visibleCases.length} sub={showArchived ? "im Archiv" : "in Bearbeitung"} />
          <KpiTile icon={Landmark} label="Kreditvolumen" value={fmtEur(totalBetrag)} sub="Summe der Kreditsummen" />
          <KpiTile icon={FileText} label="Offene Unterlagen" value={offeneUnterlagen} sub="über alle angezeigten Fälle" />
        </div>
      </SectionHero>

      <NewCaseForm onAdd={addCase} canWrite={canWrite} employeeNames={employeeNames} />

      <Card className={DARK_CARD}>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-white">{showArchived ? "Archivierte Kreditfälle" : "Kreditfälle"}</CardTitle>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-white" htmlFor="fin-sort">Sortierung</label>
              <Select
                id="fin-sort"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className={cn("w-56", DARK_SELECT)}
              >
                {SORT_OPTIONS.map((k) => (
                  <option className={DARK_OPTION} key={k} value={k}>{SORT_LABEL[k]}</option>
                ))}
              </Select>
              <Button variant="ghost" size="sm" className={GHOST_DARK} onClick={() => setShowArchived((s) => !s)}>
                {showArchived ? "Zurück zu aktiven Fällen" : `Archiv anzeigen (${archivedCount})`}
              </Button>
              <span className="rounded-full bg-[#64DDA3]/15 px-2.5 py-1 text-xs font-bold text-[#64DDA3]">
                {visibleCases.length} Fälle
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {visibleCases.length === 0 ? (
            <div className="py-6 text-center text-sm text-white/90">
              {showArchived ? "Keine archivierten Kreditfälle." : "Noch keine Kreditfälle angelegt."}
            </div>
          ) : (
            <div className={DARK_TABLE.wrap}>
              <table className={cn("min-w-[900px]", DARK_TABLE.table)}>
                <thead>
                  <tr className="bg-[#0f2633] text-left text-[11px] font-bold uppercase tracking-wide text-white/90">
                    <th className="w-8 px-2 py-2" />
                    <th className="px-2 py-2">Person</th>
                    <th className="px-2 py-2">Betreuer</th>
                    <th className="px-2 py-2">Art</th>
                    <th className="px-3 py-2 text-right">Kreditsumme</th>
                    <th className="px-3 py-2">Unterlagen</th>
                    <th className="px-2 py-2 text-center">Daten aufbereitet (MA)</th>
                    <th className="px-2 py-2 text-center">Eingereicht (VB)</th>
                    <th className="px-2 py-2 text-center">Kreditvertrag bekommen</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCases.map(({ fc, relevant, done }) => {
                    const isOpen = expanded === fc.id
                    return (
                      <Fragment key={fc.id}>
                        <tr
                          className={cn(DARK_TABLE.row, fc.eingereicht && "opacity-60")}
                        >
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              onClick={() => setExpanded(isOpen ? null : fc.id)}
                              aria-label={isOpen ? `Checkliste ${fc.name} einklappen` : `Checkliste ${fc.name} aufklappen`}
                              className="flex size-6 items-center justify-center rounded-md text-white/85 hover:bg-white/10 hover:text-white"
                            >
                              {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                            </button>
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-2">
                              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#64DDA3]/15 text-xs font-bold text-[#64DDA3]">
                                {initials(fc.name)}
                              </div>
                              <span className="font-semibold">{fc.name}</span>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-white/85">
                            {fc.betreuer || "—"}
                            {fc.abwickler && <div className="text-xs">Abwickler: {fc.abwickler}</div>}
                          </td>
                          <td className="px-2 py-2">
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-xs font-semibold",
                                fc.art === "anlegerwohnung" ? "bg-[#E7A94C]/15 text-[#E7A94C]" : "bg-white/10 text-white/90"
                              )}
                            >
                              {ART_LABEL[fc.art]}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-bold tabular-nums">{fmtEur(fc.betrag)}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <MintBar pct={relevant.length ? (done / relevant.length) * 100 : 0} className="w-24" />
                              <span className="text-xs tabular-nums text-white/90">
                                {done}/{relevant.length}
                              </span>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <StatusPill
                              checked={fc.aufbereitet}
                              onChange={(next) => patchCase(fc.id, { aufbereitet: next })}
                              disabled={!canWrite}
                              label={`Daten aufbereitet (MA) – ${fc.name}`}
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <StatusPill
                              checked={fc.eingereicht}
                              onChange={(next) => patchCase(fc.id, { eingereicht: next })}
                              disabled={!canWrite}
                              label={`Eingereicht (VB) – ${fc.name}`}
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <StatusPill
                              checked={fc.kreditvertrag}
                              onChange={(next) => patchCase(fc.id, { kreditvertrag: next })}
                              disabled={!canWrite}
                              label={`Kreditvertrag bekommen – ${fc.name}`}
                            />
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="border-b border-white/5 bg-white/[.03] last:border-0">
                            <td className="px-2 py-2" />
                            <td colSpan={8} className="px-3 py-3">
                              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                                <div className="flex flex-wrap items-end gap-3">
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-semibold text-white" htmlFor={`fin-edit-name-${fc.id}`}>Person</label>
                                  <Input
                                    id={`fin-edit-name-${fc.id}`}
                                    key={`name-${fc.id}-${fc.name}`}
                                    defaultValue={fc.name}
                                    onBlur={(e) => {
                                      const v = e.target.value.trim()
                                      if (v && v !== fc.name) patchCase(fc.id, { name: v })
                                    }}
                                    disabled={!isEditor}
                                    className={cn("w-48", DARK_INPUT)}
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-semibold text-white" htmlFor={`fin-edit-betrag-${fc.id}`}>Kreditsumme</label>
                                  <Input
                                    id={`fin-edit-betrag-${fc.id}`}
                                    key={`betrag-${fc.id}-${fc.betrag}`}
                                    type="number"
                                    defaultValue={fc.betrag}
                                    onBlur={(e) => patchCase(fc.id, { betrag: Number(e.target.value) || 0 })}
                                    disabled={!isEditor}
                                    className={cn("w-36", DARK_INPUT)}
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-semibold text-white" htmlFor={`fin-edit-art-${fc.id}`}>Art</label>
                                  <Select
                                    id={`fin-edit-art-${fc.id}`}
                                    value={fc.art}
                                    onChange={(e) => patchCase(fc.id, { art: e.target.value as FinanzierungArt })}
                                    disabled={!isEditor}
                                    className={cn("w-40", DARK_SELECT)}
                                  >
                                    {ART_OPTIONS.map((a) => (
                                      <option className={DARK_OPTION} key={a} value={a}>{ART_LABEL[a]}</option>
                                    ))}
                                  </Select>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-semibold text-white" htmlFor={`fin-edit-beschaeftigung-${fc.id}`}>Beschäftigung</label>
                                  <Select
                                    id={`fin-edit-beschaeftigung-${fc.id}`}
                                    value={fc.beschaeftigung}
                                    onChange={(e) => patchCase(fc.id, { beschaeftigung: e.target.value as Beschaeftigung })}
                                    disabled={!isEditor}
                                    className={cn("w-40", DARK_SELECT)}
                                  >
                                    <option className={DARK_OPTION} value="unselbststaendig">Unselbstständig</option>
                                    <option className={DARK_OPTION} value="selbststaendig">Selbstständig</option>
                                  </Select>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-semibold text-white" htmlFor={`fin-edit-betreuer-${fc.id}`}>Zuständiger Mitarbeiter</label>
                                  <Select
                                    id={`fin-edit-betreuer-${fc.id}`}
                                    value={fc.betreuer || ""}
                                    onChange={(e) => patchCase(fc.id, { betreuer: e.target.value })}
                                    disabled={!isEditor}
                                    className={cn("w-48", DARK_SELECT)}
                                  >
                                    <option className={DARK_OPTION} value="">– auswählen –</option>
                                    {[...new Set([...employeeNames, ...(fc.betreuer ? [fc.betreuer] : [])])].map((n) => (
                                      <option className={DARK_OPTION} key={n} value={n}>{n}</option>
                                    ))}
                                  </Select>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-semibold text-white" htmlFor={`fin-edit-abwickler-${fc.id}`}>Abwickler</label>
                                  <Select
                                    id={`fin-edit-abwickler-${fc.id}`}
                                    value={fc.abwickler || ""}
                                    onChange={(e) => patchCase(fc.id, { abwickler: e.target.value })}
                                    disabled={!isEditor}
                                    className={cn("w-48", DARK_SELECT)}
                                  >
                                    <option className={DARK_OPTION} value="">– keiner –</option>
                                    {abwicklerNames.map((n) => (
                                      <option className={DARK_OPTION} key={n} value={n}>{n}</option>
                                    ))}
                                  </Select>
                                </div>
                                </div>
                                {isEditor && (
                                  <div className="flex items-center gap-1">
                                    {fc.archived ? (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className={GHOST_DARK}
                                        onClick={() => patchCase(fc.id, { archived: false })}
                                        aria-label={`Kreditfall ${fc.name} wiederherstellen`}
                                      >
                                        <ArchiveRestore className="size-4" />
                                        Wiederherstellen
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className={GHOST_DARK}
                                        onClick={() => onArchive(fc)}
                                        aria-label={`Kreditfall ${fc.name} archivieren`}
                                      >
                                        <Archive className="size-4" />
                                        Archivieren
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className={GHOST_DARK}
                                      onClick={() => onRemove(fc)}
                                      aria-label={`Kreditfall ${fc.name} löschen`}
                                    >
                                      <Trash2 className="size-4" />
                                      Löschen
                                    </Button>
                                  </div>
                                )}
                              </div>
                              <ChecklistGrid
                                fc={fc}
                                canWrite={canWrite}
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
                  <tr className="border-t border-white/15 bg-[#12372f] font-semibold">
                    <td className="px-2 py-2" />
                    <td className="px-2 py-2">Gesamt</td>
                    <td className="px-2 py-2" />
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
