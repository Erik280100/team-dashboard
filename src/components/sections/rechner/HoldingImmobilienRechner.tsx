// Holding & Immobilien-GmbH-Rechner — siehe src/lib/calc/holdingImmobilien.ts für die
// Rechenlogik und die dort dokumentierten Vereinfachungen. Bewusst als eigener, schlanker
// Rechner getrennt vom Rechtsform-Vergleich (EU/GmbH/Zypern) gehalten, statt alles in ein
// Mega-Tool zu packen.
import { useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { KREDIT_DEFAULTS, kreditFormatEUR, kreditFormatPct, type KreditSaetze } from "@/lib/calc/kredit"
import {
  DEFAULTS_HOLDING_IMMO, berechneHoldingImmobilien, type HoldingImmoEingabe,
} from "@/lib/calc/holdingImmobilien"

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

export function HoldingImmobilienRechner() {
  const [verfuegbarerGewinnVorSteuer, setVerfuegbarerGewinnVorSteuer] = useState(String(DEFAULTS_HOLDING_IMMO.verfuegbarerGewinnVorSteuer))
  const [kapitalherkunft, setKapitalherkunft] = useState<"gmbh" | "eu">(DEFAULTS_HOLDING_IMMO.kapitalherkunft)
  const [euGrenzsteuersatzPct, setEuGrenzsteuersatzPct] = useState(String(DEFAULTS_HOLDING_IMMO.euGrenzsteuersatzPct))
  const [grenzsteuersatzVermietungPct, setGrenzsteuersatzVermietungPct] = useState(String(DEFAULTS_HOLDING_IMMO.grenzsteuersatzVermietungPct))

  const [kaufpreis, setKaufpreis] = useState(String(DEFAULTS_HOLDING_IMMO.kaufpreis))
  const [mitMakler, setMitMakler] = useState(DEFAULTS_HOLDING_IMMO.mitMakler)
  const [nkMitfinanziert, setNkMitfinanziert] = useState(DEFAULTS_HOLDING_IMMO.nkMitfinanziert)
  const [horizontJahre, setHorizontJahre] = useState(String(DEFAULTS_HOLDING_IMMO.horizontJahre))
  const [kreditLaufzeitJahre, setKreditLaufzeitJahre] = useState(String(DEFAULTS_HOLDING_IMMO.kreditLaufzeitJahre))
  const [kreditZinsPct, setKreditZinsPct] = useState(String(DEFAULTS_HOLDING_IMMO.kreditZinsPct))
  const [mieteMonat, setMieteMonat] = useState(String(DEFAULTS_HOLDING_IMMO.mieteMonat))
  const [indexierungPct, setIndexierungPct] = useState(String(DEFAULTS_HOLDING_IMMO.indexierungPct))
  const [leerstandPct, setLeerstandPct] = useState(String(DEFAULTS_HOLDING_IMMO.leerstandPct))
  const [bewirtschaftungMonat, setBewirtschaftungMonat] = useState(String(DEFAULTS_HOLDING_IMMO.bewirtschaftungMonat))
  const [wertsteigerungPct, setWertsteigerungPct] = useState(String(DEFAULTS_HOLDING_IMMO.wertsteigerungPct))
  const [verkaufskostenPct, setVerkaufskostenPct] = useState(String(DEFAULTS_HOLDING_IMMO.verkaufskostenPct))

  const [ueberHolding, setUeberHolding] = useState(DEFAULTS_HOLDING_IMMO.ueberHolding)
  const [holdingFixkostenJahr, setHoldingFixkostenJahr] = useState(String(DEFAULTS_HOLDING_IMMO.holdingFixkostenJahr))
  const [holdingGruendungskostenEinmalig, setHoldingGruendungskostenEinmalig] = useState(String(DEFAULTS_HOLDING_IMMO.holdingGruendungskostenEinmalig))

  const [saetzeOffen, setSaetzeOffen] = useState(false)
  const [detailOffen, setDetailOffen] = useState(false)
  const [saetze, setSaetze] = useState<KreditSaetze>(KREDIT_DEFAULTS)
  const satzSetter = (key: keyof KreditSaetze) => (v: string) => setSaetze((s) => ({ ...s, [key]: Number(v) || 0 }))

  const horizontClamped = Math.min(40, Math.max(1, Math.round(n(horizontJahre)) || 20))
  const kreditLaufzeitClamped = Math.min(40, Math.max(5, Math.round(n(kreditLaufzeitJahre)) || 25))

  const eingabe: HoldingImmoEingabe = useMemo(() => ({
    verfuegbarerGewinnVorSteuer: n(verfuegbarerGewinnVorSteuer), kapitalherkunft,
    euGrenzsteuersatzPct: n(euGrenzsteuersatzPct), grenzsteuersatzVermietungPct: n(grenzsteuersatzVermietungPct),
    kaufpreis: n(kaufpreis), mitMakler, nkMitfinanziert,
    horizontJahre: horizontClamped, kreditLaufzeitJahre: kreditLaufzeitClamped, kreditZinsPct: n(kreditZinsPct),
    mieteMonat: n(mieteMonat), indexierungPct: n(indexierungPct), leerstandPct: n(leerstandPct),
    bewirtschaftungMonat: n(bewirtschaftungMonat), wertsteigerungPct: n(wertsteigerungPct),
    verkaufskostenPct: n(verkaufskostenPct), saetze,
    ueberHolding, holdingFixkostenJahr: n(holdingFixkostenJahr), holdingGruendungskostenEinmalig: n(holdingGruendungskostenEinmalig),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    verfuegbarerGewinnVorSteuer, kapitalherkunft, euGrenzsteuersatzPct, grenzsteuersatzVermietungPct,
    kaufpreis, mitMakler, nkMitfinanziert, horizontClamped, kreditLaufzeitClamped, kreditZinsPct,
    mieteMonat, indexierungPct, leerstandPct, bewirtschaftungMonat, wertsteigerungPct, verkaufskostenPct, saetze,
    ueberHolding, holdingFixkostenJahr, holdingGruendungskostenEinmalig,
  ])

  const erg = useMemo(() => berechneHoldingImmobilien(eingabe), [eingabe])

  const kandidaten = [
    { label: "Privat", wert: erg.endwertPrivat },
    { label: `GmbH${ueberHolding ? " über Holding" : " (Direktkauf)"}, bleibt drin`, wert: erg.endwertGmbhThesauriert },
    { label: `GmbH${ueberHolding ? " über Holding" : " (Direktkauf)"}, danach ausgeschüttet`, wert: erg.endwertGmbhAusgeschuettet },
  ]
  const bester = kandidaten.reduce((a, b) => (b.wert > a.wert ? b : a))

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
        <strong>Holding &amp; Immobilien-GmbH:</strong> Vergleicht den Kauf einer vermieteten
        Anlegerwohnung privat gegen den Kauf über eine Kapitalgesellschaft (direkt durch die
        operative GmbH oder über eine Holding mit eigener Immobilien-GmbH zur Haftungstrennung).
        Kaufnebenkosten, Tilgung und AfA rechnen wie im Finanzierungsrechner — hier kommt nur die
        Steuerfrage obendrauf: was die Rechtsform beim Kapitaltransfer und bei der laufenden
        Besteuerung ausmacht.
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Kapitalherkunft</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Feld label="Verfügbarer Gewinn vor Steuer (€)" value={verfuegbarerGewinnVorSteuer} onChange={setVerfuegbarerGewinnVorSteuer} step={5000} min={0} />
            <Feld label="Grenzsteuersatz auf laufende Vermietungseinkünfte, privat (%)" value={grenzsteuersatzVermietungPct} onChange={setGrenzsteuersatzVermietungPct} step={1} suffix="%" min={0} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setKapitalherkunft("gmbh")}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                kapitalherkunft === "gmbh" ? "border-transparent bg-primary text-primary-foreground shadow-sm" : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}>
              Aus GmbH-Gewinn ausgeschüttet ({kreditFormatPct(erg.transferSatzPrivatPct, 1)})
            </button>
            <button type="button" onClick={() => setKapitalherkunft("eu")}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                kapitalherkunft === "eu" ? "border-transparent bg-primary text-primary-foreground shadow-sm" : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}>
              Aus Einzelunternehmer-Gewinn
            </button>
          </div>
          {kapitalherkunft === "eu" && (
            <Feld label="Grenzsteuersatz Einzelunternehmer beim Kapitaltransfer (%)" value={euGrenzsteuersatzPct} onChange={setEuGrenzsteuersatzPct} step={1} suffix="%" min={0} className="max-w-xs" />
          )}
          <p className="text-xs text-muted-foreground">
            Nur diese eine Transferbelastung entscheidet, wie viel vom Gewinn überhaupt als
            Eigenmittel ankommt — bei GmbH-Ausschüttung 23 % KöSt + 27,5 % KESt kombiniert
            (≈ {kreditFormatPct(erg.transferSatzPrivatPct, 1)}), bei direktem Kauf durch die
            Kapitalgesellschaft entfällt diese Ebene komplett (nur 23 % KöSt).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Immobilie (zur Vermietung)</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Feld label="Kaufpreis (€)" value={kaufpreis} onChange={setKaufpreis} step={5000} min={0} />
            <Feld label="Miete (€/Monat)" value={mieteMonat} onChange={setMieteMonat} step={25} min={0} />
            <Feld label="Mietindexierung (% p.a.)" value={indexierungPct} onChange={setIndexierungPct} step={0.1} suffix="%" />
            <Feld label="Leerstand/Mietausfall (%)" value={leerstandPct} onChange={setLeerstandPct} step={0.5} suffix="%" min={0} />
            <Feld label="Bewirtschaftung (€/Monat, heute)" value={bewirtschaftungMonat} onChange={setBewirtschaftungMonat} step={5} min={0} />
            <Feld label="Wertsteigerung (% p.a.)" value={wertsteigerungPct} onChange={setWertsteigerungPct} step={0.1} suffix="%" />
            <Feld label="Anlagehorizont bis Verkauf (Jahre)" value={horizontJahre} onChange={setHorizontJahre} step={1} min={1} />
            <Feld label="Verkaufskosten (%)" value={verkaufskostenPct} onChange={setVerkaufskostenPct} step={0.5} suffix="%" min={0} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Feld label="Kreditlaufzeit (Jahre)" value={kreditLaufzeitJahre} onChange={setKreditLaufzeitJahre} step={1} min={5} />
            <Feld label="Sollzinssatz (% p.a.)" value={kreditZinsPct} onChange={setKreditZinsPct} step={0.05} suffix="%" min={0} />
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

          <button type="button" onClick={() => setSaetzeOffen((v) => !v)}
            className="flex items-center gap-1.5 text-left text-sm font-semibold text-muted-foreground hover:text-foreground">
            <span className={cn("inline-block transition-transform", saetzeOffen && "rotate-90")}>▶</span>
            Kaufneben-/AfA-Sätze anpassen
          </button>
          {saetzeOffen && (
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Feld label="Grunderwerbsteuer" value={String(saetze.grunderwerbsteuerPct)} onChange={satzSetter("grunderwerbsteuerPct")} suffix="%" step={0.1} />
              <Feld label="Grundbucheintragung" value={String(saetze.grundbuchEintragungPct)} onChange={satzSetter("grundbuchEintragungPct")} suffix="%" step={0.1} />
              <Feld label="Vertragserrichtung (netto)" value={String(saetze.vertragserrichtungPct)} onChange={satzSetter("vertragserrichtungPct")} suffix="%" step={0.1} />
              <Feld label="Maklerprovision (netto)" value={String(saetze.maklerprovisionPct)} onChange={satzSetter("maklerprovisionPct")} suffix="%" step={0.1} />
              <Feld label="Gebäudeanteil am Kaufpreis" value={String(saetze.gebaeudeanteilPct)} onChange={satzSetter("gebaeudeanteilPct")} suffix="%" step={1} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Direktkauf vs. Holding-Struktur</h3>
          <label className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <input type="checkbox" checked={ueberHolding} onChange={(e) => setUeberHolding(e.target.checked)} className="mt-0.5 size-4" />
            <span>
              Über eine Holding mit eigener Immobilien-GmbH kaufen (Haftungstrennung von der
              operativen Gesellschaft), statt direkt durch die operative GmbH.
            </span>
          </label>
          <p className="text-xs text-muted-foreground">
            Steuerlich macht das <strong className="text-foreground">keinen Unterschied</strong> —
            beide Wege vermeiden die KESt-Leckage beim Kapitaltransfer gleichermaßen. Der einzige
            Effekt einer Holding ist Haftungstrennung, erkauft mit den Fixkosten einer weiteren
            Gesellschaft (eigene Bilanz, eigener Jahresabschluss, ggf. eigene Gründungskosten).
          </p>
          {ueberHolding && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Feld label="Zusätzliche Fixkosten Holding/Immo-GmbH (€/Jahr)" value={holdingFixkostenJahr} onChange={setHoldingFixkostenJahr} step={100} min={0} />
              <Feld label="Einmalige Gründungskosten (€)" value={holdingGruendungskostenEinmalig} onChange={setHoldingGruendungskostenEinmalig} step={100} min={0} />
            </div>
          )}
        </CardContent>
      </Card>

      {erg.warnungen.length > 0 && (
        <div className="flex flex-col gap-2">
          {erg.warnungen.map((w) => (
            <div key={w} className="rounded-lg border bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {w}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Privat gekauft</h3>
            <div className="text-xl font-bold tabular-nums">{kreditFormatEUR(erg.endwertPrivat)}</div>
            <div className="flex flex-col gap-1.5 border-t pt-3 text-sm">
              <ZeilePos label="Eigenmittel nach Steuer" value={kreditFormatEUR(erg.eigenmittelPrivat)} muted />
              <ZeilePos label="Kreditbetrag" value={kreditFormatEUR(erg.wohnungPrivat.kreditbetrag)} muted />
              <ZeilePos label="Steuer auf Vermietung, kumuliert" value={"−" + kreditFormatEUR(-erg.wohnungPrivat.steuerEffektKumuliert)} muted />
              <ZeilePos label={`ImmoESt bei Verkauf (${kreditFormatPct(30, 0)})`} value={"−" + kreditFormatEUR(erg.wohnungPrivat.immoEst)} muted />
              <ZeilePos label="Endwert nach Verkauf" value={kreditFormatEUR(erg.endwertPrivat)} bold />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">GmbH — bleibt drin</h3>
            <div className="text-xl font-bold tabular-nums">{kreditFormatEUR(erg.endwertGmbhThesauriert)}</div>
            <div className="flex flex-col gap-1.5 border-t pt-3 text-sm">
              <ZeilePos label="Eigenmittel nach KöSt" value={kreditFormatEUR(erg.eigenmittelGmbh)} muted />
              <ZeilePos label="Kreditbetrag" value={kreditFormatEUR(erg.wohnungGmbh.kreditbetrag)} muted />
              <ZeilePos label="KöSt auf Vermietung, kumuliert" value={"−" + kreditFormatEUR(-erg.wohnungGmbh.steuerEffektKumuliert)} muted />
              <ZeilePos label={`KöSt bei Verkauf (${kreditFormatPct(23, 0)})`} value={"−" + kreditFormatEUR(erg.wohnungGmbh.immoEst)} muted />
              {erg.holdingFixkostenGesamt > 0 && <ZeilePos label="− Holding-Fixkosten gesamt" value={"−" + kreditFormatEUR(erg.holdingFixkostenGesamt)} muted />}
              <ZeilePos label="Endwert, bleibt im Unternehmen" value={kreditFormatEUR(erg.endwertGmbhThesauriert)} bold />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">GmbH — danach ausgeschüttet</h3>
            <div className="text-xl font-bold tabular-nums">{kreditFormatEUR(erg.endwertGmbhAusgeschuettet)}</div>
            <div className="flex flex-col gap-1.5 border-t pt-3 text-sm">
              <ZeilePos label="Endwert vor Ausschüttung" value={kreditFormatEUR(erg.endwertGmbhThesauriert)} muted />
              <ZeilePos label="− KESt bei Ausschüttung (27,5 %)" value={"−" + kreditFormatEUR(erg.endwertGmbhThesauriert - erg.endwertGmbhAusgeschuettet)} muted />
              <ZeilePos label="Netto privat verfügbar" value={kreditFormatEUR(erg.endwertGmbhAusgeschuettet)} bold />
            </div>
            <p className="text-xs text-muted-foreground">
              Vereinfachend mit KESt auf den vollen Betrag gerechnet — eine Kapitalrückzahlung bis
              zur Höhe der eingelegten Eigenmittel wäre real teilweise KESt-frei möglich
              (Einlagenrückgewähr), das braucht aber echte Beratung im Einzelfall.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card style={{ background: "linear-gradient(135deg,#0B1F2A 0%,#155767 130%)" }} className="text-white">
        <CardContent className="flex flex-col gap-1">
          <span className="text-xs text-white/70">Beste Option nach {horizontClamped} Jahren</span>
          <span className="text-2xl font-bold tabular-nums">{bester.label}: {kreditFormatEUR(bester.wert)}</span>
          <span className="mt-1 text-xs text-white/70">
            Differenz Privat vs. GmbH (bleibt drin): {erg.endwertGmbhThesauriert - erg.endwertPrivat >= 0 ? "+" : ""}
            {kreditFormatEUR(erg.endwertGmbhThesauriert - erg.endwertPrivat)}
          </span>
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
                <h4 className="mb-2 font-semibold text-foreground">Kaufnebenkosten (beide Wege identisch, Grunderwerbsteuer kennt keine Rechtsform)</h4>
                <div className="flex flex-col gap-1">
                  {erg.wohnungPrivat.kaufNK.positionen.map((p) => (
                    <ZeilePos key={p.label} label={`${p.label} (${p.hinweis})`} value={kreditFormatEUR(p.betrag)} />
                  ))}
                  <ZeilePos label="Summe Kaufnebenkosten" value={kreditFormatEUR(erg.wohnungPrivat.kaufNK.summe)} bold />
                </div>
              </div>
              <div>
                <h4 className="mb-2 font-semibold text-foreground">AfA</h4>
                <div className="flex flex-col gap-1">
                  <ZeilePos label="AfA-Bemessungsgrundlage" value={kreditFormatEUR(erg.wohnungPrivat.afaBasis)} />
                  <ZeilePos label={`Kumulierte AfA nach ${horizontClamped} Jahren`} value={kreditFormatEUR(erg.wohnungPrivat.afaKumuliert)} />
                </div>
              </div>
              <p>
                <strong className="text-foreground">Vereinfachungen:</strong> Die Immobilien-Mechanik
                (Kaufnebenkosten, Annuitätentilgung, AfA, Mietindexierung/Leerstand, Verkauf) ist
                identisch mit dem Finanzierungsrechner — siehe dort für Details. Nicht enthalten:
                Grunderwerbsteuer-Sonderfälle bei Einbringung bereits vorhandener Immobilien in eine
                GmbH, Wegzugs-/Umgründungsfragen einer nachträglichen Holding-Gründung
                (Art. III UmgrStG), sowie eine allfällige Eigennutzung der Immobilie (würde bei einer
                GmbH-Immobilie eine verdeckte Ausschüttung auslösen — hier bewusst nicht abgebildet,
                da die Immobilie laut Annahme vermietet wird).
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
