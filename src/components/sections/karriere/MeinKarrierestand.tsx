// Persönlicher Karrierestand: Stufe je Karriereplan und was bis zur nächsten Stufe fehlt.
// Trainees sind in Investment/Credit/Real Estate getrennt eingestuft (Start FT1, Aufstieg über die
// kumulierten Einheiten im Plan, siehe planStufen.ts); Insurance und alles ab Teamleiter folgt der
// Strukturbaum-Rolle. Führungskräfte sehen ihren Strukturaufbau (Kriterien wie im Strukturbaum-Panel).
import { useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { computePlanStandings, computePromotionProgress } from "@/lib/calc/befoerderung"
import { fmt } from "@/lib/calc/format"
import { PLAN_IDS, PLAN_LABELS, sbGetPlanRate, type PlanId } from "@/lib/calc/struktur"
import { planStageOf } from "@/lib/calc/planStufen"
import type { MergedRow } from "@/lib/calc/team"
import { cn } from "@/lib/utils"
import { PromotionPanel } from "./PromotionPanel"

interface Props {
  merged: MergedRow[]
  planRates: Record<PlanId, Record<string, number>>
  /** Name der eigenen Person (aus dem Konto); fehlt z. B. beim Admin ohne Mitarbeiterzeile. */
  myName?: string
}

const eur = (n: number) => `€${n.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function Bar({ fraction, done }: { fraction: number; done: boolean }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div className={cn("h-full rounded-full", done ? "bg-emerald-500" : "bg-primary")} style={{ width: `${Math.round(fraction * 100)}%` }} />
    </div>
  )
}

export function MeinKarrierestand({ merged, planRates, myName }: Props) {
  const [picked, setPicked] = useState("")
  const own = myName ? merged.find((m) => m.name === myName) : undefined
  const me = own ?? merged.find((m) => m.name === picked)
  const promotion = useMemo(() => (me ? computePromotionProgress(merged).get(me.name) : undefined), [merged, me])
  const standings = me ? computePlanStandings(me) : null

  return (
    <div className="flex flex-col gap-4">
      {!own && (
        <label className="flex max-w-sm flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Person auswählen</span>
          <select
            className="h-9 rounded-md border bg-background px-2"
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
          >
            <option value="">— bitte wählen —</option>
            {merged.map((m) => <option key={m.name} value={m.name}>{m.name} ({m.role || "—"})</option>)}
          </select>
        </label>
      )}
      {!me && <div className="text-sm text-muted-foreground">Für dich ist im Strukturbaum noch keine Person hinterlegt.</div>}
      {me && (
        <>
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{me.name}</span> · Stufe laut Strukturbaum: {me.role || "—"}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {PLAN_IDS.filter((p) => p !== "investmentVb").map((planId) => {
              const standing = standings?.find((s) => s.planId === planId)
              const stage = standing?.role ?? planStageOf(me, planId)
              const rate = sbGetPlanRate(planRates, stage, planId)
              return (
                <Card key={planId}>
                  <CardContent className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-sm font-semibold">{PLAN_LABELS[planId]}</h3>
                      <span className="text-sm font-medium">{stage || "—"}{rate > 0 && <span className="text-muted-foreground"> · {eur(rate)} / EH</span>}</span>
                    </div>
                    {standing ? (
                      <>
                        <Bar fraction={standing.fraction} done={!standing.nextRole} />
                        <div className="text-[11px] text-muted-foreground">
                          {standing.nextRole
                            ? <>{fmt(standing.have)} / {fmt(standing.need)} EH · noch {fmt(standing.missing)} EH bis {standing.nextRole}</>
                            : <>{fmt(standing.have)} EH gesamt · Ende der Stufen in diesem Plan, der nächste Schritt ist Teamleiter (Strukturaufbau)</>}
                        </div>
                      </>
                    ) : (
                      <div className="text-[11px] text-muted-foreground">
                        {standings
                          ? (promotion?.nextRole ? `Nächste Stufe: ${promotion.nextRole} (Kriterien siehe unten)` : "Höchste Stufe erreicht")
                          : "Ab Teamleiter gilt in allen Plänen dieselbe Stufe."}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
          {standings && (
            <div className="text-[11px] text-muted-foreground">
              Als Trainee zählen Investment (inkl. Investment mit VB), Credit und Real Estate getrennt: Die Stufe steigt mit den
              gesamten Einheiten im jeweiligen Plan und wird beim Monatsabschluss nicht zurückgesetzt.
            </div>
          )}
          {promotion && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">{standings ? "Insurance bzw. Weg zum Teamleiter" : "Mein Strukturaufbau"}</h3>
              <PromotionPanel promotion={promotion} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
