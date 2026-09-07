// GmbH-vs-Einzelunternehmer-Rechner — siehe src/lib/calc/gmbhVsEu.ts für die Rechenlogik,
// die verwendeten Sätze (Stand 2026) und die dort dokumentierten Vereinfachungen.
import "@/lib/chartSetup"
import { useMemo, useState } from "react"
import { Line } from "react-chartjs-2"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { kreditFormatEUR, kreditFormatPct } from "@/lib/calc/kredit"
import {
  DEFAULTS, EU_BILANZIERUNGSPFLICHT_UMSATZ, KLEINUNTERNEHMERGRENZE_UST,
  autoAfaJaehrlich, berechneEu, berechneGmbh, berechneGruendungsVergleich, berechneSchwellenreihe,
  type GemeinsameEingabe, type GmbhSpezifischeEingabe,
} from "@/lib/calc/gmbhVsEu"

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

export function EuVsGmbhRechner() {
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

  const eu = useMemo(() => berechneEu(gemeinsam), [gemeinsam])
  const gmbh = useMemo(() => berechneGmbh(gemeinsam, spezifisch), [gemeinsam, spezifisch])
  const gruendung = useMemo(
    () => berechneGruendungsVergleich(eu, gmbh, n(gruendungskostenEinmalig)),
    [eu, gmbh, gruendungskostenEinmalig]
  )

  const operativerGewinn = gemeinsam.umsatz - gemeinsam.betriebsausgaben - eu.afaGesamt
  const schwellenreihe = useMemo(() => {
    const bis = Math.max(220000, Math.round((operativerGewinn * 2.2) / 10000) * 10000)
    return berechneSchwellenreihe(gemeinsam, spezifisch, 10000, bis, Math.max(5000, Math.round(bis / 30 / 5000) * 5000))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gemeinsam, spezifisch])

  const gmbhBesser = gmbh.gesamtInklThesaurierung >= eu.nettoEinkommen
  const differenz = gmbh.gesamtInklThesaurierung - eu.nettoEinkommen

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
        <strong>GmbH vs. Einzelunternehmer:</strong> Vergleicht das tatsächlich verfügbare Nettoeinkommen —
        inklusive GSVG (bleibt bei &gt;25&nbsp;% Anteil als Geschäftsführer bestehen, wird nicht zu ASVG),
        Mindestkörperschaftsteuer, DB/DZ/Kommunalsteuer auf den GF-Bezug und den laufenden StB-Mehrkosten der
        GmbH gegenüber der selbst erstellten EÜR. Alle Werte sind Richtwerte für 2026 und frei änderbar.
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Betriebsdaten (für beide Rechtsformen gleich)</h3>
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
              Beim Einzelunternehmer wird die AfA um den Privatanteil gekürzt. Bei der GmbH bleibt die AfA voll
              Betriebsausgabe, dafür erhöht ein privat genutzter Firmenwagen den steuer- und SV-pflichtigen
              Sachbezug des Geschäftsführers (2&nbsp;% vom Anschaffungswert/Monat, gedeckelt bei 960&nbsp;€/Monat).
            </p>
          </div>
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={investitionsbedingtenGfbNutzen} onChange={(e) => setInvestitionsbedingtenGfbNutzen(e.target.checked)} className="size-4" />
            Investitionsbedingten Gewinnfreibetrag zusätzlich nutzen (setzt ausreichend begünstigte Investitionen/Wertpapierdeckung voraus)
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

      {warnungen.length > 0 && (
        <div className="flex flex-col gap-2">
          {warnungen.map((w) => (
            <div key={w} className="rounded-lg border bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {w}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
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
      </div>

      <Card style={{ background: "linear-gradient(135deg,#0B1F2A 0%,#155767 130%)" }} className="text-white">
        <CardContent className="flex flex-col gap-1">
          <span className="text-xs text-white/70">
            Jährliche Differenz (inkl. thesauriertem Gewinn) — {gmbhBesser ? "GmbH" : "Einzelunternehmer"} liegt vorne
          </span>
          <span className="text-2xl font-bold tabular-nums">
            {differenz >= 0 ? "+" : ""}{kreditFormatEUR(differenz)}
          </span>
          <span className="mt-1 text-xs text-white/70">
            {gruendung.breakEvenJahre !== null
              ? `Bei ${kreditFormatEUR(n(gruendungskostenEinmalig))} Gründungskosten rentiert sich die Gründung nach rund ${gruendung.breakEvenJahre.toFixed(1)} Jahren.`
              : "In diesem Szenario bringt die GmbH laufend keinen Vorteil — die Gründungskosten würden sich nicht amortisieren."}
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h3 className="mb-1 text-sm font-semibold">Ab welchem Gewinn lohnt sich die GmbH?</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Operativer Gewinn (Umsatz − Betriebsausgaben − AfA) auf der X-Achse, bei sonst gleichbleibendem
            GF-Gehalt und gleichbleibender Ausschüttungsquote. Dein aktueller Wert: {kreditFormatEUR(operativerGewinn)}.
          </p>
          <div className="h-[400px]">
            <Line
              data={{
                labels: schwellenreihe.map((p) => p.operativerGewinn),
                datasets: [
                  { label: "Einzelunternehmer, netto", data: schwellenreihe.map((p) => p.nettoEu), borderColor: "#155767", backgroundColor: "rgba(21,87,103,.12)", borderWidth: 2.5, pointRadius: 0, tension: 0.15 },
                  { label: "GmbH, bar verfügbar", data: schwellenreihe.map((p) => p.verfuegbarGmbh), borderColor: "#C97A2B", backgroundColor: "rgba(201,122,43,.12)", borderWidth: 2.5, pointRadius: 0, tension: 0.15 },
                  { label: "GmbH, inkl. thesauriert", data: schwellenreihe.map((p) => p.gesamtGmbh), borderColor: "#C97A2B", borderDash: [5, 4], borderWidth: 2, pointRadius: 0, tension: 0.15 },
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
              aria-label="Vergleich Einzelunternehmer vs. GmbH über verschiedene Gewinnniveaus"
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
              <p>
                Vereinfachungen: Die GSVG-Bemessung verwendet den laufenden Gewinn/Bezug direkt (statt der
                tatsächlichen 3-jährigen Vorläufigkeits-/Nachbemessungslogik der SVS) — für die Dauerbetrachtung
                führt das zum selben Ergebnis. Die Mindestkörperschaftsteuer ist eigentlich mit künftigen
                KöSt-Zahllasten verrechenbar (Vortrag), wird hier aber als sofortige Zahllast gerechnet. Der
                investitionsbedingte Gewinnfreibetrag wird nur bei aktivierter Checkbox angenommen. Familienbonus,
                Alleinverdiener-Absetzbetrag und sonstige persönliche Absetzbeträge sind nicht enthalten.
                Kammerumlage/WKO-Grundumlage fällt in beiden Rechtsformen gleichermaßen an und ist daher nicht
                differenzierend eingerechnet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
