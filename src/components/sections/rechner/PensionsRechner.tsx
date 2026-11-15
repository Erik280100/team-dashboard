// Pensionsrechner — Pensionslücke und nötige Investition (Einmalerlag bzw. Sparplan).
// Rechenlogik: src/lib/calc/pension.ts
import "@/lib/chartSetup"
import { useMemo, useState } from "react"
import { Bar } from "react-chartjs-2"
import type { Plugin } from "chart.js"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  ENTNAHME_BIS_ALTER, ERWERBSBEGINN_ALTER, KOSTEN_PA, PENSION_PROFILE, berechnePension,
  type RisikoProfil,
} from "@/lib/calc/pension"
import { rrFormatAxis, rrFormatEUR } from "@/lib/calc/rendite"

const COLOR_STAAT = "#155767"
const COLOR_LUECKE = "#A32A48"
const COLOR_WUNSCH = "#C9A200"

const INPUT_CLS =
  "h-8 w-28 rounded-md border border-input bg-background focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 transition-colors px-2 text-sm"

const fmtPct = (x: number) => (x * 100).toFixed(2).replace(".", ",").replace(/0$/, "").replace(/,$/, "") + " %"

// Zeichnet die Werte über die Balken (liest die Daten beim Zeichnen aus dem Chart).
const valueLabelPlugin: Plugin<"bar"> = {
  id: "pensionValueLabels",
  afterDatasetsDraw(chart) {
    const { ctx } = chart
    const meta = chart.getDatasetMeta(0)
    const data = chart.data.datasets[0].data as (number | [number, number])[]
    ctx.save()
    ctx.font = "bold 12px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "bottom"
    meta.data.forEach((bar, i) => {
      const v = data[i]
      const val = Array.isArray(v) ? v[1] - v[0] : v
      ctx.fillStyle = [COLOR_STAAT, COLOR_LUECKE, COLOR_WUNSCH][i]
      ctx.fillText(rrFormatEUR(val), bar.x, bar.y - 4)
    })
    ctx.restore()
  },
}

export function PensionsRechner() {
  const [alter, setAlter] = useState("30")
  const [pensionsalter, setPensionsalter] = useState("65")
  const [netto, setNetto] = useState("3000")
  const [wunsch, setWunsch] = useState("4000")
  const [inflation, setInflation] = useState("2")
  const [entnahmeBis, setEntnahmeBis] = useState(String(ENTNAHME_BIS_ALTER))
  const [profil, setProfil] = useState<RisikoProfil>("ausgewogen")

  const alterN = Math.round(Number(alter) || 0)
  const pensionsalterN = Math.round(Number(pensionsalter) || 0)
  const nettoN = Math.max(0, Number(netto) || 0)
  const wunschN = Math.max(0, Number(wunsch) || 0)
  const inflationN = Math.max(0, Number(inflation.replace(",", ".")) || 0) / 100

  const entnahmeBisN = Math.round(Number(entnahmeBis) || 0)

  const fehler =
    alterN < 16 || alterN > 80 ? "Bitte ein aktuelles Alter zwischen 16 und 80 angeben."
    : pensionsalterN <= alterN ? "Das Pensionsalter muss über dem aktuellen Alter liegen."
    : entnahmeBisN > 110 ? "Die Lebenserwartung darf höchstens 110 Jahre betragen."
    : pensionsalterN >= entnahmeBisN ? `Das Pensionsalter muss unter der Lebenserwartung (${entnahmeBisN}) liegen.`
    : nettoN <= 0 ? "Bitte ein Nettoeinkommen angeben."
    : null

  const r = useMemo(
    () => fehler ? null : berechnePension({
      alter: alterN, pensionsalter: pensionsalterN, nettoMonat: nettoN, wunschPension: wunschN,
      inflation: inflationN, profil, entnahmeBis: entnahmeBisN,
    }),
    [fehler, alterN, pensionsalterN, nettoN, wunschN, inflationN, profil, entnahmeBisN]
  )

  const chartData = r && {
    labels: ["Staatliche Pension", "Pensionslücke", "Gewünschte Pension"],
    datasets: [{
      data: [r.staatNetto, [r.staatNetto, Math.max(wunschN, r.staatNetto)] as [number, number], wunschN],
      backgroundColor: [COLOR_STAAT, COLOR_LUECKE, COLOR_WUNSCH],
      borderRadius: 8,
      borderSkipped: false as const,
      maxBarThickness: 120,
    }],
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <strong>Pensionsrechner:</strong> Schätzt deine staatliche Netto-Pension, die Pensionslücke zur Wunschpension
        und wie viel du heute einmalig oder monatlich per Sparplan investieren müsstest, um sie zu schließen.
        Alle Beträge sind in heutiger Kaufkraft angegeben, sofern nicht anders vermerkt.
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Eingaben</h3>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Aktuelles Alter
              <input type="number" min={16} max={80} step={1} value={alter}
                onChange={(e) => setAlter(e.target.value)} className={INPUT_CLS} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Gewünschtes Pensionsalter
              <input type="number" min={50} max={ENTNAHME_BIS_ALTER - 1} step={1} value={pensionsalter}
                onChange={(e) => setPensionsalter(e.target.value)} className={INPUT_CLS} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Aktuelles Nettoeinkommen (€/Monat)
              <input type="number" min={0} step={100} value={netto}
                onChange={(e) => setNetto(e.target.value)} className={INPUT_CLS} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Gewünschte Pension (€/Monat)
              <input type="number" min={0} step={100} value={wunsch}
                onChange={(e) => setWunsch(e.target.value)} className={INPUT_CLS} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Inflation (% p.a.)
              <input type="number" min={0} step={0.1} value={inflation}
                onChange={(e) => setInflation(e.target.value)} className={INPUT_CLS} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Lebenserwartung (Entnahme bis Alter)
              <input type="number" min={60} max={110} step={1} value={entnahmeBis}
                onChange={(e) => setEntnahmeBis(e.target.value)} className={INPUT_CLS} />
            </label>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="text-xs text-muted-foreground">Risikoprofil</div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(PENSION_PROFILE) as RisikoProfil[]).map((k) => (
                <button
                  key={k} type="button" onClick={() => setProfil(k)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                    profil === k
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {PENSION_PROFILE[k].label} · {fmtPct(PENSION_PROFILE[k].rendite)} p.a.
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {fehler && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{fehler}</div>
      )}

      {r && chartData && (
        <>
          <Card>
            <CardContent className="flex flex-col items-center gap-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Deine monatliche Pensionslücke
              </div>
              <div className="text-4xl font-bold tabular-nums" style={{ color: r.luecke > 0 ? COLOR_LUECKE : COLOR_STAAT }}>
                {rrFormatEUR(r.luecke)}
              </div>
              <div className="text-sm text-muted-foreground">gegenüber {rrFormatEUR(wunschN)} / Monat (Wunschpension)</div>
              <div className="mt-3 h-[300px] w-full">
                <Bar
                  data={chartData}
                  plugins={[valueLabelPlugin]}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: { top: 24 } },
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (ctx) => {
                            const v = ctx.raw as number | [number, number]
                            return rrFormatEUR(Array.isArray(v) ? v[1] - v[0] : v)
                          },
                        },
                      },
                    },
                    scales: {
                      x: { grid: { display: false } },
                      y: { beginAtZero: true, ticks: { callback: (val) => rrFormatAxis(Number(val)) } },
                    },
                  }}
                  aria-label="Staatliche Pension, Pensionslücke und gewünschte Pension"
                  role="img"
                />
              </div>
            </CardContent>
          </Card>

          <h3 className="text-sm font-semibold text-[#155767]">So schließt du deine Pensionslücke</h3>
          {r.luecke > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Card style={{ backgroundColor: "#08899f" }}>
                <CardContent>
                  <div className="text-xs font-semibold text-white/90">Einmalerlag heute</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-white">{rrFormatEUR(r.einmalerlag)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <div className="text-xs font-semibold text-muted-foreground">Sparplan monatlich bis Pensionsantritt</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums">{rrFormatEUR(r.sparplanStart)}</div>
                  <div className="text-[10.5px] text-muted-foreground">
                    steigt jährlich um {fmtPct(inflationN)} auf {rrFormatEUR(r.sparplanEnde)} im letzten Jahr
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="rounded-lg border bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Deine geschätzte staatliche Pension deckt die Wunschpension — es ist keine zusätzliche Vorsorge nötig.
            </div>
          )}

          <Card>
            <CardContent className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
              <Zeile label={`Geschätztes Brutto (14×)`} value={`${rrFormatEUR(r.bruttoMonat)} / Monat`} />
              <Zeile label="Staatliche Pension brutto" value={`${rrFormatEUR(r.staatBrutto)} / Monat`} />
              <Zeile label="Staatliche Pension netto" value={`${rrFormatEUR(r.staatNetto)} / Monat`} />
              <Zeile label={`Lücke bei Pensionsantritt (in ${r.jahre} J., nominal)`} value={`${rrFormatEUR(r.lueckeNominal)} / Monat`} />
              <Zeile label={`Kapitalbedarf mit ${pensionsalterN}`} value={rrFormatEUR(r.kapitalBedarf)} />
              <Zeile label="Rendite nach Kosten" value={`${(r.nettoRendite * 100).toFixed(2).replace(".", ",")} % p.a.`} />
            </CardContent>
          </Card>
        </>
      )}

      <p className="text-[10.5px] leading-relaxed text-muted-foreground">
        Die Pensionsberechnung beruht auf Annahmen und Schätzungen. Grundlage: Pensionskonto-Logik der PVA
        (1,78 % × Beitragsgrundlage × 14, Versicherungsbeginn mit {ERWERBSBEGINN_ALTER} Jahren), Steuertarif §33 EStG 2026,
        SV-Beitrag Angestellte 18,12 %, KV-Beitrag Pension 6 %, Höchstbeitragsgrundlage 6.930 €/Monat,
        Pensionistenabsetzbetrag 1.020 €. Allen Berechnungen liegen Kosten von {fmtPct(KOSTEN_PA)} p.a. auf das veranlagte Kapital
        (quartalsweise abgerechnet) zugrunde; die Entnahme läuft bis zum Alter {entnahmeBisN} (Standard: {ENTNAHME_BIS_ALTER}). Tatsächliche Werte können erheblich abweichen —
        entscheidend ist dein individueller Versicherungsverlauf. Diese Berechnung ersetzt keine Pensionsauskunft der PVA und
        stellt keine Anlage-, Steuer- oder Rechtsberatung dar. Die konkrete steuerliche Behandlung hängt von deinen persönlichen
        Verhältnissen ab und kann künftig Änderungen unterworfen sein. Wertpapierdienstleister &amp; Versicherungsvermittler sind
        nicht zur Steuerberatung befugt.
      </p>
    </div>
  )
}

function Zeile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  )
}
