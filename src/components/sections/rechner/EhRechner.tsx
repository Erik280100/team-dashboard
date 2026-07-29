// EH-Rechner — Äquivalent zu initEHRechner() aus legacy/index.html:3356–3456.
// Reine Client-Berechnung, nichts wird gespeichert (wie im Original).
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useConfirm } from "@/hooks/useConfirm"
import { calcEh, EH_GROUPS, EH_ITEMS, ehFormatEH, ehFormatEUR, type EhGroup } from "@/lib/calc/eh"

function defaultG(): Record<string, number> {
  const g: Record<string, number> = {}
  EH_ITEMS.forEach((it) => { if (it.hasG) g[it.id] = it.gDefault ?? 0 })
  return g
}
function defaultJ(): Record<string, number> {
  const j: Record<string, number> = {}
  EH_ITEMS.forEach((it) => { j[it.id] = 0 })
  return j
}
function defaultMult(): Record<EhGroup["id"], number> {
  const m = {} as Record<EhGroup["id"], number>
  EH_GROUPS.forEach((g) => { m[g.id] = g.multDefault })
  return m
}

export function EhRechner() {
  const [g, setG] = useState(defaultG)
  const [j, setJ] = useState(defaultJ)
  const [mult, setMult] = useState(defaultMult)
  const confirm = useConfirm()

  const result = calcEh({ g, j, mult })

  async function onReset() {
    const ok = await confirm("Alle Eingaben im EH-Rechner wirklich zurücksetzen?")
    if (!ok) return
    setG(defaultG())
    setJ(defaultJ())
    setMult(defaultMult())
  }

  function renderGroup(group: EhGroup) {
    const items = EH_ITEMS.filter((it) => it.sparte === group.id)
    return (
      <Card key={group.id}>
        <CardContent className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">{group.title}</h3>
          {items.map((it) => (
            <div key={it.id} className="grid grid-cols-[1fr_auto_auto_auto] items-end gap-3 border-b pb-3 last:border-0 last:pb-0">
              <div className="min-w-0">
                <div className="text-sm font-medium">{it.label}</div>
                <div className="text-xs text-muted-foreground">Auszahlung: {it.payout}</div>
              </div>
              {it.hasG ? (
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {it.gLabel} ({it.gUnit})
                  <input
                    type="number" min={0} step={1} max={it.gMax}
                    className="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm"
                    value={g[it.id] ?? 0}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setG((s) => ({ ...s, [it.id]: Number(e.target.value) || 0 }))}
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
                    className="h-8 w-28 rounded-md border border-input bg-background px-2 text-sm"
                    value={j[it.id] ?? 0}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setJ((s) => ({ ...s, [it.id]: Number(e.target.value) || 0 }))}
                  />
                </label>
              )}
              <div className="text-right">
                <div className="text-base font-bold tabular-nums">{ehFormatEH(result.perItem[it.id])}</div>
                <div className="text-xs text-muted-foreground">EH</div>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between border-t pt-3 text-sm">
            <span className="text-muted-foreground">Zwischensumme</span>
            <span className="font-semibold tabular-nums">{ehFormatEH(result.groupSums[group.id])} EH</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex-1 text-xs text-muted-foreground">
              Multiplikator (€ / EH)
              <input
                type="number" min={0} step={0.5}
                className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={mult[group.id]}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setMult((s) => ({ ...s, [group.id]: Number(e.target.value) || 0 }))}
              />
            </label>
            <span className="whitespace-nowrap text-sm font-semibold tabular-nums">
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

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Gesamt Einheiten</div>
            <div className="text-2xl font-bold tabular-nums">{ehFormatEH(result.grandTotal)} EH</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Gesamt in €</div>
            <div className="text-2xl font-bold tabular-nums">{ehFormatEUR(result.grandTotalEur)} €</div>
          </div>
          <Button variant="ghost" size="sm" onClick={onReset}>Zurücksetzen</Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        {renderGroup(mainGroup)}
        <div className="flex flex-col gap-4">
          {sideGroups.map(renderGroup)}
        </div>
      </div>
    </div>
  )
}
