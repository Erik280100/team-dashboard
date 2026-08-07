// Feature 4 (Statistik): Karriereplan-Aufteilung — Stacked Bar über den
// Zeitraum (absolut/prozentual umschaltbar) plus Doughnut der Zeitraum-Summe.
import "@/lib/chartSetup"
import { useState } from "react"
import { Bar, Doughnut } from "react-chartjs-2"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DARK_CARD, DARK_GRID, DARK_LEGEND, DARK_TICK } from "@/lib/chartSetup"
import { fmt } from "@/lib/calc/format"
import { PLAN_COLORS, type PlanSplitPoint } from "@/lib/calc/statistik"
import { PLAN_IDS, PLAN_LABELS } from "@/lib/calc/struktur"
import { cn } from "@/lib/utils"

export function PlanSplitChart({ points }: { points: PlanSplitPoint[] }) {
  const [mode, setMode] = useState<"absolute" | "percent">("absolute")
  const totalsByPlan = PLAN_IDS.map((p) => points.reduce((s, pt) => s + (pt.units[p] || 0), 0))

  return (
    <Card className={DARK_CARD}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-white">Karriereplan-Aufteilung</CardTitle>
          <p className="text-xs text-white/50">Insurance / Investment / Credit / Real Estate über den Zeitraum</p>
        </div>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant={mode === "absolute" ? "default" : "outline"}
            className={mode === "absolute" ? "" : "border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"}
            onClick={() => setMode("absolute")}
          >
            Absolut
          </Button>
          <Button
            size="sm"
            variant={mode === "percent" ? "default" : "outline"}
            className={mode === "percent" ? "" : "border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"}
            onClick={() => setMode("percent")}
          >
            Prozentual
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-3">
        <div className="h-[260px] lg:col-span-2">
          <Bar
            data={{
              labels: points.map((p) => p.label),
              datasets: PLAN_IDS.map((p) => ({
                label: PLAN_LABELS[p],
                data: points.map((pt) => (mode === "absolute" ? pt.units[p] || 0 : pt.share[p] || 0)),
                backgroundColor: PLAN_COLORS[p],
                stack: "plans",
              })),
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: DARK_LEGEND },
              scales: {
                x: { stacked: true, grid: { display: false }, ticks: DARK_TICK },
                y: {
                  stacked: true, beginAtZero: true,
                  max: mode === "percent" ? 100 : undefined,
                  ticks: DARK_TICK, grid: { color: DARK_GRID },
                },
              },
            }}
            aria-label="Karriereplan-Aufteilung je Monat"
            role="img"
          />
        </div>
        <div>
          <div className="h-[180px]">
            <Doughnut
              data={{
                labels: PLAN_IDS.map((p) => PLAN_LABELS[p]),
                datasets: [{ data: totalsByPlan, backgroundColor: PLAN_IDS.map((p) => PLAN_COLORS[p]), borderWidth: 0 }],
              }}
              options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
              aria-label="Karriereplan-Anteil, Zeitraum-Summe"
              role="img"
            />
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            {PLAN_IDS.map((p, i) => (
              <div key={p} className={cn("flex items-center gap-2 text-xs text-white/70")}>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PLAN_COLORS[p] }} />
                <span className="flex-1">{PLAN_LABELS[p]}</span>
                <span className="font-medium">{fmt(totalsByPlan[i])}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
