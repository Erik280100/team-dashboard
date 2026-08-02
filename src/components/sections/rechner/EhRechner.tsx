// EH-Rechner — Äquivalent zu initEHRechner() aus legacy/index.html:3356–3456.
// Reine Client-Berechnung, nichts wird gespeichert (wie im Original) — außer
// beim expliziten "Auf Mitarbeiter buchen" (nur isEditor), das die berechneten
// Einheiten je Sparte additiv auf einen Mitarbeiter überträgt (siehe
// App.tsx applyUnitsToEmployee / verguetung.ts).
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { useConfirm } from "@/hooks/useConfirm"
import { calcEh, EH_GROUPS, EH_ITEMS, ehFormatEH, ehFormatEUR, type EhGroup } from "@/lib/calc/eh"
import { PLAN_LABELS, type PlanId } from "@/lib/calc/struktur"

// legacy/index.html:821-824 — Gruppen-Akzentfarbe (oberer Rand der Karte)
const GROUP_ACCENT: Record<EhGroup["id"], string> = {
  insurance: "#3FCB8E",
  investment: "#5B9BD5",
  credit: "#E7A94C",
  realestate: "#B07CC6",
}

function defaultG(): Record<string, string> {
  const g: Record<string, string> = {}
  EH_ITEMS.forEach((it) => { if (it.hasG) g[it.id] = String(it.gDefault ?? 0) })
  return g
}
function defaultJ(): Record<string, string> {
  const j: Record<string, string> = {}
  EH_ITEMS.forEach((it) => { j[it.id] = "0" })
  return j
}
function defaultMult(): Record<EhGroup["id"], string> {
  const m = {} as Record<EhGroup["id"], string>
  EH_GROUPS.forEach((g) => { m[g.id] = String(g.multDefault) })
  return m
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function EhRechner({
  employees, isEditor, onApplyUnits,
}: {
  employees: { name: string; role: string; units: Record<PlanId, number> }[]
  isEditor: boolean
  onApplyUnits: (name: string, units: Record<PlanId, number>) => void
}) {
  const [g, setG] = useState(defaultG)
  const [j, setJ] = useState(defaultJ)
  const [mult, setMult] = useState(defaultMult)
  const [selectedName, setSelectedName] = useState("")
  const [bookingOpen, setBookingOpen] = useState(false)
  const [lastBooked, setLastBooked] = useState<string | null>(null)
  const confirm = useConfirm()

  const result = calcEh({ g, j, mult })
  const bookedUnits = EH_GROUPS.reduce((acc, group) => {
    acc[group.id] = round2(result.groupSums[group.id] || 0)
    return acc
  }, {} as Record<PlanId, number>)
  const selectedEmployee = employees.find((e) => e.name === selectedName) ?? null

  async function onReset() {
    const ok = await confirm("Alle Eingaben im EH-Rechner wirklich zurücksetzen?")
    if (!ok) return
    setG(defaultG())
    setJ(defaultJ())
    setMult(defaultMult())
  }

  function onConfirmBooking() {
    if (!selectedEmployee) return
    onApplyUnits(selectedEmployee.name, bookedUnits)
    setLastBooked(selectedEmployee.name)
    setBookingOpen(false)
  }

  function renderGroup(group: EhGroup) {
    const items = EH_ITEMS.filter((it) => it.sparte === group.id)
    return (
      <Card key={group.id} className="border-t-[3px]" style={{ borderTopColor: GROUP_ACCENT[group.id] }}>
        <CardContent className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">{group.title}</h3>
          {items.map((it) => (
            <div key={it.id} className="grid grid-cols-2 items-end gap-3 border-b pb-3 last:border-0 last:pb-0 sm:grid-cols-[1fr_7rem_7rem_7rem]">
              <div className="col-span-2 min-w-0 sm:col-span-1">
                <div className="text-sm font-medium">{it.label}</div>
                <div className="text-xs text-muted-foreground">Auszahlung: {it.payout}</div>
              </div>
              {it.hasG ? (
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {it.gLabel} ({it.gUnit})
                  <input
                    type="number" min={0} step={1} max={it.gMax}
                    className="h-8 w-20 rounded-md border border-input bg-[#EFFBF5] focus:outline-none focus:border-[#3FCB8E] px-2 text-sm"
                    value={g[it.id] ?? ""}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setG((s) => ({ ...s, [it.id]: e.target.value }))}
                  />
                </label>
              ) : (
                <div />
              )}
              {it.disabled ? (
                <input type="text" disabled value={it.disabledNote} className="h-8 w-28 rounded-md border border-input bg-muted px-2 text-sm" />
              ) : (
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {it.jLabel}
                  <input
                    type="number" min={0} step={10}
                    className="h-8 w-28 rounded-md border border-input bg-[#EFFBF5] focus:outline-none focus:border-[#3FCB8E] px-2 text-sm"
                    value={j[it.id] ?? ""}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setJ((s) => ({ ...s, [it.id]: e.target.value }))}
                  />
                </label>
              )}
              <div className="col-span-2 text-right sm:col-span-1">
                <div className="text-base font-bold tabular-nums text-[#155767]">{ehFormatEH(result.perItem[it.id])}</div>
                <div className="text-xs text-muted-foreground">EH</div>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between border-t-2 border-t-foreground/80 pt-3 text-sm">
            <span className="font-semibold text-muted-foreground">Zwischensumme</span>
            <span className="text-lg font-extrabold tabular-nums">{ehFormatEH(result.groupSums[group.id])} EH</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <label className="shrink-0 text-[11px] font-semibold text-muted-foreground">
              Multiplikator (€ / EH)
            </label>
            <input
              type="number" min={0} step={0.5}
              className="ml-2 h-7 w-16 shrink-0 rounded-md border border-input bg-[#EFFBF5] focus:outline-none focus:border-[#3FCB8E] px-2 text-[12.5px]"
              value={mult[group.id] ?? ""}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setMult((s) => ({ ...s, [group.id]: e.target.value }))}
            />
            <span className="ml-auto shrink-0 whitespace-nowrap text-[13.5px] font-bold tabular-nums text-[#155767]">
              {ehFormatEUR(result.groupEur[group.id])} €
            </span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const mainGroup = EH_GROUPS.find((gr) => gr.id === "insurance")!
  const sideGroups = EH_GROUPS.filter((gr) => gr.id !== "insurance")

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
        <strong>Einheiten (EH) berechnen:</strong> Trage bei jedem Produkt die monatliche Prämie ein
        (bei Kredit &amp; Immobilienverkauf die Gesamtsumme) — das Ergebnis in Einheiten wird
        automatisch berechnet und zur Zwischensumme addiert. Eingaben werden nicht gespeichert.
      </div>

      <Card className="border-none bg-[linear-gradient(135deg,#0B1F2A_0%,#155767_130%)] text-white">
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs text-white/60">Gesamt Einheiten</div>
              <div className="text-4xl font-extrabold tabular-nums">{ehFormatEH(result.grandTotal)} EH</div>
            </div>
            <div>
              <div className="text-xs text-white/60">Gesamt in €</div>
              <div className="text-4xl font-extrabold tabular-nums">{ehFormatEUR(result.grandTotalEur)} €</div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
              onClick={onReset}
            >
              Zurücksetzen
            </Button>
          </div>

          {isEditor && (
            <div className="flex flex-wrap items-center gap-2 border-t border-white/15 pt-3">
              <Select
                aria-label="Mitarbeiter für Übernahme wählen"
                value={selectedName}
                onChange={(e) => setSelectedName(e.target.value)}
                className="w-56 border-white/25 bg-white/10 text-white [&>svg]:text-white/70"
              >
                <option value="" className="text-foreground">Mitarbeiter wählen…</option>
                {employees.map((emp) => (
                  <option key={emp.name} value={emp.name} className="text-foreground">
                    {emp.name}
                  </option>
                ))}
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
                disabled={!selectedEmployee || result.grandTotal <= 0}
                onClick={() => setBookingOpen(true)}
              >
                Auf Mitarbeiter buchen
              </Button>
              {lastBooked && (
                <span className="text-xs text-white/70">Zuletzt gebucht auf {lastBooked}.</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        {renderGroup(mainGroup)}
        <div className="flex flex-col gap-4">
          {sideGroups.map(renderGroup)}
        </div>
      </div>

      {isEditor && selectedEmployee && (
        <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Einheiten auf {selectedEmployee.name} buchen?</DialogTitle>
              <DialogDescription>
                Die berechneten Einheiten werden je Karriereplan zu den bestehenden Einheiten addiert.
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-hidden rounded-md border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
                    <th className="px-3 py-1.5">Plan</th>
                    <th className="px-3 py-1.5 text-right">Vorher</th>
                    <th className="px-3 py-1.5 text-right">+ Neu</th>
                    <th className="px-3 py-1.5 text-right">Nachher</th>
                  </tr>
                </thead>
                <tbody>
                  {EH_GROUPS.map((group) => {
                    const before = Number(selectedEmployee.units[group.id]) || 0
                    const added = bookedUnits[group.id] || 0
                    return (
                      <tr key={group.id} className="border-t">
                        <td className="px-3 py-1.5">{PLAN_LABELS[group.id]}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                          {ehFormatEH(before)}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                          {added > 0 ? `+ ${ehFormatEH(added)}` : "–"}
                        </td>
                        <td className="px-3 py-1.5 text-right font-semibold tabular-nums">
                          {ehFormatEH(before + added)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBookingOpen(false)}>Abbrechen</Button>
              <Button onClick={onConfirmBooking}>Buchen</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
