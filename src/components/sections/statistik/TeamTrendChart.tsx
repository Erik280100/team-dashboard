// Feature 1 (Statistik): Team-Trend — Einheiten Soll vs. Ist je Monat (Bars,
// wie das Bar-Chart in Overview.tsx) plus Zielerreichung % als Linie auf einer
// zweiten Achse.
import "@/lib/chartSetup"
import { Bar } from "react-chartjs-2"
import type { ChartData } from "chart.js"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DARK_CARD, DARK_GRID, DARK_LEGEND, DARK_TICK } from "@/lib/chartSetup"
import type { TrendPoint } from "@/lib/calc/statistik"

export function TeamTrendChart({ points }: { points: TrendPoint[] }) {
  return (
    <Card className={DARK_CARD}>
      <CardHeader>
        <CardTitle className="text-white">Team-Trend</CardTitle>
        <p className="text-xs text-white/50">Einheiten Soll/Ist und Zielerreichung je abgeschlossenem Monat</p>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <Bar
            // Gemischtes Bar+Line-Chart: Chart.js unterstützt einen Typ-Override je
            // Dataset zur Laufzeit problemlos, react-chartjs-2s Typen für <Bar>
            // erlauben das aber nicht — daher der Cast (Standard-Workaround für
            // Mixed Charts mit react-chartjs-2).
            data={{
              labels: points.map((p) => p.label),
              datasets: [
                { label: "Soll", data: points.map((p) => p.soll), backgroundColor: "rgba(255,255,255,.12)", borderRadius: 4, yAxisID: "y" },
                { label: "Ist", data: points.map((p) => p.ist), backgroundColor: "#64DDA3", borderRadius: 4, yAxisID: "y" },
                {
                  label: "Zielerreichung %", data: points.map((p) => p.pct), type: "line",
                  borderColor: "#E7A94C", backgroundColor: "#E7A94C", pointBackgroundColor: "#E7A94C",
                  borderWidth: 2, pointRadius: 3, tension: 0.25, yAxisID: "y1",
                },
              ],
            } as unknown as ChartData<"bar">}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: "index", intersect: false },
              plugins: { legend: DARK_LEGEND },
              scales: {
                x: { grid: { display: false }, ticks: DARK_TICK },
                y: { beginAtZero: true, ticks: DARK_TICK, grid: { color: DARK_GRID } },
                y1: {
                  beginAtZero: true, position: "right" as const, ticks: DARK_TICK,
                  grid: { display: false }, max: 120,
                },
              },
            }}
            aria-label={
              "Team-Trend: " +
              points.map((p) => `${p.label} Ist ${p.ist} von Soll ${p.soll}, ${p.pct} Prozent`).join(", ")
            }
            role="img"
          />
        </div>
      </CardContent>
    </Card>
  )
}
