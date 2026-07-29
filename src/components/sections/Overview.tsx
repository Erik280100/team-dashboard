// Übersicht-Sektion — Äquivalent zu section-overview aus legacy/index.html:1623–1718.
// Datenlogik 1:1 aus src/lib/calc/overview.ts (golden-master-getestet gegen die
// Legacy-App). Farben 1:1 aus dem Original übernommen: die komplette Übersicht ist
// dort durchgängig dunkel (.kpi-card/.panel-dark nutzen dieselbe Navy-Verlaufsfarbe),
// nicht nur die Chart-Panels.
import "@/lib/chartSetup"
import { useState, type ChangeEvent } from "react"
import { Bar, Doughnut, Line, Pie } from "react-chartjs-2"
import { Users, Star, UserPlus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { DARK_GRID, DARK_TICK } from "@/lib/chartSetup"
import { fmt } from "@/lib/calc/format"
import {
  barChartData, doughnutData, goalProgress, leaderboardData, recruitProgress,
  revenueShareData, summaryKpis, timelineData,
} from "@/lib/calc/overview"
import type { EmployeeRow, HistoryEntry, TeamGoal } from "@/types/dashboard"
import { cn } from "@/lib/utils"

const DARK_LEGEND = { labels: { color: "#DCEAE6", boxWidth: 12, font: { size: 11 } }, position: "top" as const }

// Original: linear-gradient(160deg, #16323F 0%, #0B1F2A 100%) — durchgängig für
// alle Kacheln der Übersicht (kpi-card, kpi-card-mini, panel-dark), nicht nur Charts.
const DARK_CARD = "border-white/10 bg-[linear-gradient(160deg,#16323F_0%,#0B1F2A_100%)] text-white"
const DARK_INPUT = "border-white/20 bg-white/10 text-white placeholder:text-white/40 [color-scheme:dark]"

function DarkCardHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <CardHeader>
      <CardTitle className="text-white">{title}</CardTitle>
      <p className="text-xs text-white/50">{sub}</p>
    </CardHeader>
  )
}

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
        <Card className={DARK_CARD}>
          <CardContent className="flex flex-col gap-5">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-white/50">
                Team-Ziel
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <div className="text-4xl font-bold tabular-nums">{fmt(goal.target)}</div>
                <span className="text-sm text-white/60">
                  Einheiten
                  <br />
                  <span className="text-xs opacity-75">Summe Soll (Mitarbeiter)</span>
                </span>
              </div>
              <Input
                className={cn("mt-3", DARK_INPUT)}
                placeholder="Kurzer Fokus/Motto für den Monat (optional)…"
                aria-label="Fokus/Motto für den Monat"
                value={noteDraft}
                disabled={!isEditor}
                onChange={(e) => setNoteDraft(e.target.value)}
                onBlur={() => { if (noteDraft !== teamGoal.note) commitField("note", noteDraft) }}
              />
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="periodStartInput" className="text-[10px] font-bold uppercase tracking-wide text-white/50">
                    Umsatzmonat Start
                  </label>
                  <Input
                    id="periodStartInput"
                    type="date"
                    className={DARK_INPUT}
                    value={teamGoal.periodStart}
                    disabled={!isEditor}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      if (e.target.value) commitField("periodStart", e.target.value)
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="periodEndInput" className="text-[10px] font-bold uppercase tracking-wide text-white/50">
                    Umsatzmonat Ende
                  </label>
                  <Input
                    id="periodEndInput"
                    type="date"
                    className={DARK_INPUT}
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
                <span className="text-base font-extrabold text-[#64DDA3]">{goal.pct}%</span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#3FCB8E,#64DDA3)] transition-[width]"
                  style={{ width: `${Math.min(goal.pct, 100)}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-[#A9C7BF]">{goal.remainingText}</div>
            </div>
          </CardContent>
        </Card>

        <Card className={DARK_CARD}>
          <DarkCardHeader title="Zielverlauf & Prognose" sub="Wann erreichen wir das Team-Ziel bei aktuellem Tempo?" />
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
              <div className="py-8 text-center text-sm text-white/50">{timeline.forecastText}</div>
            )}
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-white/50">
              <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#64DDA3]" />Ist-Verlauf</span>
              <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#5B7C8A]" />Ziel-Pfad (linear)</span>
              <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#E7A94C]" />Prognose</span>
            </div>
            {timeline.valid && (
              <div
                className="mt-3 text-sm text-white/80"
                dangerouslySetInnerHTML={{ __html: timeline.forecastText }}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className={DARK_CARD}>
          <CardContent className="flex items-center gap-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#64DDA3]/15">
              <Users className="size-4 text-[#64DDA3]" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-white/50">Mitarbeiter</div>
              <div className="text-2xl font-extrabold">{kpis.employeeCount}</div>
              <div className="text-xs text-white/50">im Team</div>
            </div>
          </CardContent>
        </Card>
        <Card className={DARK_CARD}>
          <CardContent className="flex items-center gap-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#64DDA3]/15">
              <Star className="size-4 text-[#64DDA3]" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-white/50">≥ 70% erreicht</div>
              <div className="text-2xl font-extrabold">{kpis.onTrackCount}</div>
              <div className="text-xs text-white/50">von {rows.length} MA</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team-Fortschritt / Umsatzanteil / Leaderboard */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className={DARK_CARD}>
          <DarkCardHeader title="Team-Fortschritt" sub="Ist / Team-Ziel, Einheiten" />
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
                <div className="text-xl font-bold text-white">
                  {doughnut.hasData ? `${doughnut.pct}%` : "—"}
                </div>
                <div className="text-[10px] text-white/50">
                  {doughnut.hasData ? `${fmt(doughnut.totalIst)} / ${fmt(doughnut.target)}` : "Kein Ziel gesetzt"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={DARK_CARD}>
          <DarkCardHeader title="Umsatzanteil" sub="Anteil je Mitarbeiter am Gesamtumsatz" />
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
                <div key={s.name} className="flex items-center gap-2 text-xs text-white/70">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="font-medium">{s.pct}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className={DARK_CARD}>
          <DarkCardHeader title="Leaderboard" sub="Ranking nach Ist AT" />
          <CardContent className="flex flex-col gap-1.5">
            {leaderboard.map((r, i) => (
              <div key={r.name} className="flex items-center gap-3 text-sm">
                <span
                  className={
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold " +
                    (i === 0 ? "bg-yellow-500 text-black" : i === 1 ? "bg-neutral-300 text-black" : i === 2 ? "bg-amber-700 text-white" : "bg-white/10 text-white/60")
                  }
                >
                  {i + 1}
                </span>
                <span className="flex-1 truncate text-white/80">{r.name}</span>
                <span className="font-semibold tabular-nums text-white">{fmt(r.atIst)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recruiting-KPI */}
      <Card className={cn(DARK_CARD, "border-[#64DDA3]/30")}>
        <CardContent className="flex flex-wrap items-start gap-6">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#64DDA3]/15">
            <UserPlus className="size-4 text-[#64DDA3]" aria-hidden="true" />
          </div>
          <div className="flex flex-1 flex-wrap gap-6">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-white/50">Ziel</div>
              <div className="text-xl font-extrabold">{recruit.target}</div>
            </div>
            <div>
              <label htmlFor="kpiRecruitActual" className="text-[11px] font-bold uppercase tracking-wide text-white/50">
                Tatsächlich
              </label>
              <Input
                id="kpiRecruitActual"
                type="number"
                className={cn("w-24", DARK_INPUT)}
                defaultValue={teamGoal.recruitActual ?? ""}
                placeholder="auto"
                disabled={!isEditor}
                onChange={(e) => {
                  commitField("recruitActual", e.target.value === "" ? null : Number(e.target.value))
                }}
              />
            </div>
          </div>
          <p className="w-full text-xs text-white/50">
            Ziel wird unten im Bereich „Mitarbeiter-Aufbau" gesetzt. Tatsächlich überschreibt
            die automatische Zählung „NEU"-markierter Mitarbeiter — Feld leeren, um wieder
            automatisch zu zählen.
          </p>
        </CardContent>
      </Card>

      {/* Bar-Chart Soll vs. Ist */}
      <Card className={DARK_CARD}>
        <DarkCardHeader title="Einheiten — Soll vs. Ist pro Mitarbeiter" sub="Aktueller Stand je Mitarbeiter" />
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
      <Card className={DARK_CARD}>
        <CardContent className="flex flex-col gap-5">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-white/50">
              Mitarbeiter-Aufbau
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <Input
                type="number"
                className={cn("w-24 text-2xl font-bold", DARK_INPUT)}
                value={teamGoal.recruitGoal}
                disabled={!isEditor}
                onChange={(e) => commitField("recruitGoal", Number(e.target.value) || 0)}
              />
              <span className="text-sm text-white/60">neue Mitarbeiter (Ziel)</span>
            </div>
            <p className="mt-2 text-xs text-white/50">
              Zählt alle aktuell als „NEU" markierten Mitarbeiter im gewählten Zeitraum.
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between text-sm">
              <span>{recruit.count} von {recruit.target} neuen Mitarbeitern</span>
              <span className="text-base font-extrabold text-[#64DDA3]">{recruit.pct}%</span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#3FCB8E,#64DDA3)] transition-[width]"
                style={{ width: `${Math.min(recruit.pct, 100)}%` }}
              />
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              {recruit.items.length === 0 ? (
                <div className="text-xs text-white/50">Noch keine neuen Mitarbeiter markiert.</div>
              ) : (
                recruit.items.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <span>{item.name}</span>
                    <span className="text-white/50">
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
