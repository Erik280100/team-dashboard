// Invest vs. Anlegerwohnung — vergleicht dieselben Eigenmittel im Depot und als Anzahlung für
// eine fremdfinanzierte Anlegerwohnung. Siehe src/lib/calc/investVsWohnung.ts für die
// Rechenlogik und die dort dokumentierten Vereinfachungen; das Kostenmodell (Kaufnebenkosten,
// Annuität, AfA) ist dasselbe wie im Finanzierungsrechner (src/lib/calc/kredit.ts). Die
// Depot-Seite (Szenario A + das Mietüberschuss-Nebenkonto) rechnet bewusst ohne Kosten — nur
// die angegebene Rendite, abzüglich 27,5 % KESt auf den Gewinn.
import { useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { KREDIT_DEFAULTS, kreditFormatEUR, kreditFormatPct, type KreditSaetze } from "@/lib/calc/kredit"
import { berechneInvestVsWohnung, type InvestVsWohnungEingabe } from "@/lib/calc/investVsWohnung"

const DEPOT_RENDITE_PRESETS = [5, 6, 7]
const WERTSTEIGERUNG_PRESETS = [2, 3, 4]
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

export function InvestVsWohnungRechner() {
  // Eigenmittel & Zeitraum
  const [eigenmittel, setEigenmittel] = useState("30000")
  const [horizontJahre, setHorizontJahre] = useState("30")
  const [entnahmeJahre, setEntnahmeJahre] = useState("20")

  // Depot
  const [depotRenditePa, setDepotRenditePa] = useState("6")

  // Wohnung
  const [kaufpreis, setKaufpreis] = useState("150000")
  const [mitMakler, setMitMakler] = useState(true)
  const [nkMitfinanziert, setNkMitfinanziert] = useState(true)
  const [mieteMonat, setMieteMonat] = useState("580")
  const [indexierungPct, setIndexierungPct] = useState("1.6")
  const [leerstandPct, setLeerstandPct] = useState("3")
  const [bewirtschaftungMonat, setBewirtschaftungMonat] = useState("30")
  const [wertsteigerungPct, setWertsteigerungPct] = useState("2")

  // Kredit
  const [kreditLaufzeitJahre, setKreditLaufzeitJahre] = useState("35")
  const [kreditZinsPct, setKreditZinsPct] = useState("2.85")

  // Steuer & Verkauf
  const [grenzsteuersatzPct, setGrenzsteuersatzPct] = useState("40")
  const [immoEstPct, setImmoEstPct] = useState("30")
  const [verkaufskostenPct, setVerkaufskostenPct] = useState("0")

  // Kostensätze (Kaufnebenkosten/Kreditnebenkosten/AfA) — geteiltes Modell mit dem
  // Finanzierungsrechner und dem Anlegerwohnungs-Portfolio-Rechner.
  const [saetzeOffen, setSaetzeOffen] = useState(false)
  const [saetze, setSaetze] = useState<KreditSaetze>(KREDIT_DEFAULTS)
  const satzSetter = (key: keyof KreditSaetze) => (v: string) => setSaetze((s) => ({ ...s, [key]: Number(v) || 0 }))

  const horizontClamped = Math.min(40, Math.max(1, Math.round(n(horizontJahre)) || 20))
  // Untergrenze 5 Jahre: Hypothekarkredite mit kürzerer Laufzeit gibt es in der Praxis nicht —
  // ohne diese Grenze kann eine versehentliche Kurzlaufzeit (z. B. durchs Herunterklicken des
  // Zahlenfelds) eine absurd hohe Monatsrate erzeugen und das ganze Ergebnis verzerren.
  const kreditLaufzeitClamped = Math.min(40, Math.max(5, Math.round(n(kreditLaufzeitJahre)) || 35))
  const entnahmeJahreClamped = Math.max(0, Math.round(n(entnahmeJahre)))

  const eingabe: InvestVsWohnungEingabe = useMemo(() => ({
    eigenmittel: n(eigenmittel), horizontJahre: horizontClamped, entnahmeJahre: entnahmeJahreClamped,
    depotRenditePa: n(depotRenditePa),
    kaufpreis: n(kaufpreis), mitMakler, nkMitfinanziert,
    kreditLaufzeitJahre: kreditLaufzeitClamped, kreditZinsPct: n(kreditZinsPct),
    mieteMonat: n(mieteMonat), indexierungPct: n(indexierungPct), leerstandPct: n(leerstandPct),
    bewirtschaftungMonat: n(bewirtschaftungMonat), wertsteigerungPct: n(wertsteigerungPct),
    grenzsteuersatzPct: Math.min(55, Math.max(0, n(grenzsteuersatzPct))),
    immoEstPct: n(immoEstPct), verkaufskostenPct: n(verkaufskostenPct), saetze,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    eigenmittel, horizontClamped, entnahmeJahreClamped, depotRenditePa, kaufpreis, mitMakler, nkMitfinanziert,
    kreditLaufzeitClamped, kreditZinsPct, mieteMonat, indexierungPct, leerstandPct, bewirtschaftungMonat,
    wertsteigerungPct, grenzsteuersatzPct, immoEstPct, verkaufskostenPct, saetze,
  ])

  const ergebnis = useMemo(() => berechneInvestVsWohnung(eingabe), [eingabe])
  const { depot, wohnung, differenz, entnahme, warnungen } = ergebnis

  const wohnungBesser = differenz >= 0

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
        <strong>Invest vs. Anlegerwohnung:</strong> Vergleicht dieselben Eigenmittel im Depot mit einer fremdfinanzierten Anlegerwohnung über denselben Zeitraum.
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Eigenmittel &amp; Zeitraum</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Feld label="Eigenmittel (€)" value={eigenmittel} onChange={setEigenmittel} step={1000} min={0} />
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Anlagehorizont (Jahre)
              <div className="flex flex-wrap items-center gap-2">
                <input type="number" min={1} max={40} step={1} value={horizontJahre}
                  onChange={(e) => setHorizontJahre(e.target.value)} className={cn(INPUT_CLASS, "w-20")} />
                <span className="text-xs">J</span>
              </div>
            </label>
            <Feld label="Entnahmezeit (Jahre)" value={entnahmeJahre} onChange={setEntnahmeJahre} step={1} suffix="J" min={0} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Szenario A — Depot</h3>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Rendite (% p.a.)
            <div className="flex flex-wrap items-center gap-2">
              <input type="number" min={0} step={0.1} value={depotRenditePa} onChange={(e) => setDepotRenditePa(e.target.value)} className={cn(INPUT_CLASS, "w-20")} />
              <PillGroup value={depotRenditePa as never}
                options={DEPOT_RENDITE_PRESETS.map((p) => ({ value: String(p) as never, label: `${p} %` }))}
                onChange={(v) => setDepotRenditePa(v)} />
            </div>
          </label>
          <p className="text-xs text-muted-foreground">
            Ohne Kosten gerechnet: nur die angegebene Rendite, abzüglich 27,5&nbsp;% KESt auf den Gewinn.
            Gilt auch für das Nebenkonto in Szenario B (Mietüberschuss-Reinvestition), damit beide Seiten
            fair mit derselben Opportunitätskosten-Annahme verglichen werden.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Szenario B — Anlegerwohnung</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Feld label="Kaufpreis (€)" value={kaufpreis} onChange={setKaufpreis} step={5000} min={0} />
            <Feld label="Miete (€/Monat)" value={mieteMonat} onChange={setMieteMonat} step={25} min={0} />
            <Feld label="Mietindexierung (% p.a.)" value={indexierungPct} onChange={setIndexierungPct} step={0.1} suffix="%" />
            <Feld label="Leerstand/Mietausfall (%)" value={leerstandPct} onChange={setLeerstandPct} step={0.5} suffix="%" min={0} />
            <Feld label="Bewirtschaftung (€/Monat)" value={bewirtschaftungMonat} onChange={setBewirtschaftungMonat} step={5} min={0} />
            <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
              Wertsteigerung Immobilie (% p.a.)
              <div className="flex flex-wrap items-center gap-2">
                <input type="number" step={0.1} value={wertsteigerungPct} onChange={(e) => setWertsteigerungPct(e.target.value)} className={cn(INPUT_CLASS, "w-20")} />
                <PillGroup value={wertsteigerungPct as never}
                  options={WERTSTEIGERUNG_PRESETS.map((p) => ({ value: String(p) as never, label: `${p} %` }))}
                  onChange={(v) => setWertsteigerungPct(v)} />
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
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Kredit</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Laufzeit (Jahre)
              <div className="flex flex-wrap items-center gap-2">
                <input type="number" min={5} max={40} step={1} value={kreditLaufzeitJahre}
                  onChange={(e) => setKreditLaufzeitJahre(e.target.value)} className={cn(INPUT_CLASS, "w-20")} />
                <PillGroup value={String(kreditLaufzeitClamped) as never}
                  options={LAUFZEIT_PRESETS.map((p) => ({ value: String(p) as never, label: `${p} J` }))}
                  onChange={(v) => setKreditLaufzeitJahre(v)} />
              </div>
            </label>
            <Feld label="Sollzinssatz (% p.a.)" value={kreditZinsPct} onChange={setKreditZinsPct} step={0.05} suffix="%" min={0} />
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              Kreditbetrag / Rate
              <div className="text-sm text-foreground">
                {kreditFormatEUR(wohnung.kreditbetrag)} · {kreditFormatEUR(wohnung.rate)}/Monat
              </div>
            </div>
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              Beleihungsquote
              <div className="text-sm text-foreground">{kreditFormatPct(wohnung.beleihungsquotePct, 0)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Steuer &amp; Verkauf</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
              Grenzsteuersatz (%)
              <div className="flex flex-wrap items-center gap-2">
                <input type="number" step={1} value={grenzsteuersatzPct} onChange={(e) => setGrenzsteuersatzPct(e.target.value)} className={cn(INPUT_CLASS, "w-20")} />
                <PillGroup value={grenzsteuersatzPct as never}
                  options={GRENZSTEUER_PRESETS.map((p) => ({ value: String(p) as never, label: `${p} %` }))}
                  onChange={(v) => setGrenzsteuersatzPct(v)} />
              </div>
            </label>
            <Feld label="Verkaufskosten (%)" value={verkaufskostenPct} onChange={setVerkaufskostenPct} step={0.5} suffix="%" min={0} />
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              ImmoESt-Satz (%)
              <input type="number" min={0} step={1} value={immoEstPct} disabled={!wohnung.immoEstAnwendbar}
                onChange={(e) => setImmoEstPct(e.target.value)} className={cn(INPUT_CLASS, "w-20 disabled:opacity-50")} />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            ImmoESt wird automatisch anhand der Haltedauer angesetzt: unter 10 Jahren mit dem
            angegebenen Satz, ab 10 Jahren steuerfrei. Aktueller Anlagehorizont ({horizontClamped}{" "}
            Jahre): <strong className={wohnung.immoEstAnwendbar ? "text-foreground" : "text-[#155767]"}>
              {wohnung.immoEstAnwendbar ? "steuerpflichtig" : "steuerfrei"}
            </strong>.
          </p>
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
                <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Kreditnebenkosten (von der Kreditsumme)</h4>
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
            <h3 className="text-sm font-semibold">Depot nach {horizontClamped} Jahren</h3>
            <div className="text-xl font-bold tabular-nums">{kreditFormatEUR(depot.endwertNachSteuer)}</div>
            <div className="flex flex-col gap-1.5 border-t pt-3">
              <ZeilePos label="Gesamtbetrag (vor KESt)" value={kreditFormatEUR(depot.bruttoEndwert)} muted />
              <ZeilePos label="− KESt (27,5 % auf den Gewinn)" value={"−" + kreditFormatEUR(depot.kestGesamt)} muted />
              <ZeilePos label="Eingesetzte Eigenmittel" value={kreditFormatEUR(n(eigenmittel))} muted />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Wohnung, verkauft nach {horizontClamped} Jahren</h3>
            <div className="text-xl font-bold tabular-nums">{kreditFormatEUR(wohnung.endwertNachSteuer)}</div>
            <div className="flex flex-col gap-1.5 border-t pt-3">
              <ZeilePos label="Verkehrswert" value={kreditFormatEUR(wohnung.immobilienwertEnde)} muted />
              <ZeilePos label="− Restschuld" value={"−" + kreditFormatEUR(wohnung.restschuldEnde)} muted />
              {wohnung.verkaufskosten > 0 && <ZeilePos label="− Verkaufskosten" value={"−" + kreditFormatEUR(wohnung.verkaufskosten)} muted />}
              {wohnung.immoEst > 0 && <ZeilePos label="− ImmoESt" value={"−" + kreditFormatEUR(wohnung.immoEst)} muted />}
              <ZeilePos
                label={wohnung.nebenkontoEndwert >= 0 ? "+ Nebenkonto (Mietüberschuss reinvestiert)" : "− Nebenkonto (Zuzahlungen überwiegen)"}
                value={(wohnung.nebenkontoEndwert >= 0 ? "+" : "−") + kreditFormatEUR(Math.abs(wohnung.nebenkontoEndwert))}
                muted
              />
              {wohnung.zuzahlungenKumuliert > 0 && (
                <ZeilePos label="davon aus eigener Tasche zugeschossen" value={kreditFormatEUR(wohnung.zuzahlungenKumuliert)} muted />
              )}
              <ZeilePos label="Kumulierte AfA" value={kreditFormatEUR(wohnung.afaKumuliert)} muted />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card style={{ background: "linear-gradient(135deg,#0B1F2A 0%,#155767 130%)" }} className="text-white">
        <CardContent className="flex flex-col gap-1">
          <span className="text-xs text-white/70">
            Differenz nach {horizontClamped} Jahren — {wohnungBesser ? "Wohnung" : "Depot"} liegt vorne
          </span>
          <span className="text-2xl font-bold tabular-nums">
            {wohnungBesser ? "+" : ""}{kreditFormatEUR(differenz)}
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold">Monatliche Entnahme über {entnahmeJahreClamped} Jahre</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Wie viel könnte man sich nach Ablauf des Anlagehorizonts monatlich auszahlen, bis das
              Kapital nach der gewählten Entnahmezeit exakt aufgebraucht ist? Beide Werte mit derselben
              Netto-Rendite gerechnet (Rendite abzüglich KESt), damit der Vergleich fair bleibt.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Depot</div>
              <div className="text-xl font-bold tabular-nums">{kreditFormatEUR(entnahme.depotMonat)}/Monat</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Wohnung (verkauft, Erlös im Depot entnommen)</div>
              <div className="text-xl font-bold tabular-nums">{kreditFormatEUR(entnahme.immoMonat)}/Monat</div>
            </div>
          </div>
          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Alternative — Wohnung behalten statt verkaufen: laufender Mietüberschuss plus Entnahme aus
            dem Nebenkonto ≈ <strong className="text-foreground">{kreditFormatEUR(entnahme.immoOhneVerkaufMonat)}/Monat</strong>.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
