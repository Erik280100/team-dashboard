// Übersicht-Sektion — Äquivalent zu section-overview aus legacy/index.html:1623–1718.
// Datenlogik 1:1 aus src/lib/calc/overview.ts (golden-master-getestet gegen die
// Legacy-App). Farben 1:1 aus dem Original übernommen: die komplette Übersicht ist
// dort durchgängig dunkel (.kpi-card/.panel-dark nutzen dieselbe Navy-Verlaufsfarbe),
// nicht nur die Chart-Panels.
import "@/lib/chartSetup"
import { useEffect, useMemo, useState } from "react"
import { Line } from "react-chartjs-2"
import { Siegertreppchen } from "@/components/Siegertreppchen"
import { Users, Landmark, Building2, Shield, TrendingUp, Wallet, Sigma } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { DARK_CARD, DARK_GRID, DARK_INPUT, DARK_TICK } from "@/lib/chartSetup"
import { fmt as fmtDecimal, formatISODateDE, toISODate } from "@/lib/calc/format"
import { readPlanUnits } from "@/lib/calc/verguetung"
import { monthKeyOf, monthLabel } from "@/lib/calc/archive"
import type { ArchiveIndexEntry } from "@/types/archive"
import {
  goalProgress, leaderboardData,
  revenueShareData, summaryKpis, timelineData,
} from "@/lib/calc/overview"
import { aggregateByName, monthWeekKeys } from "@/lib/calc/planung"
import type { UsePlanungDocResult } from "@/hooks/usePlanungDoc"
import type { PlanWeekDoc } from "@/types/dashboard"
import type { EmployeeRow, HistoryEntry, TeamGoal } from "@/types/dashboard"
import { cn } from "@/lib/utils"

/** Auf dem Dashboard nur ganze Zahlen. */
function fmt(n: number | undefined | null): string {
  return fmtDecimal(Math.round(Number(n) || 0))
}

function fmtEur(n: number): string {
  return Number(n || 0).toLocaleString("de-AT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
}

function DarkCardHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <CardHeader>
      <CardTitle className="text-white">{title}</CardTitle>
      <p className="text-xs text-white/50">{sub}</p>
    </CardHeader>
  )
}

/** Statisch: ein neues Options-Objekt je Render würde Chart.js bei jeder Änderung der App neu zeichnen lassen. */
const LINE_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index" as const, intersect: false },
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { ...DARK_TICK, maxTicksLimit: 10 } },
    y: { beginAtZero: true, ticks: DARK_TICK, grid: { color: DARK_GRID } },
  },
}

export function Overview({
  rows,
  teamGoal,
  history,
  saveGoal,
  isEditor,
  canSeeLive = () => true,
  now,
  offenesFinanzierungsvolumen,
  offeneAnlegerwohnungen,
  planung,
  archiveIndex,
  teamSize,
  avatars,
}: {
  /** Profilbilder je Name (nur Personen mit Bild) — Köpfe der Figuren im Treppchen. */
  avatars?: Record<string, { id: string; version: number }>
  /** Mitarbeiterzahl laut Strukturbaum (live); im Archiv undefined → rows.length. */
  teamSize?: number
  rows: EmployeeRow[]
  teamGoal: TeamGoal
  history: HistoryEntry[]
  saveGoal: (next: TeamGoal) => void
  isEditor: boolean
  /** Darf der Betrachter die Planung dieser Person lesen? Sonst bleibt der gespeicherte/Monatssummen-Wert. */
  canSeeLive?: (name: string) => boolean
  /** Referenzzeitpunkt für den Zielverlauf — im Archiv-Modus ein Tag nach
   * periodEnd (siehe archiveNow() in lib/calc/archive.ts), damit die
   * Ist-Kurve den vollen abgeschlossenen Monat zeigt statt am heutigen Datum
   * abzuschneiden. Live per Default new Date(). */
  now?: Date
  /** Summe der Kreditsummen aller offenen (nicht archivierten) Finanzierungsfälle,
   * siehe totalBetrag in OffeneAbwicklungen.tsx. */
  offenesFinanzierungsvolumen: number
  /** Anzahl offener (nicht archivierter) Finanzierungsfälle mit Art "anlegerwohnung". */
  offeneAnlegerwohnungen: number
  /** Wochenplanung-Zugriff für die automatische Ist-AT-Übernahme ins
   * Leaderboard (analog Team.tsx) — undefined im Archiv-Modus, dort bleiben
   * die eingefrorenen Row-Werte (Stand Monatsabschluss) sichtbar. */
  planung?: UsePlanungDocResult
  /** Abgeschlossene Monate aus dem Archiv, Basis der Jahreswerte. */
  archiveIndex: ArchiveIndexEntry[]
}) {
  // Berechnungen nur bei geänderten Eingaben (statt bei jedem Render der ganzen App).
  const kpis = useMemo(() => summaryKpis(rows), [rows])
  const goal = useMemo(() => goalProgress(rows), [rows])
  // Der gespeicherte Verlauf wird nur bei Admin-Speicherungen fortgeschrieben und hinkt sonst dem Live-Ist hinterher
  // (Kurve blieb auf altem Stand stehen). Für den heutigen Tag zählt deshalb immer die aktuelle Summe aus den Zeilen.
  const timeline = useMemo(() => {
    const ref = now ?? new Date()
    const { periodStart, periodEnd } = teamGoal
    const today = toISODate(ref)
    const date = periodEnd && today > periodEnd ? periodEnd : periodStart && today < periodStart ? periodStart : today
    const live = { date, ist: goal.totalIst }
    const merged = [...history.filter((h) => h.date !== date), live].sort((a, b) => a.date.localeCompare(b.date))
    return timelineData(teamGoal, rows, merged, ref)
  }, [teamGoal, rows, history, now, goal.totalIst])
  const shares = useMemo(() => revenueShareData(rows), [rows])
  const sparten = useMemo(() => {
    const planTotals = rows.reduce(
      (acc, r) => {
        const u = readPlanUnits(r)
        acc.insurance += u.insurance
        acc.invest += u.investment + u.investmentVb
        acc.credit += u.credit
        return acc
      },
      { insurance: 0, invest: 0, credit: 0 }
    )
    const planSum = planTotals.insurance + planTotals.invest + planTotals.credit
    const list = [
      { label: "Insurance", icon: Shield, units: planTotals.insurance },
      { label: "Invest", icon: TrendingUp, units: planTotals.invest },
      { label: "Credit", icon: Wallet, units: planTotals.credit },
    ].map((s) => ({ ...s, pct: planSum > 0 ? Math.round((s.units / planSum) * 100) : 0 }))
    list.push({ label: "Gesamt", icon: Sigma, units: planSum, pct: planSum > 0 ? 100 : 0 })
    return list
  }, [rows])
  const yearly = useMemo(() => yearlyPlanData(rows, teamGoal, archiveIndex), [rows, teamGoal, archiveIndex])

  // Ist-AT fürs Leaderboard live aus der Wochenplanung übernehmen (Summe der
  // "analysen"-Gemacht-Werte über alle Wochen des aktuellen Umsatzmonats) —
  // dieselbe Quelle wie die "Ist"-Spalte auf der Mitarbeiterseite (Team.tsx),
  // statt des zuletzt gespeicherten, potenziell veralteten row.atIst.
  const planWeekKey = planung ? monthWeekKeys(monthKeyOf(teamGoal)).join(",") : ""
  useEffect(() => {
    if (!planung || !planWeekKey) return
    void planung.loadWeeks(planWeekKey.split(","))
  }, [planung, planWeekKey])
  const leaderboard = useMemo(() => {
    const planByName = planung
      ? aggregateByName(
          planWeekKey.split(",").filter(Boolean).map((w) => planung.getWeek(w)).filter((d): d is PlanWeekDoc => d !== null),
          rows.map((r) => r.name as string)
        )
      : null
    const rowsForLeaderboard = planByName
      ? rows.map((r) => (canSeeLive(r.name as string) ? { ...r, atIst: planByName.get(r.name as string)?.analysen ?? 0 } : r))
      : rows
    return leaderboardData(rowsForLeaderboard)
  }, [planung, planWeekKey, rows, canSeeLive])

  const lineData = useMemo(() => ({
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
  }), [timeline])
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
              <div className="mt-3 text-xs text-white/60">
                {monthLabel(monthKeyOf(teamGoal))} · {formatISODateDE(teamGoal.periodStart)} – {formatISODateDE(teamGoal.periodEnd)}
                <span className="opacity-75"> (wird am Monatsende automatisch abgeschlossen)</span>
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
                  data={lineData}
                  options={LINE_OPTIONS}
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className={DARK_CARD}>
          <CardContent className="flex items-center gap-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#64DDA3]/15">
              <Users className="size-4 text-[#64DDA3]" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-white/50">Geschäftspartner</div>
              <div className="text-2xl font-extrabold">{teamSize ?? kpis.employeeCount}</div>
              <div className="text-xs text-white/50">im Team</div>
            </div>
          </CardContent>
        </Card>
        <Card className={DARK_CARD}>
          <CardContent className="flex items-center gap-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#64DDA3]/15">
              <Landmark className="size-4 text-[#64DDA3]" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-white/50">Offenes Finanzierungsvolumen</div>
              <div className="text-2xl font-extrabold">{fmtEur(offenesFinanzierungsvolumen)}</div>
              <div className="text-xs text-white/50">Kreditsumme offener Fälle</div>
            </div>
          </CardContent>
        </Card>
        <Card className={DARK_CARD}>
          <CardContent className="flex items-center gap-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#64DDA3]/15">
              <Building2 className="size-4 text-[#64DDA3]" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-white/50">Anlegerwohnungen ausstehend</div>
              <div className="text-2xl font-extrabold">{offeneAnlegerwohnungen}</div>
              <div className="text-xs text-white/50">offene Finanzierungsfälle</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Umsatzanteil / Top 10 Geschäftspartner / Leaderboard */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className={DARK_CARD}>
          <DarkCardHeader title="Treppchen" sub="Die Top 3 nach Einheiten" />
          <CardContent>
            <Siegertreppchen entries={shares} avatars={avatars} formatValue={fmt} />
          </CardContent>
        </Card>

        <Card className={DARK_CARD}>
          <DarkCardHeader title="Top 10 Geschäftspartner" sub="Einheiten" />
          <CardContent className="flex flex-col gap-1.5">
            {shares.slice(0, 10).map((s, i) => (
              <div key={s.name} className="flex items-center gap-3 text-sm">
                <span
                  className={
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold " +
                    (i === 0 ? "bg-yellow-500 text-black" : i === 1 ? "bg-neutral-300 text-black" : i === 2 ? "bg-amber-700 text-white" : "bg-white/10 text-white/60")
                  }
                >
                  {i + 1}
                </span>
                <span className="flex-1 truncate text-white/80">{s.name}</span>
                <span className="font-semibold tabular-nums text-white">{fmt(s.value)} EH</span>
              </div>
            ))}
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


      {/* Umsatz nach Sparte */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sparten.map((s) => (
          <Card key={s.label} className={DARK_CARD}>
            <CardContent className="flex items-center gap-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#64DDA3]/15">
                <s.icon className="size-4 text-[#64DDA3]" aria-hidden="true" />
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-white/50">{s.label}</div>
                <div className="text-2xl font-extrabold">{fmt(s.units)}</div>
                <div className="text-xs text-white/50">{s.pct}% vom Umsatz (Einheiten)</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Jahreswerte je Sparte */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Insurance", icon: Shield, units: yearly.totals.insurance },
          { label: "Invest", icon: TrendingUp, units: yearly.totals.invest },
          { label: "Credit", icon: Wallet, units: yearly.totals.credit },
          { label: "Gesamt", icon: Sigma, units: yearly.total },
        ].map((s) => (
          <Card key={s.label} className={DARK_CARD}>
            <CardContent className="flex items-center gap-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#64DDA3]/15">
                <s.icon className="size-4 text-[#64DDA3]" aria-hidden="true" />
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-white/50">{s.label} {yearly.year}</div>
                <div className="text-2xl font-extrabold">{fmt(s.units)}</div>
                <div className="text-xs text-white/50">Einheiten im Jahr</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

const MONTH_LABELS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"]

interface PlanMonth { insurance: number; invest: number; credit: number }

/** Einheiten je Sparte und Monat des Jahres der aktuellen Periode: abgeschlossene
 * Monate aus dem Archiv, der laufende Monat live aus den Zeilen (falls noch nicht archiviert). */
function yearlyPlanData(rows: EmployeeRow[], teamGoal: TeamGoal, archiveIndex: ArchiveIndexEntry[]) {
  const currentKey = monthKeyOf(teamGoal)
  const year = currentKey.slice(0, 4)
  const months: PlanMonth[] = MONTH_LABELS.map(() => ({ insurance: 0, invest: 0, credit: 0 }))
  const put = (key: string, p: PlanMonth) => {
    if (key.slice(0, 4) !== year) return
    months[Number(key.slice(5, 7)) - 1] = p
  }
  archiveIndex.forEach((e) => {
    const u = e.totals.ehByPlan
    put(e.month, { insurance: u.insurance || 0, invest: (u.investment || 0) + (u.investmentVb || 0), credit: u.credit || 0 })
  })
  if (!archiveIndex.some((e) => e.month === currentKey)) {
    const p: PlanMonth = { insurance: 0, invest: 0, credit: 0 }
    rows.forEach((r) => {
      const u = readPlanUnits(r)
      p.insurance += u.insurance
      p.invest += u.investment + u.investmentVb
      p.credit += u.credit
    })
    put(currentKey, p)
  }
  const totals = months.reduce(
    (a, m) => ({ insurance: a.insurance + m.insurance, invest: a.invest + m.invest, credit: a.credit + m.credit }),
    { insurance: 0, invest: 0, credit: 0 }
  )
  return { year, months, totals, total: totals.insurance + totals.invest + totals.credit }
}
