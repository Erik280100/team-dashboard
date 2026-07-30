// Feature 2 (Statistik): A/B-Monatsvergleich — eigene, vom Zeitraum-Range
// unabhängige Monatsauswahl, KPI-Delta-Tabelle (▲/▼) plus horizontale Bars der
// Einheiten je Karriereplan.
import "@/lib/chartSetup"
import { Bar } from "react-chartjs-2"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { DARK_CARD, DARK_GRID, DARK_LEGEND, DARK_TICK } from "@/lib/chartSetup"
import { fmt, fmtEur } from "@/lib/calc/format"
import { compareMonths, type MetricDelta } from "@/lib/calc/statistik"
import { PLAN_IDS, PLAN_LABELS } from "@/lib/calc/struktur"
import type { ArchiveIndexEntry, MonthKey } from "@/types/archive"
import { cn } from "@/lib/utils"

function formatValue(v: number, unit: MetricDelta["unit"]): string {
  if (unit === "eur") return fmtEur(v) + " €"
  if (unit === "pct") return v + "%"
  return fmt(v)
}

export function MonthCompare({
  index,
  monthA,
  monthB,
  onChangeA,
  onChangeB,
  entryA,
  entryB,
}: {
  index: ArchiveIndexEntry[]
  monthA: MonthKey
  monthB: MonthKey
  onChangeA: (m: MonthKey) => void
  onChangeB: (m: MonthKey) => void
  entryA: ArchiveIndexEntry
  entryB: ArchiveIndexEntry
}) {
  const deltas = compareMonths(entryA, entryB)

  return (
    <Card className={DARK_CARD}>
      <CardHeader>
        <CardTitle className="text-white">Monatsvergleich</CardTitle>
        <p className="text-xs text-white/50">Monat A gegen Monat B, Differenz absolut und in Prozent</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-medium text-white/60" htmlFor="compareMonthA">Monat A</label>
            <Select
              id="compareMonthA" aria-label="Monat A" value={monthA}
              onChange={(e) => onChangeA(e.target.value)}
              className="w-40 border-white/20 bg-white/10 text-white"
            >
              {index.map((e) => <option key={e.month} value={e.month} className="text-black">{e.label}</option>)}
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-white/60" htmlFor="compareMonthB">Monat B</label>
            <Select
              id="compareMonthB" aria-label="Monat B" value={monthB}
              onChange={(e) => onChangeB(e.target.value)}
              className="w-40 border-white/20 bg-white/10 text-white"
            >
              {index.map((e) => <option key={e.month} value={e.month} className="text-black">{e.label}</option>)}
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-white/50">
                <th className="py-1.5 pr-3">Kennzahl</th>
                <th className="py-1.5 pr-3 text-right">A</th>
                <th className="py-1.5 pr-3 text-right">B</th>
                <th className="py-1.5 text-right">Δ</th>
              </tr>
            </thead>
            <tbody>
              {deltas.map((d) => (
                <tr key={d.key} className="border-t border-white/10">
                  <td className="py-1.5 pr-3 text-white/80">{d.label}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-white/70">{formatValue(d.a, d.unit)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-white/70">{formatValue(d.b, d.unit)}</td>
                  <td
                    className={cn(
                      "py-1.5 text-right tabular-nums font-semibold",
                      d.delta > 0 ? "text-emerald-400" : d.delta < 0 ? "text-red-400" : "text-white/50"
                    )}
                  >
                    {d.delta > 0 ? "▲ " : d.delta < 0 ? "▼ " : ""}
                    {formatValue(Math.abs(d.delta), d.unit)}
                    {d.pctChange !== null && (
                      <span className="ml-1 text-xs text-white/40">
                        ({d.pctChange > 0 ? "+" : ""}{d.pctChange}%)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="h-[200px]">
          <Bar
            data={{
              labels: PLAN_IDS.map((p) => PLAN_LABELS[p]),
              datasets: [
                { label: entryA.label, data: PLAN_IDS.map((p) => entryA.totals.ehByPlan[p] || 0), backgroundColor: "rgba(255,255,255,.25)", borderRadius: 4 },
                { label: entryB.label, data: PLAN_IDS.map((p) => entryB.totals.ehByPlan[p] || 0), backgroundColor: "#64DDA3", borderRadius: 4 },
              ],
            }}
            options={{
              indexAxis: "y" as const,
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: DARK_LEGEND },
              scales: {
                x: { beginAtZero: true, ticks: DARK_TICK, grid: { color: DARK_GRID } },
                y: { grid: { display: false }, ticks: DARK_TICK },
              },
            }}
            aria-label="Einheiten je Karriereplan, Monat A vs. Monat B"
            role="img"
          />
        </div>
      </CardContent>
    </Card>
  )
}
