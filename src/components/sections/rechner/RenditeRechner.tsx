// Renditerechner — Äquivalent zu initRenditeRechner() aus legacy/index.html:3744–3978.
import "@/lib/chartSetup"
import { useMemo, useRef, useState, type CSSProperties } from "react"
import { Line } from "react-chartjs-2"
import type { Plugin } from "chart.js"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  RR_PRODUCT_COLORS, rrFormatAxis, rrFormatEUR, rrMaxEntnahme,
  simulateFLVVerlauf, simulateFondsdepotVerlauf,
  type Provider, type RRProductKey, type RRVerlauf,
} from "@/lib/calc/rendite"
import { fondssparerKostenZeilen } from "@/lib/calc/fondssparer"
import { helvetiaEffektivverzinsung, helvetiaKostenZeilen } from "@/lib/calc/helvetiaFlv"
import { merkurKostenZeilen } from "@/lib/calc/merkurFlv"

const PERF_PRESETS = [3, 6, 9]

function ToggleGroup<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string; disabled?: boolean }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
            o.disabled
              ? "cursor-not-allowed border-border bg-card text-muted-foreground/40"
              : value === o.value
              ? "border-transparent bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function ProductDot({ colorKey }: { colorKey: RRProductKey }) {
  return <span className="size-2.5 shrink-0 rounded-full" style={{ background: RR_PRODUCT_COLORS[colorKey].line }} />
}

function productCardStyle(colorKey: RRProductKey): CSSProperties {
  return { borderTopColor: RR_PRODUCT_COLORS[colorKey].line, borderTopWidth: 3 }
}

function Stepper({
  value, onChange, step, id, disabled,
}: {
  value: string
  onChange: (v: string) => void
  step: number
  id: string
  disabled?: boolean
}) {
  const numValue = Number(value) || 0
  return (
    <div className="flex items-center gap-1">
      <button type="button" disabled={disabled} className="flex size-8 items-center justify-center rounded-md border text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        onClick={() => onChange(String(Math.max(0, numValue - step)))}>−</button>
      <input
        id={id} type="number" min={0} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-24 rounded-md border border-input bg-background focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 transition-colors px-2 text-center text-sm tabular-nums disabled:opacity-40 disabled:cursor-not-allowed"
      />
      <button type="button" disabled={disabled} className="flex size-8 items-center justify-center rounded-md border text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        onClick={() => onChange(String(numValue + step))}>+</button>
    </div>
  )
}

export function RenditeRechner() {
  const [monat, setMonat] = useState("200")
  const [jahre, setJahre] = useState("20")
  const [waEnabled, setWaEnabled] = useState(false)
  const [waPct, setWaPct] = useState("3")
  const [perfPreset, setPerfPreset] = useState<number | null>(6)
  const [customPerf, setCustomPerf] = useState("")
  const [provider, setProvider] = useState<Provider>("merkur")
  const [ausgabeaufschlag, setAusgabeaufschlag] = useState("5")
  const [depotgebuehr, setDepotgebuehr] = useState("1.45")
  const [ageRendite, setAgeRendite] = useState("2")
  const [entnahmeEnabled, setEntnahmeEnabled] = useState(false)
  const [entnahmeJahre, setEntnahmeJahre] = useState("20")
  const [entnahmeMonatEingabe, setEntnahmeMonatEingabe] = useState("1000")
  const [eintrittsalter, setEintrittsalter] = useState("35")

  const monatNum = Number(monat) || 0
  const ausgabeaufschlagNum = Number(ausgabeaufschlag) || 0
  const depotgebuehrNum = Number(depotgebuehr) || 0
  const ageRenditeNum = Number(ageRendite) || 0
  const eintrittsalterNum = Math.min(75, Math.max(0, Math.round(Number(eintrittsalter) || 0) || 35))

  const perf = (customPerf !== "" && !isNaN(parseFloat(customPerf)) ? parseFloat(customPerf) : perfPreset ?? 6) / 100
  // Helvetias PDF-Modell verlangt eine Laufzeit von 5-60 Jahren; Merkur bleibt bei 1-65.
  const jahreMin = provider === "helvetia" ? 5 : 1
  const jahreMax = provider === "helvetia" ? 60 : 65
  const jahreClamped = Math.min(jahreMax, Math.max(jahreMin, Math.round(Number(jahre) || 0) || 20))
  const waPctEff = waEnabled ? Math.max(0, Number(waPct) || 0) / 100 : 0
  // Helvetias PDF-Modell kennt nur eine einmalige Teilentnahme zu einem Stichtag, keine
  // laufende Monatsentnahme — die Entnahmephase ist deshalb nur bei Merkur verfügbar.
  const entnahmeErlaubt = provider !== "helvetia"
  const entnahmeJahreEff = entnahmeEnabled && entnahmeErlaubt
    ? Math.min(50, Math.max(1, Math.round(Number(entnahmeJahre) || 0) || 20))
    : 0
  const entnahmeMonatNum = entnahmeEnabled && entnahmeErlaubt ? Math.max(0, Number(entnahmeMonatEingabe) || 0) : 0

  function selectPerfPreset(p: number) {
    setPerfPreset(p)
    setCustomPerf("")
  }
  function onCustomPerf(v: string) {
    setCustomPerf(v)
    if (v !== "" && !isNaN(parseFloat(v))) setPerfPreset(null)
  }

  const jahreGesamt = jahreClamped + entnahmeJahreEff

  const {
    years, einbezahlt, flvY, fondssparerY, fondsdepotY, vvY,
    flvVerlauf, fondsdepotVerlauf, flvMaxEntnahme, depotMaxEntnahme, helvetiaEffZinsPct,
  } = useMemo(() => {
    const flvVerlauf: RRVerlauf = simulateFLVVerlauf(
      provider, monatNum, 0, jahreClamped, perf, waPctEff, entnahmeJahreEff, entnahmeMonatNum, eintrittsalterNum
    )
    const fondsdepotVerlauf: RRVerlauf = simulateFondsdepotVerlauf(
      monatNum, 0, jahreClamped, perf, ausgabeaufschlagNum, depotgebuehrNum, ageRenditeNum, 0, waPctEff,
      entnahmeJahreEff, entnahmeMonatNum
    )

    const helvetiaEffZinsPct = provider === "helvetia"
      ? helvetiaEffektivverzinsung(flvVerlauf.values[jahreClamped * 12], monatNum, jahreClamped, 12, waPctEff) * 100
      : null

    const years: number[] = []
    const einbezahlt: number[] = []
    const flvY: number[] = [], fondssparerY: number[] = [], fondsdepotY: number[] = [], vvY: number[] = []
    for (let y = 0; y <= jahreGesamt; y++) {
      years.push(y)
      einbezahlt.push(monatNum * 12 * Math.min(y, jahreClamped))
      const idx = y * 12
      flvY.push(flvVerlauf.values[idx])
      // Fondssparer & Vermögensverwaltung vorübergehend deaktiviert (ausgegraut, Werte auf 0)
      fondssparerY.push(0)
      fondsdepotY.push(fondsdepotVerlauf.values[idx])
      vvY.push(0)
    }

    // Größte Monatsentnahme, die exakt bis zum Ende der Entnahmezeit trägt (Obergrenze: das am
    // Ende der Ansparphase verfügbare Kapital).
    const ansparIdx = jahreClamped * 12
    const flvMaxEntnahme = entnahmeJahreEff > 0
      ? rrMaxEntnahme(
          (x) => simulateFLVVerlauf(provider, monatNum, 0, jahreClamped, perf, waPctEff, entnahmeJahreEff, x),
          flvVerlauf.values[ansparIdx]
        )
      : 0
    const depotMaxEntnahme = entnahmeJahreEff > 0
      ? rrMaxEntnahme(
          (x) => simulateFondsdepotVerlauf(
            monatNum, 0, jahreClamped, perf, ausgabeaufschlagNum, depotgebuehrNum, ageRenditeNum, 0, waPctEff,
            entnahmeJahreEff, x
          ),
          fondsdepotVerlauf.values[ansparIdx]
        )
      : 0

    return {
      years, einbezahlt, flvY, fondssparerY, fondsdepotY, vvY,
      flvVerlauf, fondsdepotVerlauf, flvMaxEntnahme, depotMaxEntnahme, helvetiaEffZinsPct,
    }
  }, [
    provider, monatNum, jahreClamped, perf, waPctEff, ausgabeaufschlagNum, depotgebuehrNum, ageRenditeNum,
    jahreGesamt, entnahmeJahreEff, entnahmeMonatNum, eintrittsalterNum,
  ])

  const finalEinbezahlt = einbezahlt[einbezahlt.length - 1]
  const entnahmeAktiv = entnahmeJahreEff > 0
  const products: {
    name: string; colorKey: RRProductKey; end: number; einbezahlt: number; disabled?: boolean
    entnommenNetto?: number; reichtBisMonat?: number | null; maxEntnahme?: number
    effektivverzinsungPct?: number | null
  }[] = [
    {
      name: "FLV", colorKey: "flv", end: flvY[flvY.length - 1], einbezahlt: finalEinbezahlt,
      entnommenNetto: entnahmeAktiv ? flvVerlauf.entnommenNetto : undefined,
      reichtBisMonat: entnahmeAktiv ? flvVerlauf.reichtBisMonat : undefined,
      maxEntnahme: entnahmeAktiv ? flvMaxEntnahme : undefined,
      effektivverzinsungPct: helvetiaEffZinsPct,
    },
    { name: "Fondssparer", colorKey: "fondssparer", end: 0, einbezahlt: 0, disabled: true },
    {
      name: "Depot", colorKey: "fondsdepot", end: fondsdepotY[fondsdepotY.length - 1], einbezahlt: finalEinbezahlt,
      entnommenNetto: entnahmeAktiv ? fondsdepotVerlauf.entnommenNetto : undefined,
      reichtBisMonat: entnahmeAktiv ? fondsdepotVerlauf.reichtBisMonat : undefined,
      maxEntnahme: entnahmeAktiv ? depotMaxEntnahme : undefined,
    },
    { name: "Vermögensverwaltung", colorKey: "vv", end: 0, einbezahlt: 0, disabled: true },
  ]

  // react-chartjs-2 liest die `plugins`-Prop nur beim allerersten Mount des Charts ein — ein
  // Plugin, das per Closure direkt auf entnahmeAktiv/jahreClamped zugreift, würde für immer die
  // Werte vom ersten Render sehen. Deshalb ein Ref, das bei jedem Render aktualisiert wird; das
  // (einmalig erzeugte) Plugin liest daraus erst beim tatsächlichen Zeichnen, also stets aktuell.
  const entnahmeMarkerRef = useRef({ entnahmeAktiv, jahreClamped })
  entnahmeMarkerRef.current = { entnahmeAktiv, jahreClamped }

  const [entnahmeMarkerPlugin] = useState<Plugin<"line">>(() => ({
    id: "entnahmeMarker",
    afterDatasetsDraw(chart) {
      const { entnahmeAktiv: aktiv, jahreClamped: startJahr } = entnahmeMarkerRef.current
      if (!aktiv) return
      const { ctx, chartArea, scales } = chart
      const x = scales.x.getPixelForTick(startJahr)
      ctx.save()
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = "#8FA1A6"
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x, chartArea.top)
      ctx.lineTo(x, chartArea.bottom)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = "#5B6B6E"
      ctx.font = "10px sans-serif"
      ctx.textAlign = "left"
      ctx.fillText("Entnahmestart", x + 4, chartArea.top + 12)
      ctx.restore()
    },
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
        <strong>Renditerechner:</strong> Vergleicht vier Anlageprodukte über die gewählte Laufzeit inklusive Kosten und KESt.
        {" "}Bei aktivierter Entnahmephase ist die Monatsentnahme netto in der Hand gemeint — beim Depot wird die KESt auf
        den Gewinnanteil dafür zusätzlich aus dem Depot entnommen (Brutto-Hochrechnung), die FLV ist KESt-frei. Das
        Restkapital bleibt in beiden Fällen zu den gleichen Konditionen weiterveranlagt.
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Eingaben</h3>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              <label htmlFor="rrMonat">Monatliche Einzahlung (€)</label>
              <Stepper id="rrMonat" value={monat} onChange={setMonat} step={25} />
            </div>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Laufzeit (Jahre)
              <input type="number" min={jahreMin} max={jahreMax} step={1} value={jahre}
                onChange={(e) => setJahre(e.target.value)}
                className="h-8 w-24 rounded-md border border-input bg-background focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 transition-colors px-2 text-sm" />
            </label>
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={waEnabled} onChange={(e) => setWaEnabled(e.target.checked)} className="size-4" />
                Wertanpassung p.a. (%)
              </label>
              <input type="number" min={0} step={0.5} value={waPct} disabled={!waEnabled}
                onChange={(e) => setWaPct(e.target.value)}
                className="h-8 w-24 rounded-md border border-input bg-background focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 transition-colors px-2 text-sm disabled:opacity-50" />
            </div>
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={entnahmeEnabled} disabled={!entnahmeErlaubt}
                  onChange={(e) => setEntnahmeEnabled(e.target.checked)} className="size-4 disabled:opacity-50" />
                Entnahmephase
              </label>
              {!entnahmeErlaubt && (
                <span className="text-[10.5px]">Bei Helvetia nicht verfügbar</span>
              )}
              <label className="flex flex-col gap-1" htmlFor="rrEntnahmeJahre">
                Entnahmedauer (Jahre)
                <input id="rrEntnahmeJahre" type="number" min={1} max={50} step={1} value={entnahmeJahre}
                  disabled={!entnahmeEnabled || !entnahmeErlaubt}
                  onChange={(e) => setEntnahmeJahre(e.target.value)}
                  className="h-8 w-24 rounded-md border border-input bg-background focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 transition-colors px-2 text-sm disabled:opacity-50" />
              </label>
            </div>
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              <label htmlFor="rrEntnahmeMonat">Monatliche Entnahme (€, netto)</label>
              <Stepper id="rrEntnahmeMonat" value={entnahmeMonatEingabe} onChange={setEntnahmeMonatEingabe} step={100}
                disabled={!entnahmeEnabled || !entnahmeErlaubt} />
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <ToggleGroup
              value={perfPreset === null ? ("" as never) : (String(perfPreset) as never)}
              options={PERF_PRESETS.map((p) => ({ value: String(p) as never, label: `${p} %` }))}
              onChange={(v) => selectPerfPreset(Number(v))}
            />
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Eigene Performance (% p.a.)
              <input type="number" step={0.1} placeholder="z. B. 5,5" value={customPerf}
                onChange={(e) => onCustomPerf(e.target.value)}
                className="h-8 w-32 rounded-md border border-input bg-background focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 transition-colors px-2 text-sm" />
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card style={productCardStyle("fondsdepot")}>
          <CardContent className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><ProductDot colorKey="fondsdepot" />Depot</h3>
            <div className="grid grid-cols-3 gap-3">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Ausgabeaufschlag (%)
                <input type="number" min={0} step={0.1} value={ausgabeaufschlag}
                  onChange={(e) => setAusgabeaufschlag(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 transition-colors px-2 text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Depotgebühr / TER (% p.a.)
                <input type="number" min={0} step={0.05} value={depotgebuehr}
                  onChange={(e) => setDepotgebuehr(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 transition-colors px-2 text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                agE-/Dividendenrendite (% p.a.)
                <input type="number" min={0} step={0.1} value={ageRendite}
                  onChange={(e) => setAgeRendite(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 transition-colors px-2 text-sm" />
              </label>
            </div>
            <div className="text-[10.5px] font-bold uppercase tracking-wide text-[#155767]">KESt-pflichtig (27,5 %) — agE-Rendite gilt auch für die VV</div>
          </CardContent>
        </Card>

        <Card style={productCardStyle("vv")} className="pointer-events-none opacity-40 grayscale">
          <CardContent className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><ProductDot colorKey="vv" />Vermögensverwaltung</h3>
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Setup-Kosten</span><span>—</span></div>
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Laufende Kosten</span><span>—</span></div>
            <div className="mt-1 text-[10.5px] font-bold uppercase tracking-wide text-[#155767]">Vorübergehend deaktiviert</div>
          </CardContent>
        </Card>

        <Card style={productCardStyle("fondssparer")} className="pointer-events-none opacity-40 grayscale">
          <CardContent className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><ProductDot colorKey="fondssparer" />Fondssparer</h3>
            <div className="flex flex-col gap-1">
              {fondssparerKostenZeilen(jahreClamped).map(([label]) => (
                <div key={label} className="flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span>—</span></div>
              ))}
            </div>
            <div className="mt-1 text-[10.5px] font-bold uppercase tracking-wide text-[#155767]">Vorübergehend deaktiviert</div>
          </CardContent>
        </Card>

        <Card style={productCardStyle("flv")}>
          <CardContent className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><ProductDot colorKey="flv" />FLV (Fondsgebundene Lebensversicherung)</h3>
            <ToggleGroup
              value={provider}
              options={[{ value: "merkur", label: "Merkur" }, { value: "helvetia", label: "Helvetia" }]}
              onChange={setProvider}
            />
            {provider === "helvetia" && (
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Eintrittsalter
                <input type="number" min={0} max={75} step={1} value={eintrittsalter}
                  onChange={(e) => setEintrittsalter(e.target.value)}
                  className="h-8 w-24 rounded-md border border-input bg-background focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 transition-colors px-2 text-sm" />
              </label>
            )}
            <div className="flex flex-col gap-1">
              {(provider === "merkur" ? merkurKostenZeilen(monatNum, jahreClamped) : helvetiaKostenZeilen()).map(([label, val]) => (
                <div key={label} className="flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span>{val}</span></div>
              ))}
            </div>
            <div className="text-[10.5px] font-bold uppercase tracking-wide text-[#155767]">KESt-frei</div>
            {provider === "merkur" && (
              <div className="text-[10.5px] text-muted-foreground">
                Sparprämie kalibriert auf echte Merkur-Angebote (Stand 08/2026, zwei Fonds, Annahme 6 % p.a.)
              </div>
            )}
            {provider === "helvetia" && (
              <div className="text-[10.5px] text-muted-foreground">
                1:1 nach der offiziellen Helvetia-FLV-Schnellberechnung. Laufzeit 5–60 Jahre, keine laufende
                Entnahmephase.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <h3 className="mb-3 text-sm font-semibold">Wertentwicklung im Vergleich</h3>
          <div className="h-[460px]">
            <Line
              data={{
                labels: years,
                datasets: [
                  { label: "FLV", data: flvY, borderColor: RR_PRODUCT_COLORS.flv.line, backgroundColor: RR_PRODUCT_COLORS.flv.fill, borderWidth: 2.5, pointRadius: 0, tension: 0.2 },
                  { label: "Fondssparer (deaktiviert)", data: fondssparerY, borderColor: "#B9C2C4", backgroundColor: "transparent", borderWidth: 1.5, pointRadius: 0, tension: 0.2 },
                  { label: "Depot", data: fondsdepotY, borderColor: RR_PRODUCT_COLORS.fondsdepot.line, backgroundColor: RR_PRODUCT_COLORS.fondsdepot.fill, borderWidth: 2.5, pointRadius: 0, tension: 0.2 },
                  { label: "Vermögensverwaltung (deaktiviert)", data: vvY, borderColor: "#B9C2C4", backgroundColor: "transparent", borderWidth: 1.5, pointRadius: 0, tension: 0.2 },
                  { label: "Einbezahlt*", data: einbezahlt, borderColor: "#8FA1A6", borderDash: [5, 4], borderWidth: 2, pointRadius: 0, tension: 0 },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                  legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } },
                  tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${rrFormatEUR(ctx.parsed.y as number)}` } },
                },
                scales: {
                  x: { grid: { display: false }, title: { display: true, text: "Jahre" } },
                  y: { beginAtZero: true, ticks: { callback: (val) => rrFormatAxis(Number(val)) } },
                },
              }}
              plugins={[entnahmeMarkerPlugin]}
              aria-label="Wertentwicklungs-Vergleich der vier Produkte"
              role="img"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((p) => {
          const diff = p.end - p.einbezahlt
          const positive = diff >= 0
          const color = RR_PRODUCT_COLORS[p.colorKey]
          if (p.disabled) {
            return (
              <Card key={p.name} style={productCardStyle(p.colorKey)} className="opacity-40 grayscale">
                <CardContent>
                  <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: color.line }}>
                    <ProductDot colorKey={p.colorKey} />{p.name}
                  </div>
                  <div className="mt-1 text-xl font-bold tabular-nums">{rrFormatEUR(0)}</div>
                  <div className="text-xs font-bold text-muted-foreground">Vorübergehend deaktiviert</div>
                </CardContent>
              </Card>
            )
          }
          const reichtNicht = p.reichtBisMonat != null
          return (
            <Card key={p.name} style={{ ...productCardStyle(p.colorKey), backgroundColor: color.tint }}>
              <CardContent>
                <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: color.line }}>
                  <ProductDot colorKey={p.colorKey} />{p.name}
                </div>
                <div className="mt-1 text-xl font-bold tabular-nums">{rrFormatEUR(p.end)}</div>
                {p.effektivverzinsungPct != null && (
                  <div className="text-[10.5px] text-muted-foreground">
                    Effektivverzinsung:{" "}
                    <span className="font-bold text-foreground">
                      {p.effektivverzinsungPct.toFixed(2).replace(".", ",")} % p. a.
                    </span>
                  </div>
                )}
                {entnahmeAktiv ? (
                  <>
                    <div className="text-[10.5px] text-muted-foreground">Restkapital nach Entnahme</div>
                    {reichtNicht ? (
                      <div className="text-xs font-bold text-destructive">
                        Kapital reicht bis Jahr {Math.ceil((p.reichtBisMonat as number) / 12)}
                      </div>
                    ) : (
                      <div className={cn("text-xs font-bold", positive ? "text-[#155767]" : "text-destructive")}>
                        {positive ? "+" : ""}{rrFormatEUR(diff)} ggü. Einbezahlt
                      </div>
                    )}
                    <div className="mt-1 text-xs text-muted-foreground">
                      Entnommen: {rrFormatEUR(p.entnommenNetto ?? 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Max. Entnahme: {rrFormatEUR(p.maxEntnahme ?? 0)}/Monat
                    </div>
                  </>
                ) : (
                  <div className={cn("text-xs font-bold", positive ? "text-[#155767]" : "text-destructive")}>
                    {positive ? "+" : ""}{rrFormatEUR(diff)} ggü. Einbezahlt
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardContent>
          <h3 className="mb-3 text-sm font-semibold">Jahrestabelle</h3>
          {entnahmeAktiv && (
            <div className="mb-2 text-[10.5px] text-muted-foreground">
              Ab Jahr {jahreClamped} (hinterlegte Zeilen): Entnahmephase, Restkapital wird zu gleichen Konditionen weiterveranlagt.
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-semibold text-muted-foreground">
                  <th className="px-2 py-1.5">Jahr</th>
                  <th className="px-2 py-1.5">Einbezahlt</th>
                  <th className="px-2 py-1.5" style={{ color: RR_PRODUCT_COLORS.flv.line }}>FLV</th>
                  <th className="px-2 py-1.5 text-muted-foreground/40">Fondssparer</th>
                  <th className="px-2 py-1.5" style={{ color: RR_PRODUCT_COLORS.fondsdepot.line }}>Depot</th>
                  <th className="px-2 py-1.5 text-muted-foreground/40">VV</th>
                </tr>
              </thead>
              <tbody>
                {years.map((y, i) => {
                  const inEntnahme = entnahmeAktiv && y > jahreClamped
                  const istEntnahmeStart = entnahmeAktiv && y === jahreClamped
                  return (
                    <tr
                      key={y}
                      className={cn(
                        "border-b last:border-0",
                        inEntnahme && "bg-muted/40",
                        istEntnahmeStart && "border-t-2 border-t-foreground/30"
                      )}
                    >
                      <td className="px-2 py-1.5">{y}</td>
                      <td className="px-2 py-1.5 tabular-nums">{rrFormatEUR(einbezahlt[i])}</td>
                      <td className="px-2 py-1.5 tabular-nums">{rrFormatEUR(flvY[i])}</td>
                      <td className="px-2 py-1.5 tabular-nums text-muted-foreground/40">{rrFormatEUR(fondssparerY[i])}</td>
                      <td className="px-2 py-1.5 tabular-nums">{rrFormatEUR(fondsdepotY[i])}</td>
                      <td className="px-2 py-1.5 tabular-nums text-muted-foreground/40">{rrFormatEUR(vvY[i])}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
