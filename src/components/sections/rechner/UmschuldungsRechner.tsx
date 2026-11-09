// Umschuldungsrechner — vergleicht den bestehenden Kredit (offener Betrag, Restlaufzeit, Zins)
// mit einem neuen Kredit, der wie im Finanzierungsrechner (KreditRechner) gerechnet wird.
// Rechenlogik: src/lib/calc/umschuldung.ts
import "@/lib/chartSetup"
import { useMemo, useState } from "react"
import { Line } from "react-chartjs-2"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { KREDIT_DEFAULTS, kreditFormatEUR, kreditFormatPct, type KreditSaetze } from "@/lib/calc/kredit"
import { VFE_DEFAULT_PCT, berechneUmschuldung } from "@/lib/calc/umschuldung"
import { INPUT_CLASS, SatzFeld } from "@/components/sections/rechner/fields"

const LAUFZEIT_PRESETS = [15, 20, 25, 30, 35]

function Kachel({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn("text-xl font-bold tabular-nums", tone === "good" && "text-emerald-700", tone === "bad" && "text-amber-700")}>
          {value}
        </span>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </CardContent>
    </Card>
  )
}

export function UmschuldungsRechner() {
  const [restschuld, setRestschuld] = useState("250000")
  const [restJahre, setRestJahre] = useState("22")
  const [restMonate, setRestMonate] = useState("0")
  const [zinsAlt, setZinsAlt] = useState("4.5")
  const [zinsNeu, setZinsNeu] = useState("3")
  // null = neue Laufzeit folgt der Restlaufzeit des alten Kredits
  const [laufzeitNeu, setLaufzeitNeu] = useState<string | null>(null)
  const [vfeAktiv, setVfeAktiv] = useState(true)
  const [vfePct, setVfePct] = useState(String(VFE_DEFAULT_PCT))
  const [kostenMitfinanziert, setKostenMitfinanziert] = useState(true)
  const [saetzeOffen, setSaetzeOffen] = useState(false)
  const [saetze, setSaetze] = useState<KreditSaetze>(KREDIT_DEFAULTS)

  const restschuldNum = Math.max(0, Number(restschuld) || 0)
  const restMonateGesamt = Math.min(480, Math.max(1,
    Math.round(Math.max(0, Number(restJahre) || 0) * 12 + Math.max(0, Number(restMonate) || 0))))
  const zinsAltNum = Math.min(20, Math.max(0, Number(zinsAlt) || 0))
  const zinsNeuNum = Math.min(20, Math.max(0, Number(zinsNeu) || 0))
  const restJahreExakt = restMonateGesamt / 12
  const laufzeitNeuJahre = laufzeitNeu === null
    ? restJahreExakt
    : Math.min(40, Math.max(1, Math.round(Number(laufzeitNeu) || 0)))
  const vfePctNum = Math.max(0, Number(vfePct) || 0)

  const satzSetter = (key: keyof KreditSaetze) => (v: string) =>
    setSaetze((s) => ({ ...s, [key]: Number(v) || 0 }))

  const erg = useMemo(() => berechneUmschuldung({
    restschuld: restschuldNum, restlaufzeitMonate: restMonateGesamt, zinsAltPct: zinsAltNum,
    zinsNeuPct: zinsNeuNum, laufzeitNeuJahre, vfeAktiv, vfePct: vfePctNum, kostenMitfinanziert, saetze,
  }), [restschuldNum, restMonateGesamt, zinsAltNum, zinsNeuNum, laufzeitNeuJahre, vfeAktiv, vfePctNum, kostenMitfinanziert, saetze])

  const maxMonate = Math.max(erg.planAlt.monate.length, erg.planNeu.monate.length)
  const labels = Array.from({ length: maxMonate + 1 }, (_, i) => i / 12)
  const lineAlt = Array.from({ length: maxMonate + 1 }, (_, i) =>
    i === 0 ? restschuldNum : (erg.planAlt.monate[i - 1]?.restschuld ?? 0))
  const lineNeu = Array.from({ length: maxMonate + 1 }, (_, i) =>
    i === 0 ? erg.kreditbetragNeu : (erg.planNeu.monate[i - 1]?.restschuld ?? 0))

  const jahreMax = Math.max(erg.planAlt.jahre.length, erg.planNeu.jahre.length)
  const zeilen = Array.from({ length: jahreMax }, (_, i) => ({
    jahr: i + 1, alt: erg.planAlt.jahre[i], neu: erg.planNeu.jahre[i],
  }))
  const summeKosten = erg.kostenPositionen.reduce((s, p) => s + p.betrag, 0)
  const lohnt = erg.vorteil > 0

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <strong>Umschuldungsrechner:</strong> Vergleicht den bestehenden Kredit (offener Betrag, Restlaufzeit, Zinsen)
        mit einem neuen Kredit inklusive Umschuldungskosten.
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold">Bestehender Kredit</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Noch offener Betrag (€)
                <input type="number" min={0} step={1000} value={restschuld}
                  onChange={(e) => setRestschuld(e.target.value)} className={INPUT_CLASS} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Sollzinssatz (% p.a.)
                <input type="number" min={0} max={20} step={0.05} value={zinsAlt}
                  onChange={(e) => setZinsAlt(e.target.value)} className={INPUT_CLASS} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Restlaufzeit (Jahre)
                <input type="number" min={0} max={40} step={1} value={restJahre}
                  onChange={(e) => setRestJahre(e.target.value)} className={INPUT_CLASS} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                zusätzliche Monate
                <input type="number" min={0} max={11} step={1} value={restMonate}
                  onChange={(e) => setRestMonate(e.target.value)} className={INPUT_CLASS} />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Aktuelle Monatsrate (berechnet):{" "}
              <strong className="tabular-nums text-foreground">{kreditFormatEUR(erg.planAlt.rate)}</strong>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold">Neuer Kredit</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Sollzinssatz (% p.a.)
                <input type="number" min={0} max={20} step={0.05} value={zinsNeu}
                  onChange={(e) => setZinsNeu(e.target.value)} className={INPUT_CLASS} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Laufzeit (Jahre)
                <input type="number" min={1} max={40} step={1}
                  value={laufzeitNeu ?? String(Math.round(restJahreExakt * 10) / 10)}
                  onChange={(e) => setLaufzeitNeu(e.target.value)}
                  className={cn(INPUT_CLASS, "w-24")} />
              </label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setLaufzeitNeu(null)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-bold transition-colors",
                  laufzeitNeu === null
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}>
                = Restlaufzeit
              </button>
              {LAUFZEIT_PRESETS.map((p) => (
                <button key={p} type="button" onClick={() => setLaufzeitNeu(String(p))}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-bold transition-colors",
                    laufzeitNeu !== null && laufzeitNeuJahre === p
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}>
                  {p} J
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={vfeAktiv} onChange={(e) => setVfeAktiv(e.target.checked)} className="size-4" />
                Vorfälligkeitsentschädigung berücksichtigen
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={kostenMitfinanziert} onChange={(e) => setKostenMitfinanziert(e.target.checked)} className="size-4" />
                Umschuldungskosten mitfinanzieren
              </label>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <button type="button" onClick={() => setSaetzeOffen((v) => !v)}
            className="flex items-center gap-1.5 text-left text-sm font-semibold text-muted-foreground hover:text-foreground">
            <span className={cn("inline-block transition-transform", saetzeOffen && "rotate-90")}>▶</span>
            Kostensätze anpassen
          </button>
          {saetzeOffen && (
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <SatzFeld label="Vorfälligkeitsentschädigung" value={vfePct} onChange={setVfePct} />
                <SatzFeld label="Kreditvertragserstellung" value={String(saetze.kreditvertragserstellungPct)} onChange={satzSetter("kreditvertragserstellungPct")} />
                <SatzFeld label="Pfandrechtseintragung" value={String(saetze.pfandrechtPct)} onChange={satzSetter("pfandrechtPct")} />
                <SatzFeld label="Nebengebührensicherstellung" value={String(saetze.nebengebuehrensicherstellungPct)} onChange={satzSetter("nebengebuehrensicherstellungPct")} />
                <SatzFeld label="Sonstige Kreditnebenkosten" value={String(saetze.sonstigeKreditNK)} onChange={satzSetter("sonstigeKreditNK")} suffix="€" step={100} />
              </div>
              <button type="button" onClick={() => { setSaetze(KREDIT_DEFAULTS); setVfePct(String(VFE_DEFAULT_PCT)) }}
                className="w-fit rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted">
                Auf Standardwerte zurücksetzen
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Umschuldungskosten</h3>
          {erg.warnungen.length > 0 && (
            <div className="flex flex-col gap-1">
              {erg.warnungen.map((w) => (
                <div key={w} className="rounded-lg border bg-amber-50 px-3 py-2 text-xs text-amber-900">{w}</div>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-1">
            {erg.kostenPositionen.map((p) => (
              <div key={p.label} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{p.label} <span className="text-xs">({p.hinweis})</span></span>
                <span className="tabular-nums">{kreditFormatEUR(p.betrag)}</span>
              </div>
            ))}
            <div className="mt-1 flex items-baseline justify-between gap-2 border-t pt-1 text-sm font-semibold">
              <span>Summe Umschuldungskosten</span>
              <span className="tabular-nums">{kreditFormatEUR(summeKosten)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Offener Betrag alter Kredit</span>
              <span className="tabular-nums">{kreditFormatEUR(restschuldNum)}</span>
            </div>
            {!kostenMitfinanziert && (
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Bar zu zahlen (nicht mitfinanziert)</span>
                <span className="tabular-nums">{kreditFormatEUR(erg.barkosten)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-2 text-base font-bold">
              <span>Neuer Kreditbetrag</span>
              <span className="tabular-nums">{kreditFormatEUR(erg.kreditbetragNeu)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Kachel label="Monatliche Rate alt → neu"
          value={`${kreditFormatEUR(erg.planAlt.rate)} → ${kreditFormatEUR(erg.planNeu.rate)}`}
          sub={`${erg.ersparnisProMonat >= 0 ? "Ersparnis" : "Mehrbelastung"} ${kreditFormatEUR(Math.abs(erg.ersparnisProMonat))} / Monat`}
          tone={erg.ersparnisProMonat >= 0 ? "good" : "bad"} />
        <Kachel label="Gesamtzinsen alt → neu"
          value={`${kreditFormatEUR(erg.planAlt.gesamtzinsen)} → ${kreditFormatEUR(erg.planNeu.gesamtzinsen)}`} />
        <Kachel label="Gesamtaufwand alt → neu (inkl. Kosten)"
          value={`${kreditFormatEUR(erg.gesamtaufwandAlt)} → ${kreditFormatEUR(erg.gesamtaufwandNeu)}`} />
        <Kachel label={lohnt ? "Vorteil durch Umschuldung" : "Nachteil durch Umschuldung"}
          value={kreditFormatEUR(Math.abs(erg.vorteil))} tone={lohnt ? "good" : "bad"} />
        <Kachel label="Umschuldung rechnet sich ab"
          value={erg.breakEvenMonat === null ? "nie" : `${(erg.breakEvenMonat / 12).toLocaleString("de-AT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Jahren`}
          sub={erg.breakEvenMonat === null ? undefined : `nach ${erg.breakEvenMonat} Monaten`} />
        <Kachel label="Effektivzinssatz neu p.a." value={kreditFormatPct(erg.effektivzinsNeu)} />
      </div>

      <Card>
        <CardContent>
          <h3 className="mb-3 text-sm font-semibold">Restschuldverlauf alt gegen neu</h3>
          <div className="h-[380px]">
            <Line
              data={{
                labels,
                datasets: [
                  { label: "Bestehender Kredit", data: lineAlt, borderColor: "#8FA1A6", backgroundColor: "rgba(143,161,166,.08)", borderWidth: 2, pointRadius: 0, tension: 0.1, fill: true },
                  { label: "Neuer Kredit", data: lineNeu, borderColor: "#155767", backgroundColor: "rgba(21,87,103,.08)", borderWidth: 2, pointRadius: 0, tension: 0.1, fill: true },
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
                      title: (items) => `Jahr ${labels[items[0].dataIndex].toFixed(2)}`,
                      label: (ctx) => `${ctx.dataset.label}: ${kreditFormatEUR(ctx.parsed.y as number)}`,
                    },
                  },
                },
                scales: {
                  x: {
                    grid: { display: false },
                    title: { display: true, text: "Jahre" },
                    ticks: { autoSkip: false, maxRotation: 0, callback: (_v, index) => (Number.isInteger(labels[index]) ? labels[index] : "") },
                  },
                  y: { beginAtZero: true, ticks: { callback: (val) => kreditFormatEUR(Number(val)) } },
                },
              }}
              aria-label="Restschuldverlauf des bestehenden und des neuen Kredits"
              role="img"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h3 className="mb-3 text-sm font-semibold">Tilgungsplan (jährlich)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1 pr-3 font-medium">Jahr</th>
                  <th className="py-1 pr-3 text-right font-medium">Rate alt</th>
                  <th className="py-1 pr-3 text-right font-medium">Rate neu</th>
                  <th className="py-1 pr-3 text-right font-medium">Zinsen alt</th>
                  <th className="py-1 pr-3 text-right font-medium">Zinsen neu</th>
                  <th className="py-1 pr-3 text-right font-medium">Restschuld alt</th>
                  <th className="py-1 text-right font-medium">Restschuld neu</th>
                </tr>
              </thead>
              <tbody>
                {zeilen.map(({ jahr, alt, neu }) => (
                  <tr key={jahr} className="border-b border-border/50">
                    <td className="py-1 pr-3 tabular-nums">{jahr}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{alt ? kreditFormatEUR(alt.rateSumme) : "–"}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{neu ? kreditFormatEUR(neu.rateSumme) : "–"}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{alt ? kreditFormatEUR(alt.zinsen) : "–"}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{neu ? kreditFormatEUR(neu.zinsen) : "–"}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{alt ? kreditFormatEUR(alt.restschuld) : "0 €"}</td>
                    <td className="py-1 text-right tabular-nums">{neu ? kreditFormatEUR(neu.restschuld) : "0 €"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-sm font-semibold">
                  <td className="pt-2 pr-3">Summe</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{kreditFormatEUR(erg.planAlt.gesamtaufwand)}</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{kreditFormatEUR(erg.planNeu.gesamtaufwand)}</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{kreditFormatEUR(erg.planAlt.gesamtzinsen)}</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{kreditFormatEUR(erg.planNeu.gesamtzinsen)}</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">0 €</td>
                  <td className="pt-2 text-right tabular-nums">0 €</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Modellrechnung mit gleichbleibender Annuität und festem Zinssatz. Die Vorfälligkeitsentschädigung ist bei
        Fixzinsvereinbarung auf 1 % der vorzeitig zurückgezahlten Restschuld begrenzt (§ 20 Abs 3 HIKrG), bei variablem
        Zins fällt sie nicht an. Pfandrechtskosten können entfallen, wenn die Bank das bestehende Pfandrecht übernimmt.
        Die Gesamtaufwand-Zeile des neuen Kredits enthält bar zu zahlende Umschuldungskosten. Keine Anlage- oder Finanzberatung.
      </p>
    </div>
  )
}
