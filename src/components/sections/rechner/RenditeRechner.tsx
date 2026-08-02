// Renditerechner — Äquivalent zu initRenditeRechner() aus legacy/index.html:3744–3978.
import "@/lib/chartSetup"
import { useMemo, useState } from "react"
import { Line } from "react-chartjs-2"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  RR_DEPOT_PRESETS, RR_FLV_COSTS, rrFormatAxis, rrFormatEUR,
  simulateFLV, simulateFondsdepot, simulateFondssparer, simulateVV,
  type DepotProvider, type Provider,
} from "@/lib/calc/rendite"

const PERF_PRESETS = [3, 6, 9]

function ToggleGroup<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
            value === o.value
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

function Stepper({
  value, onChange, step, id,
}: {
  value: string
  onChange: (v: string) => void
  step: number
  id: string
}) {
  const numValue = Number(value) || 0
  return (
    <div className="flex items-center gap-1">
      <button type="button" className="flex size-8 items-center justify-center rounded-md border text-sm hover:bg-muted"
        onClick={() => onChange(String(Math.max(0, numValue - step)))}>−</button>
      <input
        id={id} type="number" min={0} step={step} value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-24 rounded-md border border-input bg-[#EFFBF5] focus:outline-none focus:border-[#3FCB8E] px-2 text-center text-sm tabular-nums"
      />
      <button type="button" className="flex size-8 items-center justify-center rounded-md border text-sm hover:bg-muted"
        onClick={() => onChange(String(numValue + step))}>+</button>
    </div>
  )
}

export function RenditeRechner() {
  const [monat, setMonat] = useState("200")
  const [einmal, setEinmal] = useState("0")
  const [jahre, setJahre] = useState("20")
  const [waEnabled, setWaEnabled] = useState(false)
  const [waPct, setWaPct] = useState("3")
  const [perfPreset, setPerfPreset] = useState<number | null>(6)
  const [customPerf, setCustomPerf] = useState("")
  const [provider, setProvider] = useState<Provider>("merkur")
  const [depotProvider, setDepotProvider] = useState<DepotProvider | "sonstiges">("flatex")
  const [ausgabeaufschlag, setAusgabeaufschlag] = useState("5")
  const [depotgebuehr, setDepotgebuehr] = useState("1.45")
  const [ageRendite, setAgeRendite] = useState("2")

  const monatNum = Number(monat) || 0
  const einmalNum = Number(einmal) || 0
  const ausgabeaufschlagNum = Number(ausgabeaufschlag) || 0
  const depotgebuehrNum = Number(depotgebuehr) || 0
  const ageRenditeNum = Number(ageRendite) || 0

  const perf = (customPerf !== "" && !isNaN(parseFloat(customPerf)) ? parseFloat(customPerf) : perfPreset ?? 6) / 100
  const jahreClamped = Math.min(65, Math.max(1, Math.round(Number(jahre) || 0) || 20))
  const waPctEff = waEnabled ? Math.max(0, Number(waPct) || 0) / 100 : 0
  const depotFixFee = depotProvider !== "sonstiges" ? RR_DEPOT_PRESETS[depotProvider].flatFee : 0

  function selectDepotProvider(p: DepotProvider | "sonstiges") {
    setDepotProvider(p)
    if (p !== "sonstiges") setDepotgebuehr(String(RR_DEPOT_PRESETS[p].depotgebuehr))
  }
  function selectPerfPreset(p: number) {
    setPerfPreset(p)
    setCustomPerf("")
  }
  function onCustomPerf(v: string) {
    setCustomPerf(v)
    if (v !== "" && !isNaN(parseFloat(v))) setPerfPreset(null)
  }

  const { years, einbezahlt, flvY, fondssparerY, fondsdepotY, vvY } = useMemo(() => {
    const flvMonthly = simulateFLV(provider, monatNum, einmalNum, jahreClamped, perf, waPctEff)
    const fondssparerMonthly = simulateFondssparer(monatNum, jahreClamped, perf, waPctEff)
    const fondsdepotMonthly = simulateFondsdepot(monatNum, einmalNum, jahreClamped, perf, ausgabeaufschlagNum, depotgebuehrNum, ageRenditeNum, depotFixFee)
    const vvMonthly = simulateVV(monatNum, einmalNum, jahreClamped, perf, ageRenditeNum)

    const years: number[] = []
    const einbezahlt: number[] = []
    const flvY: number[] = [], fondssparerY: number[] = [], fondsdepotY: number[] = [], vvY: number[] = []
    for (let y = 0; y <= jahreClamped; y++) {
      years.push(y)
      einbezahlt.push(monatNum * 12 * y + einmalNum)
      const idx = y * 12
      flvY.push(flvMonthly[idx])
      fondssparerY.push(fondssparerMonthly[idx])
      fondsdepotY.push(fondsdepotMonthly[idx])
      vvY.push(vvMonthly[idx])
    }
    return { years, einbezahlt, flvY, fondssparerY, fondsdepotY, vvY }
  }, [provider, monatNum, einmalNum, jahreClamped, perf, waPctEff, ausgabeaufschlagNum, depotgebuehrNum, ageRenditeNum, depotFixFee])

  const finalEinbezahlt = einbezahlt[einbezahlt.length - 1]
  const finalEinbezahltFondssparer = monatNum * 12 * jahreClamped
  const products = [
    { name: "FLV", end: flvY[flvY.length - 1], einbezahlt: finalEinbezahlt },
    { name: "Fondssparer", end: fondssparerY[fondssparerY.length - 1], einbezahlt: finalEinbezahltFondssparer },
    { name: "Depot", end: fondsdepotY[fondsdepotY.length - 1], einbezahlt: finalEinbezahlt },
    { name: "Vermögensverwaltung", end: vvY[vvY.length - 1], einbezahlt: finalEinbezahlt },
  ]

  const depotHint = depotProvider !== "sonstiges"
    ? (einmalNum > 0
        ? `Sparplan gebührenfrei — zzgl. ${RR_DEPOT_PRESETS[depotProvider].feeLabel} einmalige Ordergebühr auf den Einmalerlag`
        : `Sparplan gebührenfrei — bei Einmalerlag fällt eine fixe Ordergebühr von ${RR_DEPOT_PRESETS[depotProvider].feeLabel} an`)
    : ""

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
        <strong>Renditerechner:</strong> Vergleicht vier österreichische Anlageprodukte (FLV,
        Fondssparer, Depot, Vermögensverwaltung) über die gewählte Laufzeit inklusive Kosten und
        KESt. Modellrechnung ohne Gewähr — Eingaben werden nicht gespeichert.
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Eingaben</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Monatliche Einzahlung (€)
              <Stepper id="rrMonat" value={monat} onChange={setMonat} step={25} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Einmalerlag (€)
              <Stepper id="rrEinmal" value={einmal} onChange={setEinmal} step={1000} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Laufzeit (Jahre)
              <input type="number" min={1} max={65} step={1} value={jahre}
                onChange={(e) => setJahre(e.target.value)}
                className="h-8 w-24 rounded-md border border-input bg-[#EFFBF5] focus:outline-none focus:border-[#3FCB8E] px-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <input type="checkbox" checked={waEnabled} onChange={(e) => setWaEnabled(e.target.checked)} className="size-4" />
                Wertanpassung p.a. (%)
              </span>
              <input type="number" min={0} step={0.5} value={waPct} disabled={!waEnabled}
                onChange={(e) => setWaPct(e.target.value)}
                className="h-8 w-24 rounded-md border border-input bg-[#EFFBF5] focus:outline-none focus:border-[#3FCB8E] px-2 text-sm disabled:opacity-50" />
            </label>
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
                className="h-8 w-32 rounded-md border border-input bg-[#EFFBF5] focus:outline-none focus:border-[#3FCB8E] px-2 text-sm" />
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Depot</h3>
            <ToggleGroup
              value={depotProvider}
              options={[{ value: "flatex", label: "flatex" }, { value: "traderepublic", label: "Trade Republic" }, { value: "sonstiges", label: "Sonstiges" }]}
              onChange={selectDepotProvider}
            />
            <div className="grid grid-cols-3 gap-3">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Ausgabeaufschlag (%)
                <input type="number" min={0} step={0.1} value={ausgabeaufschlag}
                  onChange={(e) => setAusgabeaufschlag(e.target.value)}
                  className="h-8 rounded-md border border-input bg-[#EFFBF5] focus:outline-none focus:border-[#3FCB8E] px-2 text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Depotgebühr / TER (% p.a.)
                <input type="number" min={0} step={0.05} value={depotgebuehr}
                  onChange={(e) => setDepotgebuehr(e.target.value)}
                  className="h-8 rounded-md border border-input bg-[#EFFBF5] focus:outline-none focus:border-[#3FCB8E] px-2 text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                agE-/Dividendenrendite (% p.a.)
                <input type="number" min={0} step={0.1} value={ageRendite}
                  onChange={(e) => setAgeRendite(e.target.value)}
                  className="h-8 rounded-md border border-input bg-[#EFFBF5] focus:outline-none focus:border-[#3FCB8E] px-2 text-sm" />
              </label>
            </div>
            {depotHint && <div className="text-xs text-muted-foreground">{depotHint}</div>}
            <div className="text-[10.5px] font-bold uppercase tracking-wide text-[#155767]">KESt-pflichtig (27,5 %) — agE-Rendite gilt auch für die VV</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Vermögensverwaltung</h3>
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Setup-Kosten</span><span>3 × Monatsbeitrag</span></div>
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Ausgabeaufschlag Einmalerlag</span><span>5 %</span></div>
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Laufende Kosten</span><span>2,09 % p.a.</span></div>
            <div className="mt-1 text-[10.5px] font-bold uppercase tracking-wide text-[#155767]">KESt-pflichtig (27,5 %)</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Fondssparer</h3>
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Versicherungssteuer</span><span>3,85 %</span></div>
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Kosten (von Prämiensumme)</span><span>5,06 %</span></div>
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Laufende Kosten (am Vermögen)</span><span>0,516 % p.a.</span></div>
            <div className="mt-1 text-[10.5px] font-bold uppercase tracking-wide text-[#155767]">KESt-frei</div>
            {einmalNum > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                Kein Einmalerlag verfügbar — der eingegebene Einmalerlag fließt bei diesem Produkt nicht ins Depot.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">FLV (Fondsgebundene Lebensversicherung)</h3>
            <ToggleGroup
              value={provider}
              options={[{ value: "merkur", label: "Merkur" }, { value: "helvetia", label: "Helvetia" }]}
              onChange={setProvider}
            />
            <div className="flex flex-col gap-1">
              {RR_FLV_COSTS[provider].map(([label, val]) => (
                <div key={label} className="flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span>{val}</span></div>
              ))}
            </div>
            <div className="text-[10.5px] font-bold uppercase tracking-wide text-[#155767]">KESt-frei</div>
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
                  { label: "FLV", data: flvY, borderColor: "#155767", backgroundColor: "rgba(21,87,103,.08)", borderWidth: 2.5, pointRadius: 0, tension: 0.2 },
                  { label: "Fondssparer", data: fondssparerY, borderColor: "#5B9BD5", backgroundColor: "rgba(91,155,213,.08)", borderWidth: 2.5, pointRadius: 0, tension: 0.2 },
                  { label: "Depot", data: fondsdepotY, borderColor: "#B07CC6", backgroundColor: "rgba(176,124,198,.08)", borderWidth: 2.5, pointRadius: 0, tension: 0.2 },
                  { label: "Vermögensverwaltung", data: vvY, borderColor: "#E7A94C", backgroundColor: "rgba(231,169,76,.08)", borderWidth: 2.5, pointRadius: 0, tension: 0.2 },
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
          return (
            <Card key={p.name}>
              <CardContent>
                <div className="text-xs text-muted-foreground">{p.name}</div>
                <div className="text-xl font-bold tabular-nums">{rrFormatEUR(p.end)}</div>
                <div className={cn("text-xs font-bold", positive ? "text-[#155767]" : "text-destructive")}>
                  {positive ? "+" : ""}{rrFormatEUR(diff)} ggü. Einbezahlt
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardContent>
          <h3 className="mb-3 text-sm font-semibold">Jahrestabelle</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-semibold text-muted-foreground">
                  <th className="px-2 py-1.5">Jahr</th>
                  <th className="px-2 py-1.5">Einbezahlt</th>
                  <th className="px-2 py-1.5">FLV</th>
                  <th className="px-2 py-1.5">Fondssparer</th>
                  <th className="px-2 py-1.5">Depot</th>
                  <th className="px-2 py-1.5">VV</th>
                </tr>
              </thead>
              <tbody>
                {years.map((y, i) => (
                  <tr key={y} className="border-b last:border-0">
                    <td className="px-2 py-1.5">{y}</td>
                    <td className="px-2 py-1.5 tabular-nums">{rrFormatEUR(einbezahlt[i])}</td>
                    <td className="px-2 py-1.5 tabular-nums">{rrFormatEUR(flvY[i])}</td>
                    <td className="px-2 py-1.5 tabular-nums">{rrFormatEUR(fondssparerY[i])}</td>
                    <td className="px-2 py-1.5 tabular-nums">{rrFormatEUR(fondsdepotY[i])}</td>
                    <td className="px-2 py-1.5 tabular-nums">{rrFormatEUR(vvY[i])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
