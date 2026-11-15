// Pensionsrechner — Pensionslücke und nötige Investition (Einmalerlag bzw. Sparplan).
// Rechenlogik: src/lib/calc/pension.ts
import { DARK_GRID, DARK_TICK } from "@/lib/chartSetup"
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Bar } from "react-chartjs-2"
import type { Plugin } from "chart.js"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  ENTNAHME_BIS_ALTER, ERWERBSBEGINN_ALTER, FLV_VERSICHERUNGSSTEUER, KOSTEN_PA, PENSION_PROFILE, berechnePension,
  type PensionInput, type RisikoProfil,
} from "@/lib/calc/pension"
import { RR_PRODUCT_COLORS, rrFormatEUR } from "@/lib/calc/rendite"

const COLOR_STAAT = "#4FC3D9"
const COLOR_LUECKE = "#E2685B"
const COLOR_WUNSCH = "#E7A94C"

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
  const ergebnisRef = useRef<HTMLDivElement>(null)
  // Ergebnis erst nach Klick auf „Berechnen“: Eingaben werden dabei als Schnappschuss übernommen.
  const [ein, setEin] = useState<PensionInput | null>(null)
  const [klicks, setKlicks] = useState(0)
  const [fehlerZeigen, setFehlerZeigen] = useState(false)
  const [entnahmeBis, setEntnahmeBis] = useState(String(ENTNAHME_BIS_ALTER))
  const [profil, setProfil] = useState<RisikoProfil>("ausgewogen")
  const [eigeneRendite, setEigeneRendite] = useState("")

  const alterN = Math.round(Number(alter) || 0)
  const pensionsalterN = Math.round(Number(pensionsalter) || 0)
  const nettoN = Math.max(0, Number(netto) || 0)
  const wunschN = Math.max(0, Number(wunsch) || 0)
  const inflationN = Math.max(0, Number(inflation.replace(",", ".")) || 0) / 100

  const entnahmeBisN = Math.round(Number(entnahmeBis) || 0)
  // Eigene Rendite (Textfeld) überschreibt das Risikoprofil, sobald etwas eingetragen ist.
  const eigeneRenditeAktiv = eigeneRendite.trim() !== ""
  const eigeneRenditeN = Number(eigeneRendite.replace(",", "."))

  const fehler =
    alterN < 16 || alterN > 80 ? "Bitte ein aktuelles Alter zwischen 16 und 80 angeben."
    : pensionsalterN <= alterN ? "Das Pensionsalter muss über dem aktuellen Alter liegen."
    : entnahmeBisN > 110 ? "Die Lebenserwartung darf höchstens 110 Jahre betragen."
    : pensionsalterN >= entnahmeBisN ? `Das Pensionsalter muss unter der Lebenserwartung (${entnahmeBisN}) liegen.`
    : nettoN <= 0 ? "Bitte ein Nettoeinkommen angeben."
    : eigeneRenditeAktiv && (!Number.isFinite(eigeneRenditeN) || eigeneRenditeN < 0 || eigeneRenditeN > 20)
      ? "Die eigene Rendite muss zwischen 0 und 20 % p.a. liegen."
    : null

  const aktuell: PensionInput = {
    alter: alterN, pensionsalter: pensionsalterN, nettoMonat: nettoN, wunschPension: wunschN,
    inflation: inflationN, profil, entnahmeBis: entnahmeBisN,
    rendite: eigeneRenditeAktiv ? eigeneRenditeN / 100 : undefined,
  }
  const r = useMemo(() => (ein ? berechnePension(ein) : null), [ein])
  const geaendert = ein !== null && JSON.stringify(ein) !== JSON.stringify(aktuell)

  function berechnen(e: FormEvent) {
    e.preventDefault()
    setFehlerZeigen(true)
    if (fehler) { setEin(null); return }
    setEin(aktuell)
    setKlicks((k) => k + 1)
  }

  // Nach dem Berechnen zum Ergebnis scrollen (Element existiert erst nach dem Rendern).
  useEffect(() => {
    if (klicks > 0) ergebnisRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [klicks])

  const chartData = r && ein && {
    labels: ["Staatliche Pension", "Pensionslücke", "Gewünschte Pension"],
    datasets: [{
      data: [r.staatNetto, [r.staatNetto, Math.max(ein.wunschPension, r.staatNetto)] as [number, number], ein.wunschPension],
      backgroundColor: [COLOR_STAAT, COLOR_LUECKE, COLOR_WUNSCH],
      borderRadius: 8,
      borderSkipped: false as const,
      maxBarThickness: 120,
    }],
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="calc-info px-4 py-3 text-sm">
        <strong>Pensionsrechner:</strong> Schätzt deine staatliche Netto-Pension, die Pensionslücke zur Wunschpension
        und wie viel du heute einmalig oder monatlich per Sparplan investieren müsstest, um sie zu schließen.
        Alle Beträge sind in heutiger Kaufkraft angegeben, sofern nicht anders vermerkt.
      </div>

      <Card>
        <CardContent>
         <form className="flex flex-col gap-4" onSubmit={berechnen}>
          <h3 className="text-sm font-semibold">Eingaben</h3>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
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
            <div className="flex flex-wrap items-center gap-1.5">
              {(Object.keys(PENSION_PROFILE) as RisikoProfil[]).map((k) => (
                <button
                  key={k} type="button" onClick={() => { setProfil(k); setEigeneRendite("") }}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                    profil === k && !eigeneRenditeAktiv
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {PENSION_PROFILE[k].label} · {fmtPct(PENSION_PROFILE[k].rendite)} p.a.
                </button>
              ))}
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                oder eigene Rendite (% p.a.)
                <input type="number" min={0} max={20} step={0.1} placeholder="z. B. 5,5" value={eigeneRendite}
                  onChange={(e) => setEigeneRendite(e.target.value)} className={INPUT_CLS} />
              </label>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Berechnen
            </button>
            <span className="text-[10.5px] text-muted-foreground">
              {geaendert
                ? "Eingaben geändert — auf „Berechnen“ klicken, um das Ergebnis zu aktualisieren."
                : ein ? "Ergebnis ist aktuell." : "Eingaben prüfen und auf „Berechnen“ klicken."}
            </span>
          </div>
         </form>
        </CardContent>
      </Card>

      {fehlerZeigen && fehler && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{fehler}</div>
      )}

      {r && ein && chartData && (
        <div ref={ergebnisRef} className="flex scroll-mt-4 flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col items-center gap-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Deine monatliche Pensionslücke
              </div>
              <div className="text-4xl font-bold tabular-nums" style={{ color: r.luecke > 0 ? COLOR_LUECKE : COLOR_STAAT }}>
                {rrFormatEUR(r.luecke)}
              </div>
              <div className="text-sm text-muted-foreground">gegenüber {rrFormatEUR(ein!.wunschPension)} / Monat (Wunschpension)</div>
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
                      x: { grid: { display: false }, ticks: { ...DARK_TICK, font: { size: 12 } } },
                      y: { beginAtZero: true, grid: { color: DARK_GRID }, ticks: { ...DARK_TICK, callback: (val) => rrFormatEUR(Number(val)) } },
                    },
                  }}
                  aria-label="Staatliche Pension, Pensionslücke und gewünschte Pension"
                  role="img"
                />
              </div>
            </CardContent>
          </Card>

          <details className="group rounded-lg border border-border bg-card px-4 py-3">
            <summary className="cursor-pointer select-none text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Verwendete Annahmen
            </summary>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                ["Jahre bis Pension", String(r.jahre)],
                ["Pensionslaufzeit", `${r.entnahmeJahre} Jahre (bis ${ein.entnahmeBis ?? ENTNAHME_BIS_ALTER})`],
                ["Geschätztes Bruttoeinkommen", `${rrFormatEUR(r.bruttoJahr)} / Jahr`],
                [`Nominale Rendite (${eigeneRenditeAktiv ? "eigene" : PENSION_PROFILE[ein.profil].label})`, fmtPct(ein.rendite ?? PENSION_PROFILE[ein.profil].rendite)],
                ["Inflation", fmtPct(ein.inflation)],
                ["Kosten Depot", `${fmtPct(KOSTEN_PA)} p.a.`],
                ["Rendite Depot in der Pension", `${fmtPct(r.entnahmeRendite)} p.a.`],
                ["Rendite FLV in der Pension", `${fmtPct(r.flv.entnahmeRendite)} p.a.`],
                ["Staatliche Pension nominal", `${rrFormatEUR(r.staatNettoNominal)} / Monat`],
                ["Gewünschte Pension nominal", `${rrFormatEUR(r.wunschNominal)} / Monat`],
                ["Lücke nominal", `${rrFormatEUR(r.lueckeNominal)} / Monat`],
                ["Vermögen bei Pensionsantritt (Depot)", `${rrFormatEUR(r.kapitalBedarf / Math.pow(1 + ein.inflation, r.jahre))} real · ${rrFormatEUR(r.kapitalBedarf)} nominell`],
                ["Vermögen bei Pensionsantritt (FLV)", `${rrFormatEUR(r.flv.kapitalBedarf / Math.pow(1 + ein.inflation, r.jahre))} real · ${rrFormatEUR(r.flv.kapitalBedarf)} nominell`],
                ["Versicherungssteuer (FLV)", fmtPct(FLV_VERSICHERUNGSSTEUER)],
                ["KESt", "0 %"],
              ].map(([k, v]) => (
                <span key={k} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
                  {k}: <strong className="text-foreground">{v}</strong>
                </span>
              ))}
            </div>
          </details>

          <h3 className="text-sm font-semibold text-[#0b1f2a]">So schließt du deine Pensionslücke</h3>
          {r.luecke > 0 ? (
            <div className="flex flex-col gap-3">
              {[
                { name: "Depot", color: "#B07CC6", tile: "linear-gradient(135deg,#0a7f93,#08899f)", einmal: r.einmalerlag, start: r.sparplanStart, ende: r.sparplanEnde, g: ein!.inflation },
                { name: "FLV (Merkur)", color: RR_PRODUCT_COLORS.flv.line, tile: "linear-gradient(135deg,#1f8f63,#2aa874)", einmal: r.flv.einmalerlag, start: r.flv.sparplanStart, ende: r.flv.sparplanEnde, g: ein!.inflation },
              ].map((p) => (
                <div key={p.name} className="grid gap-3 sm:grid-cols-2">
                  <Card style={{ background: p.tile }}>
                    <CardContent>
                      <div className="text-xs font-semibold text-white/90">Einmalerlag heute ({p.name})</div>
                      <div className="mt-1 text-2xl font-bold tabular-nums text-white">{rrFormatEUR(p.einmal)}</div>
                    </CardContent>
                  </Card>
                  <Card style={{ borderTopColor: p.color, borderTopWidth: 3 }}>
                    <CardContent>
                      <div className="text-xs font-semibold text-muted-foreground">Sparplan monatlich bis Pensionsantritt ({p.name})</div>
                      <div className="mt-1 text-2xl font-bold tabular-nums">{rrFormatEUR(p.start)}</div>
                      <div className="text-[10.5px] text-muted-foreground">
                        steigt jährlich um {fmtPct(p.g)} auf {rrFormatEUR(p.ende)} im letzten Jahr
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          ) : (
            <div className="calc-ok px-4 py-3 text-sm">
              Deine geschätzte staatliche Pension deckt die Wunschpension — es ist keine zusätzliche Vorsorge nötig.
            </div>
          )}
        </div>
      )}

      <p className="text-[10.5px] leading-relaxed text-muted-foreground">
        Die Pensionsberechnung beruht auf Annahmen und Schätzungen. Grundlage: Pensionskonto-Logik der PVA
        (1,78 % × Beitragsgrundlage × 14, Versicherungsbeginn mit {ERWERBSBEGINN_ALTER} Jahren), Steuertarif §33 EStG 2026,
        SV-Beitrag Angestellte 18,12 %, KV-Beitrag Pension 6 %, Höchstbeitragsgrundlage 6.930 €/Monat,
        Pensionistenabsetzbetrag 1.020 €. Dem Depot (froots) liegen Kosten von {fmtPct(KOSTEN_PA)} p.a. auf das veranlagte Kapital
        (quartalsweise abgerechnet) zugrunde. Ab Pensionsantritt bleibt das Kapital investiert und wird bis zum Alter {entnahmeBisN}
        (Standard: {ENTNAHME_BIS_ALTER}) inflationsindexiert verbraucht; beim Depot verzinst es sich mit Rendite abzüglich Kosten, bei der FLV wie in der
        Entnahmephase des Renditerechners. Tatsächliche Werte können erheblich abweichen —
        entscheidend ist dein individueller Versicherungsverlauf. Diese Berechnung ersetzt keine Pensionsauskunft der PVA und
        stellt keine Anlage-, Steuer- oder Rechtsberatung dar. Die konkrete steuerliche Behandlung hängt von deinen persönlichen
        Verhältnissen ab und kann künftig Änderungen unterworfen sein. Wertpapierdienstleister &amp; Versicherungsvermittler sind
        nicht zur Steuerberatung befugt.
      </p>
      <p className="text-[10.5px] leading-relaxed text-muted-foreground">
        FLV-Vergleich: Kostenstruktur und Formeln der Merkur-FLV aus dem Renditerechner (Sparprämie kalibriert auf echte
        Merkur-Angebote, Stand 08/2026, zwei Fonds, Annahme 6 % p.a.; Einmalerlag mit Abschluss-/Verwaltungskosten, Prämiendynamik
        so angesetzt, dass die Sparrate wirksam wie beim Depot um die Inflation steigt). Die FLV ist KESt-frei. Das Depot ist hier
        ohne KESt, Ausgabeaufschlag und Depotgebühr des Renditerechners gerechnet, sondern mit den oben genannten
        {" "}{fmtPct(KOSTEN_PA)} p.a. (Annahme des froots-Pensionsrechners; ohne die Servicegebühr der Vermittlung). Die Ergebnisse hängen stark von den Kostenannahmen ab und sind keine Produktempfehlung.
      </p>
    </div>
  )
}
