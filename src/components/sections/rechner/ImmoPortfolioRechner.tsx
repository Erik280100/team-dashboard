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

export function ImmoPortfolioRechner({ rechtsform = "privat" }: { rechtsform?: "privat" | "gmbh" }) {
  const istGmbh = rechtsform === "gmbh"

  // Start & Sparen
  const [eigenmittel, setEigenmittel] = useState("40000")
  const [sparbetragMonat, setSparbetragMonat] = useState("500")
  const [guthabenzinsPct, setGuthabenzinsPct] = useState("5")

  // Kauf & Finanzierung
  const [kaufpreisReferenz, setKaufpreisReferenz] = useState("150000")
  const [wohnflaecheM2, setWohnflaecheM2] = useState("45")
  // 80 % statt vormals 90 % — Aufsichtserwartung der FMA (seit Auslaufen der KIM-V zum 30.6.2025
  // als Rahmen fortgeführt: ≥ 20 % Eigenmittel inkl. Nebenkosten), frei überschreibbar (E6).
  const [ltvKaufPct, setLtvKaufPct] = useState("80")
  const [laufzeitJahre, setLaufzeitJahre] = useState("35")
  const [zinssatzPct, setZinssatzPct] = useState("2.85")
  const [mitMakler, setMitMakler] = useState(true)
  const [nkMitfinanziert, setNkMitfinanziert] = useState(true)

  // Miete — als Nettomiete (ohne Betriebskosten, exkl. 10 % USt auf Wohnraumvermietung) zu
  // verstehen (E4); beide Eingabemodi sind so aufeinander abgestimmt, dass sie bei den
  // Default-Werten (45 m²) dieselbe Miete ergeben.
  const [mietModus, setMietModus] = useState<"direkt" | "proM2">("direkt")
  const [mieteMonat, setMieteMonat] = useState("495")
  const [mietpreisProM2, setMietpreisProM2] = useState("11")
  const [indexierungPct, setIndexierungPct] = useState("2")
  const [leerstandPct, setLeerstandPct] = useState("0")
  const [befristet, setBefristet] = useState(false)

  // Kosten
  const [hausverwaltungMonat, setHausverwaltungMonat] = useState("0")
  const [instandhaltungProM2Monat, setInstandhaltungProM2Monat] = useState("1")
  const [sonstigeKostenMonat, setSonstigeKostenMonat] = useState("0")

  // Wertentwicklung & Umschuldung
  const [wertzuwachsPct, setWertzuwachsPct] = useState("2")
  const [umschuldungAlleJahre, setUmschuldungAlleJahre] = useState("5")
  // 80 % statt vormals 100 % — oberes Ende des banküblichen Rahmens von 70–80 % des Verkehrswerts,
  // frei überschreibbar.
  const [beleihungUmschuldungPct, setBeleihungUmschuldungPct] = useState("80")

  // Steuer
  const [grenzsteuersatzPct, setGrenzsteuersatzPct] = useState("40")

  // Nur "gmbh": laufende Gesellschaftskosten und einmalige Gründungskosten (Default analog
  // DEFAULTS_HOLDING_IMMO in holdingImmobilien.ts).
  const [gmbhFixkostenJahr, setGmbhFixkostenJahr] = useState("2500")
  const [gmbhGruendungskostenEinmalig, setGmbhGruendungskostenEinmalig] = useState("3000")

  // Bestand
  const [bestandOffen, setBestandOffen] = useState(false)
  const [bestandAnzahl, setBestandAnzahl] = useState("0")
  const [bestandWert, setBestandWert] = useState("0")
  const [bestandRestschuld, setBestandRestschuld] = useState("0")
  const [bestandRateMonat, setBestandRateMonat] = useState("0")
  const [bestandMieteMonat, setBestandMieteMonat] = useState("0")
  const [bestandRestlaufzeitJahre, setBestandRestlaufzeitJahre] = useState("25")
  const [bestandAnschaffungskosten, setBestandAnschaffungskosten] = useState("0")
  const [bestandAfaJahreVerbraucht, setBestandAfaJahreVerbraucht] = useState("0")

  // Leistbarkeit — lebenshaltungMonat dient auch als harte Kaufsperre (mindestResteinkommenMonat):
  // Deckt ein cashflow-negatives Portfolio den Fehlbetrag nicht aus dem laufenden Sparen, wird er
  // vom Nettoeinkommen abgezogen. Bleiben davon weniger als die Fixkosten/Lebenshaltung übrig, wird
  // kein weiterer Kauf mehr getätigt. Kein eigenes Feld dafür, da es inhaltlich dasselbe ist.
  const [nettoeinkommenMonat, setNettoeinkommenMonat] = useState("3500")
  const [lebenshaltungMonat, setLebenshaltungMonat] = useState("1800")

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
  // Eingabe-Klemmung gegen offensichtlich unsinnige Werte (C8): Leerstand > 100 % würde negative
  // Miete erzeugen, negative Indexierung/Sparbetrag/Zinssatz sind zwar theoretisch denkbar, aber
  // ein Tippfehler ist hier wahrscheinlicher als eine bewusste Eingabe.
  const leerstandClamped = Math.min(100, Math.max(0, n(leerstandPct)))
  const indexierungClamped = Math.max(-5, Math.min(20, n(indexierungPct)))
  const sparbetragClamped = Math.max(0, n(sparbetragMonat))
  const zinssatzClamped = Math.max(0, n(zinssatzPct))

  const eingabe: ImmoPortfolioEingabe = useMemo(() => ({
    eigenmittel: n(eigenmittel), sparbetragMonat: sparbetragClamped, guthabenzinsPct: n(guthabenzinsPct),
    kaufpreisReferenz: n(kaufpreisReferenz), wohnflaecheM2: n(wohnflaecheM2),
    ltvKaufPct: ltvClamped, laufzeitJahre: laufzeitClamped,
    zinssatzPct: zinssatzClamped, mitMakler, nkMitfinanziert,
    mietModus, mieteMonat: n(mieteMonat), mietpreisProM2: n(mietpreisProM2),
    indexierungPct: indexierungClamped, leerstandPct: leerstandClamped,
    befristet,
    hausverwaltungMonat: n(hausverwaltungMonat), instandhaltungProM2Monat: n(instandhaltungProM2Monat),
    sonstigeKostenMonat: n(sonstigeKostenMonat),
    wertzuwachsPct: n(wertzuwachsPct), umschuldungAlleJahre: Math.max(1, n(umschuldungAlleJahre) || 5),
    beleihungUmschuldungPct: beleihungClamped,
    grenzsteuersatzPct: Math.min(55, Math.max(0, n(grenzsteuersatzPct))),
    gebaeudeanteilPct: saetze.gebaeudeanteilPct, afaSatzPct: saetze.afaSatzPct,
    bestandAnzahl: Math.max(0, Math.round(n(bestandAnzahl))), bestandWert: n(bestandWert),
    bestandRestschuld: n(bestandRestschuld), bestandRateMonat: n(bestandRateMonat),
    bestandMieteMonat: n(bestandMieteMonat), bestandRestlaufzeitJahre: Math.max(1, n(bestandRestlaufzeitJahre) || 25),
    bestandAnschaffungskosten: n(bestandAnschaffungskosten),
    bestandAfaJahreVerbraucht: Math.max(0, n(bestandAfaJahreVerbraucht)),
    // Bei "gmbh" wirken sich diese drei Felder auf die EIGENE Simulation nicht aus (eine
    // Gesellschaft hat kein Gehalt — die Kauf-/Umschuldungssperre ist für sie in immoPortfolio.ts
    // vollständig deaktiviert, siehe die dortigen `!istGmbh`-Prüfungen). Sie bleiben trotzdem
    // echte, vom Nutzer editierbare Werte (nicht auf 0 gezwungen), weil dieselbe eingabe/
    // eingabeStand auch als Basis für die Gegenüberstellung mit dem Einzelunternehmen dient
    // (vergleichPrivat weiter unten) — DORT muss ein realistisches Einkommen einfließen können,
    // sonst würde die Vergleichsperson unrealistisch auf 0 € Einkommen gesetzt.
    nettoeinkommenMonat: n(nettoeinkommenMonat),
    lebenshaltungMonat: n(lebenshaltungMonat),
    mindestResteinkommenMonat: n(lebenshaltungMonat),
    horizontJahre: horizontClamped, saetze,
    rechtsform,
    gmbhFixkostenJahr: istGmbh ? n(gmbhFixkostenJahr) : 0,
    gmbhGruendungskostenEinmalig: istGmbh ? n(gmbhGruendungskostenEinmalig) : 0,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    eigenmittel, sparbetragClamped, guthabenzinsPct, kaufpreisReferenz, wohnflaecheM2,
    ltvClamped, laufzeitClamped, zinssatzClamped, mitMakler, nkMitfinanziert, mietModus, mieteMonat, mietpreisProM2,
    indexierungClamped, leerstandClamped, befristet,
    hausverwaltungMonat, instandhaltungProM2Monat, sonstigeKostenMonat,
    wertzuwachsPct, umschuldungAlleJahre, beleihungClamped, grenzsteuersatzPct, saetze,
    bestandAnzahl, bestandWert, bestandRestschuld, bestandRateMonat, bestandMieteMonat, bestandRestlaufzeitJahre,
    bestandAnschaffungskosten, bestandAfaJahreVerbraucht,
    nettoeinkommenMonat, lebenshaltungMonat, horizontClamped,
    rechtsform, istGmbh, gmbhFixkostenJahr, gmbhGruendungskostenEinmalig,
  ])

  // Keine automatische Neuberechnung mehr bei jeder Eingabe — die Simulation (420 Monate,
  // Chart-Neuzeichnung, Tabellen) läuft nur noch, wenn "Berechnen" geklickt wird. eingabeStand
  // hält fest, mit welchem Eingabestand das aktuell angezeigte ergebnis berechnet wurde; solange
  // sich seither etwas geändert hat (eingabe !== eingabeStand), gilt das Ergebnis als veraltet.
  const [eingabeStand, setEingabeStand] = useState<ImmoPortfolioEingabe>(eingabe)
  const [ergebnis, setErgebnis] = useState(() => simuliereImmoPortfolio(eingabe))
  const veraltet = eingabe !== eingabeStand
  const kaufpreisZuNiedrig = eingabe.kaufpreisReferenz <= KAUFPREIS_MINDESTGRENZE

  function berechnen() {
    setEingabeStand(eingabe)
    setErgebnis(simuliereImmoPortfolio(eingabe))
  }
  const { jahre, kaeufe, meilensteine, kennzahlen, warnungen } = ergebnis
  const letztesJahr = jahre[jahre.length - 1]

  // Gegenüberstellung mit dem Einzelunternehmen (nur "gmbh"): dieselbe Simulation, aber mit
  // rechtsform "privat" und ohne die GmbH-spezifischen Fixkosten — läuft nur ein zweites Mal, wenn
  // auch die Hauptsimulation neu läuft ("Berechnen"-Gating über eingabeStand, siehe oben).
  const vergleichPrivat = useMemo(
    () => (istGmbh ? simuliereImmoPortfolio({ ...eingabeStand, rechtsform: "privat", gmbhFixkostenJahr: 0, gmbhGruendungskostenEinmalig: 0 }) : null),
    [eingabeStand, istGmbh]
  )

  const kaufJahrInfo = useMemo(() => {
    const map = new Map<number, boolean>()
    for (const k of kaeufe) map.set(k.jahr, (map.get(k.jahr) ?? false) || k.istGratis)
    return map
  }, [kaeufe])

  // Als Prop-Objekte memoisiert (statt inline in der JSX), damit react-chartjs-2 zwischen zwei
  // Klicks auf "Berechnen" (wenn sich jahre/kaeufe also gar nicht ändern) exakt dieselben
  // Objektreferenzen bekommt und den Chart entsprechend gar nicht neu zeichnet.
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
      {
        label: "Nettovermögen nach Verkaufssteuern", data: jahre.map((j) => j.nettovermoegenNachSteuer),
        borderColor: "#B5624A", borderDash: [5, 4], backgroundColor: "transparent", borderWidth: 2,
        tension: 0.1, fill: false, pointRadius: 0,
      },
      ...(istGmbh
        ? [{
          label: "Nettovermögen nach Vollausschüttung", data: jahre.map((j) => j.nettovermoegenNachAusschuettung ?? 0),
          borderColor: "#6b7280", borderDash: [2, 3], backgroundColor: "transparent", borderWidth: 2,
          tension: 0.1, fill: false, pointRadius: 0,
        }]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [jahre, kaufJahrInfo, istGmbh])

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

  // C4: letztesJahr.mieteinnahmen ist bereits leerstandsbereinigt (kein zusätzlicher 0,8-Abschlag
  // nötig, der war ein Doppelabzug) und die Bewirtschaftungskosten fehlten bisher ganz. Bei "gmbh"
  // fließen Netto-Haushaltseinkommen/Lebenshaltung nicht ein (siehe eingabe-Erzeugung oben).
  const freieLiquiditaetMonat = letztesJahr
    ? (istGmbh ? 0 : n(nettoeinkommenMonat)) + (letztesJahr.mieteinnahmen - letztesJahr.bewirtschaftungskosten) / 12
      - (istGmbh ? 0 : n(lebenshaltungMonat)) - letztesJahr.kreditratenGesamt / 12
    : 0
  const dstiAmpel = letztesJahr
    ? letztesJahr.dstiPct < 40 ? "grün" : letztesJahr.dstiPct <= 50 ? "gelb" : "rot"
    : "grün"
  const dstiFarbe = dstiAmpel === "grün" ? "text-emerald-600" : dstiAmpel === "gelb" ? "text-amber-600" : "text-red-600"

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
        <strong>Anlegerwohnungs-Portfolio-Rechner{istGmbh ? " (GmbH)" : ""}:</strong> Simuliert, wie ein Wohnungsportfolio über die Zeit wächst und sich weitere Wohnungen von selbst finanzieren.{" "}
        {istGmbh
          ? "Steuerliche Betrachtung als Kapitalgesellschaft: 23 % KöSt statt Grenzsteuersatz/ImmoESt, Verlustvortrag statt Sofortgutschrift, KESt erst bei einer Ausschüttung — siehe die Gegenüberstellung mit dem Einzelunternehmen weiter unten."
          : "Alle Eingaben und die Portfolio-Mechanik sind identisch zum Rechner \"Anlegerwohnungen GmbH\" — nur die steuerliche Betrachtung unterscheidet sich (natürliche Person statt Kapitalgesellschaft)."}
      </div>

      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-lg border bg-card/95 px-4 py-3 shadow-sm backdrop-blur">
        <button type="button" onClick={berechnen}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors",
            veraltet ? "bg-primary hover:bg-primary/90" : "bg-primary/60"
          )}>
          Berechnen
        </button>
        <span className="text-xs text-muted-foreground">
          {veraltet
            ? "Eingaben geändert — Ergebnis unten ist noch der alte Stand, bis du auf \"Berechnen\" klickst."
            : "Ergebnis aktuell."}
        </span>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Start &amp; Sparen</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Feld label="Aktuelle Eigenmittel (€)" value={eigenmittel} onChange={setEigenmittel} step={1000} />
            <Feld label="Sparbetrag (€/Monat)" value={sparbetragMonat} onChange={setSparbetragMonat} step={50} />
            <Feld
              label={istGmbh ? "Guthabenzinsen (% p.a. — ungekürzt, KöSt-pflichtig statt KESt)" : "Guthabenzinsen, brutto (% p.a. — 25 % KESt wird automatisch abgezogen)"}
              value={guthabenzinsPct} onChange={setGuthabenzinsPct} step={0.1} suffix="%"
            />
            <Feld label="Horizont (Jahre)" value={horizontJahre} onChange={setHorizontJahre} step={1} suffix="J" />
            <Feld
              label={istGmbh ? "Netto-Haushaltseinkommen (nur für die Gegenüberstellung mit dem Einzelunternehmen, €/Monat)" : "Netto-Haushaltseinkommen (€/Monat)"}
              value={nettoeinkommenMonat} onChange={setNettoeinkommenMonat} step={100}
            />
            <Feld
              label={istGmbh ? "Fixkosten / Lebenshaltung (nur für die Gegenüberstellung, €/Monat)" : "Fixkosten / Lebenshaltung (€/Monat)"}
              value={lebenshaltungMonat} onChange={setLebenshaltungMonat} step={100}
            />
          </div>
          {istGmbh && (
            <p className="text-xs text-muted-foreground">
              Für die GmbH selbst sind Netto-Haushaltseinkommen und Fixkosten/Lebenshaltung ohne Wirkung — eine
              Gesellschaft hat kein Gehalt, für Käufe und Umschuldungen zählt nur das verfügbare Kapital (Eigenmittel,
              Sparbetrag, Mietüberschüsse); ein laufender Fehlbetrag wird automatisch als weitere Einlage
              nachgeschossen (siehe Warnhinweise). Die beiden Felder fließen ausschließlich in die
              Gegenüberstellungs-Karte weiter unten ein, wo sie das Verhalten des verglichenen Einzelunternehmens
              bestimmen.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Wohnung &amp; Finanzierung (gilt für jeden künftigen Kauf)</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Feld label="Kaufpreis heute (€)" value={kaufpreisReferenz} onChange={setKaufpreisReferenz} step={5000} />
            <Feld label="Wohnfläche (m²)" value={wohnflaecheM2} onChange={setWohnflaecheM2} step={1} suffix="m²" />
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
              Kaufpreis unter {kreditFormatEUR(KAUFPREIS_MINDESTGRENZE)} — es finden keine neuen Käufe mehr statt
              (Sparen, Guthabenzinsen und ein etwaiger Bestand laufen normal weiter), bis ein realistischer
              Kaufpreis eingegeben ist.
            </div>
          )}
          {ltvClamped > 80 && (
            <div className="rounded-lg border bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Beleihung beim Kauf über 80 % ist die von dir gewählte Modellannahme — seit Auslaufen der KIM-V zum
              30.6.2025 erwartet die FMA als Aufsichtsrahmen weiterhin ≥ 20 % Eigenmittel inkl. Nebenkosten.
            </div>
          )}
          {laufzeitClamped > 35 && (
            <div className="rounded-lg border bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Eine Laufzeit über 35 Jahre liegt über dem von der FMA erwarteten Rahmen.
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
            <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
              Nettomiete (ohne Betriebskosten, exkl. 10 % USt auf Wohnraumvermietung)
              <div className="flex flex-wrap items-center gap-2">
                <PillGroup value={mietModus} onChange={setMietModus}
                  options={[{ value: "direkt", label: "Betrag/Monat" }, { value: "proM2", label: "€/m²" }]} />
                {mietModus === "direkt"
                  ? <input type="number" step={25} value={mieteMonat} onChange={(e) => setMieteMonat(e.target.value)} className={cn(INPUT_CLASS, "w-28")} />
                  : <input type="number" step={0.1} value={mietpreisProM2} onChange={(e) => setMietpreisProM2(e.target.value)} className={cn(INPUT_CLASS, "w-24")} />}
              </div>
            </div>
            <Feld label="Mietindexierung (% p.a.)" value={indexierungPct} onChange={setIndexierungPct} step={0.1} suffix="%" />
            <Feld label="Leerstand/Mietausfall (%)" value={leerstandPct} onChange={setLeerstandPct} step={0.5} suffix="%" />
            <Feld label="Hausverwaltung (€/Monat)" value={hausverwaltungMonat} onChange={setHausverwaltungMonat} step={5} />
            <Feld label="Instandhaltung (€/m²/Monat)" value={instandhaltungProM2Monat} onChange={setInstandhaltungProM2Monat} step={0.1} />
            <Feld label="Sonstige Kosten (€/Monat)" value={sonstigeKostenMonat} onChange={setSonstigeKostenMonat} step={5} />
            <label className="flex items-center gap-1.5 text-sm sm:col-span-2">
              <input type="checkbox" checked={befristet} onChange={(e) => setBefristet(e.target.checked)} className="size-4" />
              Befristet vermietet (−25 % Befristungsabschlag auf die Anfangsmiete künftiger Käufe)
            </label>
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
              {istGmbh ? "Grenzsteuersatz (nur für die Gegenüberstellung mit dem Einzelunternehmen, %)" : "Grenzsteuersatz (%)"}
              <div className="flex flex-wrap items-center gap-2">
                <input type="number" step={1} value={grenzsteuersatzPct} onChange={(e) => setGrenzsteuersatzPct(e.target.value)} className={cn(INPUT_CLASS, "w-20")} />
                <PillGroup value={grenzsteuersatzPct as never}
                  options={GRENZSTEUER_PRESETS.map((p) => ({ value: String(p) as never, label: `${p} %` }))}
                  onChange={(v) => setGrenzsteuersatzPct(v)} />
              </div>
            </label>
            {istGmbh && (
              <>
                <Feld label="Laufende Gesellschaftskosten (Bilanz, StB, Firmenbuch, €/Jahr)" value={gmbhFixkostenJahr} onChange={setGmbhFixkostenJahr} step={100} />
                <Feld label="Gründungskosten, einmalig (Notar, Firmenbuch, €)" value={gmbhGruendungskostenEinmalig} onChange={setGmbhGruendungskostenEinmalig} step={500} />
              </>
            )}
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
              <Feld label="Historische Anschaffungskosten gesamt (€) — Basis für AfA & ImmoESt" value={bestandAnschaffungskosten} onChange={setBestandAnschaffungskosten} step={5000} />
              <Feld label="Davon bereits abgeschriebene Jahre" value={bestandAfaJahreVerbraucht} onChange={setBestandAfaJahreVerbraucht} step={1} suffix="J" />
            </div>
          )}
          {bestandOffen && n(bestandAnschaffungskosten) === 0 && n(bestandWert) > 0 && (
            <div className="rounded-lg border bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Ohne historische Anschaffungskosten wird für den Bestand keine AfA angesetzt und die ImmoESt-Basis
              überschätzt. Falls unbekannt, ersatzweise den Verkehrswert eintragen.
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
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
                    Gebäudeanteil am Kaufpreis
                    <div className="flex flex-wrap items-center gap-2">
                      <input type="number" step={1} value={String(saetze.gebaeudeanteilPct)}
                        onChange={(e) => satzSetter("gebaeudeanteilPct")(e.target.value)} className={cn(INPUT_CLASS, "w-20")} />
                      <span>%</span>
                      <PillGroup value={String(saetze.gebaeudeanteilPct) as never}
                        options={[
                          { value: "80" as never, label: "80 % (Kleingemeinde, Baulandpreis < 400 €/m²)" },
                          { value: "70" as never, label: "70 % (Gebäude > 10 Einheiten)" },
                          { value: "60" as never, label: "60 % (Gebäude ≤ 10 Einheiten, sonst)" },
                        ]}
                        onChange={(v) => satzSetter("gebaeudeanteilPct")(v)} />
                    </div>
                  </label>
                  <Feld label="AfA-Satz (linear, ab 3. Jahr)" value={String(saetze.afaSatzPct)} onChange={satzSetter("afaSatzPct")} suffix="%" step={0.1} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Nach der Grundanteilverordnung 2016 sind 80 % Gebäudeanteil nur zulässig, wenn die Gemeinde unter
                  100.000 Einwohner hat UND der durchschnittliche Baulandpreis unter 400 €/m² liegt — für eine
                  Vorsorgewohnung in einer Landeshauptstadt sind meist 70 % oder 60 % korrekt.
                </p>
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
        <KPI label="davon 100 % gratis (voll aus Umschuldung finanziert)" value={String(kennzahlen.anzahlGratis)} accent />
        <KPI
          label="Gratis-Äquivalent (alle Umschuldungsanteile zusammengezählt)"
          value={kennzahlen.gratisAequivalentAnzahl.toLocaleString("de-AT", { maximumFractionDigits: 1 })}
          accent
        />
        <KPI
          label="Kapitalbedarf gesamt aus Umschuldung gedeckt"
          value={`${kreditFormatPct(kennzahlen.umschuldungsAnteilGesamtPct, 0)} (${kreditFormatEUR(kennzahlen.ausUmschuldungGesamt)})`}
        />
        <KPI label="Portfolio-Verkehrswert" value={kreditFormatEUR(letztesJahr?.portfolioWert ?? 0)} />
        <KPI label="Nettovermögen (vor Verkauf)" value={kreditFormatEUR(letztesJahr?.nettovermoegen ?? 0)} />
        {istGmbh && (
          <KPI
            label="Nettovermögen nach Vollausschüttung (KöSt + 27,5 % KESt)"
            value={kreditFormatEUR(letztesJahr?.nettovermoegenNachAusschuettung ?? 0)}
          />
        )}
        <KPI
          label={`Monatlicher Cashflow bei Weitervermietung (statt Verkauf, Jahr ${letztesJahr?.jahr ?? "–"})`}
          value={kreditFormatEUR((letztesJahr?.cashflowNetto ?? 0) / 12)}
        />
      </div>

      {istGmbh && vergleichPrivat && (
        <Card>
          <CardContent>
            <h3 className="mb-1 text-sm font-semibold">Gegenüberstellung: GmbH vs. Einzelunternehmen</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Dieselben Eingaben, einmal als Kapitalgesellschaft (diese Seite) und einmal als natürliche Person
              gerechnet — bei sonst identischer Portfolio-Mechanik (Käufe, Miete, Wertentwicklung, Umschuldung).
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-1 pr-3 font-medium">Nach</th>
                    {meilensteine.map((m) => <th key={m.jahr} className="py-1 pr-3 text-right font-medium">{m.jahr} Jahren</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-3 text-muted-foreground">Wohnungen (GmbH / EU)</td>
                    {meilensteine.map((m, i) => (
                      <td key={m.jahr} className="py-1 pr-3 text-right tabular-nums">
                        {m.anzahlObjekte} / {vergleichPrivat.meilensteine[i]?.anzahlObjekte ?? "–"}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-3 text-muted-foreground">Portfolio-Verkehrswert (GmbH / EU)</td>
                    {meilensteine.map((m, i) => (
                      <td key={m.jahr} className="py-1 pr-3 text-right tabular-nums">
                        {kreditFormatEUR(m.portfolioWert)} / {kreditFormatEUR(vergleichPrivat.meilensteine[i]?.portfolioWert ?? 0)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-3 text-muted-foreground">Nettovermögen vor Verkauf (GmbH / EU)</td>
                    {meilensteine.map((m, i) => (
                      <td key={m.jahr} className="py-1 pr-3 text-right tabular-nums">
                        {kreditFormatEUR(m.nettovermoegen)} / {kreditFormatEUR(vergleichPrivat.meilensteine[i]?.nettovermoegen ?? 0)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-3 text-muted-foreground">Nettovermögen nach Verkaufssteuer (KöSt / ImmoESt)</td>
                    {meilensteine.map((m, i) => (
                      <td key={m.jahr} className="py-1 pr-3 text-right tabular-nums">
                        {kreditFormatEUR(m.nettovermoegenNachSteuer)} / {kreditFormatEUR(vergleichPrivat.meilensteine[i]?.nettovermoegenNachSteuer ?? 0)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1 pr-3 text-muted-foreground">GmbH nach Vollausschüttung (vs. EU-Nettovermögen n. St.)</td>
                    {meilensteine.map((m, i) => (
                      <td key={m.jahr} className="py-1 pr-3 text-right tabular-nums font-semibold text-[#155767]">
                        {kreditFormatEUR(m.nettovermoegenNachAusschuettung ?? 0)} / {kreditFormatEUR(vergleichPrivat.meilensteine[i]?.nettovermoegenNachSteuer ?? 0)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-1 pr-3 text-muted-foreground">Differenz (GmbH n. Vollausschüttung − EU n. St.)</td>
                    {meilensteine.map((m, i) => {
                      const diff = (m.nettovermoegenNachAusschuettung ?? 0) - (vergleichPrivat.meilensteine[i]?.nettovermoegenNachSteuer ?? 0)
                      return (
                        <td key={m.jahr} className={cn("py-1 pr-3 text-right tabular-nums font-medium", diff >= 0 ? "text-emerald-600" : "text-red-600")}>
                          {diff >= 0 ? "+" : ""}{kreditFormatEUR(diff)}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Zwei gegenläufige Effekte wirken hier gleichzeitig: Eine GmbH bekommt für Verlustjahre KEINE
              Sofortgutschrift wie das Einzelunternehmen (nur einen Verlustvortrag) und zahlt selbst in einem
              Verlustjahr die Mindest-KöSt (500&nbsp;€/Jahr) — das bremst gerade in der Anfangsphase, wie schnell sich
              weitere Wohnungen "von selbst" finanzieren, und führt in der Simulation oft zu einem kleineren
              Portfolio als beim Einzelunternehmen. Auf der reinen Steuersatz-Seite ist die GmbH dagegen oft günstiger
              (23&nbsp;% KöSt statt Grenzsteuersatz/ImmoESt), was sich zeigt, solange das Geld in der Gesellschaft
              bleibt ("vor Verkauf"/"nach Verkaufssteuer"). Eine Vollausschüttung (letzte Zeile) holt zusätzlich
              27,5&nbsp;% KESt auf den über die Einlagen hinausgehenden Teil nach. Welcher Effekt am Ende überwiegt,
              hängt stark von Grenzsteuersatz, Kaufpreis und Horizont ab — die Zahlen oben zeigen das tatsächliche
              Ergebnis für die aktuell eingestellten Werte, eine pauschale Regel gibt es nicht.
            </p>
          </CardContent>
        </Card>
      )}

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
                  {(
                    [
                      ["Wohnungen gesamt", (m) => String(m.anzahlObjekte)],
                      ["davon gratis", (m) => String(m.davonGratis)],
                      ["Portfolio-Verkehrswert", (m) => kreditFormatEUR(m.portfolioWert)],
                      ["Restschuld gesamt", (m) => kreditFormatEUR(m.restschuldGesamt)],
                      ["Nettovermögen (vor Verkauf)", (m) => kreditFormatEUR(m.nettovermoegen)],
                      ["Nettovermögen (nach Verkaufssteuern)", (m) => kreditFormatEUR(m.nettovermoegenNachSteuer)],
                      istGmbh
                        ? ["Nettovermögen (nach Vollausschüttung)", (m) => kreditFormatEUR(m.nettovermoegenNachAusschuettung ?? 0)]
                        : null,
                      ["Jahresmiete", (m) => kreditFormatEUR(m.jahresmiete)],
                      ["Jahres-AfA", (m) => kreditFormatEUR(m.jahresAfa)],
                      ["Jahres-Cashflow (netto)", (m) => kreditFormatEUR(m.jahresCashflow)],
                    ] satisfies ([string, (m: typeof meilensteine[number]) => string] | null)[]
                  ).filter((zeile): zeile is [string, (m: typeof meilensteine[number]) => string] => zeile !== null)
                    .map(([label, fmt]) => (
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
                          ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">100 % gratis</span>
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
                  <th className="py-1 pr-3 text-right font-medium">
                    {istGmbh ? "Kosten (Bewirtschaftung + Gesellschaft)" : "Bewirtschaftungskosten"}
                  </th>
                  <th className="py-1 pr-3 text-right font-medium">Kreditraten</th>
                  <th className="py-1 pr-3 text-right font-medium">Zinsen</th>
                  <th className="py-1 pr-3 text-right font-medium">AfA</th>
                  <th className="py-1 pr-3 text-right font-medium">Steuereffekt</th>
                  <th className="py-1 pr-3 text-right font-medium">Cashflow netto</th>
                  <th className="py-1 pr-3 text-right font-medium">Eigenmitteleinsatz (Kauf)</th>
                  <th className="py-1 pr-3 text-right font-medium">davon kumuliert</th>
                  <th className="py-1 pr-3 text-right font-medium">Nettovermögen</th>
                  <th className="py-1 text-right font-medium">Nettovermögen (n. St.)</th>
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
                    <td className="py-1 pr-3 text-right tabular-nums text-muted-foreground">{kreditFormatEUR(j.bewirtschaftungskosten)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{kreditFormatEUR(j.kreditratenGesamt)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{kreditFormatEUR(j.zinsenGesamt)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{kreditFormatEUR(j.afaGesamt)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{kreditFormatEUR(j.steuerEffekt)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{kreditFormatEUR(j.cashflowNetto)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{j.eigenmitteleinsatzKauf > 0 ? kreditFormatEUR(j.eigenmitteleinsatzKauf) : "–"}</td>
                    <td className="py-1 pr-3 text-right tabular-nums font-medium">{kreditFormatEUR(j.eigenmitteleinsatzKumuliert)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{kreditFormatEUR(j.nettovermoegen)}</td>
                    <td className="py-1 text-right tabular-nums text-muted-foreground">{kreditFormatEUR(j.nettovermoegenNachSteuer)}</td>
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
                  <td className="pt-2 pr-3 text-right tabular-nums text-muted-foreground">{kreditFormatEUR(jahre.reduce((s, j) => s + j.bewirtschaftungskosten, 0))}</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{kreditFormatEUR(jahre.reduce((s, j) => s + j.kreditratenGesamt, 0))}</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{kreditFormatEUR(jahre.reduce((s, j) => s + j.zinsenGesamt, 0))}</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{kreditFormatEUR(jahre.reduce((s, j) => s + j.afaGesamt, 0))}</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{kreditFormatEUR(jahre.reduce((s, j) => s + j.steuerEffekt, 0))}</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{kreditFormatEUR(jahre.reduce((s, j) => s + j.cashflowNetto, 0))}</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{kreditFormatEUR(jahre.reduce((s, j) => s + j.eigenmitteleinsatzKauf, 0))}</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{kreditFormatEUR(letztesJahr?.eigenmitteleinsatzKumuliert ?? 0)}</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{kreditFormatEUR(letztesJahr?.nettovermoegen ?? 0)}</td>
                  <td className="pt-2 text-right tabular-nums text-muted-foreground">{kreditFormatEUR(letztesJahr?.nettovermoegenNachSteuer ?? 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            "Eigenmitteleinsatz (Kauf)" ist der in diesem Jahr aus eigener Tasche finanzierte Anteil aller Käufe
            (Kapitalbedarf gesamt minus Umschuldungserlös, siehe Kauf-Timeline) — das beantwortet, wie viel eigenes
            Geld in welchem Jahr fließen muss, damit der Plan aufgeht. "davon kumuliert" ist die laufende Summe seit
            Simulationsstart.
            {istGmbh && (
              <> "Kosten" enthält neben Hausverwaltung/Instandhaltung/Sonstigem auch die laufenden
                Gesellschaftskosten (Bilanz, StB, Firmenbuch) sowie im ersten Jahr die einmaligen Gründungskosten —
                deshalb kann der Cashflow trotz Miete über der Kreditrate negativ sein, solange diese Fixkosten die
                Differenz übersteigen.</>
            )}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Renditen &amp; Leistbarkeit</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Bruttomietrendite (aktuell, bezogen auf Portfolio-Verkehrswert)</span>
              <span className="text-lg font-bold tabular-nums">{kreditFormatPct(kennzahlen.bruttomietrenditeSchnittPct, 1)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Nettomietrendite (aktuell, bezogen auf Portfolio-Verkehrswert)</span>
              <span className="text-lg font-bold tabular-nums">{kreditFormatPct(kennzahlen.nettomietrenditeSchnittPct, 1)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                Eigenkapitalrendite, vor / nach Verkaufssteuern{istGmbh ? " / nach Vollausschüttung" : ""}
              </span>
              <span className="text-lg font-bold tabular-nums">
                {kreditFormatPct(kennzahlen.eigenkapitalrenditePct, 1)}
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">/ {kreditFormatPct(kennzahlen.eigenkapitalrenditeNachSteuerPct, 1)}</span>
                {istGmbh && (
                  <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                    / {kennzahlen.eigenkapitalrenditeNachAusschuettungPct != null ? kreditFormatPct(kennzahlen.eigenkapitalrenditeNachAusschuettungPct, 1) : "n. v."}
                  </span>
                )}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                IRR der Eigenmittel (p.a.), vor / nach Verkaufssteuern{istGmbh ? " / nach Vollausschüttung" : ""}
              </span>
              <span className="text-lg font-bold tabular-nums">
                {kennzahlen.irrPct != null ? kreditFormatPct(kennzahlen.irrPct, 1) : "n. v."}
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                  / {kennzahlen.irrNachSteuerPct != null ? kreditFormatPct(kennzahlen.irrNachSteuerPct, 1) : "n. v."}
                </span>
                {istGmbh && (
                  <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                    / {kennzahlen.irrNachAusschuettungPct != null ? kreditFormatPct(kennzahlen.irrNachAusschuettungPct, 1) : "n. v."}
                  </span>
                )}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {istGmbh
              ? <>
                  "Nach Verkaufssteuern" unterstellt einen gedachten Verkauf des GESAMTEN Portfolios zum jeweiligen
                  Zeitpunkt, mit 23&nbsp;% KöSt auf den SALDIERTEN Veräußerungsgewinn (Verlust eines Objekts mindert
                  den Gewinn eines anderen), unter Nutzung eines etwaigen Verlustvortrags. "Nach Vollausschüttung"
                  unterstellt zusätzlich eine vollständige Ausschüttung ans Privatvermögen (+ 27,5&nbsp;% KESt auf den
                  Teil oberhalb der kumulierten Einlagen) — der eigentliche Vergleichspunkt zum Einzelunternehmen.
                  Vereinfachung: keine 4,2&nbsp;%-Pauschale für Altvermögen.
                </>
              : <>
                  "Nach Verkaufssteuern" unterstellt einen gedachten Verkauf des GESAMTEN Portfolios zum jeweiligen
                  Zeitpunkt, mit 30&nbsp;% ImmoESt auf Verkehrswert − Anschaffungskosten + kumulierte AfA je Objekt
                  (§ 30a EStG). Vereinfachung: keine 4,2&nbsp;%-Pauschale für Altvermögen, kein gewerblicher
                  Grundstückshandel berücksichtigt.
                </>}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 border-t pt-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Operativer Cashflow-Breakeven</span>
              <span className="text-lg font-bold tabular-nums">
                {kennzahlen.breakEvenJahr != null ? `Jahr ${kennzahlen.breakEvenJahr}` : "im Zeitraum nicht erreicht"}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                {istGmbh ? "Mietdeckungsgrad (Kreditraten / Mieteinnahmen)" : "Schuldendienstquote / DSTI"} (Jahr {letztesJahr?.jahr ?? "–"})
              </span>
              <span className={cn("text-lg font-bold tabular-nums", dstiFarbe)}>{kreditFormatPct(letztesJahr?.dstiPct ?? 0, 1)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                {istGmbh ? "Operativer Cashflow/Monat (vor Steuer, nur Anzeige)" : "Freie Liquidität/Monat (nur Anzeige)"} (Jahr {letztesJahr?.jahr ?? "–"})
              </span>
              <span className="text-lg font-bold tabular-nums">{kreditFormatEUR(freieLiquiditaetMonat)}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {istGmbh
              ? <>
                  Beide Werte sind reine Anzeige und blockieren keinen Kauf — bei einer GmbH gibt es kein
                  Netto-Haushaltseinkommen, das eine harte Kaufsperre begründen könnte. Ein cashflow-negatives
                  Portfolio ist deshalb für sich kein Problem: Ein laufender Fehlbetrag wird automatisch als
                  weitere Einlage nachgeschossen (siehe Warnhinweise), statt einen Kauf zu blockieren. Der
                  Mietdeckungsgrad = monatliche Kreditraten aller Objekte, geteilt durch 80&nbsp;% der
                  Mieteinnahmen. Ampel: grün &lt; 40&nbsp;%, gelb 40–50&nbsp;%, rot &gt; 50&nbsp;%.
                </>
              : <>
                  DSTI ist reine Anzeige und blockiert keinen Kauf. Die Fixkosten/Lebenshaltung (oben bei "Start
                  &amp; Sparen") dagegen wirken als harte Kaufsperre: Ein cashflow-negatives Portfolio (Miete unter
                  der Kreditrate) ist für sich kein Problem — der Fehlbetrag wird von der Sparquote aufgefangen.
                  Kritisch wird es erst, wenn dieser Fehlbetrag vom Nettoeinkommen abgezogen weniger als die
                  Fixkosten/Lebenshaltung übrig lässt — dann kauft die Simulation nicht mehr weiter. DSTI =
                  monatliche Kreditraten aller Objekte, geteilt durch Nettoeinkommen + 80&nbsp;% der Mieteinnahmen.
                  Ampel: grün &lt; 40&nbsp;%, gelb 40–50&nbsp;%, rot &gt; 50&nbsp;%.
                </>}
          </p>
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
