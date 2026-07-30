// Feature 3b (Statistik): Verlaufskurve der in der Mitarbeiter-Matrix
// ausgewählten Person — Ist/Soll/Vergütung über den gewählten Zeitraum.
import "@/lib/chartSetup"
import { Line } from "react-chartjs-2"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DARK_CARD, DARK_GRID, DARK_LEGEND, DARK_TICK } from "@/lib/chartSetup"
import { monthLabel } from "@/lib/calc/archive"
import type { EmployeeSeries } from "@/lib/calc/statistik"

export function EmployeeCurve({ series }: { series: EmployeeSeries | null }) {
  if (!series) return null

  return (
    <Card className={DARK_CARD}>
      <CardHeader>
        <CardTitle className="text-white">
          {series.name}{series.role ? ` · ${series.role}` : ""}
        </CardTitle>
        <p className="text-xs text-white/50">Verlauf über den gewählten Zeitraum</p>
      </CardHeader>
      <CardContent>
        <div className="h-[220px]">
          <Line
            data={{
              labels: series.cells.map((c) => monthLabel(c.month)),
              datasets: [
                {
                  label: "Ist", data: series.cells.map((c) => (c.present ? c.ist : null)),
                  borderColor: "#64DDA3", backgroundColor: "rgba(100,221,163,.15)",
                  borderWidth: 3, pointRadius: 3, pointBackgroundColor: "#64DDA3",
                  fill: true, tension: 0.25, spanGaps: true,
                },
                {
                  label: "Soll", data: series.cells.map((c) => (c.present ? c.soll : null)),
                  borderColor: "#5B7C8A", borderDash: [5, 4], borderWidth: 2, pointRadius: 0, spanGaps: true,
                },
                {
                  label: "Vergütung €", data: series.cells.map((c) => (c.present ? c.eur : null)),
                  borderColor: "#E7A94C", borderWidth: 2, pointRadius: 2, yAxisID: "y1", spanGaps: true,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: "index", intersect: false },
              plugins: { legend: DARK_LEGEND },
              scales: {
                x: { grid: { display: false }, ticks: DARK_TICK },
                y: { beginAtZero: true, ticks: DARK_TICK, grid: { color: DARK_GRID } },
                y1: { beginAtZero: true, position: "right" as const, ticks: DARK_TICK, grid: { display: false } },
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
