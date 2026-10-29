// Feature 3b (Statistik): Verlaufskurve der in der Mitarbeiter-Matrix
// ausgewählten Person — Ist/Soll/Vergütung über den gewählten Zeitraum.
import "@/lib/chartSetup"
import { Line } from "react-chartjs-2"
import { TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SURFACE_CARD, CHART_GRID, CHART_LEGEND, CHART_TICK } from "@/lib/chartSetup"
import { monthLabel } from "@/lib/calc/archive"
import type { EmployeeSeries } from "@/lib/calc/statistik"

export function EmployeeCurve({ series }: { series: EmployeeSeries | null }) {
  if (!series) return null

  return (
    <Card className={SURFACE_CARD}>
      <CardHeader>
        <CardTitle icon={TrendingUp}>
          {series.name}{series.role ? ` · ${series.role}` : ""}
        </CardTitle>
        <p className="text-xs text-slate-400">Verlauf über den gewählten Zeitraum</p>
      </CardHeader>
      <CardContent>
        <div className="h-[220px]">
          <Line
            data={{
              labels: series.cells.map((c) => monthLabel(c.month)),
              datasets: [
                {
                  label: "Ist", data: series.cells.map((c) => (c.present ? c.ist : null)),
                  borderColor: "#3ee08e", backgroundColor: "rgba(62,224,142,.15)",
                  borderWidth: 3, pointRadius: 3, pointBackgroundColor: "#3ee08e",
                  fill: true, tension: 0.25, spanGaps: true,
                },
                {
                  label: "Soll", data: series.cells.map((c) => (c.present ? c.soll : null)),
                  borderColor: "#5B7C8A", borderDash: [5, 4], borderWidth: 2, pointRadius: 0, spanGaps: true,
                },
                {
                  label: "Vergütung €", data: series.cells.map((c) => (c.present ? c.eur : null)),
                  borderColor: "#f5b800", borderWidth: 2, pointRadius: 2, yAxisID: "y1", spanGaps: true,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: "index", intersect: false },
              plugins: { legend: CHART_LEGEND },
              scales: {
                x: { grid: { display: false }, ticks: CHART_TICK },
                y: { beginAtZero: true, ticks: CHART_TICK, grid: { color: CHART_GRID } },
                y1: { beginAtZero: true, position: "right" as const, ticks: CHART_TICK, grid: { display: false } },
              },
            }}
            aria-label={`Verlauf für ${series.name}`}
            role="img"
          />
        </div>
      </CardContent>
    </Card>
  )
}
