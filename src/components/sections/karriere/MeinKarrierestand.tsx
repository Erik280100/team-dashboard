// Persönlicher Karrierestand: Stufe je Karriereplan und was bis zur nächsten Stufe fehlt.
// Trainees sind in Investment/Credit/Real Estate getrennt eingestuft (Start FT1, Aufstieg über die
// kumulierten Einheiten im Plan, siehe planStufen.ts); Insurance und alles ab Teamleiter folgt der
// Strukturbaum-Rolle. Führungskräfte sehen ihren Strukturaufbau (Kriterien wie im Strukturbaum-Panel).
import { useMemo, useState } from "react"
import { Select } from "@/components/ui/select"
import { DARK_OPTION, DARK_SELECT, MintBar, SectionHero } from "@/components/ui/dark"
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

export function MeinKarrierestand({ merged, planRates, myName }: Props) {
  const [picked, setPicked] = useState("")
  const own = myName ? merged.find((m) => m.name === myName) : undefined
  const me = own ?? merged.find((m) => m.name === picked)
  const promotion = useMemo(() => (me ? computePromotionProgress(merged).get(me.name) : undefined), [merged, me])
  const standings = me ? computePlanStandings(me) : null

  return (
    <div className="flex flex-col gap-4">
      <SectionHero
        eyebrow="Karriere"
        title={me ? me.name : "Mein Karrierestand"}
        badge={me ? me.role || "—" : undefined}
        description={me ? "Stufe laut Strukturbaum" : undefined}
        actions={
          !own && (
            <Select
              aria-label="Person auswählen"
              className={cn("w-64", DARK_SELECT)}
              value={picked}
              onChange={(e) => setPicked(e.target.value)}
            >
              <option className={DARK_OPTION} value="">— Person auswählen —</option>
              {merged.map((m) => (
                <option className={DARK_OPTION} key={m.name} value={m.name}>{m.name} ({m.role || "—"})</option>
              ))}
            </Select>
          )
        }
      />
      {!me && <div className="text-sm text-muted-foreground">Für dich ist im Strukturbaum noch keine Person hinterlegt.</div>}
      {me && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {PLAN_IDS.filter((p) => p !== "investmentVb").map((planId) => {
              const standing = standings?.find((s) => s.planId === planId)
              const stage = standing?.role ?? planStageOf(me, planId)
              const rate = sbGetPlanRate(planRates, stage, planId)
              return (
                <div key={planId} className="career-stage">
                  <div className="stage-label">{PLAN_LABELS[planId]}</div>
                  <div className="stage-title">{stage || "—"}</div>
                  {rate > 0 && (
                    <div className="stage-rate">{eur(rate)}<small>/ EH</small></div>
                  )}
                  {standing ? (
                    <div className="mt-auto flex flex-col gap-2">
                      <MintBar pct={Math.round(standing.fraction * 100)} />
                      <div className="rounded-[10px] bg-white/[.06] px-2.5 py-1.5 text-xs leading-snug text-[#dbe7e4]">
                        {standing.nextRole
                          ? <>{fmt(standing.have)} / {fmt(standing.need)} EH · noch {fmt(standing.missing)} EH bis {standing.nextRole}</>
                          : <>{fmt(standing.have)} EH gesamt · Ende der Stufen in diesem Plan, der nächste Schritt ist Teamleiter (Strukturaufbau)</>}
                      </div>
                    </div>
                  ) : (
                    <div className="stage-desc mt-auto">
                      {standings
                        ? (promotion?.nextRole ? `Nächste Stufe: ${promotion.nextRole} (Kriterien siehe unten)` : "Höchste Stufe erreicht")
                        : "Ab Teamleiter gilt in allen Plänen dieselbe Stufe."}
                    </div>
                  )}
                </div>
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
              <PromotionPanel promotion={promotion} variant="dark" />
            </div>
          )}
        </>
      )}
    </div>
  )
}
