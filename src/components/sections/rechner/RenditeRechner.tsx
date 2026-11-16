// Renditerechner — Äquivalent zu initRenditeRechner() aus der früheren Einzeldatei-App.
import { DARK_GRID, DARK_LEGEND, DARK_TICK } from "@/lib/chartSetup"
import { useMemo, useRef, useState, type CSSProperties } from "react"
import { Line } from "react-chartjs-2"
import type { Plugin } from "chart.js"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { LABEL_CLASS, FELD_GRID, Zelle, EinheitInput } from "@/components/sections/rechner/fields"
import {
  RR_FLATEX_ORDER_EUR, RR_FLATEX_TER_PA_PCT, RR_PRODUCT_COLORS, rrFormatAxis, rrFormatEUR, rrMaxEntnahme,
  simulateFLVVerlauf, simulateFondsdepotVerlauf,
  type Provider, type RRProductKey, type RRVerlauf,
} from "@/lib/calc/rendite"
import { simulateFondssparerVerlauf } from "@/lib/calc/fondssparer"
import { simulateFrootsVerlauf } from "@/lib/calc/froots"

const PERF_PRESETS = [3, 6, 9]

function ToggleGroup<T extends string>({
  options, value, onChange, fill,
}: {
  options: { value: T; label: string; disabled?: boolean }[]
  value: T
  onChange: (v: T) => void
  fill?: boolean
}) {
  return (
    <div className={cn("flex gap-1.5", fill ? "h-10" : "flex-wrap")}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
            fill && "flex-1",
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

export function RenditeRechner({ isAdmin = false }: { /** Fondssparer und Vermögensverwaltung sind nur für Admins sichtbar. */ isAdmin?: boolean }) {
  const [monat, setMonat] = useState("200")
  const [jahre, setJahre] = useState("20")
  const [waEnabled, setWaEnabled] = useState(false)
  const [waPct, setWaPct] = useState("3")
  const [perfPreset, setPerfPreset] = useState<number | null>(6)
  const [customPerf, setCustomPerf] = useState("")
  const [provider, setProvider] = useState<Provider>("merkur")
  const [ageRendite, setAgeRendite] = useState("0.5")
  const [entnahmeEnabled, setEntnahmeEnabled] = useState(false)
  const [entnahmeJahre, setEntnahmeJahre] = useState("20")
  const [entnahmeMonatEingabe, setEntnahmeMonatEingabe] = useState("1000")

  const monatNum = Number(monat) || 0
  const ageRenditeNum = Number(ageRendite) || 0

  const perf = (customPerf !== "" && !isNaN(parseFloat(customPerf)) ? parseFloat(customPerf) : perfPreset ?? 6) / 100
  const jahreMin = 1
  const jahreMax = 65
  const jahreClamped = Math.min(jahreMax, Math.max(jahreMin, Math.round(Number(jahre) || 0) || 20))
  const waPctEff = waEnabled ? Math.max(0, Number(waPct) || 0) / 100 : 0
  const entnahmeJahreEff = entnahmeEnabled
    ? Math.min(50, Math.max(1, Math.round(Number(entnahmeJahre) || 0) || 20))
    : 0
  const entnahmeMonatNum = entnahmeEnabled ? Math.max(0, Number(entnahmeMonatEingabe) || 0) : 0

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
    years, einbezahlt, flvY, fondssparerY, fondsdepotY, fondsdepotNachKestY, vvY, vvNachKestY,
    flvVerlauf, fondsdepotVerlauf, vvVerlauf, fondssparerVerlauf, flvMaxEntnahme, depotMaxEntnahme, vvMaxEntnahme, fondssparerMaxEntnahme,
  } = useMemo(() => {
    const flvVerlauf: RRVerlauf = simulateFLVVerlauf(
      provider, monatNum, 0, jahreClamped, perf, waPctEff, entnahmeJahreEff, entnahmeMonatNum
    )
    const fondsdepotVerlauf: RRVerlauf = simulateFondsdepotVerlauf(
      monatNum, 0, jahreClamped, perf, 0, RR_FLATEX_TER_PA_PCT, ageRenditeNum, 0, waPctEff,
      entnahmeJahreEff, entnahmeMonatNum, RR_FLATEX_ORDER_EUR
    )

    const fondssparerVerlauf: RRVerlauf = simulateFondssparerVerlauf(
      monatNum, jahreClamped, perf, waPctEff, entnahmeJahreEff, entnahmeMonatNum
    )
    const vvVerlauf: RRVerlauf = simulateFrootsVerlauf(
      monatNum, 0, jahreClamped, perf, ageRenditeNum, waPctEff, entnahmeJahreEff, entnahmeMonatNum
    )

    const years: number[] = []
    const einbezahlt: number[] = []
    const flvY: number[] = [], fondssparerY: number[] = [], fondsdepotY: number[] = [], vvY: number[] = []
    const fondsdepotNachKestY: number[] = [], vvNachKestY: number[] = []
    for (let y = 0; y <= jahreGesamt; y++) {
      years.push(y)
      einbezahlt.push(monatNum * 12 * Math.min(y, jahreClamped))
      const idx = y * 12
      flvY.push(flvVerlauf.values[idx])
      // Karte/Tabelle: Wert ohne KESt-Abzug auf den unversteuerten Gewinn; Grafik: laufend nach KESt
      fondsdepotY.push((fondsdepotVerlauf.valuesVorKest ?? fondsdepotVerlauf.values)[idx])
      fondsdepotNachKestY.push((fondsdepotVerlauf.valuesNachKest ?? fondsdepotVerlauf.values)[idx])
      vvY.push((vvVerlauf.valuesVorKest ?? vvVerlauf.values)[idx])
      vvNachKestY.push((vvVerlauf.valuesNachKest ?? vvVerlauf.values)[idx])
      fondssparerY.push(fondssparerVerlauf.values[idx])
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
            monatNum, 0, jahreClamped, perf, 0, RR_FLATEX_TER_PA_PCT, ageRenditeNum, 0, waPctEff,
            entnahmeJahreEff, x, RR_FLATEX_ORDER_EUR
          ),
          fondsdepotVerlauf.values[ansparIdx]
        )
      : 0
    const fondssparerMaxEntnahme = entnahmeJahreEff > 0
      ? rrMaxEntnahme(
          (x) => simulateFondssparerVerlauf(monatNum, jahreClamped, perf, waPctEff, entnahmeJahreEff, x),
          fondssparerVerlauf.values[ansparIdx]
        )
      : 0
    const vvMaxEntnahme = entnahmeJahreEff > 0
      ? rrMaxEntnahme(
          (x) => simulateFrootsVerlauf(monatNum, 0, jahreClamped, perf, ageRenditeNum, waPctEff, entnahmeJahreEff, x),
          vvVerlauf.values[ansparIdx]
        )
      : 0

    return {
      years, einbezahlt, flvY, fondssparerY, fondsdepotY, fondsdepotNachKestY, vvY, vvNachKestY,
      flvVerlauf, fondsdepotVerlauf, vvVerlauf, fondssparerVerlauf, flvMaxEntnahme, depotMaxEntnahme, vvMaxEntnahme, fondssparerMaxEntnahme,
    }
  }, [
    provider, monatNum, jahreClamped, perf, waPctEff,
    ageRenditeNum, jahreGesamt, entnahmeJahreEff, entnahmeMonatNum,
  ])

  const finalEinbezahlt = einbezahlt[einbezahlt.length - 1]
  const entnahmeAktiv = entnahmeJahreEff > 0
  const products: {
    name: string; colorKey: RRProductKey; end: number; endVorKest?: number; einbezahlt: number; disabled?: boolean; adminOnly?: boolean
    entnommenNetto?: number; reichtBisMonat?: number | null; maxEntnahme?: number
    effektivverzinsungPct?: number | null
  }[] = [
    {
      name: "FLV", colorKey: "flv", end: flvY[flvY.length - 1], einbezahlt: finalEinbezahlt,
      entnommenNetto: entnahmeAktiv ? flvVerlauf.entnommenNetto : undefined,
      reichtBisMonat: entnahmeAktiv ? flvVerlauf.reichtBisMonat : undefined,
      maxEntnahme: entnahmeAktiv ? flvMaxEntnahme : undefined,
    },
    {
      name: "Fondssparer", colorKey: "fondssparer", end: fondssparerY[fondssparerY.length - 1], einbezahlt: finalEinbezahlt, adminOnly: true,
      entnommenNetto: entnahmeAktiv ? fondssparerVerlauf.entnommenNetto : undefined,
      reichtBisMonat: entnahmeAktiv ? fondssparerVerlauf.reichtBisMonat : undefined,
      maxEntnahme: entnahmeAktiv ? fondssparerMaxEntnahme : undefined,
    },
    {
      name: "Depot", colorKey: "fondsdepot", end: fondsdepotNachKestY[fondsdepotNachKestY.length - 1], endVorKest: fondsdepotY[fondsdepotY.length - 1], einbezahlt: finalEinbezahlt,
      entnommenNetto: entnahmeAktiv ? fondsdepotVerlauf.entnommenNetto : undefined,
      reichtBisMonat: entnahmeAktiv ? fondsdepotVerlauf.reichtBisMonat : undefined,
      maxEntnahme: entnahmeAktiv ? depotMaxEntnahme : undefined,
    },
    {
      name: "Vermögensverwaltung", colorKey: "vv", end: vvNachKestY[vvNachKestY.length - 1], endVorKest: vvY[vvY.length - 1], einbezahlt: finalEinbezahlt, adminOnly: true,
      entnommenNetto: entnahmeAktiv ? vvVerlauf.entnommenNetto : undefined,
      reichtBisMonat: entnahmeAktiv ? vvVerlauf.reichtBisMonat : undefined,
      maxEntnahme: entnahmeAktiv ? vvMaxEntnahme : undefined,
    },
  ]
  const visibleProducts = products.filter((p) => isAdmin || !p.adminOnly)

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
      ctx.fillStyle = "#9FB3AF"
      ctx.font = "10px sans-serif"
      ctx.textAlign = "left"
      ctx.fillText("Entnahmestart", x + 4, chartArea.top + 12)
      ctx.restore()
    },
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className="calc-info px-4 py-3 text-sm">
        <strong>Renditerechner:</strong> Vergleicht vier Anlageprodukte über die gewählte Laufzeit inklusive Kosten und KESt.
        {" "}Bei aktivierter Entnahmephase ist die Monatsentnahme netto in der Hand gemeint — beim Depot wird die KESt auf
        den Gewinnanteil dafür zusätzlich aus dem Depot entnommen (Brutto-Hochrechnung), die FLV ist KESt-frei. Das
        Restkapital bleibt in beiden Fällen zu den gleichen Konditionen weiterveranlagt.
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Eingaben</h3>
          <div className={FELD_GRID}>
            <Zelle label="Monatliche Einzahlung">
              <EinheitInput id="rrMonat" value={monat} onChange={setMonat} step={25} min={0} einheit="€" />
            </Zelle>
            <Zelle label="Laufzeit">
              <EinheitInput value={jahre} onChange={setJahre} step={1} min={jahreMin} max={jahreMax} einheit="Jahre" />
            </Zelle>
            <Zelle label="Wertanpassung p.a." check={{ checked: waEnabled, onChange: setWaEnabled }}>
              <EinheitInput value={waPct} onChange={setWaPct} step={0.5} min={0} einheit="%" disabled={!waEnabled} />
            </Zelle>
            <Zelle label="Entnahmephase · Dauer" check={{ checked: entnahmeEnabled, onChange: setEntnahmeEnabled }}>
              <EinheitInput id="rrEntnahmeJahre" value={entnahmeJahre} onChange={setEntnahmeJahre} step={1} min={1} max={50} einheit="Jahre" disabled={!entnahmeEnabled} />
            </Zelle>
            <Zelle label="Monatliche Entnahme (netto)">
              <EinheitInput id="rrEntnahmeMonat" value={entnahmeMonatEingabe} onChange={setEntnahmeMonatEingabe} step={100} min={0} einheit="€" disabled={!entnahmeEnabled} />
            </Zelle>
            <Zelle label="Performance">
              <ToggleGroup
                fill
                value={perfPreset === null ? ("" as never) : (String(perfPreset) as never)}
                options={PERF_PRESETS.map((p) => ({ value: String(p) as never, label: `${p} %` }))}
                onChange={(v) => selectPerfPreset(Number(v))}
              />
            </Zelle>
            <Zelle label="Eigene Performance">
              <EinheitInput step={0.1} placeholder="z. B. 5,5" value={customPerf} onChange={onCustomPerf} einheit="% p.a." />
            </Zelle>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card style={productCardStyle("fondsdepot")}>
          <CardContent className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><ProductDot colorKey="fondsdepot" />Depot</h3>
            <label className={cn("flex flex-col gap-1.5", LABEL_CLASS)}>
              agE-/Dividendenrendite
              <EinheitInput min={0} step={0.1} value={ageRendite}
                onChange={(v) => setAgeRendite(v)}
                einheit="% p.a." />
            </label>
            <div className="text-[10.5px] font-bold uppercase tracking-wide text-[#64DDA3]">KESt-pflichtig (27,5 %)</div>
          </CardContent>
        </Card>

        {isAdmin && <Card style={productCardStyle("vv")}>
          <CardContent className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><ProductDot colorKey="vv" />Vermögensverwaltung</h3>
            <div className="text-[10.5px] text-muted-foreground">Nutzt die agE-/Dividendenrendite des Depots.</div>
            <div className="text-[10.5px] font-bold uppercase tracking-wide text-[#64DDA3]">KESt-pflichtig (27,5 %)</div>
          </CardContent>
        </Card>}

        {isAdmin && <Card style={productCardStyle("fondssparer")}>
          <CardContent className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><ProductDot colorKey="fondssparer" />Fondssparer</h3>
            <div className="text-[10.5px] font-bold uppercase tracking-wide text-[#64DDA3]">KESt-frei</div>
          </CardContent>
        </Card>}

        <Card style={productCardStyle("flv")}>
          <CardContent className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><ProductDot colorKey="flv" />FLV (Fondsgebundene Lebensversicherung)</h3>
            <ToggleGroup
              value={provider}
              options={[{ value: "merkur", label: "Merkur" }, { value: "helvetia", label: "Helvetia", disabled: true }]}
              onChange={setProvider}
            />
            <div className="text-[10.5px] font-bold uppercase tracking-wide text-[#64DDA3]">KESt-frei</div>
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
                  ...(isAdmin ? [{ label: "Fondssparer", data: fondssparerY, borderColor: RR_PRODUCT_COLORS.fondssparer.line, backgroundColor: RR_PRODUCT_COLORS.fondssparer.fill, borderWidth: 2.5, pointRadius: 0, tension: 0.2 }] : []),
                  { label: "Depot (nach KESt)", data: fondsdepotNachKestY, borderColor: RR_PRODUCT_COLORS.fondsdepot.line, backgroundColor: RR_PRODUCT_COLORS.fondsdepot.fill, borderWidth: 2.5, pointRadius: 0, tension: 0.2 },
                  ...(isAdmin ? [{ label: "Vermögensverwaltung (nach KESt)", data: vvNachKestY, borderColor: RR_PRODUCT_COLORS.vv.line, backgroundColor: RR_PRODUCT_COLORS.vv.fill, borderWidth: 2.5, pointRadius: 0, tension: 0.2 }] : []),
                  { label: "Einbezahlt*", data: einbezahlt, borderColor: "#8FA1A6", borderDash: [5, 4], borderWidth: 2, pointRadius: 0, tension: 0 },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                  legend: DARK_LEGEND,
                  tooltip: {
                    callbacks: {
                      label: (ctx) => `${ctx.dataset.label}: ${rrFormatEUR(ctx.parsed.y as number)}`,
                      afterBody: (items) => {
                        const i = items[0]?.dataIndex
                        return i == null ? [] : [
                          `Depot ohne KESt-Abzug: ${rrFormatEUR(fondsdepotY[i])}`,
                          ...(isAdmin ? [`Vermögensverwaltung ohne KESt-Abzug: ${rrFormatEUR(vvY[i])}`,
                          ] : []),
                        ]
                      },
                    },
                  },
                },
                scales: {
                  x: { grid: { display: false }, ticks: DARK_TICK, title: { display: true, text: "Jahre", color: "#9FB3AF" } },
                  y: { beginAtZero: true, grid: { color: DARK_GRID }, ticks: { ...DARK_TICK, callback: (val) => rrFormatAxis(Number(val)) } },
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
        {visibleProducts.map((p) => {
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
                {(p.colorKey === "fondsdepot" || p.colorKey === "vv") && (
                  <div className="text-[10.5px] text-muted-foreground">
                    ohne KESt-Abzug: <span className="font-bold text-foreground">{rrFormatEUR(p.endVorKest ?? p.end)}</span> (Endwert oben nach KESt)
                  </div>
                )}
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
                      <div className={cn("text-xs font-bold", positive ? "text-[#64DDA3]" : "text-destructive")}>
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
                  <div className={cn("text-xs font-bold", positive ? "text-[#64DDA3]" : "text-destructive")}>
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
                  {isAdmin && <th className="px-2 py-1.5" style={{ color: RR_PRODUCT_COLORS.fondssparer.line }}>Fondssparer</th>}
                  <th className="px-2 py-1.5" style={{ color: RR_PRODUCT_COLORS.fondsdepot.line }}>Depot (ohne KESt)</th>
                  <th className="px-2 py-1.5" style={{ color: RR_PRODUCT_COLORS.fondsdepot.line }}>Depot (nach KESt)</th>
                  {isAdmin && <><th className="px-2 py-1.5" style={{ color: RR_PRODUCT_COLORS.vv.line }}>VV (ohne KESt)</th>
                  <th className="px-2 py-1.5" style={{ color: RR_PRODUCT_COLORS.vv.line }}>VV (nach KESt)</th></>}
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
                      {isAdmin && <td className="px-2 py-1.5 tabular-nums">{rrFormatEUR(fondssparerY[i])}</td>}
                      <td className="px-2 py-1.5 tabular-nums">{rrFormatEUR(fondsdepotY[i])}</td>
                      <td className="px-2 py-1.5 tabular-nums">{rrFormatEUR(fondsdepotNachKestY[i])}</td>
                      {isAdmin && <><td className="px-2 py-1.5 tabular-nums">{rrFormatEUR(vvY[i])}</td>
                      <td className="px-2 py-1.5 tabular-nums">{rrFormatEUR(vvNachKestY[i])}</td></>}
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
