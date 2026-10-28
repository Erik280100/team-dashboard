// EH-Rechner — Äquivalent zu initEHRechner() aus der früheren Einzeldatei-App.
// Reine Client-Berechnung, nichts wird gespeichert (wie im Original) — außer
// beim expliziten "Auf Mitarbeiter buchen" (jeder Besucher darf das, auch
// ohne echten Login — siehe canBook/useAuth.ts), das die berechneten
// Einheiten je Sparte additiv auf einen Mitarbeiter überträgt (siehe
// App.tsx applyUnitsToEmployee / verguetung.ts).
import { useEffect, useRef, useState } from "react"
import { Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { DARK_CARD, DARK_OPTION, DARK_SELECT, DARK_TILE } from "@/components/ui/dark"
import { cn } from "@/lib/utils"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { useConfirm } from "@/hooks/useConfirm"
import { calcEh, ehAbwicklerOptions, ehMultForRole, EH_GROUPS, EH_ITEMS, ehFormatEH, ehFormatEUR, type EhGroup } from "@/lib/calc/eh"
import { PLAN_IDS, PLAN_LABELS, type PlanId } from "@/lib/calc/struktur"
import { umsatzDrafts, type UmsatzDraft } from "@/lib/calc/umsatz"

// der früheren Einzeldatei-App — Gruppen-Akzentfarbe (oberer Rand der Karte)
const GROUP_ACCENT: Record<EhGroup["id"], string> = {
  insurance: "#3FCB8E",
  investment: "#5B9BD5",
  credit: "#E7A94C",
  realestate: "#B07CC6",
}

/** Eingabefelder auf den dunklen Gruppenkarten. */
const EH_INPUT = "rounded-md border border-white/35 bg-white/[.12] text-white placeholder:text-white/65 [color-scheme:dark] transition-colors focus:outline-none focus:border-[#64DDA3] focus:ring-2 focus:ring-[#64DDA3]/25"

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
  employees, abwicklerCandidates, planRates, defaultEmployee, canBook, onApplyUnits,
}: {
  employees: { name: string; role: string; units: Record<PlanId, number> }[]
  abwicklerCandidates: { name: string }[]
  planRates: Record<PlanId, Record<string, number>>
  defaultEmployee?: string
  /** Steuert nur die Buchen-Sektion — jeder Besucher darf hier auf sich buchen. */
  canBook: boolean
  onApplyUnits: (name: string, units: Record<PlanId, number>, abwickler?: string, sales?: UmsatzDraft[]) => void
}) {
  const [g, setG] = useState(defaultG)
  const [j, setJ] = useState(defaultJ)
  const [mult, setMult] = useState(defaultMult)
  const [selectedName, setSelectedName] = useState("")
  const [bookingOpen, setBookingOpen] = useState(false)
  const [abwickler, setAbwickler] = useState("")
  const [kunde, setKunde] = useState("")
  const [lastBooked, setLastBooked] = useState<string | null>(null)
  const confirm = useConfirm()

  const result = calcEh({ g, j, mult })
  const bookedUnits = PLAN_IDS.reduce((acc, planId) => {
    acc[planId] = round2(result.planSums[planId] || 0)
    return acc
  }, {} as Record<PlanId, number>)
  // Positionen mit Betrag wandern bei der Buchung in die Umsatzverfolgung (Controlling).
  const sales = umsatzDrafts(j, result.perItem, kunde)
  const selectedEmployee = employees.find((e) => e.name === selectedName) ?? null
  // Fallback auf alle Mitarbeiter, falls Georg/Sandro im Strukturbaum nicht gefunden werden.
  const matched = ehAbwicklerOptions(abwicklerCandidates)
  const abwicklerOptions = matched.length > 0 ? matched : [...abwicklerCandidates].sort((a, b) => a.name.localeCompare(b.name, "de"))
  const needsAbwickler = bookedUnits.investmentVb > 0 && abwicklerOptions.length > 0
  const chosenAbwickler = abwicklerOptions.find((a) => a.name === abwickler) ?? abwicklerOptions[0] ?? null

  /** Mitarbeiter wählen: Multiplikatoren auf die Stufensätze seiner Karrierestufe setzen (danach änderbar). */
  function selectEmployee(name: string) {
    setSelectedName(name)
    const emp = employees.find((e) => e.name === name)
    if (!emp) return
    setMult(Object.fromEntries(EH_GROUPS.map((gr) => [gr.id, String(ehMultForRole(planRates, gr, emp.role))])) as Record<EhGroup["id"], string>)
  }

  // Der Eingeloggte ist vorausgewählt, sobald die Mitarbeiterliste geladen ist (einmalig).
  const preselected = useRef(false)
  useEffect(() => {
    if (preselected.current || !defaultEmployee || !employees.some((e) => e.name === defaultEmployee)) return
    preselected.current = true
    selectEmployee(defaultEmployee)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultEmployee, employees])

  async function onReset() {
    const ok = await confirm("Alle Eingaben im EH-Rechner wirklich zurücksetzen?")
    if (!ok) return
    setG(defaultG())
    setJ(defaultJ())
    if (selectedEmployee) selectEmployee(selectedEmployee.name)
    else setMult(defaultMult())
  }

  function onConfirmBooking() {
    if (!selectedEmployee) return
    onApplyUnits(selectedEmployee.name, bookedUnits, needsAbwickler ? chosenAbwickler?.name : undefined, sales)
    setLastBooked(selectedEmployee.name)
    setKunde("")
    setBookingOpen(false)
  }

  function renderGroup(group: EhGroup) {
    const items = EH_ITEMS.filter((it) => it.sparte === group.id)
    return (
      <Card key={group.id} className={cn("border-t-[3px]", DARK_CARD)} style={{ borderTopColor: GROUP_ACCENT[group.id] }}>
        <CardContent className="@container flex flex-col gap-3">
          <h3 className="text-sm font-extrabold uppercase tracking-wide" style={{ color: GROUP_ACCENT[group.id] }}>{group.title}</h3>
          {items.map((it) => (
            <div key={it.id} className={cn(DARK_TILE, "grid grid-cols-2 items-end gap-3 p-3 @lg:grid-cols-[1fr_7rem_7rem_7rem]")}>
              <div className="col-span-2 min-w-0 @lg:col-span-1">
                <div className="text-sm font-medium">{it.label}</div>
                <div className="text-xs text-white/90">Auszahlung: {it.payout}</div>
                {it.planFor && (
                  <div className="text-[11px] font-medium" style={{ color: GROUP_ACCENT[group.id] }}>
                    → {PLAN_LABELS[result.perItemPlan[it.id]]}
                  </div>
                )}
              </div>
              {it.hasG ? (
                <label className="flex flex-col gap-1 text-xs text-white/90">
                  {it.gLabel} ({it.gUnit})
                  <input
                    type="number" min={0} step={1} max={it.gMax}
                    className={cn("h-8 w-20 px-2 text-sm", EH_INPUT)}
                    value={g[it.id] ?? ""}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setG((s) => ({ ...s, [it.id]: e.target.value }))}
                  />
                </label>
              ) : (
                <div />
              )}
              {it.disabled ? (
                <input type="text" disabled value={it.disabledNote} className="h-8 w-28 rounded-md border border-white/15 bg-white/5 px-2 text-sm text-white/70" />
              ) : (
                <label className="flex flex-col gap-1 text-xs text-white/90">
                  {it.jLabel}
                  <input
                    type="number" min={0} step={10}
                    className={cn("h-8 w-28 px-2 text-sm", EH_INPUT)}
                    value={j[it.id] ?? ""}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setJ((s) => ({ ...s, [it.id]: e.target.value }))}
                  />
                </label>
              )}
              <div className="col-span-2 text-right sm:col-span-1">
                <div className="text-base font-bold tabular-nums text-[#64DDA3]">{ehFormatEH(result.perItem[it.id])}</div>
                <div className="text-xs text-white/90">EH</div>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-white/20 pt-3 text-sm">
            <span className="font-semibold text-white/85">Zwischensumme</span>
            <span className="text-lg font-extrabold tabular-nums">{ehFormatEH(result.groupSums[group.id])} EH</span>
          </div>
          {group.plans.length > 1 && group.plans.filter((p) => result.planSums[p] > 0).length > 1 && (
            <div className="-mt-2 flex flex-col gap-0.5">
              {group.plans.map((p) => (
                <div key={p} className="flex items-center justify-between text-xs text-white/90">
                  <span>davon {PLAN_LABELS[p]}</span>
                  <span className="tabular-nums">{ehFormatEH(result.planSums[p])} EH</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 flex items-center gap-1.5">
            <label className="shrink-0 text-[11px] font-semibold text-white/90">
              Multiplikator (€ / EH)
            </label>
            <input
              type="number" min={0} step={0.5}
              className={cn("ml-2 h-7 w-16 shrink-0 px-2 text-[12.5px]", EH_INPUT)}
              value={mult[group.id] ?? ""}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setMult((s) => ({ ...s, [group.id]: e.target.value }))}
            />
            <span className="ml-auto shrink-0 whitespace-nowrap text-[13.5px] font-bold tabular-nums text-[#64DDA3]">
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
      <div className={cn(DARK_CARD, "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm text-white/90")}>
        <Info className="mt-0.5 size-4 shrink-0 text-[#64DDA3]" aria-hidden="true" />
        <div><strong className="text-white">Einheiten (EH) berechnen:</strong> Prämien eintragen, Einheiten werden automatisch berechnet und summiert.
        froots-Geschäft über 500 € mtl. bzw. 10.000 € einmalig läuft automatisch über einen Abwickler (VB) und wird
        auf „Investment (mit VB)" statt „Investment" gebucht.
        </div>
      </div>

      <Card className="border-white/10 bg-[linear-gradient(135deg,#0B1F2A_0%,#155767_130%)] text-white">
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-white/90">Gesamt Einheiten</div>
              <div className="text-4xl font-extrabold tabular-nums text-[#64DDA3]">{ehFormatEH(result.grandTotal)} EH</div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-white/90">Gesamt in €</div>
              <div className="text-4xl font-extrabold tabular-nums text-[#64DDA3]">{ehFormatEUR(result.grandTotalEur)} €</div>
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

          {canBook && (
            <div className="flex flex-wrap items-center gap-2 border-t border-white/15 pt-3">
              <Select
                aria-label="Mitarbeiter für Übernahme wählen"
                value={selectedName}
                onChange={(e) => selectEmployee(e.target.value)}
                className={cn("w-56", DARK_SELECT)}
              >
                <option value="" className={DARK_OPTION}>Mitarbeiter wählen…</option>
                {[...employees].sort((a, b) => a.name.localeCompare(b.name, "de")).map((emp) => (
                  <option key={emp.name} value={emp.name} className={DARK_OPTION}>
                    {emp.name}
                  </option>
                ))}
              </Select>
              {needsAbwickler && (
                <Select
                  aria-label="Abwickler wählen"
                  value={chosenAbwickler?.name ?? ""}
                  onChange={(e) => setAbwickler(e.target.value)}
                  className={cn("w-56", DARK_SELECT)}
                >
                  {abwicklerOptions.map((a) => (
                    <option key={a.name} value={a.name} className={DARK_OPTION}>
                      Abwickler: {a.name}
                    </option>
                  ))}
                </Select>
              )}
              <Button
                size="sm"
                className="border-0 bg-[linear-gradient(135deg,#64DDA3,#3FCB8E)] font-bold text-[#0b1f2a] shadow-[0_4px_14px_rgba(63,203,142,.3)] hover:opacity-90"
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

      {canBook && selectedEmployee && (
        <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Einheiten auf {selectedEmployee.name} buchen?</DialogTitle>
              <DialogDescription>
                Die berechneten Einheiten werden je Karriereplan zu den bestehenden Einheiten addiert.
              </DialogDescription>
            </DialogHeader>
            {needsAbwickler && chosenAbwickler && (
              <p className="text-sm">
                Abwickler: <strong>{chosenAbwickler.name}</strong> (erhält die Differenz bei „Investment (mit VB)“)
              </p>
            )}
            {sales.length > 0 && (
              <div className="text-sm">
                <div className="mb-1 text-xs font-semibold text-muted-foreground">Wird in der Umsatzverfolgung erfasst:</div>
                <ul className="flex flex-col gap-0.5">
                  {sales.map((s) => (
                    <li key={s.produkt} className="flex justify-between gap-3">
                      <span>{s.produkt}</span>
                      <span className="tabular-nums text-muted-foreground">{ehFormatEUR(s.praemie)} €</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {sales.length > 0 && (
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Name des Kunden (optional, gilt für alle Produkte)
                <input
                  type="text"
                  className="h-8 rounded-md border border-input bg-background focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 transition-colors px-2 text-sm text-foreground"
                  value={kunde}
                  onChange={(e) => setKunde(e.target.value)}
                />
              </label>
            )}
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
                  {PLAN_IDS.map((planId) => {
                    const before = Number(selectedEmployee.units[planId]) || 0
                    const added = bookedUnits[planId] || 0
                    return (
                      <tr key={planId} className="border-t">
                        <td className="px-3 py-1.5">{PLAN_LABELS[planId]}</td>
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
