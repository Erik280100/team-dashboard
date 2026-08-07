// Finanzierungsrechner — errechnet aus Kaufpreis, Eigenmitteln und der Frage "Makler
// ja/nein" automatisch Kauf- und Kreditnebenkosten, den benötigten Kreditbetrag und den
// monatsgenauen Annuitätentilgungsplan. Siehe src/lib/calc/kredit.ts für die Rechenlogik
// und die Herkunft der Standardsätze.
import "@/lib/chartSetup"
import { useMemo, useState } from "react"
import { Line } from "react-chartjs-2"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  KREDIT_DEFAULTS, berechneAfaBemessungsgrundlage, berechneAfaJahre, berechneKreditbetrag,
  berechneTilgungsplan, effektivzinsPct, kreditFormatEUR, kreditFormatPct, type KreditSaetze,
} from "@/lib/calc/kredit"

const LAUFZEIT_PRESETS = [10, 15, 20, 25, 30]

const INPUT_CLASS = "h-8 rounded-md border border-input bg-background focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 transition-colors px-2 text-sm"

function SatzFeld({
  label, value, onChange, suffix = "%", step = 0.1,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  suffix?: string
  step?: number
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <div className="flex items-center gap-1.5">
        <input type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)}
          className={cn(INPUT_CLASS, "w-24")} />
        <span className="text-xs">{suffix}</span>
      </div>
    </label>
  )
}

export function KreditRechner() {
  const [kaufpreis, setKaufpreis] = useState("400000")
  const [eigenmittel, setEigenmittel] = useState("80000")
  const [laufzeit, setLaufzeit] = useState("30")
  const [zinssatz, setZinssatz] = useState("3.5")
  const [mitMakler, setMitMakler] = useState(true)
  const [nkMitfinanziert, setNkMitfinanziert] = useState(true)
  const [saetzeOffen, setSaetzeOffen] = useState(false)
  const [saetze, setSaetze] = useState<KreditSaetze>(KREDIT_DEFAULTS)

  const kaufpreisNum = Math.max(0, Number(kaufpreis) || 0)
  const eigenmittelNum = Math.max(0, Number(eigenmittel) || 0)
  const laufzeitClamped = Math.min(40, Math.max(1, Math.round(Number(laufzeit) || 0) || 20))
  const zinssatzClamped = Math.min(20, Math.max(0, Number(zinssatz) || 0))

  const satzSetter = (key: keyof KreditSaetze) => (v: string) =>
    setSaetze((s) => ({ ...s, [key]: Number(v) || 0 }))

  const { kredit, plan, effektivzins, afaBemessungsgrundlage, afaJahre } = useMemo(() => {
    const kredit = berechneKreditbetrag({
      kaufpreis: kaufpreisNum, eigenmittel: eigenmittelNum, mitMakler, nkMitfinanziert, saetze,
    })
    const plan = berechneTilgungsplan(kredit.kreditbetrag, zinssatzClamped, laufzeitClamped)
    const effektivzins = effektivzinsPct(kredit.nettoAuszahlung, plan.rate, plan.monate.length)
    const afaBemessungsgrundlage = berechneAfaBemessungsgrundlage(kaufpreisNum, saetze.gebaeudeanteilPct)
    const afaJahre = berechneAfaJahre(afaBemessungsgrundlage, saetze.afaSatzPct, laufzeitClamped)
    return { kredit, plan, effektivzins, afaBemessungsgrundlage, afaJahre }
  }, [kaufpreisNum, eigenmittelNum, mitMakler, nkMitfinanziert, saetze, zinssatzClamped, laufzeitClamped])

  // Kumulierte Zinsen je Monat, fürs Tooltip auf der Restschuld-Kurve.
  const kumZinsen = useMemo(() => {
    let sum = 0
    return plan.monate.map((m) => (sum += m.zins))
  }, [plan.monate])

  const monthLabels = [0, ...plan.monate.map((m) => m.monat / 12)]
  const restschuldLine = [kredit.kreditbetrag, ...plan.monate.map((m) => m.restschuld)]

  const eigenmittelquotePct = kredit.gesamtinvestition > 0 ? (eigenmittelNum / kredit.gesamtinvestition) * 100 : 0

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
        <strong>Finanzierungsrechner:</strong> Ermittelt aus Kaufpreis, Eigenmitteln und der
        Frage "Makler ja/nein" automatisch die Kauf- und Kreditnebenkosten (Grunderwerbsteuer,
        Grundbuch, Vertragserrichtung, ggf. Maklerprovision, Kreditvertragserstellung,
        Pfandrechtseintragung) sowie den benötigten Kreditbetrag und den
        Annuitätentilgungsplan. Sätze marktüblich für Österreich, Stand 2026 — in der Praxis
        bankabhängig und daher unter "Kostensätze anpassen" veränderbar. Modellrechnung ohne
        Gewähr, Eingaben werden nicht gespeichert.
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Eingaben</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Kaufpreis (€)
              <input type="number" min={0} step={1000} value={kaufpreis}
                onChange={(e) => setKaufpreis(e.target.value)} className={INPUT_CLASS} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Eigenmittel (€)
              <input type="number" min={0} step={1000} value={eigenmittel}
                onChange={(e) => setEigenmittel(e.target.value)} className={INPUT_CLASS} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Sollzinssatz (% p.a.)
              <input type="number" min={0} max={20} step={0.05} value={zinssatz}
                onChange={(e) => setZinssatz(e.target.value)} className={INPUT_CLASS} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Laufzeit (Jahre)
              <div className="flex flex-wrap items-center gap-2">
                <input type="number" min={1} max={40} step={1} value={laufzeit}
                  onChange={(e) => setLaufzeit(e.target.value)}
                  className={cn(INPUT_CLASS, "w-20")} />
                <div className="flex flex-wrap gap-1.5">
                  {LAUFZEIT_PRESETS.map((p) => (
                    <button key={p} type="button" onClick={() => setLaufzeit(String(p))}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-bold transition-colors",
                        laufzeitClamped === p
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
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={mitMakler} onChange={(e) => setMitMakler(e.target.checked)} className="size-4" />
              Makler beauftragt (Provision fällt an)
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={nkMitfinanziert} onChange={(e) => setNkMitfinanziert(e.target.checked)} className="size-4" />
              Kreditnebenkosten mitfinanzieren
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <button type="button" onClick={() => setSaetzeOffen((v) => !v)}
            className="flex items-center gap-1.5 text-left text-sm font-semibold text-muted-foreground hover:text-foreground">
            <span className={cn("inline-block transition-transform", saetzeOffen && "rotate-90")}>▶</span>
            Kostensätze anpassen
          </button>
          {saetzeOffen && (
            <div className="flex flex-col gap-4">
              <div>
                <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Kaufnebenkosten (vom Kaufpreis)</h4>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  <SatzFeld label="Grunderwerbsteuer" value={String(saetze.grunderwerbsteuerPct)} onChange={satzSetter("grunderwerbsteuerPct")} />
                  <SatzFeld label="Grundbucheintragung" value={String(saetze.grundbuchEintragungPct)} onChange={satzSetter("grundbuchEintragungPct")} />
                  <SatzFeld label="Vertragserrichtung (netto)" value={String(saetze.vertragserrichtungPct)} onChange={satzSetter("vertragserrichtungPct")} />
                  <SatzFeld label="Maklerprovision (netto)" value={String(saetze.maklerprovisionPct)} onChange={satzSetter("maklerprovisionPct")} />
                  <SatzFeld label="USt auf Dienstleistungen" value={String(saetze.ustPct)} onChange={satzSetter("ustPct")} />
                  <SatzFeld label="Sonstige Kaufnebenkosten" value={String(saetze.sonstigeKaufNK)} onChange={satzSetter("sonstigeKaufNK")} suffix="€" step={100} />
                </div>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Kreditnebenkosten (von der Kreditsumme)</h4>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  <SatzFeld label="Kreditvertragserstellung" value={String(saetze.kreditvertragserstellungPct)} onChange={satzSetter("kreditvertragserstellungPct")} />
                  <SatzFeld label="Pfandrechtseintragung" value={String(saetze.pfandrechtPct)} onChange={satzSetter("pfandrechtPct")} />
                  <SatzFeld label="Nebengebührensicherstellung" value={String(saetze.nebengebuehrensicherstellungPct)} onChange={satzSetter("nebengebuehrensicherstellungPct")} />
                  <SatzFeld label="Sonstige Kreditnebenkosten" value={String(saetze.sonstigeKreditNK)} onChange={satzSetter("sonstigeKreditNK")} suffix="€" step={100} />
                </div>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold text-muted-foreground">AfA (steuerliche Abschreibung)</h4>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  <SatzFeld label="Gebäudeanteil am Kaufpreis" value={String(saetze.gebaeudeanteilPct)} onChange={satzSetter("gebaeudeanteilPct")} />
                  <SatzFeld label="AfA-Satz (linear, ab 3. Jahr)" value={String(saetze.afaSatzPct)} onChange={satzSetter("afaSatzPct")} />
                </div>
              </div>
              <button type="button" onClick={() => setSaetze(KREDIT_DEFAULTS)}
                className="w-fit rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted">
                Auf Standardwerte zurücksetzen
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Kostenaufstellung</h3>
          {kredit.warnung && (
            <div className="rounded-lg border bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {kredit.warnung}
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-1">
              <h4 className="text-xs font-semibold text-muted-foreground">Kaufnebenkosten</h4>
              {kredit.kaufNK.positionen.map((p) => (
                <div key={p.label} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">{p.label} <span className="text-xs">({p.hinweis})</span></span>
                  <span className="tabular-nums">{kreditFormatEUR(p.betrag)}</span>
                </div>
              ))}
              <div className="mt-1 flex items-baseline justify-between gap-2 border-t pt-1 text-sm font-semibold">
                <span>Summe Kaufnebenkosten</span>
                <span className="tabular-nums">{kreditFormatEUR(kredit.kaufNK.summe)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="text-xs font-semibold text-muted-foreground">Kreditnebenkosten</h4>
              {kredit.kreditNKPositionen.map((p) => (
                <div key={p.label} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">{p.label} <span className="text-xs">({p.hinweis})</span></span>
                  <span className="tabular-nums">{kreditFormatEUR(p.betrag)}</span>
                </div>
              ))}
              <div className="mt-1 flex items-baseline justify-between gap-2 border-t pt-1 text-sm font-semibold">
                <span>Summe Kreditnebenkosten</span>
                <span className="tabular-nums">{kreditFormatEUR(kredit.kreditNKSumme)}</span>
              </div>
            </div>
          </div>
          <div className="mt-2 flex flex-col gap-1 border-t pt-3">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Gesamtinvestition (Kaufpreis + alle Nebenkosten)</span>
              <span className="tabular-nums">{kreditFormatEUR(kredit.gesamtinvestition)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Eigenmittel</span>
              <span className="tabular-nums">{kreditFormatEUR(eigenmittelNum)}</span>
            </div>
            {!nkMitfinanziert && kredit.barbedarf > 0 && (
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Zusätzlicher Barbedarf (Kreditnebenkosten nicht mitfinanziert)</span>
                <span className="tabular-nums">{kreditFormatEUR(kredit.barbedarf)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-2 text-base font-bold">
              <span>Benötigter Kreditbetrag</span>
              <span className="tabular-nums">{kreditFormatEUR(kredit.kreditbetrag)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">Restschuldverlauf</h3>
            <span className="text-xs text-muted-foreground">
              Laufzeit: <strong className="tabular-nums text-foreground">{laufzeitClamped} Jahre</strong>
            </span>
          </div>
          <div className="h-[420px]">
            <Line
              data={{
                labels: monthLabels,
                datasets: [
                  {
                    label: "Restschuld", data: restschuldLine, borderColor: "#155767",
                    backgroundColor: "rgba(21,87,103,.08)", borderWidth: 2, pointRadius: 0,
                    tension: 0.1, fill: true,
                  },
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
                      label: (ctx) => `Restschuld: ${kreditFormatEUR(ctx.parsed.y as number)}`,
                      afterLabel: (ctx) => {
                        const idx = ctx.dataIndex
                        const zins = idx === 0 ? 0 : kumZinsen[idx - 1]
                        return `Kumulierte Zinsen bisher: ${kreditFormatEUR(zins)}`
                      },
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
                  y: { ticks: { callback: (val) => kreditFormatEUR(Number(val)) } },
                },
              }}
              aria-label="Restschuldverlauf über die Kreditlaufzeit"
              role="img"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Monatliche Rate</span>
            <span className="text-xl font-bold tabular-nums">{kreditFormatEUR(plan.rate)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Gesamtzinsen</span>
            <span className="text-xl font-bold tabular-nums">{kreditFormatEUR(plan.gesamtzinsen)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Gesamtaufwand (Kredit + Zinsen)</span>
            <span className="text-xl font-bold tabular-nums">{kreditFormatEUR(plan.gesamtaufwand)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Effektivzinssatz p.a.</span>
            <span className="text-xl font-bold tabular-nums">{kreditFormatPct(effektivzins)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Beleihungsquote (Kredit/Kaufpreis)</span>
            <span className="text-xl font-bold tabular-nums">{kreditFormatPct(kredit.beleihungsquotePct, 1)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Eigenmittelquote (an Gesamtinvestition)</span>
            <span className="text-xl font-bold tabular-nums">{kreditFormatPct(eigenmittelquotePct, 1)}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">Tilgungsplan (jährlich)</h3>
            <span className="text-xs text-muted-foreground">
              AfA-Bemessungsgrundlage ({saetze.gebaeudeanteilPct.toLocaleString("de-AT")} % vom Kaufpreis):{" "}
              <strong className="tabular-nums text-foreground">{kreditFormatEUR(afaBemessungsgrundlage)}</strong>
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1 pr-3 font-medium">Jahr</th>
                  <th className="py-1 pr-3 text-right font-medium">Rate p.a.</th>
                  <th className="py-1 pr-3 text-right font-medium">Zinsen</th>
                  <th className="py-1 pr-3 text-right font-medium">Tilgung</th>
                  <th className="py-1 pr-3 text-right font-medium">Restschuld</th>
                  <th className="py-1 text-right font-medium">AfA</th>
                </tr>
              </thead>
              <tbody>
                {plan.jahre.map((j) => {
                  const afa = afaJahre[j.jahr - 1]
                  return (
                    <tr key={j.jahr} className="border-b border-border/50">
                      <td className="py-1 pr-3 tabular-nums">{j.jahr}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{kreditFormatEUR(j.rateSumme)}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{kreditFormatEUR(j.zinsen)}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{kreditFormatEUR(j.tilgung)}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{kreditFormatEUR(j.restschuld)}</td>
                      <td className="py-1 text-right tabular-nums">
                        {kreditFormatEUR(afa.afa)}{afa.faktor > 1 && <span className="text-muted-foreground"> (×{afa.faktor})</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="text-sm font-semibold">
                  <td className="pt-2 pr-3">Summe</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{kreditFormatEUR(plan.gesamtaufwand)}</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{kreditFormatEUR(plan.gesamtzinsen)}</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{kreditFormatEUR(kredit.kreditbetrag)}</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">0 €</td>
                  <td className="pt-2 text-right tabular-nums">
                    {kreditFormatEUR(afaJahre.reduce((s, a) => s + a.afa, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
