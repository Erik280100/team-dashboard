// MSCI-World-vs-Vermögensverwaltung-Rechner — stellt die Wertentwicklung eines
// MSCI-World-ETFs der hauseigenen Vermögensverwaltung (VV) gegenüber: mehr Schwankung
// und höherer Max. Drawdown beim ETF, dafür auch höhere Rendite; die VV verläuft
// ruhiger. Siehe src/lib/calc/msciVv.ts für die Datenbasis/Modellrechnung.
import "@/lib/chartSetup"
import { useMemo, useState } from "react"
import { Line } from "react-chartjs-2"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  MSCI_MONTHLY_RETURNS, MSCI_STATS, VV_DISTRIBUTION_MIX, VV_DISTRIBUTION_YIELD_PCT,
  VV_MONTHLY_RETURNS, VV_STATS,
  maxDrawdownPct, msciVvFormatEUR, msciVvFormatPct, paidInLine, simulateGrowth, simulateVvWithDistributions,
} from "@/lib/calc/msciVv"

const HORIZON_PRESETS = [5, 10, 15, 20]
const VV_DISTRIBUTION_YIELD_DEFAULT = Math.round(VV_DISTRIBUTION_YIELD_PCT * 100) / 100

export function MsciVvRechner() {
  const [horizont, setHorizont] = useState("15")
  const [kapital, setKapital] = useState("10000")
  const [monatlich, setMonatlich] = useState("200")
  const [dividendenBonusEnabled, setDividendenBonusEnabled] = useState(true)
  const [ausschuettungsrendite, setAusschuettungsrendite] = useState(String(VV_DISTRIBUTION_YIELD_DEFAULT))

  const horizontClamped = Math.min(40, Math.max(1, Math.round(Number(horizont) || 0) || 15))
  const kapitalClamped = Math.max(0, Number(kapital) || 0)
  const monatlichClamped = Math.max(0, Number(monatlich) || 0)
  const ausschuettungsrenditeClamped = dividendenBonusEnabled ? Math.max(0, Number(ausschuettungsrendite) || 0) : 0

  // Monatliche Auflösung fürs Chart (nicht nur Jahres-Stützpunkte!) — sonst verschwindet
  // der zwischenzeitliche Crash-Tiefpunkt beim MSCI World komplett in der linearen
  // Interpolation zwischen zwei Jahres-Endwerten, und genau der Max. Drawdown soll ja
  // sichtbar sein.
  const {
    monthLabels, msciMonthly, vvMonthly, eingezahltLine, msciEnd, vvEnd, msciDD, vvDD,
    eingezahltEnd, dividendenBonus,
  } = useMemo(() => {
    const msciMonthly = simulateGrowth(MSCI_MONTHLY_RETURNS, horizontClamped, kapitalClamped, monatlichClamped)
    const vvMonthly = simulateVvWithDistributions(
      VV_MONTHLY_RETURNS, horizontClamped, kapitalClamped, monatlichClamped, ausschuettungsrenditeClamped
    )
    // Referenzwert ohne Dividenden-/Kupon-Bonus — zeigt dessen konkreten €-Beitrag separat.
    const vvMonthlyOhneBonus = simulateVvWithDistributions(
      VV_MONTHLY_RETURNS, horizontClamped, kapitalClamped, monatlichClamped, 0
    )
    const monthLabels = msciMonthly.map((_, m) => m / 12)
    const eingezahltLine = paidInLine(horizontClamped, kapitalClamped, monatlichClamped)

    return {
      monthLabels, msciMonthly, vvMonthly, eingezahltLine,
      msciEnd: msciMonthly[msciMonthly.length - 1],
      vvEnd: vvMonthly[vvMonthly.length - 1],
      msciDD: maxDrawdownPct(msciMonthly),
      vvDD: maxDrawdownPct(vvMonthly),
      eingezahltEnd: eingezahltLine[eingezahltLine.length - 1],
      dividendenBonus: vvMonthly[vvMonthly.length - 1] - vvMonthlyOhneBonus[vvMonthlyOhneBonus.length - 1],
    }
  }, [horizontClamped, kapitalClamped, monatlichClamped, ausschuettungsrenditeClamped])

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
        <strong>MSCI World vs. Vermögensverwaltung:</strong> Vergleicht die Wertentwicklung eines
        MSCI-World-ETFs mit der hauseigenen Vermögensverwaltung über den gewählten
        Anlagehorizont — ohne Kosten/KESt, zur reinen Veranschaulichung von Schwankung
        (Volatilität) und Max. Drawdown. Datenbasis beider Kurven: 2021–2026. Die VV-Kurve
        basiert auf den realen Jahresrenditen 2021–2026, die für längere Horizonte
        wiederholt werden. Die MSCI-Kurve ist eine Modellrechnung, kalibriert auf die
        "5J"-Kennzahlen des iShares-Factsheets (Volatilität, Max. Verlust, Wertentwicklung
        p.a. — dieses Zeitfenster deckt ebenfalls ca. 2021–2026 ab) — keine echten
        historischen Monatswerte. Zusätzlich berücksichtigt: der Dividenden-/Kupon-Bonus der
        VV — der ETF behält Dividenden/Kupons der enthaltenen Aktien/Anleihen ein, die VV
        reinvestiert sie aktiv für den Kunden, das kommt on top oben drauf. Modellrechnung
        ohne Gewähr.
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Eingaben</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Einmalanlage (€)
              <input type="number" min={0} step={1000} value={kapital}
                onChange={(e) => setKapital(e.target.value)}
                className="h-8 w-40 rounded-md border border-input bg-background focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 transition-colors px-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Monatliche Einzahlung (€)
              <input type="number" min={0} step={25} value={monatlich}
                onChange={(e) => setMonatlich(e.target.value)}
                className="h-8 w-40 rounded-md border border-input bg-background focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 transition-colors px-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Anlagehorizont (Jahre)
              <div className="flex flex-wrap items-center gap-2">
                <input type="number" min={1} max={40} step={1} value={horizont}
                  onChange={(e) => setHorizont(e.target.value)}
                  className="h-8 w-24 rounded-md border border-input bg-background focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 transition-colors px-2 text-sm" />
                <div className="flex flex-wrap gap-1.5">
                  {HORIZON_PRESETS.map((p) => (
                    <button key={p} type="button" onClick={() => setHorizont(String(p))}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-bold transition-colors",
                        horizontClamped === p
                          ? "border-transparent bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}>
                      {p} J
                    </button>
                  ))}
                </div>
              </div>
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <label className="flex items-center gap-1.5 text-sm font-semibold">
            <input type="checkbox" checked={dividendenBonusEnabled}
              onChange={(e) => setDividendenBonusEnabled(e.target.checked)} className="size-4" />
            Dividenden-/Kupon-Bonus der VV berücksichtigen
          </label>
          <p className="text-xs text-muted-foreground">
            Der ETF behält Dividenden/Kupons der enthaltenen Aktien/Anleihen komplett ein —
            die VV reinvestiert ihre Ausschüttungen dagegen aktiv für den Kunden, einmal
            jährlich geschätzt, komplett obendrauf. Angenommener Portfolio-Mix:{" "}
            {VV_DISTRIBUTION_MIX.map((m) => `${m.label} ${m.weightPct.toLocaleString("de-AT")} % (${msciVvFormatPct(m.yieldPct)})`).join(", ")}.
          </p>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Ausschüttungsrendite VV (% p.a.)
            <input type="number" min={0} step={0.1} value={ausschuettungsrendite} disabled={!dividendenBonusEnabled}
              onChange={(e) => setAusschuettungsrendite(e.target.value)}
              className="h-8 w-32 rounded-md border border-input bg-background focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 transition-colors px-2 text-sm disabled:opacity-50" />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">Wertentwicklung im Vergleich</h3>
            <span className="text-xs text-muted-foreground">
              Eingezahlt nach {horizontClamped} Jahren: <strong className="tabular-nums text-foreground">{msciVvFormatEUR(eingezahltEnd)}</strong>
            </span>
          </div>
          <div className="h-[420px]">
            <Line
              data={{
                labels: monthLabels,
                datasets: [
                  { label: "MSCI World ETF", data: msciMonthly, borderColor: "#B5624A", backgroundColor: "rgba(181,98,74,.08)", borderWidth: 2, pointRadius: 0, tension: 0.15 },
                  { label: "Vermögensverwaltung", data: vvMonthly, borderColor: "#155767", backgroundColor: "rgba(21,87,103,.08)", borderWidth: 2, pointRadius: 0, tension: 0.15 },
                  { label: "Eingezahlt", data: eingezahltLine, borderColor: "#8FA1A6", borderDash: [5, 4], borderWidth: 2, pointRadius: 0, tension: 0 },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                  legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } },
                  tooltip: {
                    callbacks: {
                      title: (items) => `Jahr ${(monthLabels[items[0].dataIndex]).toFixed(2)}`,
                      label: (ctx) => `${ctx.dataset.label}: ${msciVvFormatEUR(ctx.parsed.y as number)}`,
                    },
                  },
                },
                scales: {
                  x: {
                    grid: { display: false },
                    title: { display: true, text: "Jahre" },
                    ticks: {
                      autoSkip: false,
                      maxRotation: 0,
                      callback: (_val, index) => (Number.isInteger(monthLabels[index]) ? monthLabels[index] : ""),
                    },
                  },
                  y: { ticks: { callback: (val) => msciVvFormatEUR(Number(val)) } },
                },
              }}
              aria-label="Wertentwicklungs-Vergleich MSCI World ETF vs. Vermögensverwaltung, monatliche Auflösung"
              role="img"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{MSCI_STATS.label}</h3>
            <div className="text-xl font-bold tabular-nums">{msciVvFormatEUR(msciEnd)}</div>
            <div className="text-xs font-bold text-[#B5624A]">
              {msciEnd - eingezahltEnd >= 0 ? "+" : ""}{msciVvFormatEUR(msciEnd - eingezahltEnd)} ggü. Eingezahlt · Basisrendite ca. {msciVvFormatPct(MSCI_STATS.cagr)} p.a.
            </div>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <span className="text-muted-foreground">Volatilität p.a. ({MSCI_STATS.sourceLabel})</span><span className="text-right tabular-nums">{msciVvFormatPct(MSCI_STATS.volatility)}</span>
              <span className="text-muted-foreground">Sharpe Ratio</span><span className="text-right tabular-nums">{MSCI_STATS.sharpe.toLocaleString("de-AT")}</span>
              <span className="text-muted-foreground">Max. Drawdown ({MSCI_STATS.sourceLabel})</span><span className="text-right font-bold tabular-nums text-destructive">{msciVvFormatPct(MSCI_STATS.maxDrawdown)}</span>
              <span className="text-muted-foreground">Max. Drawdown im Chart</span><span className="text-right tabular-nums text-destructive">{msciVvFormatPct(msciDD)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{VV_STATS.label}</h3>
            <div className="text-xl font-bold tabular-nums">{msciVvFormatEUR(vvEnd)}</div>
            <div className="text-xs font-bold text-[#155767]">
              {vvEnd - eingezahltEnd >= 0 ? "+" : ""}{msciVvFormatEUR(vvEnd - eingezahltEnd)} ggü. Eingezahlt · Basisrendite ca. {msciVvFormatPct(VV_STATS.cagr)} p.a.
            </div>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <span className="text-muted-foreground">Volatilität p.a. ({VV_STATS.sourceLabel})</span><span className="text-right tabular-nums">{msciVvFormatPct(VV_STATS.volatility)}</span>
              <span className="text-muted-foreground">Sharpe Ratio</span><span className="text-right tabular-nums">{VV_STATS.sharpe.toLocaleString("de-AT")}</span>
              <span className="text-muted-foreground">Max. Drawdown ({VV_STATS.sourceLabel})</span><span className="text-right font-bold tabular-nums text-destructive">{msciVvFormatPct(VV_STATS.maxDrawdown)}</span>
              <span className="text-muted-foreground">Max. Drawdown im Chart</span><span className="text-right tabular-nums text-destructive">{msciVvFormatPct(vvDD)}</span>
              {dividendenBonusEnabled && (
                <>
                  <span className="text-muted-foreground">Dividenden-/Kupon-Bonus (ggü. ETF)</span>
                  <span className="text-right font-bold tabular-nums text-[#155767]">+{msciVvFormatEUR(dividendenBonus)}</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
