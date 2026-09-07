// Rechtsform-Vergleich Einzelunternehmer / GmbH / Zypern-Ltd — siehe src/lib/calc/gmbhVsEu.ts
// und src/lib/calc/zypernLtd.ts für die Rechenlogik, die verwendeten Sätze (Stand 2026) und
// die dort dokumentierten Vereinfachungen. Wichtig zur Zypern-Spalte: sie rechnet nur dann
// mit den echten zypriotischen Sätzen, wenn die Checkbox "Wohnsitz wirklich verlegt" aktiv
// ist — sonst gilt der Ort der Geschäftsleitung als Österreich (§ 1 KStG/DBA) und die Spalte
// zeigt bewusst dasselbe Ergebnis wie eine österreichische GmbH, nur mit den zusätzlichen
// zypriotischen Fixkosten obendrauf, um vorzuführen, dass eine bloße Firmengründung in
// Zypern ohne echten Umzug keinen Steuervorteil bringt.
import "@/lib/chartSetup"
import { useMemo, useState } from "react"
import { Line } from "react-chartjs-2"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { kreditFormatEUR, kreditFormatPct } from "@/lib/calc/kredit"
import {
  DEFAULTS, EU_BILANZIERUNGSPFLICHT_UMSATZ, KLEINUNTERNEHMERGRENZE_UST,
  autoAfaJaehrlich, berechneEu, berechneGmbh, berechneGruendungsVergleich,
  type GemeinsameEingabe, type GmbhSpezifischeEingabe,
} from "@/lib/calc/gmbhVsEu"
import {
  DEFAULTS_ZYPERN, berechneDreiWegeSchwellenreihe, berechneZypernGruendungsVergleich, berechneZypernLtd,
  type ZypernSpezifischeEingabe,
} from "@/lib/calc/zypernLtd"

const INPUT_CLASS = "h-8 rounded-md border border-input bg-background focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 transition-colors px-2 text-sm"

function Feld({
  label, value, onChange, suffix, step = 1, min, className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  suffix?: string
  step?: number
  min?: number
  className?: string
}) {
  return (
    <label className={cn("flex flex-col gap-1 text-xs text-muted-foreground", className)}>
      {label}
      <div className="flex items-center gap-1.5">
        <input type="number" min={min} step={step} value={value} onChange={(e) => onChange(e.target.value)} className={INPUT_CLASS} />
        {suffix && <span className="text-xs">{suffix}</span>}
      </div>
    </label>
  )
}

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

function Regler({
  label, value, onChange, hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  hint?: string
}) {
  const num = Math.min(100, Math.max(0, Number(value) || 0))
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <span className="tabular-nums text-sm font-semibold text-foreground">{num.toFixed(0)} %</span>
      </div>
      <input type="range" min={0} max={100} step={5} value={num} onChange={(e) => onChange(e.target.value)} className="w-full accent-primary" />
      {hint && <span className="text-[11px]">{hint}</span>}
    </label>
  )
}

function ZeilePos({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className={muted ? "text-muted-foreground" : undefined}>{label}</span>
      <span className={cn("tabular-nums", bold && "font-semibold")}>{value}</span>
    </div>
  )
}

function n(v: string): number {
  return Number(v) || 0
}

const MIETE_PRESETS: { value: string; label: string }[] = [
  { value: "750", label: "Nikosia" },
  { value: "950", label: "Larnaka/Paphos" },
  { value: "1800", label: "Limassol" },
]

export function RechtsformVergleichRechner() {
  const [umsatz, setUmsatz] = useState(String(DEFAULTS.umsatz))
  const [betriebsausgaben, setBetriebsausgaben] = useState(String(DEFAULTS.betriebsausgaben))
  const [autoAnschaffungswert, setAutoAnschaffungswert] = useState(String(DEFAULTS.autoAnschaffungswert))
  const [autoNutzungsdauerJahre, setAutoNutzungsdauerJahre] = useState(String(DEFAULTS.autoNutzungsdauerJahre))
  const [autoPrivatanteilPct, setAutoPrivatanteilPct] = useState(String(DEFAULTS.autoPrivatanteilPct))
  const [sonstigeAfaJahr, setSonstigeAfaJahr] = useState(String(DEFAULTS.sonstigeAfaJahr))
  const [investitionsbedingtenGfbNutzen, setInvestitionsbedingtenGfbNutzen] = useState(DEFAULTS.investitionsbedingtenGfbNutzen)

  const [gfGehaltBrutto, setGfGehaltBrutto] = useState(String(DEFAULTS.gfGehaltBrutto))
  const [ausschuettungsquotePct, setAusschuettungsquotePct] = useState(String(DEFAULTS.ausschuettungsquotePct))

  const [detailOffen, setDetailOffen] = useState(false)
  const [kostenOffen, setKostenOffen] = useState(false)
  const [dzSatzPct, setDzSatzPct] = useState(String(DEFAULTS.dzSatzPct))
  const [stbMehrkostenJahr, setStbMehrkostenJahr] = useState(String(DEFAULTS.stbMehrkostenJahr))
  const [offenlegungJahr, setOffenlegungJahr] = useState(String(DEFAULTS.offenlegungJahr))
  const [gruendungskostenEinmalig, setGruendungskostenEinmalig] = useState(String(DEFAULTS.gruendungskostenEinmalig))

  const [wohnsitzVollstaendigVerlegt, setWohnsitzVollstaendigVerlegt] = useState(DEFAULTS_ZYPERN.wohnsitzVollstaendigVerlegt)
  const [direktorGehaltBrutto, setDirektorGehaltBrutto] = useState(String(DEFAULTS_ZYPERN.direktorGehaltBrutto))
  const [zypernAusschuettungsquotePct, setZypernAusschuettungsquotePct] = useState(String(DEFAULTS_ZYPERN.ausschuettungsquotePct))
  const [mieteZypernMonat, setMieteZypernMonat] = useState(String(DEFAULTS_ZYPERN.mieteZypernMonat))
  const [mieteOesterreichVergleichMonat, setMieteOesterreichVergleichMonat] = useState(String(DEFAULTS_ZYPERN.mieteOesterreichVergleichMonat))
  const [zypernKostenOffen, setZypernKostenOffen] = useState(false)
  const [buchhaltungJahr, setBuchhaltungJahr] = useState(String(DEFAULTS_ZYPERN.buchhaltungJahr))
  const [auditJahr, setAuditJahr] = useState(String(DEFAULTS_ZYPERN.auditJahr))
  const [registeredOfficeJahr, setRegisteredOfficeJahr] = useState(String(DEFAULTS_ZYPERN.registeredOfficeJahr))
  const [zypernGruendungskostenEinmalig, setZypernGruendungskostenEinmalig] = useState(String(DEFAULTS_ZYPERN.gruendungskostenEinmalig))
  const [umzugskostenEinmalig, setUmzugskostenEinmalig] = useState(String(DEFAULTS_ZYPERN.umzugskostenEinmalig))

  const gemeinsam: GemeinsameEingabe = useMemo(() => ({
    umsatz: n(umsatz), betriebsausgaben: n(betriebsausgaben),
    autoAnschaffungswert: n(autoAnschaffungswert), autoNutzungsdauerJahre: Math.max(1, n(autoNutzungsdauerJahre)),
    autoPrivatanteilPct: n(autoPrivatanteilPct), sonstigeAfaJahr: n(sonstigeAfaJahr),
    investitionsbedingtenGfbNutzen,
  }), [umsatz, betriebsausgaben, autoAnschaffungswert, autoNutzungsdauerJahre, autoPrivatanteilPct, sonstigeAfaJahr, investitionsbedingtenGfbNutzen])

  const spezifisch: GmbhSpezifischeEingabe = useMemo(() => ({
    gfGehaltBrutto: n(gfGehaltBrutto), ausschuettungsquotePct: n(ausschuettungsquotePct),
    dzSatzPct: n(dzSatzPct), stbMehrkostenJahr: n(stbMehrkostenJahr), offenlegungJahr: n(offenlegungJahr),
  }), [gfGehaltBrutto, ausschuettungsquotePct, dzSatzPct, stbMehrkostenJahr, offenlegungJahr])

  const zypernSpezifisch: ZypernSpezifischeEingabe = useMemo(() => ({
    direktorGehaltBrutto: n(direktorGehaltBrutto), ausschuettungsquotePct: n(zypernAusschuettungsquotePct),
    buchhaltungJahr: n(buchhaltungJahr), auditJahr: n(auditJahr), registeredOfficeJahr: n(registeredOfficeJahr),
    wohnsitzVollstaendigVerlegt, mieteZypernMonat: n(mieteZypernMonat), mieteOesterreichVergleichMonat: n(mieteOesterreichVergleichMonat),
  }), [direktorGehaltBrutto, zypernAusschuettungsquotePct, buchhaltungJahr, auditJahr, registeredOfficeJahr, wohnsitzVollstaendigVerlegt, mieteZypernMonat, mieteOesterreichVergleichMonat])

  const eu = useMemo(() => berechneEu(gemeinsam), [gemeinsam])
  const gmbh = useMemo(() => berechneGmbh(gemeinsam, spezifisch), [gemeinsam, spezifisch])
  const zypern = useMemo(() => berechneZypernLtd(gemeinsam, zypernSpezifisch), [gemeinsam, zypernSpezifisch])

  const gruendungGmbh = useMemo(
    () => berechneGruendungsVergleich(eu, gmbh, n(gruendungskostenEinmalig)),
    [eu, gmbh, gruendungskostenEinmalig]
  )
  const gruendungZypern = useMemo(
    () => berechneZypernGruendungsVergleich(eu, zypern, n(zypernGruendungskostenEinmalig) + n(umzugskostenEinmalig)),
    [eu, zypern, zypernGruendungskostenEinmalig, umzugskostenEinmalig]
  )

  const operativerGewinn = gemeinsam.umsatz - gemeinsam.betriebsausgaben - eu.afaGesamt
  const schwellenreihe = useMemo(() => {
    const bis = Math.max(220000, Math.round((operativerGewinn * 2.2) / 10000) * 10000)
    return berechneDreiWegeSchwellenreihe(gemeinsam, spezifisch, zypernSpezifisch, 10000, bis, Math.max(5000, Math.round(bis / 30 / 5000) * 5000))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gemeinsam, spezifisch, zypernSpezifisch])

  const kandidaten = [
    { id: "eu", label: "Einzelunternehmer", wert: eu.nettoEinkommen },
    { id: "gmbh", label: "GmbH", wert: gmbh.gesamtInklThesaurierung },
    { id: "zypern", label: "Zypern Ltd", wert: zypern.gesamtInklThesaurierung },
  ]
  const bester = kandidaten.reduce((a, b) => (b.wert > a.wert ? b : a))

  const warnungen: string[] = []
  if (gemeinsam.umsatz > EU_BILANZIERUNGSPFLICHT_UMSATZ) {
    warnungen.push(`Bei über ${kreditFormatEUR(EU_BILANZIERUNGSPFLICHT_UMSATZ)} Umsatz (zwei Jahre in Folge) wird auch ein Einzelunternehmer UGB-bilanzierungspflichtig — der EÜR-Vorteil ("Steuer selbst machen") entfällt dann.`)
  }
  if (gemeinsam.umsatz > 0 && gemeinsam.umsatz <= KLEINUNTERNEHMERGRENZE_UST) {
    warnungen.push(`Unter ${kreditFormatEUR(KLEINUNTERNEHMERGRENZE_UST)} Umsatz greift unabhängig von der Rechtsform die umsatzsteuerliche Kleinunternehmerregelung — das verändert diesen Vergleich nicht, ist aber bei der Rechnungsstellung zu beachten.`)
  }
  if (spezifisch.gfGehaltBrutto / 12 < 551.1) {
    warnungen.push("Das Geschäftsführer-Gehalt liegt unter der GSVG-Mindestbeitragsgrundlage — die Pflichtversicherung wird trotzdem auf Basis der Mindestbeitragsgrundlage fällig.")
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
        <strong>Einzelunternehmer vs. GmbH vs. Zypern-Ltd:</strong> Vergleicht das tatsächlich verfügbare
        Nettoeinkommen — inklusive GSVG/GmbH-Lohnnebenkosten, Mindestkörperschaftsteuer, StB-Mehrkosten,
        und für Zypern die dortige KöSt, Sozialversicherung/GESY, Non-Dom-Dividendenbesteuerung sowie
        Gründungs-, Audit- und Wohnkosten. Alle Werte sind Richtwerte für 2026 und frei änderbar.
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Betriebsdaten (für alle drei Rechtsformen gleich)</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Feld label="Umsatz (€/Jahr)" value={umsatz} onChange={setUmsatz} step={1000} min={0} />
            <Feld label="Betriebsausgaben ohne SV/AfA/Gehalt (€/Jahr)" value={betriebsausgaben} onChange={setBetriebsausgaben} step={500} min={0} />
            <Feld label="Sonstige AfA — Büro, Geräte etc. (€/Jahr)" value={sonstigeAfaJahr} onChange={setSonstigeAfaJahr} step={100} min={0} />
          </div>
          <div>
            <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Auto (AfA-relevant)</h4>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Feld label="Anschaffungswert (€)" value={autoAnschaffungswert} onChange={setAutoAnschaffungswert} step={1000} min={0} />
              <Feld label="Nutzungsdauer (Jahre, min. 8)" value={autoNutzungsdauerJahre} onChange={setAutoNutzungsdauerJahre} step={1} min={8} />
              <Feld label="Privater Nutzungsanteil (%)" value={autoPrivatanteilPct} onChange={setAutoPrivatanteilPct} step={5} suffix="%" min={0} />
              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                Jährliche AfA (gedeckelt bei 40.000 € Anschaffungswert)
                <div className="text-sm text-foreground">{kreditFormatEUR(autoAfaJaehrlich(n(autoAnschaffungswert), n(autoNutzungsdauerJahre)))}/Jahr</div>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Beim Einzelunternehmer wird die AfA um den Privatanteil gekürzt. Bei GmbH und Zypern-Ltd bleibt
              die AfA voll Betriebsausgabe, dafür erhöht ein privat genutzter Firmenwagen den steuer- und
              SV-pflichtigen Sachbezug (2&nbsp;% vom Anschaffungswert/Monat, gedeckelt bei 960&nbsp;€/Monat) —
              vereinfachend mit dem österreichischen Sachbezugswert auch für Zypern gerechnet.
            </p>
          </div>
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={investitionsbedingtenGfbNutzen} onChange={(e) => setInvestitionsbedingtenGfbNutzen(e.target.checked)} className="size-4" />
            Investitionsbedingten Gewinnfreibetrag zusätzlich nutzen (setzt ausreichend begünstigte Investitionen/Wertpapierdeckung voraus, nur EU/GmbH)
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">GmbH-spezifisch</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Feld label="Geschäftsführer-Gehalt, brutto bar (€/Jahr)" value={gfGehaltBrutto} onChange={setGfGehaltBrutto} step={1000} min={0} />
            <Regler
              label="Ausschüttungsquote vom Gewinn nach KöSt"
              value={ausschuettungsquotePct}
              onChange={setAusschuettungsquotePct}
              hint="0 % = alles thesauriert (nur 23 % KöSt), 100 % = alles ausgeschüttet (zusätzlich 27,5 % KESt)"
            />
          </div>

          <button type="button" onClick={() => setKostenOffen((v) => !v)}
            className="flex items-center gap-1.5 text-left text-sm font-semibold text-muted-foreground hover:text-foreground">
            <span className={cn("inline-block transition-transform", kostenOffen && "rotate-90")}>▶</span>
            Kostensätze anpassen
          </button>
          {kostenOffen && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Feld label="DZ-Satz (Landeskammer-Anteil)" value={dzSatzPct} onChange={setDzSatzPct} step={0.01} suffix="%" min={0} />
              <Feld label="StB-Mehrkosten ggü. EÜR (€/Jahr)" value={stbMehrkostenJahr} onChange={setStbMehrkostenJahr} step={100} min={0} />
              <Feld label="Firmenbuch-Offenlegung (€/Jahr)" value={offenlegungJahr} onChange={setOffenlegungJahr} step={10} min={0} />
              <Feld label="Einmalige Gründungskosten (€)" value={gruendungskostenEinmalig} onChange={setGruendungskostenEinmalig} step={100} min={0} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={!wohnsitzVollstaendigVerlegt ? "border-destructive/50" : undefined}>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Zypern Ltd — spezifisch</h3>

          <label className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <input type="checkbox" checked={wohnsitzVollstaendigVerlegt} onChange={(e) => setWohnsitzVollstaendigVerlegt(e.target.checked)} className="mt-0.5 size-4" />
            <span>
              Ich verlege meinen Lebensmittelpunkt vollständig nach Zypern (183- oder 60-Tage-Regel erfüllt,
              kein österreichischer Wohnsitz mehr).
            </span>
          </label>
          {!wohnsitzVollstaendigVerlegt && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Ohne echte, vollständige Wohnsitzverlegung bleibt der "Ort der Geschäftsleitung" in Österreich
              (§ 1 KStG, DBA AT-CY Art. 4) — die Gesellschaft gilt steuerlich als österreichisch. Die Zahlen
              unten sind deshalb bewusst wirtschaftlich identisch mit der österreichischen GmbH oben, nur mit
              den zusätzlichen zypriotischen Fixkosten (Pflicht-Audit, Registered Office) obendrauf und ohne
              jeden Steuervorteil.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Feld label="Direktor-Gehalt, brutto bar (€/Jahr)" value={direktorGehaltBrutto} onChange={setDirektorGehaltBrutto} step={1000} min={0} />
            <Regler
              label="Ausschüttungsquote vom Gewinn nach KöSt"
              value={zypernAusschuettungsquotePct}
              onChange={setZypernAusschuettungsquotePct}
              hint="Als Non-Dom 0 % SDC auf Dividenden (die ersten 17 Steuerjahre) — nur 2,65 % GESY fällt an"
            />
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Wohnen (2 Personen)</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Miete Zypern (€/Monat)
                <div className="flex flex-wrap items-center gap-2">
                  <input type="number" min={0} step={50} value={mieteZypernMonat} onChange={(e) => setMieteZypernMonat(e.target.value)} className={cn(INPUT_CLASS, "w-24")} />
                  <PillGroup value={mieteZypernMonat as never} options={MIETE_PRESETS as never} onChange={(v) => setMieteZypernMonat(v)} />
                </div>
              </label>
              <Feld label="Vergleichsmiete Österreich, die dadurch wegfällt (€/Monat)" value={mieteOesterreichVergleichMonat} onChange={setMieteOesterreichVergleichMonat} step={50} min={0} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Nur die Differenz zählt — wer sowieso irgendwo wohnen muss, für den ist die österreichische
              Vergleichsmiete kein echter Zusatzaufwand. 2-Zimmer-Richtwerte 2026: Nikosia zentrumsnah
              ca. 750&nbsp;€, Larnaka/Paphos ca. 950&nbsp;€, Limassol (teuerster Markt) ca. 1.800&nbsp;€/Monat.
            </p>
          </div>

          <button type="button" onClick={() => setZypernKostenOffen((v) => !v)}
            className="flex items-center gap-1.5 text-left text-sm font-semibold text-muted-foreground hover:text-foreground">
            <span className={cn("inline-block transition-transform", zypernKostenOffen && "rotate-90")}>▶</span>
            Kostensätze anpassen
          </button>
          {zypernKostenOffen && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Feld label="Buchhaltung (€/Jahr)" value={buchhaltungJahr} onChange={setBuchhaltungJahr} step={100} min={0} />
              <Feld label="Pflicht-Audit/Review (€/Jahr)" value={auditJahr} onChange={setAuditJahr} step={100} min={0} />
              <Feld label="Registered Office &amp; Secretary (€/Jahr)" value={registeredOfficeJahr} onChange={setRegisteredOfficeJahr} step={100} min={0} />
              <Feld label="Einmalige Gründungskosten (€)" value={zypernGruendungskostenEinmalig} onChange={setZypernGruendungskostenEinmalig} step={100} min={0} />
              <Feld label="Einmalige Umzugskosten (€, 2 Personen)" value={umzugskostenEinmalig} onChange={setUmzugskostenEinmalig} step={100} min={0} />
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Auflagen: 60-Tage-Regel (mind. 60 Tage Anwesenheit, max. 183 Tage in einem anderen Staat,
            dauerhafter Wohnsitz in Zypern, Geschäftstätigkeit/Direktorsfunktion dort) oder klassische
            183-Tage-Regel. Jede zypriotische Ltd braucht praktisch immer einen Pflicht-Audit (Ausnahme:
            Review Engagement bei Umsatz &lt; 300.000&nbsp;€ und Bilanzsumme &lt; 500.000&nbsp;€ in zwei
            Folgejahren). Das Non-Dom-Regime (0&nbsp;% Special Defence Contribution auf Dividenden) gilt für
            die ersten 17 Steuerjahre als zypriotische:r Steuerresident:in.
          </p>
        </CardContent>
      </Card>

      {warnungen.length > 0 && (
        <div className="flex flex-col gap-2">
          {warnungen.map((w) => (
            <div key={w} className="rounded-lg border bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {w}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Einzelunternehmer</h3>
            <div className="text-xl font-bold tabular-nums">{kreditFormatEUR(eu.nettoEinkommen)}<span className="ml-1 text-xs font-normal text-muted-foreground">/Jahr verfügbar</span></div>
            <div className="flex flex-col gap-1.5 border-t pt-3">
              <ZeilePos label="Gewinn vor SV" value={kreditFormatEUR(eu.gewinnVorSv)} muted />
              <ZeilePos label="− GSVG-Beiträge" value={"−" + kreditFormatEUR(eu.svsBeitrag)} muted />
              <ZeilePos label="− Gewinnfreibetrag" value={"−" + kreditFormatEUR(eu.gewinnfreibetrag)} muted />
              <ZeilePos label="ESt-Bemessungsgrundlage" value={kreditFormatEUR(eu.estBemessungsgrundlage)} muted />
              <ZeilePos label="− Einkommensteuer" value={"−" + kreditFormatEUR(eu.einkommensteuer)} muted />
              <ZeilePos label="Netto verfügbar" value={kreditFormatEUR(eu.nettoEinkommen)} bold />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">GmbH (Geschäftsführer)</h3>
            <div className="text-xl font-bold tabular-nums">{kreditFormatEUR(gmbh.verfuegbaresEinkommen)}<span className="ml-1 text-xs font-normal text-muted-foreground">/Jahr bar verfügbar</span></div>
            <div className="flex flex-col gap-1.5 border-t pt-3">
              <ZeilePos label="Betriebliches Ergebnis vor KöSt" value={kreditFormatEUR(gmbh.betrieblichesErgebnisVorKoest)} muted />
              <ZeilePos label="− Körperschaftsteuer (23 %, min. 500 €)" value={"−" + kreditFormatEUR(gmbh.koeSt)} muted />
              <ZeilePos label="Gewinn nach KöSt" value={kreditFormatEUR(gmbh.gewinnNachKoest)} muted />
              <ZeilePos label={`davon Ausschüttung (${kreditFormatPct(n(ausschuettungsquotePct), 0)})`} value={kreditFormatEUR(gmbh.ausschuettungBrutto)} muted />
              <ZeilePos label="− KESt (27,5 %)" value={"−" + kreditFormatEUR(gmbh.kESt)} muted />
              <ZeilePos label="+ GF-Gehalt netto (nach GSVG, ESt, Sachbezug)" value={kreditFormatEUR(gmbh.gfNettoBar)} muted />
              <ZeilePos label="Bar verfügbar (Gehalt + Ausschüttung)" value={kreditFormatEUR(gmbh.verfuegbaresEinkommen)} bold />
              <ZeilePos label="+ thesauriert im Unternehmen (nach KöSt)" value={kreditFormatEUR(gmbh.thesaurierterGewinn)} muted />
              <ZeilePos label="Gesamtvermögenszuwachs" value={kreditFormatEUR(gmbh.gesamtInklThesaurierung)} bold />
            </div>
          </CardContent>
        </Card>

        <Card className={!zypern.wohnsitzGueltig ? "border-destructive/50" : undefined}>
          <CardContent className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              Zypern Ltd (Direktor)
              {!zypern.wohnsitzGueltig && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">⚠ kein echter Umzug</span>}
            </h3>
            <div className="text-xl font-bold tabular-nums">{kreditFormatEUR(zypern.verfuegbaresEinkommen)}<span className="ml-1 text-xs font-normal text-muted-foreground">/Jahr bar verfügbar</span></div>
            <div className="flex flex-col gap-1.5 border-t pt-3">
              <ZeilePos label="Betriebliches Ergebnis vor KöSt" value={kreditFormatEUR(zypern.betrieblichesErgebnisVorKoest)} muted />
              <ZeilePos label={zypern.wohnsitzGueltig ? "− Körperschaftsteuer (15 %)" : "− österreichische KöSt (23 %, min. 500 €)"} value={"−" + kreditFormatEUR(zypern.koeSt)} muted />
              <ZeilePos label="Gewinn nach KöSt" value={kreditFormatEUR(zypern.gewinnNachKoest)} muted />
              <ZeilePos label={`davon Ausschüttung (${kreditFormatPct(n(zypernAusschuettungsquotePct), 0)})`} value={kreditFormatEUR(zypern.ausschuettungBrutto)} muted />
              <ZeilePos label={zypern.wohnsitzGueltig ? "− GESY auf Dividende (2,65 %, 0 % SDC Non-Dom)" : "− österreichische KESt (27,5 %)"} value={"−" + kreditFormatEUR(zypern.gesyAufDividende)} muted />
              <ZeilePos label="+ Direktor-Gehalt netto" value={kreditFormatEUR(zypern.direktorNettoBar)} muted />
              {zypern.wohnkostenDeltaJahr !== 0 && (
                <ZeilePos label={zypern.wohnkostenDeltaJahr > 0 ? "− Mietmehrkosten Zypern ggü. Österreich" : "+ Mietersparnis Zypern ggü. Österreich"} value={(zypern.wohnkostenDeltaJahr > 0 ? "−" : "+") + kreditFormatEUR(Math.abs(zypern.wohnkostenDeltaJahr))} muted />
              )}
              <ZeilePos label="Bar verfügbar" value={kreditFormatEUR(zypern.verfuegbaresEinkommen)} bold />
              <ZeilePos label="+ thesauriert im Unternehmen (nach KöSt)" value={kreditFormatEUR(zypern.thesaurierterGewinn)} muted />
              <ZeilePos label="Gesamtvermögenszuwachs" value={kreditFormatEUR(zypern.gesamtInklThesaurierung)} bold />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card style={{ background: "linear-gradient(135deg,#0B1F2A 0%,#155767 130%)" }} className="text-white">
        <CardContent className="flex flex-col gap-2">
          <span className="text-xs text-white/70">Beste Option — inkl. thesauriertem Gewinn</span>
          <span className="text-2xl font-bold tabular-nums">{bester.label}: {kreditFormatEUR(bester.wert)}</span>
          <div className="mt-1 flex flex-col gap-1 border-t border-white/10 pt-2 text-xs text-white/80">
            <span>
              GmbH ggü. Einzelunternehmer: {gmbh.gesamtInklThesaurierung - eu.nettoEinkommen >= 0 ? "+" : ""}
              {kreditFormatEUR(gmbh.gesamtInklThesaurierung - eu.nettoEinkommen)}/Jahr —{" "}
              {gruendungGmbh.breakEvenJahre !== null
                ? `Gründung rentiert sich nach rund ${gruendungGmbh.breakEvenJahre.toFixed(1)} Jahren.`
                : "kein laufender Vorteil, Gründungskosten amortisieren sich nicht."}
            </span>
            <span>
              Zypern Ltd ggü. Einzelunternehmer: {zypern.gesamtInklThesaurierung - eu.nettoEinkommen >= 0 ? "+" : ""}
              {kreditFormatEUR(zypern.gesamtInklThesaurierung - eu.nettoEinkommen)}/Jahr —{" "}
              {!zypern.wohnsitzGueltig
                ? "Wohnsitz nicht verlegt: kein Steuervorteil, siehe Warnung oben."
                : gruendungZypern.breakEvenJahre !== null
                ? `Gründung + Umzug rentiert sich nach rund ${gruendungZypern.breakEvenJahre.toFixed(1)} Jahren.`
                : "kein laufender Vorteil, Gründungs-/Umzugskosten amortisieren sich nicht."}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h3 className="mb-1 text-sm font-semibold">Ab welchem Gewinn lohnt sich welche Rechtsform?</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Operativer Gewinn (Umsatz − Betriebsausgaben − AfA) auf der X-Achse, bei sonst gleichbleibenden
            Einstellungen. Dein aktueller Wert: {kreditFormatEUR(operativerGewinn)}.
          </p>
          <div className="h-[420px]">
            <Line
              data={{
                labels: schwellenreihe.map((p) => p.operativerGewinn),
                datasets: [
                  { label: "Einzelunternehmer, netto", data: schwellenreihe.map((p) => p.nettoEu), borderColor: "#155767", backgroundColor: "rgba(21,87,103,.12)", borderWidth: 2.5, pointRadius: 0, tension: 0.15 },
                  { label: "GmbH, bar verfügbar", data: schwellenreihe.map((p) => p.verfuegbarGmbh), borderColor: "#C97A2B", backgroundColor: "rgba(201,122,43,.12)", borderWidth: 2.5, pointRadius: 0, tension: 0.15 },
                  { label: "GmbH, inkl. thesauriert", data: schwellenreihe.map((p) => p.gesamtGmbh), borderColor: "#C97A2B", borderDash: [5, 4], borderWidth: 2, pointRadius: 0, tension: 0.15 },
                  { label: "Zypern Ltd, bar verfügbar", data: schwellenreihe.map((p) => p.verfuegbarZypern), borderColor: "#7C5CBF", backgroundColor: "rgba(124,92,191,.12)", borderWidth: 2.5, pointRadius: 0, tension: 0.15 },
                  { label: "Zypern Ltd, inkl. thesauriert", data: schwellenreihe.map((p) => p.gesamtZypern), borderColor: "#7C5CBF", borderDash: [5, 4], borderWidth: 2, pointRadius: 0, tension: 0.15 },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                  legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } },
                  tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${kreditFormatEUR(ctx.parsed.y as number)}` } },
                },
                scales: {
                  x: { grid: { display: false }, title: { display: true, text: "Operativer Gewinn (€)" }, ticks: { callback: (val) => kreditFormatEUR(Number(schwellenreihe[Number(val)]?.operativerGewinn ?? 0)) } },
                  y: { beginAtZero: true, ticks: { callback: (val) => kreditFormatEUR(Number(val)) } },
                },
              }}
              aria-label="Vergleich Einzelunternehmer, GmbH und Zypern-Ltd über verschiedene Gewinnniveaus"
              role="img"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <button type="button" onClick={() => setDetailOffen((v) => !v)}
            className="flex items-center gap-1.5 text-left text-sm font-semibold text-muted-foreground hover:text-foreground">
            <span className={cn("inline-block transition-transform", detailOffen && "rotate-90")}>▶</span>
            Rechenschritte &amp; Annahmen im Detail
          </button>
          {detailOffen && (
            <div className="flex flex-col gap-4 text-xs text-muted-foreground">
              <div>
                <h4 className="mb-2 font-semibold text-foreground">GmbH — Geschäftsführer-Bezug</h4>
                <div className="flex flex-col gap-1">
                  <ZeilePos label="Sachbezug Firmenwagen" value={kreditFormatEUR(gmbh.sachbezugAuto)} />
                  <ZeilePos label="SV-/ESt-Bemessungsgrundlage GF (Gehalt + Sachbezug)" value={kreditFormatEUR(gmbh.gfBemessungGesamt)} />
                  <ZeilePos label="GSVG-Beiträge des GF" value={kreditFormatEUR(gmbh.gfGsvgBeitrag)} />
                  <ZeilePos label="Gewinnfreibetrag des GF" value={kreditFormatEUR(gmbh.gfGewinnfreibetrag)} />
                  <ZeilePos label="Einkommensteuer des GF" value={kreditFormatEUR(gmbh.gfEinkommensteuer)} />
                  <ZeilePos label="DB + DZ + Kommunalsteuer der GmbH auf den GF-Bezug" value={kreditFormatEUR(gmbh.lohnnebenkostenGmbh)} />
                </div>
              </div>
              <div>
                <h4 className="mb-2 font-semibold text-foreground">Zypern Ltd — Direktor-Bezug{!zypern.wohnsitzGueltig && " (Ort der Geschäftsleitung Österreich → wie GmbH gerechnet)"}</h4>
                <div className="flex flex-col gap-1">
                  <ZeilePos label="Sachbezug Firmenwagen" value={kreditFormatEUR(zypern.sachbezugAuto)} />
                  <ZeilePos label="Bemessungsgrundlage Direktor (Gehalt + Sachbezug)" value={kreditFormatEUR(zypern.direktorBemessungGesamt)} />
                  <ZeilePos label={zypern.wohnsitzGueltig ? "Sozialversicherung Arbeitnehmeranteil (8,8 %)" : "GSVG-Beiträge (AT-Fall)"} value={kreditFormatEUR(zypern.siArbeitnehmer)} />
                  <ZeilePos label={zypern.wohnsitzGueltig ? "Sozialversicherung Arbeitgeberanteil (8,8 %)" : "DB + DZ + Kommunalsteuer (AT-Fall)"} value={kreditFormatEUR(zypern.siArbeitgeber)} />
                  {zypern.wohnsitzGueltig && (
                    <>
                      <ZeilePos label="GESY Arbeitnehmeranteil (2,65 %)" value={kreditFormatEUR(zypern.gesyArbeitnehmer)} />
                      <ZeilePos label="GESY Arbeitgeberanteil (2,90 %)" value={kreditFormatEUR(zypern.gesyArbeitgeber)} />
                    </>
                  )}
                  <ZeilePos label="Einkommensteuer des Direktors" value={kreditFormatEUR(zypern.direktorEinkommensteuer)} />
                </div>
              </div>
              <p>
                <strong className="text-foreground">Vereinfachungen GmbH/EU:</strong> Die GSVG-Bemessung
                verwendet den laufenden Gewinn/Bezug direkt (statt der tatsächlichen 3-jährigen
                Vorläufigkeits-/Nachbemessungslogik der SVS). Die Mindestkörperschaftsteuer ist eigentlich mit
                künftigen KöSt-Zahllasten verrechenbar (Vortrag), wird hier aber als sofortige Zahllast
                gerechnet. Familienbonus, Alleinverdiener-Absetzbetrag und sonstige persönliche Absetzbeträge
                fehlen. Kammerumlage/WKO-Grundumlage fällt in allen Rechtsformen gleichermaßen an und ist daher
                nicht differenzierend eingerechnet.
              </p>
              <p>
                <strong className="text-foreground">Vereinfachungen Zypern:</strong> PKW-Abschreibung und
                Sachbezug werden vereinfachend mit den österreichischen Sätzen gerechnet (das zypriotische
                Recht kennt eigene, im Detail abweichende Werte). Die zypriotische Sozialversicherung für
                Selbständige/Direktor:innen basiert real auf einer amtlichen Tabelle nach Berufsgruppe statt
                dem tatsächlichen Einkommen — hier vereinfachend direkt auf das Direktor-Gehalt angewendet.
                Nicht enthalten: Wegzugsbesteuerung (relevant nur bei bereits bestehenden österreichischen
                Beteiligungen), CFC-Regeln (Hinzurechnungsbesteuerung, § 10a KStG — greift bei
                Passiveinkünften ohne echte Substanz, hier nicht einschlägig bei echtem Umzug und aktivem
                Geschäft), sowie langfristige Effekte wie der Verlust der österreichischen Pensions-/
                Krankenversicherungszeiten.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
