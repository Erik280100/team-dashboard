// Detail-Dialog zur Vergütung eines Mitarbeiters: eigene Einheiten je
// Karriereplan (bei isEditor editierbar) plus Differenzvergütung, die diese
// Person aus der Produktion ihres Unterbaums bezieht (siehe verguetung.ts).
// Änderungen werden erst mit dem "Speichern"-Button übernommen — "Schließen"
// und das X verwerfen den Entwurf (siehe Nutzer-Feedback: versehentliche
// Blur-Commits waren nicht rückgängig zu machen).
import { useEffect, useState } from "react"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { PLAN_IDS, PLAN_LABELS, type PlanId } from "@/lib/calc/struktur"
import type { EmployeeEarnings } from "@/lib/calc/verguetung"
import { cn } from "@/lib/utils"

function fmtEur(n: number): string {
  return n.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtEh(n: number): string {
  return n.toLocaleString("de-AT", { maximumFractionDigits: 2 })
}

const KIND_LABEL: Record<string, string> = {
  eigen: "Eigenproduktion",
  differenz: "Differenz",
  gleichstand: "Gleichstand",
}

function draftFromEarnings(earnings: EmployeeEarnings): Record<PlanId, string> {
  const draft = {} as Record<PlanId, string>
  PLAN_IDS.forEach((planId) => { draft[planId] = String(earnings.own[planId].units || 0) })
  return draft
}

export function EmployeeEarningsDialog({
  open, onOpenChange, name, role, earnings, isEditor, onSaveUnits, onSaveBonus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  role: string
  earnings: EmployeeEarnings
  isEditor: boolean
  onSaveUnits: (units: Record<PlanId, number>) => void
  onSaveBonus: (bonus: number) => void
}) {
  const [draft, setDraft] = useState<Record<PlanId, string>>(() => draftFromEarnings(earnings))
  const [bonusDraft, setBonusDraft] = useState<string>(() => String(earnings.bonus || 0))

  // Entwurf neu aufsetzen, wenn der Dialog für eine (neue) Person geöffnet wird
  // — nicht bei jedem earnings-Update, sonst würden Tastatureingaben durch den
  // nächsten Render überschrieben.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open) {
      setDraft(draftFromEarnings(earnings))
      setBonusDraft(String(earnings.bonus || 0))
    }
  }, [open, name])

  function handleSave() {
    const units = {} as Record<PlanId, number>
    PLAN_IDS.forEach((planId) => { units[planId] = Number(draft[planId]) || 0 })
    onSaveUnits(units)
    onSaveBonus(Number(bonusDraft) || 0)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>
            {role ? `${role} · ` : ""}Einheiten und Vergütung je Karriereplan
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Eigene Einheiten</h4>
            <div className="overflow-hidden rounded-md border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
                    <th className="px-3 py-1.5">Plan</th>
                    <th className="px-3 py-1.5 text-right">Einheiten</th>
                    <th className="px-3 py-1.5 text-right">€/EH</th>
                    <th className="px-3 py-1.5 text-right">Betrag</th>
                  </tr>
                </thead>
                <tbody>
                  {PLAN_IDS.map((planId) => {
                    const p = earnings.own[planId]
                    return (
                      <tr key={planId} className="border-t">
                        <td className="px-3 py-1.5">{PLAN_LABELS[planId]}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {isEditor ? (
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={draft[planId]}
                              aria-label={`${PLAN_LABELS[planId]} Einheiten – ${name}`}
                              className={cn(
                                "h-7 w-20 rounded-md border border-input bg-background px-2 text-right text-sm tabular-nums shadow-xs outline-none",
                                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                              )}
                              onChange={(e) => setDraft((s) => ({ ...s, [planId]: e.target.value }))}
                            />
                          ) : (
                            fmtEh(p.units)
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                          {p.rate > 0 ? fmtEur(p.rate) : "–"}
                        </td>
                        <td className="px-3 py-1.5 text-right font-medium tabular-nums">{fmtEur(p.amount)} €</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-t-foreground/40 font-semibold">
                    <td className="px-3 py-1.5" colSpan={3}>Summe eigen</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtEur(earnings.ownTotal)} €</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold text-muted-foreground">
              Differenzvergütung (aus dem eigenen Unterbaum)
            </h4>
            {earnings.diffTotal <= 0 ? (
              <p className="text-sm text-muted-foreground">Keine Differenzvergütung in diesem Zeitraum.</p>
            ) : (
              <div className="overflow-hidden rounded-md border">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
                      <th className="px-3 py-1.5">Plan</th>
                      <th className="px-3 py-1.5">Von</th>
                      <th className="px-3 py-1.5 text-right">Einheiten</th>
                      <th className="px-3 py-1.5 text-right">€/EH</th>
                      <th className="px-3 py-1.5 text-right">Betrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PLAN_IDS.flatMap((planId) =>
                      earnings.diff[planId].sources.map((s, i) => (
                        <tr key={`${planId}-${i}`} className="border-t">
                          <td className="px-3 py-1.5">{PLAN_LABELS[planId]}</td>
                          <td className="px-3 py-1.5">
                            {s.fromName}
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              ({KIND_LABEL[s.kind] ?? s.kind})
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{fmtEh(s.units)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                            {fmtEur(s.ratePerUnit)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-medium tabular-nums">{fmtEur(s.amount)} €</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-t-foreground/40 font-semibold">
                      <td className="px-3 py-1.5" colSpan={4}>Summe Differenz</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtEur(earnings.diffTotal)} €</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
            <label htmlFor="bonus-input" className="font-medium">Bonus (manuell)</label>
            {isEditor ? (
              <div className="flex items-center gap-1">
                <input
                  id="bonus-input"
                  type="number"
                  step="0.01"
                  value={bonusDraft}
                  aria-label={`Bonus – ${name}`}
                  className={cn(
                    "h-7 w-28 rounded-md border border-input bg-background px-2 text-right text-sm tabular-nums shadow-xs outline-none",
                    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  )}
                  onChange={(e) => setBonusDraft(e.target.value)}
                />
                <span className="text-muted-foreground">€</span>
              </div>
            ) : (
              <span className="tabular-nums">{fmtEur(earnings.bonus)} €</span>
            )}
          </div>

          <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm font-bold">
            <span>Gesamt</span>
            <span className="tabular-nums">{fmtEur(earnings.total)} €</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Schließen</Button>
          {isEditor && <Button onClick={handleSave}>Speichern</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
