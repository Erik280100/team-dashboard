// Übersicht-Sektion — Äquivalent zu section-overview aus legacy/index.html:1623–1718.
// Datenlogik 1:1 aus src/lib/calc/overview.ts (golden-master-getestet gegen die
// Legacy-App). Visuelle Umsetzung bewusst neu mit Tailwind/shadcn statt 1:1-CSS-Klon.
import "@/lib/chartSetup"
import { useState, type ChangeEvent } from "react"
import { Bar, Doughnut, Line, Pie } from "react-chartjs-2"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { DARK_GRID, DARK_TICK } from "@/lib/chartSetup"
import { fmt } from "@/lib/calc/format"
import {
  barChartData, doughnutData, goalProgress, leaderboardData, recruitProgress,
  revenueShareData, summaryKpis, timelineData,
} from "@/lib/calc/overview"
import type { EmployeeRow, HistoryEntry, TeamGoal } from "@/types/dashboard"

const DARK_LEGEND = { labels: { color: "#DCEAE6", boxWidth: 12, font: { size: 11 } }, position: "top" as const }

export function Overview({
  rows,
  teamGoal,
  history,
  saveGoal,
  isEditor,
}: {
  rows: EmployeeRow[]
  teamGoal: TeamGoal
  history: HistoryEntry[]
  saveGoal: (next: TeamGoal) => void
  isEditor: boolean
}) {
  const kpis = summaryKpis(rows)
  const goal = goalProgress(rows)
  const recruit = recruitProgress(rows, teamGoal)
  const timeline = timelineData(teamGoal, rows, history)
  const bars = barChartData(rows)
  const doughnut = doughnutData(rows)
  const shares = revenueShareData(rows)
  const leaderboard = leaderboardData(rows)

  const [noteDraft, setNoteDraft] = useState(teamGoal.note)

  function commitField<K extends keyof TeamGoal>(key: K, value: TeamGoal[K]) {
    saveGoal({ ...teamGoal, [key]: value })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Team-Ziel + KPI-Kacheln */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-5">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Team-Ziel
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <div className="text-4xl font-bold tabular-nums">{fmt(goal.target)}</div>
                <span className="text-sm text-muted-foreground">
                  Einheiten
                  <br />
                  <span className="text-xs opacity-75">Summe Soll (Mitarbeiter)</span>
                </span>
              </div>
              <Input
                className="mt-3"
                placeholder="Kurzer Fokus/Motto für den Monat (optional)…"
                aria-label="Fokus/Motto für den Monat"
                value={noteDraft}
                disabled={!isEditor}
                onChange={(e) => setNoteDraft(e.target.value)}
                onBlur={() => { if (noteDraft !== teamGoal.note) commitField("note", noteDraft) }}
              />
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="periodStartInput" className="text-xs text-muted-foreground">
                    Umsatzmonat Start
                  </label>
                  <Input
                    id="periodStartInput"
                    type="date"
                    value={teamGoal.periodStart}
                    disabled={!isEditor}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      if (e.target.value) commitField("periodStart", e.target.value)
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="periodEndInput" className="text-xs text-muted-foreground">
                    Umsatzmonat Ende
                  </label>
                  <Input
                    id="periodEndInput"
                    type="date"
                    value={teamGoal.periodEnd}
                    disabled={!isEditor}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      if (e.target.value) commitField("periodEnd", e.target.value)
                    }}
                  />
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm">
                <span>
                  {fmt(goal.totalIst)} von {fmt(goal.target)} Einheiten
                </span>
                <span className="font-semibold">{goal.pct}%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${Math.min(goal.pct, 100)}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-muted-foreground">{goal.remainingText}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 text-neutral-100 dark:bg-neutral-900">
          <CardHeader>
            <CardTitle className="text-neutral-100">Zielverlauf & Prognose</CardTitle>
            <p className="text-xs text-neutral-400">
              Wann erreichen wir das Team-Ziel bei aktuellem Tempo?
            </p>
          </CardHeader>
          <CardContent>
            {timeline.valid ? (
              <div className="h-[220px]">
                <Line
                  data={{
                    labels: timeline.points.map((p) => p.label),
                    datasets: [
                      {
                        label: "Ziel-Pfad", data: timeline.points.map((p) => p.idealPath),
                        borderColor: "#5B7C8A", borderDash: [5, 4], borderWidth: 2,
                        pointRadius: 0, tension: 0, spanGaps: true,
                      },
                      {
                        label: "Ist-Verlauf", data: timeline.points.map((p) => p.actual),
                        borderColor: "#64DDA3", backgroundColor: "rgba(100,221,163,.15)",
                        borderWidth: 3, pointRadius: 2, pointBackgroundColor: "#64DDA3",
                        fill: true, tension: 0.25, spanGaps: true,
                      },
                      {
                        label: "Prognose", data: timeline.points.map((p) => p.forecast),
                        borderColor: "#E7A94C", borderDash: [3, 3], borderWidth: 2,
                        pointRadius: 0, tension: 0.15, spanGaps: true,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: "index", intersect: false },
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { grid: { display: false }, ticks: { ...DARK_TICK, maxTicksLimit: 10 } },
                      y: { beginAtZero: true, ticks: DARK_TICK, grid: { color: DARK_GRID } },
                    },
                  }}
                  aria-label="Zielverlauf und Prognose"
                  role="img"
                />
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-neutral-400">{timeline.forecastText}</div>
            )}
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-neutral-400">
              <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#64DDA3]" />Ist-Verlauf</span>
              <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#5B7C8A]" />Ziel-Pfad (linear)</span>
              <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#E7A94C]" />Prognose</span>
            </div>
            {timeline.valid && (
              <div
                className="mt-3 text-sm text-neutral-200"
                dangerouslySetInnerHTML={{ __html: timeline.forecastText }}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="text-2xl" aria-hidden="true">◎</div>
            <div>
              <div className="text-xs text-muted-foreground">Mitarbeiter</div>
              <div className="text-2xl font-bold">{kpis.employeeCount}</div>
              <div className="text-xs text-muted-foreground">im Team</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="text-2xl" aria-hidden="true">★</div>
            <div>
              <div className="text-xs text-muted-foreground">≥ 70% erreicht</div>
              <div className="text-2xl font-bold">{kpis.onTrackCount}</div>
              <div className="text-xs text-muted-foreground">von {rows.length} MA</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team-Fortschritt / Umsatzanteil / Leaderboard */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="bg-neutral-900 text-neutral-100">
          <CardHeader>
            <CardTitle className="text-neutral-100">Team-Fortschritt</CardTitle>
            <p className="text-xs text-neutral-400">Ist / Team-Ziel, Einheiten</p>
          </CardHeader>
          <CardContent>
            <div className="relative h-[220px]">
              <Doughnut
                data={{
                  labels: ["Erreicht (Ist)", "Offen bis Ziel"],
                  datasets: [{
                    data: doughnut.hasData ? [doughnut.totalIst, doughnut.rest] : [1, 0],
                    backgroundColor: doughnut.hasData
                      ? ["#64DDA3", "rgba(255,255,255,.12)"]
                      : ["rgba(255,255,255,.12)", "rgba(255,255,255,.12)"],
                    borderWidth: 0,
                  }],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: "72%",
                  plugins: { legend: DARK_LEGEND },
                }}
                aria-label={
                  doughnut.hasData
                    ? `Team-Fortschritt: ${fmt(doughnut.totalIst)} von ${fmt(doughnut.target)} Einheiten, ${doughnut.pct} Prozent erreicht.`
                    : "Team-Fortschritt: kein Ziel gesetzt."
                }
                role="img"
              />
              <div className="pointer-events-none absolute inset-0 top-0 flex flex-col items-center justify-center pb-8">
                <div className="text-xl font-bold text-neutral-100">
                  {doughnut.hasData ? `${doughnut.pct}%` : "—"}
                </div>
                <div className="text-[10px] text-neutral-400">
                  {doughnut.hasData ? `${fmt(doughnut.totalIst)} / ${fmt(doughnut.target)}` : "Kein Ziel gesetzt"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 text-neutral-100">
          <CardHeader>
            <CardTitle className="text-neutral-100">Umsatzanteil</CardTitle>
            <p className="text-xs text-neutral-400">Anteil je Mitarbeiter am Gesamtumsatz</p>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <Pie
                data={{
                  labels: shares.map((s) => s.name),
                  datasets: [{
                    data: shares.length ? shares.map((s) => s.value || 1) : [1],
                    backgroundColor: shares.map((s) => s.color),
                    borderWidth: 0,
                  }],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label(item) {
                          const s = shares[item.dataIndex]
                          return `${s.name}: ${s.pct}%`
                        },
                      },
                    },
                  },
                }}
                aria-label={"Umsatzanteil je Mitarbeiter: " + shares.map((s) => `${s.name} ${s.pct} Prozent`).join(", ")}
                role="img"
              />
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              {shares.map((s) => (
                <div key={s.name} className="flex items-center gap-2 text-xs text-neutral-300">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="font-medium">{s.pct}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 text-neutral-100">
          <CardHeader>
            <CardTitle className="text-neutral-100">Leaderboard</CardTitle>
            <p className="text-xs text-neutral-400">Ranking nach Ist AT</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            {leaderboard.map((r, i) => (
              <div key={r.name} className="flex items-center gap-3 text-sm">
                <span
                  className={
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold " +
                    (i === 0 ? "bg-yellow-500 text-black" : i === 1 ? "bg-neutral-300 text-black" : i === 2 ? "bg-amber-700 text-white" : "bg-neutral-800 text-neutral-300")
                  }
                >
                  {i + 1}
                </span>
                <span className="flex-1 truncate text-neutral-200">{r.name}</span>
                <span className="font-semibold tabular-nums text-neutral-100">{fmt(r.atIst)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recruiting-KPI */}
      <Card>
        <CardContent className="flex flex-wrap items-start gap-6">
          <div className="text-2xl" aria-hidden="true">👥</div>
          <div className="flex flex-1 flex-wrap gap-6">
            <div>
              <div className="text-xs text-muted-foreground">Ziel</div>
              <div className="text-xl font-bold">{recruit.target}</div>
            </div>
            <div>
              <label htmlFor="kpiRecruitActual" className="text-xs text-muted-foreground">
                Tatsächlich
              </label>
              <Input
                id="kpiRecruitActual"
                type="number"
                className="w-24"
                defaultValue={teamGoal.recruitActual ?? ""}
                placeholder="auto"
                disabled={!isEditor}
                onChange={(e) => {
                  commitField("recruitActual", e.target.value === "" ? null : Number(e.target.value))
                }}
              />
            </div>
          </div>
          <p className="w-full text-xs text-muted-foreground">
            Ziel wird unten im Bereich „Mitarbeiter-Aufbau" gesetzt. Tatsächlich überschreibt
            die automatische Zählung „NEU"-markierter Mitarbeiter — Feld leeren, um wieder
            automatisch zu zählen.
          </p>
        </CardContent>
      </Card>

      {/* Bar-Chart Soll vs. Ist */}
      <Card className="bg-neutral-900 text-neutral-100">
        <CardHeader>
          <CardTitle className="text-neutral-100">Einheiten — Soll vs. Ist pro Mitarbeiter</CardTitle>
          <p className="text-xs text-neutral-400">Aktueller Stand je Mitarbeiter</p>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <Bar
              data={{
                labels: bars.map((b) => b.shortName),
                datasets: [
                  { label: "Soll", data: bars.map((b) => b.soll), backgroundColor: "rgba(255,255,255,.12)", borderRadius: 4 },
                  { label: "Ist", data: bars.map((b) => b.ist), backgroundColor: "#64DDA3", borderRadius: 4 },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: DARK_LEGEND },
                scales: {
                  x: { grid: { display: false }, ticks: { ...DARK_TICK, maxRotation: 60, minRotation: 60 } },
                  y: { beginAtZero: true, ticks: DARK_TICK, grid: { color: DARK_GRID } },
                },
              }}
              aria-label={
                "Einheiten Soll vs. Ist pro Mitarbeiter: " +
                bars.map((b) => `${b.fullName} Ist ${fmt(b.ist)} von Soll ${fmt(b.soll)}`).join(", ")
              }
              role="img"
            />
          </div>
        </CardContent>
      </Card>

      {/* Mitarbeiter-Aufbau */}
      <Card>
        <CardContent className="flex flex-col gap-5">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Mitarbeiter-Aufbau
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <Input
                type="number"
                className="w-24 text-2xl font-bold"
                value={teamGoal.recruitGoal}
                disabled={!isEditor}
                onChange={(e) => commitField("recruitGoal", Number(e.target.value) || 0)}
              />
              <span className="text-sm text-muted-foreground">neue Mitarbeiter (Ziel)</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Zählt alle aktuell als „NEU" markierten Mitarbeiter im gewählten Zeitraum.
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between text-sm">
              <span>{recruit.count} von {recruit.target} neuen Mitarbeitern</span>
              <span className="font-semibold">{recruit.pct}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${Math.min(recruit.pct, 100)}%` }}
              />
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              {recruit.items.length === 0 ? (
                <div className="text-xs text-muted-foreground">Noch keine neuen Mitarbeiter markiert.</div>
              ) : (
                recruit.items.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <span>{item.name}</span>
                    <span className="text-muted-foreground">
                      {item.dateLabel}
                      {item.hasDate && !item.inPeriod ? " (außerhalb Zeitraum)" : ""}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
