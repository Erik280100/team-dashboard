// Anlegerwohnungs-Portfolio-Rechner — simuliert, wie ein Wohnungsportfolio über die Zeit
// wächst: sparen, kaufen, Wertzuwachs, wiederkehrende Umschuldung auf den höheren Verkehrswert,
// und ob/wie viele weitere Wohnungen sich davon ganz ohne neues Eigenkapital finanzieren
// ("gratis"). Siehe src/lib/calc/immoPortfolio.ts für die Simulationslogik und die dort
// dokumentierten Vereinfachungen.
import "@/lib/chartSetup"
import { useMemo, useState } from "react"
import { Line } from "react-chartjs-2"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { KREDIT_DEFAULTS, kreditFormatEUR, kreditFormatPct, type KreditSaetze } from "@/lib/calc/kredit"
import { KAUFPREIS_MINDESTGRENZE, simuliereImmoPortfolio, type ImmoPortfolioEingabe } from "@/lib/calc/immoPortfolio"

const WERTZUWACHS_PRESETS = [2, 3, 4]
const UMSCHULDUNG_PRESETS = [3, 5, 7]
const LAUFZEIT_PRESETS = [25, 30, 35]
const GRENZSTEUER_PRESETS = [30, 40, 48]

function PillGroup<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-bold transition-colors",
            value === o.value
              ? "border-transparent bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
          )}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

const INPUT_CLASS = "h-8 rounded-md border border-input bg-background focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 transition-colors px-2 text-sm"

function Feld({
  label, value, onChange, suffix, step = 1, className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  suffix?: string
  step?: number
  className?: string
}) {
  return (
    <label className={cn("flex flex-col gap-1 text-xs text-muted-foreground", className)}>
      {label}
      <div className="flex items-center gap-1.5">
        <input type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)} className={INPUT_CLASS} />
        {suffix && <span className="text-xs">{suffix}</span>}
      </div>
    </label>
  )
}

function KPI({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn("text-xl font-bold tabular-nums", accent && "text-[#155767]")}>{value}</span>
      </CardContent>
    </Card>
  )
}

function n(v: string): number {
  return Number(v) || 0
}

export function ImmoPortfolioRechner() {
  // Start & Sparen
  const [eigenmittel, setEigenmittel] = useState("40000")
  const [sparbetragMonat, setSparbetragMonat] = useState("500")
  const [guthabenzinsPct, setGuthabenzinsPct] = useState("5")

  // Kauf & Finanzierung
  const [kaufpreisReferenz, setKaufpreisReferenz] = useState("150000")
  const [wohnflaecheM2, setWohnflaecheM2] = useState("45")
  const [mindestabstandMonate, setMindestabstandMonate] = useState("18")
  const [ltvKaufPct, setLtvKaufPct] = useState("90")
  const [laufzeitJahre, setLaufzeitJahre] = useState("35")
  const [zinssatzPct, setZinssatzPct] = useState("2.85")
  const [mitMakler, setMitMakler] = useState(true)
  const [nkMitfinanziert, setNkMitfinanziert] = useState(true)

  // Miete
  const [mietModus, setMietModus] = useState<"direkt" | "proM2">("direkt")
  const [mieteMonat, setMieteMonat] = useState("750")
  const [mietpreisProM2, setMietpreisProM2] = useState("13.5")
  const [indexierungPct, setIndexierungPct] = useState("2")
  const [leerstandPct, setLeerstandPct] = useState("3")

  // Kosten
  const [hausverwaltungMonat, setHausverwaltungMonat] = useState("25")
  const [instandhaltungProM2Monat, setInstandhaltungProM2Monat] = useState("1")
  const [sonstigeKostenMonat, setSonstigeKostenMonat] = useState("15")

  // Wertentwicklung & Umschuldung
  const [wertzuwachsPct, setWertzuwachsPct] = useState("3")
  const [umschuldungAlleJahre, setUmschuldungAlleJahre] = useState("5")
  const [beleihungUmschuldungPct, setBeleihungUmschuldungPct] = useState("100")

  // Steuer
  const [grenzsteuersatzPct, setGrenzsteuersatzPct] = useState("40")

  // Bestand
  const [bestandOffen, setBestandOffen] = useState(false)
  const [bestandAnzahl, setBestandAnzahl] = useState("0")
  const [bestandWert, setBestandWert] = useState("0")
  const [bestandRestschuld, setBestandRestschuld] = useState("0")
  const [bestandRateMonat, setBestandRateMonat] = useState("0")
  const [bestandMieteMonat, setBestandMieteMonat] = useState("0")
  const [bestandRestlaufzeitJahre, setBestandRestlaufzeitJahre] = useState("25")

  // Leistbarkeit
  const [nettoeinkommenMonat, setNettoeinkommenMonat] = useState("3500")
  const [lebenshaltungMonat, setLebenshaltungMonat] = useState("1800")
  // Harte Kaufsperre: Deckt ein cashflow-negatives Portfolio den Fehlbetrag nicht aus dem
  // laufenden Sparen, wird er vom Nettoeinkommen abgezogen. Bleibt weniger als dieser Betrag vom
  // Nettoeinkommen übrig, wird kein weiterer Kauf mehr getätigt.
  const [mindestResteinkommenMonat, setMindestResteinkommenMonat] = useState("2000")

  const [horizontJahre, setHorizontJahre] = useState("35")

  // Kostensätze (Kaufnebenkosten/Kreditnebenkosten/AfA) — geteiltes Modell mit dem
  // Finanzierungsrechner.
  const [saetzeOffen, setSaetzeOffen] = useState(false)
  const [saetze, setSaetze] = useState<KreditSaetze>(KREDIT_DEFAULTS)
  const satzSetter = (key: keyof KreditSaetze) => (v: string) => setSaetze((s) => ({ ...s, [key]: Number(v) || 0 }))

  const laufzeitClamped = Math.min(40, Math.max(1, Math.round(n(laufzeitJahre)) || 20))
  const horizontClamped = Math.min(40, Math.max(1, Math.round(n(horizontJahre)) || 20))
  const ltvClamped = Math.min(100, Math.max(0, n(ltvKaufPct)))
  const beleihungClamped = Math.min(150, Math.max(0, n(beleihungUmschuldungPct)))

  const eingabe: ImmoPortfolioEingabe = useMemo(() => ({
    eigenmittel: n(eigenmittel), sparbetragMonat: n(sparbetragMonat), guthabenzinsPct: n(guthabenzinsPct),
    kaufpreisReferenz: n(kaufpreisReferenz), wohnflaecheM2: n(wohnflaecheM2),
    mindestabstandMonate: n(mindestabstandMonate), ltvKaufPct: ltvClamped, laufzeitJahre: laufzeitClamped,
    zinssatzPct: n(zinssatzPct), mitMakler, nkMitfinanziert,
    mietModus, mieteMonat: n(mieteMonat), mietpreisProM2: n(mietpreisProM2),
    indexierungPct: n(indexierungPct), leerstandPct: n(leerstandPct),
    hausverwaltungMonat: n(hausverwaltungMonat), instandhaltungProM2Monat: n(instandhaltungProM2Monat),
    sonstigeKostenMonat: n(sonstigeKostenMonat),
    wertzuwachsPct: n(wertzuwachsPct), umschuldungAlleJahre: Math.max(1, n(umschuldungAlleJahre) || 5),
    beleihungUmschuldungPct: beleihungClamped,
    grenzsteuersatzPct: Math.min(55, Math.max(0, n(grenzsteuersatzPct))),
    gebaeudeanteilPct: saetze.gebaeudeanteilPct, afaSatzPct: saetze.afaSatzPct,
    bestandAnzahl: Math.max(0, Math.round(n(bestandAnzahl))), bestandWert: n(bestandWert),
    bestandRestschuld: n(bestandRestschuld), bestandRateMonat: n(bestandRateMonat),
    bestandMieteMonat: n(bestandMieteMonat), bestandRestlaufzeitJahre: Math.max(1, n(bestandRestlaufzeitJahre) || 25),
    nettoeinkommenMonat: n(nettoeinkommenMonat), lebenshaltungMonat: n(lebenshaltungMonat),
    mindestResteinkommenMonat: n(mindestResteinkommenMonat),
    horizontJahre: horizontClamped, saetze,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    eigenmittel, sparbetragMonat, guthabenzinsPct, kaufpreisReferenz, wohnflaecheM2, mindestabstandMonate,
    ltvClamped, laufzeitClamped, zinssatzPct, mitMakler, nkMitfinanziert, mietModus, mieteMonat, mietpreisProM2,
    indexierungPct, leerstandPct, hausverwaltungMonat, instandhaltungProM2Monat, sonstigeKostenMonat,
    wertzuwachsPct, umschuldungAlleJahre, beleihungClamped, grenzsteuersatzPct, saetze,
    bestandAnzahl, bestandWert, bestandRestschuld, bestandRateMonat, bestandMieteMonat, bestandRestlaufzeitJahre,
    nettoeinkommenMonat, lebenshaltungMonat, mindestResteinkommenMonat, horizontClamped,
  ])

  // Hält den zuletzt gültigen Eingabestand fest, solange der Kaufpreis unter der
  // Mindestgrenze liegt (siehe KAUFPREIS_MINDESTGRENZE in immoPortfolio.ts) — dann findet gar
  // keine neue Simulation (inkl. Chart-Neuzeichnung) statt, während man z. B. eine neue Zahl in
  // das Kaufpreisfeld tippt und das Feld dabei kurzzeitig leer oder sehr niedrig ist. Offizielles
  // React-Muster für "abgeleiteten Zustand, der nur unter einer Bedingung aktualisiert wird" (State
  // während des Renderns anpassen), siehe react.dev/learn/you-might-not-need-an-effect.
  const [eingabeEffektiv, setEingabeEffektiv] = useState<ImmoPortfolioEingabe>(eingabe)
  if (eingabe.kaufpreisReferenz > KAUFPREIS_MINDESTGRENZE && eingabe !== eingabeEffektiv) {
    setEingabeEffektiv(eingabe)
  }
  const kaufpreisZuNiedrig = eingabe.kaufpreisReferenz <= KAUFPREIS_MINDESTGRENZE

  const ergebnis = useMemo(() => simuliereImmoPortfolio(eingabeEffektiv), [eingabeEffektiv])
  const { jahre, kaeufe, meilensteine, kennzahlen, warnungen } = ergebnis
  const letztesJahr = jahre[jahre.length - 1]

  const kaufJahrInfo = useMemo(() => {
    const map = new Map<number, boolean>()
    for (const k of kaeufe) map.set(k.jahr, (map.get(k.jahr) ?? false) || k.istGratis)
    return map
  }, [kaeufe])

  // Als Prop-Objekte memoisiert (statt inline in der JSX), damit react-chartjs-2 bei jedem
  // Tastendruck, der wegen kaufpreisZuNiedrig gar keine neue Simulation auslöst, exakt dieselben
  // Objektreferenzen bekommt und den Chart entsprechend gar nicht neu zeichnet/aktualisiert —
  // sonst würde jede Eingabe (auch eine, die am Ergebnis nichts ändert) eine volle
  // Chart.js-Aktualisierung mit 420 Datenpunkten pro Datensatz anstoßen.
  const chartData = useMemo(() => ({
    labels: jahre.map((j) => j.jahr),
    datasets: [
      {
        label: "Portfolio-Verkehrswert", data: jahre.map((j) => j.portfolioWert), borderColor: "#155767",
        backgroundColor: "rgba(21,87,103,.08)", borderWidth: 2, pointRadius: 0, tension: 0.1, fill: true,
      },
      {
        label: "Restschuld", data: jahre.map((j) => j.restschuldGesamt), borderColor: "#8FA1A6",
        backgroundColor: "rgba(143,161,166,.08)", borderWidth: 2, pointRadius: 0, tension: 0.1, fill: false,
      },
      {
        label: "Nettovermögen (inkl. Liquidität)", data: jahre.map((j) => j.nettovermoegen), borderColor: "#B5624A",
        backgroundColor: "rgba(181,98,74,.08)", borderWidth: 2, tension: 0.1, fill: false,
        pointRadius: (ctx: { dataIndex?: number }) => (kaufJahrInfo.has((ctx.dataIndex ?? 0) + 1) ? 5 : 0),
        pointBackgroundColor: (ctx: { dataIndex?: number }) => (kaufJahrInfo.get((ctx.dataIndex ?? 0) + 1) ? "#16a34a" : "#B5624A"),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [jahre, kaufJahrInfo])

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: { position: "top" as const, labels: { boxWidth: 12, font: { size: 11 } } },
      tooltip: {
        callbacks: {
          title: (items: { label: string }[]) => `Jahr ${items[0].label}`,
          label: (ctx: { dataset: { label?: string }; parsed: { y: unknown } }) => `${ctx.dataset.label}: ${kreditFormatEUR(ctx.parsed.y as number)}`,
          afterBody: (items: { label: string }[]) => {
            const jahr = Number(items[0].label)
            return kaufJahrInfo.has(jahr) ? [kaufJahrInfo.get(jahr) ? "→ Kauf dieses Jahr (gratis)" : "→ Kauf dieses Jahr"] : []
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false }, title: { display: true, text: "Jahre" } },
      y: { beginAtZero: true, ticks: { callback: (val: unknown) => kreditFormatEUR(Number(val)) } },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [kaufJahrInfo])

  const freieLiquiditaetMonat = letztesJahr
    ? n(nettoeinkommenMonat) + 0.8 * (letztesJahr.mieteinnahmen / 12) - n(lebenshaltungMonat) - letztesJahr.kreditratenGesamt / 12
    : 0
  const dstiAmpel = letztesJahr
    ? letztesJahr.dstiPct < 40 ? "grün" : letztesJahr.dstiPct <= 50 ? "gelb" : "rot"
    : "grün"
  const dstiFarbe = dstiAmpel === "grün" ? "text-emerald-600" : dstiAmpel === "gelb" ? "text-amber-600" : "text-red-600"

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
        <strong>Anlegerwohnungs-Portfolio-Rechner:</strong> Simuliert, wie ein Wohnungsportfolio über die Zeit wächst und sich weitere Wohnungen von selbst finanzieren.
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Start &amp; Sparen</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Feld label="Aktuelle Eigenmittel (€)" value={eigenmittel} onChange={setEigenmittel} step={1000} />
            <Feld label="Sparbetrag (€/Monat)" value={sparbetragMonat} onChange={setSparbetragMonat} step={50} />
            <Feld label="Guthabenzinsen (% p.a.)" value={guthabenzinsPct} onChange={setGuthabenzinsPct} step={0.1} suffix="%" />
            <Feld label="Horizont (Jahre)" value={horizontJahre} onChange={setHorizontJahre} step={1} suffix="J" />
            <Feld label="Netto-Haushaltseinkommen (€/Monat)" value={nettoeinkommenMonat} onChange={setNettoeinkommenMonat} step={100} />
            <Feld label="Fixkosten / Lebenshaltung (€/Monat)" value={lebenshaltungMonat} onChange={setLebenshaltungMonat} step={100} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Wohnung &amp; Finanzierung (gilt für jeden künftigen Kauf)</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Feld label="Kaufpreis heute (€)" value={kaufpreisReferenz} onChange={setKaufpreisReferenz} step={5000} />
            <Feld label="Wohnfläche (m²)" value={wohnflaecheM2} onChange={setWohnflaecheM2} step={1} suffix="m²" />
            <Feld label="Mindestabstand zwischen Käufen (Monate)" value={mindestabstandMonate} onChange={setMindestabstandMonate} step={1} />
            <Feld label="Beleihung beim Kauf (% vom Kaufpreis)" value={ltvKaufPct} onChange={setLtvKaufPct} step={1} suffix="%" />
            <Feld label="Sollzinssatz (% p.a.)" value={zinssatzPct} onChange={setZinssatzPct} step={0.05} suffix="%" />
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Laufzeit (Jahre)
              <div className="flex flex-wrap items-center gap-2">
                <input type="number" min={1} max={40} step={1} value={laufzeitJahre}
                  onChange={(e) => setLaufzeitJahre(e.target.value)} className={cn(INPUT_CLASS, "w-20")} />
                <PillGroup value={String(laufzeitClamped) as never}
                  options={LAUFZEIT_PRESETS.map((p) => ({ value: String(p) as never, label: `${p} J` }))}
                  onChange={(v) => setLaufzeitJahre(v)} />
              </div>
            </label>
          </div>
          {kaufpreisZuNiedrig && (
            <div className="rounded-lg border bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Kaufpreis unter {kreditFormatEUR(KAUFPREIS_MINDESTGRENZE)} — die Simulation bleibt beim zuletzt
              gültigen Stand stehen, bis ein realistischer Kaufpreis eingegeben ist.
            </div>
          )}
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
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Miete &amp; Kosten (pro Wohnung, außer wo anders angegeben)</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
              Miete
              <div className="flex flex-wrap items-center gap-2">
                <PillGroup value={mietModus} onChange={setMietModus}
                  options={[{ value: "direkt", label: "Betrag/Monat" }, { value: "proM2", label: "€/m²" }]} />
                {mietModus === "direkt"
                  ? <input type="number" step={25} value={mieteMonat} onChange={(e) => setMieteMonat(e.target.value)} className={cn(INPUT_CLASS, "w-28")} />
                  : <input type="number" step={0.1} value={mietpreisProM2} onChange={(e) => setMietpreisProM2(e.target.value)} className={cn(INPUT_CLASS, "w-24")} />}
              </div>
            </label>
            <Feld label="Mietindexierung (% p.a.)" value={indexierungPct} onChange={setIndexierungPct} step={0.1} suffix="%" />
            <Feld label="Leerstand/Mietausfall (%)" value={leerstandPct} onChange={setLeerstandPct} step={0.5} suffix="%" />
            <Feld label="Hausverwaltung (€/Monat)" value={hausverwaltungMonat} onChange={setHausverwaltungMonat} step={5} />
            <Feld label="Instandhaltung (€/m²/Monat)" value={instandhaltungProM2Monat} onChange={setInstandhaltungProM2Monat} step={0.1} />
            <Feld label="Sonstige Kosten (€/Monat)" value={sonstigeKostenMonat} onChange={setSonstigeKostenMonat} step={5} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Wertentwicklung, Umschuldung &amp; Steuer</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Wertzuwachs Immobilien (% p.a.)
              <div className="flex flex-wrap items-center gap-2">
                <input type="number" step={0.1} value={wertzuwachsPct} onChange={(e) => setWertzuwachsPct(e.target.value)} className={cn(INPUT_CLASS, "w-20")} />
                <PillGroup value={wertzuwachsPct as never}
                  options={WERTZUWACHS_PRESETS.map((p) => ({ value: String(p) as never, label: `${p} %` }))}
                  onChange={(v) => setWertzuwachsPct(v)} />
              </div>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Umschuldung alle (Jahre)
              <div className="flex flex-wrap items-center gap-2">
                <input type="number" min={1} step={1} value={umschuldungAlleJahre} onChange={(e) => setUmschuldungAlleJahre(e.target.value)} className={cn(INPUT_CLASS, "w-20")} />
                <PillGroup value={umschuldungAlleJahre as never}
                  options={UMSCHULDUNG_PRESETS.map((p) => ({ value: String(p) as never, label: `${p} J` }))}
                  onChange={(v) => setUmschuldungAlleJahre(v)} />
              </div>
            </label>
            <Feld label="Beleihung bei Umschuldung (% v. Verkehrswert)" value={beleihungUmschuldungPct} onChange={setBeleihungUmschuldungPct} step={5} suffix="%" />
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Grenzsteuersatz (%)
              <div className="flex flex-wrap items-center gap-2">
                <input type="number" step={1} value={grenzsteuersatzPct} onChange={(e) => setGrenzsteuersatzPct(e.target.value)} className={cn(INPUT_CLASS, "w-20")} />
                <PillGroup value={grenzsteuersatzPct as never}
                  options={GRENZSTEUER_PRESETS.map((p) => ({ value: String(p) as never, label: `${p} %` }))}
                  onChange={(v) => setGrenzsteuersatzPct(v)} />
              </div>
            </label>
          </div>
          {beleihungClamped > 80 && (
            <div className="rounded-lg border bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Beleihung bei Umschuldung über 80 % ist die von dir gewählte Modellannahme — Banken beleihen in der
              Praxis meist nur bis 70–80 % des Verkehrswerts.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <button type="button" onClick={() => setBestandOffen((v) => !v)}
            className="flex items-center gap-1.5 text-left text-sm font-semibold text-muted-foreground hover:text-foreground">
            <span className={cn("inline-block transition-transform", bestandOffen && "rotate-90")}>▶</span>
            Bestand (bereits vorhandene Wohnungen, als Sammelposten)
          </button>
          {bestandOffen && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Feld label="Anzahl" value={bestandAnzahl} onChange={setBestandAnzahl} step={1} />
              <Feld label="Gesamter Verkehrswert (€)" value={bestandWert} onChange={setBestandWert} step={5000} />
              <Feld label="Gesamte Restschuld (€)" value={bestandRestschuld} onChange={setBestandRestschuld} step={5000} />
              <Feld label="Gesamte Rate (€/Monat)" value={bestandRateMonat} onChange={setBestandRateMonat} step={50} />
              <Feld label="Gesamte Miete (€/Monat)" value={bestandMieteMonat} onChange={setBestandMieteMonat} step={50} />
              <Feld label="Restlaufzeit der Kredite (Jahre)" value={bestandRestlaufzeitJahre} onChange={setBestandRestlaufzeitJahre} step={1} suffix="J" />
            </div>
          )}
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
                  <Feld label="Grunderwerbsteuer" value={String(saetze.grunderwerbsteuerPct)} onChange={satzSetter("grunderwerbsteuerPct")} suffix="%" step={0.1} />
                  <Feld label="Grundbucheintragung" value={String(saetze.grundbuchEintragungPct)} onChange={satzSetter("grundbuchEintragungPct")} suffix="%" step={0.1} />
                  <Feld label="Vertragserrichtung (netto)" value={String(saetze.vertragserrichtungPct)} onChange={satzSetter("vertragserrichtungPct")} suffix="%" step={0.1} />
                  <Feld label="Maklerprovision (netto)" value={String(saetze.maklerprovisionPct)} onChange={satzSetter("maklerprovisionPct")} suffix="%" step={0.1} />
                  <Feld label="USt auf Dienstleistungen" value={String(saetze.ustPct)} onChange={satzSetter("ustPct")} suffix="%" step={1} />
                </div>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Kreditnebenkosten (von der Kreditsumme, auch bei Umschuldung)</h4>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  <Feld label="Kreditvertragserstellung" value={String(saetze.kreditvertragserstellungPct)} onChange={satzSetter("kreditvertragserstellungPct")} suffix="%" step={0.1} />
                  <Feld label="Pfandrechtseintragung" value={String(saetze.pfandrechtPct)} onChange={satzSetter("pfandrechtPct")} suffix="%" step={0.1} />
                  <Feld label="Nebengebührensicherstellung" value={String(saetze.nebengebuehrensicherstellungPct)} onChange={satzSetter("nebengebuehrensicherstellungPct")} suffix="%" step={1} />
                  <Feld label="Sonstige Kreditnebenkosten" value={String(saetze.sonstigeKreditNK)} onChange={satzSetter("sonstigeKreditNK")} suffix="€" step={100} />
                </div>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold text-muted-foreground">AfA (steuerliche Abschreibung)</h4>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  <Feld label="Gebäudeanteil am Kaufpreis" value={String(saetze.gebaeudeanteilPct)} onChange={satzSetter("gebaeudeanteilPct")} suffix="%" step={1} />
                  <Feld label="AfA-Satz (linear, ab 3. Jahr)" value={String(saetze.afaSatzPct)} onChange={satzSetter("afaSatzPct")} suffix="%" step={0.1} />
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI label={`Wohnungen nach ${horizontClamped} Jahren`} value={String(letztesJahr?.anzahlObjekte ?? 0)} accent />
        <KPI label="davon gratis (aus Umschuldung finanziert)" value={String(kennzahlen.anzahlGratis)} accent />
        <KPI label="Portfolio-Verkehrswert" value={kreditFormatEUR(letztesJahr?.portfolioWert ?? 0)} />
        <KPI label="Nettovermögen" value={kreditFormatEUR(letztesJahr?.nettovermoegen ?? 0)} />
      </div>

      {meilensteine.length > 0 && (
        <Card>
          <CardContent>
            <h3 className="mb-3 text-sm font-semibold">Meilensteine</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-1 pr-3 font-medium">Nach</th>
                    {meilensteine.map((m) => <th key={m.jahr} className="py-1 pr-3 text-right font-medium">{m.jahr} Jahren</th>)}
                  </tr>
                </thead>
                <tbody>
                  {([
                    ["Wohnungen gesamt", (m: typeof meilensteine[number]) => String(m.anzahlObjekte)],
                    ["davon gratis", (m: typeof meilensteine[number]) => String(m.davonGratis)],
                    ["Portfolio-Verkehrswert", (m: typeof meilensteine[number]) => kreditFormatEUR(m.portfolioWert)],
                    ["Restschuld gesamt", (m: typeof meilensteine[number]) => kreditFormatEUR(m.restschuldGesamt)],
                    ["Nettovermögen", (m: typeof meilensteine[number]) => kreditFormatEUR(m.nettovermoegen)],
                    ["Jahresmiete", (m: typeof meilensteine[number]) => kreditFormatEUR(m.jahresmiete)],
                    ["Jahres-AfA", (m: typeof meilensteine[number]) => kreditFormatEUR(m.jahresAfa)],
                    ["Jahres-Cashflow (netto)", (m: typeof meilensteine[number]) => kreditFormatEUR(m.jahresCashflow)],
                  ] as const).map(([label, fmt]) => (
                    <tr key={label} className="border-b border-border/50">
                      <td className="py-1 pr-3 text-muted-foreground">{label}</td>
                      {meilensteine.map((m) => <td key={m.jahr} className="py-1 pr-3 text-right tabular-nums">{fmt(m)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <h3 className="mb-3 text-sm font-semibold">Portfolioentwicklung</h3>
          <div className="h-[420px]">
            <Line
              data={chartData}
              options={chartOptions}
              aria-label="Entwicklung von Portfolio-Verkehrswert, Restschuld und Nettovermögen über die Jahre, mit Kaufzeitpunkten markiert"
              role="img"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Grüne Punkte auf der Nettovermögen-Linie markieren Jahre mit einem gratis finanzierten Kauf (vollständig
            aus Umschuldungserlös), orange Punkte einen Kauf mit Eigenmitteleinsatz.
          </p>
        </CardContent>
      </Card>

      {kaeufe.length > 0 && (
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold">Kauf-Timeline</h3>
            <p className="mt-1 mb-3 text-xs text-muted-foreground">
              "Kapitalbedarf gesamt" ist der Betrag neben dem Kredit, der für diesen Kauf nötig ist (Anzahlung, weil
              nur {ltvClamped}&nbsp;% beliehen werden, plus Kaufnebenkosten) — unabhängig davon, woher das Geld
              kommt. Das steigt von Kauf zu Kauf mit, weil auch der Kaufpreis mit dem Wertzuwachs mitwächst. Die
              entscheidende Spalte ist "davon eigene Tasche": Das ist der Teil, den du tatsächlich selbst aufbringen
              musst — der Rest kommt aus dem Umschuldungserlös bereits gekaufter Wohnungen.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-1 pr-3 font-medium">#</th>
                    <th className="py-1 pr-3 font-medium">Jahr</th>
                    <th className="py-1 pr-3 text-right font-medium">Kaufpreis</th>
                    <th className="py-1 pr-3 text-right font-medium">Kapitalbedarf gesamt</th>
                    <th className="py-1 pr-3 text-right font-medium">davon eigene Tasche</th>
                    <th className="py-1 pr-3 text-right font-medium">davon aus Umschuldung</th>
                    <th className="py-1 pr-3 text-right font-medium">Rate</th>
                    <th className="py-1 pr-3 text-right font-medium">Bruttomietrendite</th>
                    <th className="py-1 pr-3 text-right font-medium">AfA Jahr 1 (×3)</th>
                    <th className="py-1 text-right font-medium">Herkunft</th>
                  </tr>
                </thead>
                <tbody>
                  {kaeufe.map((k, i) => (
                    <tr key={k.objektId} className="border-b border-border/50">
                      <td className="py-1 pr-3 tabular-nums">{i + 1}</td>
                      <td className="py-1 pr-3 tabular-nums">{k.jahr}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{kreditFormatEUR(k.kaufpreis)}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{kreditFormatEUR(k.eigenmittelbedarf)}</td>
                      <td className="py-1 pr-3 text-right tabular-nums font-semibold text-[#155767]">{kreditFormatEUR(k.eigenmittelAnteil)}</td>
                      <td className="py-1 pr-3 text-right tabular-nums text-muted-foreground">{kreditFormatEUR(k.ausUmschuldung)}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{kreditFormatEUR(k.rate)}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{kreditFormatPct(k.bruttomietrenditePct, 1)}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{kreditFormatEUR(k.afaJahr1)}</td>
                      <td className="py-1 text-right">
                        {k.istGratis
                          ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">gratis</span>
                          : k.gratisAnteilPct < 0.1
                            ? <span className="text-xs text-muted-foreground">eigene Mittel</span>
                            : <span className="text-xs text-muted-foreground">{kreditFormatPct(k.gratisAnteilPct, 0)} Umschuldung</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Die Spalte "Eigenmitteleinsatz (Kauf)" in der Jahresübersicht summiert "davon eigene Tasche" pro Jahr.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <h3 className="mb-3 text-sm font-semibold">Jahresübersicht</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1 pr-3 font-medium">Jahr</th>
                  <th className="py-1 pr-3 text-right font-medium">Wohnungen</th>
                  <th className="py-1 pr-3 text-right font-medium">Portfolio-Wert</th>
                  <th className="py-1 pr-3 text-right font-medium">Restschuld</th>
                  <th className="py-1 pr-3 text-right font-medium">Mieteinnahmen</th>
                  <th className="py-1 pr-3 text-right font-medium">Kreditraten</th>
                  <th className="py-1 pr-3 text-right font-medium">Zinsen</th>
                  <th className="py-1 pr-3 text-right font-medium">AfA</th>
                  <th className="py-1 pr-3 text-right font-medium">Steuereffekt</th>
                  <th className="py-1 pr-3 text-right font-medium">Cashflow netto</th>
                  <th className="py-1 pr-3 text-right font-medium">Eigenmitteleinsatz (Kauf)</th>
                  <th className="py-1 pr-3 text-right font-medium">davon kumuliert</th>
                  <th className="py-1 text-right font-medium">Nettovermögen</th>
                </tr>
              </thead>
              <tbody>
                {jahre.map((j) => (
                  <tr key={j.jahr} className="border-b border-border/50">
                    <td className="py-1 pr-3 tabular-nums">{j.jahr}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{j.anzahlObjekte}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{kreditFormatEUR(j.portfolioWert)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{kreditFormatEUR(j.restschuldGesamt)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{kreditFormatEUR(j.mieteinnahmen)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{kreditFormatEUR(j.kreditratenGesamt)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{kreditFormatEUR(j.zinsenGesamt)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{kreditFormatEUR(j.afaGesamt)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{kreditFormatEUR(j.steuerEffekt)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{kreditFormatEUR(j.cashflowNetto)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{j.eigenmitteleinsatzKauf > 0 ? kreditFormatEUR(j.eigenmitteleinsatzKauf) : "–"}</td>
                    <td className="py-1 pr-3 text-right tabular-nums font-medium">{kreditFormatEUR(j.eigenmitteleinsatzKumuliert)}</td>
                    <td className="py-1 text-right tabular-nums">{kreditFormatEUR(j.nettovermoegen)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-sm font-semibold">
                  <td className="pt-2 pr-3">Summe</td>
                  <td className="pt-2 pr-3" />
                  <td className="pt-2 pr-3" />
                  <td className="pt-2 pr-3" />
                  <td className="pt-2 pr-3 text-right tabular-nums">{kreditFormatEUR(jahre.reduce((s, j) => s + j.mieteinnahmen, 0))}</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{kreditFormatEUR(jahre.reduce((s, j) => s + j.kreditratenGesamt, 0))}</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{kreditFormatEUR(jahre.reduce((s, j) => s + j.zinsenGesamt, 0))}</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{kreditFormatEUR(jahre.reduce((s, j) => s + j.afaGesamt, 0))}</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{kreditFormatEUR(jahre.reduce((s, j) => s + j.steuerEffekt, 0))}</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{kreditFormatEUR(jahre.reduce((s, j) => s + j.cashflowNetto, 0))}</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{kreditFormatEUR(jahre.reduce((s, j) => s + j.eigenmitteleinsatzKauf, 0))}</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{kreditFormatEUR(letztesJahr?.eigenmitteleinsatzKumuliert ?? 0)}</td>
                  <td className="pt-2 text-right tabular-nums">{kreditFormatEUR(letztesJahr?.nettovermoegen ?? 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            "Eigenmitteleinsatz (Kauf)" ist der in diesem Jahr aus eigener Tasche finanzierte Anteil aller Käufe
            (Kapitalbedarf gesamt minus Umschuldungserlös, siehe Kauf-Timeline) — das beantwortet, wie viel eigenes
            Geld in welchem Jahr fließen muss, damit der Plan aufgeht. "davon kumuliert" ist die laufende Summe seit
            Simulationsstart.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Renditen &amp; Leistbarkeit</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Bruttomietrendite (Ø, letztes Jahr)</span>
              <span className="text-lg font-bold tabular-nums">{kreditFormatPct(kennzahlen.bruttomietrenditeSchnittPct, 1)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Nettomietrendite (Ø, letztes Jahr)</span>
              <span className="text-lg font-bold tabular-nums">{kreditFormatPct(kennzahlen.nettomietrenditeSchnittPct, 1)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Eigenkapitalrendite (gesamter Zeitraum)</span>
              <span className="text-lg font-bold tabular-nums">{kreditFormatPct(kennzahlen.eigenkapitalrenditePct, 1)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">IRR der Eigenmittel (p.a.)</span>
              <span className="text-lg font-bold tabular-nums">{kennzahlen.irrPct != null ? kreditFormatPct(kennzahlen.irrPct, 1) : "n. v."}</span>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 border-t pt-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Operativer Cashflow-Breakeven</span>
              <span className="text-lg font-bold tabular-nums">
                {kennzahlen.breakEvenJahr != null ? `Jahr ${kennzahlen.breakEvenJahr}` : "im Zeitraum nicht erreicht"}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Schuldendienstquote / DSTI (Jahr {letztesJahr?.jahr ?? "–"})</span>
              <span className={cn("text-lg font-bold tabular-nums", dstiFarbe)}>{kreditFormatPct(letztesJahr?.dstiPct ?? 0, 1)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Freie Liquidität/Monat (Jahr {letztesJahr?.jahr ?? "–"}, nur Anzeige)</span>
              <span className="text-lg font-bold tabular-nums">{kreditFormatEUR(freieLiquiditaetMonat)}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            DSTI ist reine Anzeige und blockiert keinen Kauf. "Mindest-Resteinkommen" dagegen ist eine harte
            Kaufsperre: Ein cashflow-negatives Portfolio (Miete unter der Kreditrate) ist für sich kein Problem — der
            Fehlbetrag wird von der Sparquote aufgefangen. Kritisch wird es erst, wenn dieser Fehlbetrag vom
            Nettoeinkommen (oben bei "Start & Sparen") abgezogen weniger als das Mindest-Resteinkommen übrig lässt —
            dann kauft die Simulation nicht mehr weiter. DSTI = monatliche Kreditraten aller Objekte, geteilt durch
            Nettoeinkommen + 80&nbsp;% der Mieteinnahmen. Ampel: grün &lt; 40&nbsp;%, gelb 40–50&nbsp;%, rot &gt;
            50&nbsp;%.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Feld label="Mindest-Resteinkommen (€/Monat)" value={mindestResteinkommenMonat} onChange={setMindestResteinkommenMonat} step={100} />
          </div>
        </CardContent>
      </Card>

      {warnungen.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Warnhinweise</h3>
            {warnungen.map((w) => (
              <div key={w} className="rounded-lg border bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                {w}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
