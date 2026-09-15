// Holding & Immobilien-GmbH-Rechner — siehe src/lib/calc/holdingImmobilien.ts für die
// Rechenlogik und die dort dokumentierten Vereinfachungen. Vergleicht drei Wege gleichzeitig:
// Einzelunternehmer (privat investiert), GmbH-Gewinn ausgeschüttet und privat investiert, und
// eine Kapitalgesellschaft (Direktkauf oder über eine Holding), die direkt investiert. Bewusst
// als eigener, schlanker Rechner getrennt vom Rechtsform-Vergleich (EU/GmbH/Zypern) gehalten,
// statt alles in ein Mega-Tool zu packen.
import { useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { KREDIT_DEFAULTS, kreditFormatEUR, type KreditSaetze } from "@/lib/calc/kredit"
import {
  DEFAULTS_HOLDING_IMMO, GMBH_AUSSCHUETTUNG_EFFEKTIV_SATZ, berechneHoldingImmobilien, type HoldingImmoEingabe,
} from "@/lib/calc/holdingImmobilien"
import { KOEST_SATZ } from "@/lib/calc/gmbhVsEu"

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
    verfuegbarerGewinnVorSteuer: n(verfuegbarerGewinnVorSteuer),
    euGrenzsteuersatzPct: n(euGrenzsteuersatzPct), grenzsteuersatzVermietungPct: n(grenzsteuersatzVermietungPct),
    kaufpreis: n(kaufpreis), mitMakler, nkMitfinanziert,
    horizontJahre: horizontClamped, kreditLaufzeitJahre: kreditLaufzeitClamped, kreditZinsPct: n(kreditZinsPct),
    mieteMonat: n(mieteMonat), indexierungPct: n(indexierungPct), leerstandPct: n(leerstandPct),
    bewirtschaftungMonat: n(bewirtschaftungMonat), wertsteigerungPct: n(wertsteigerungPct),
    verkaufskostenPct: n(verkaufskostenPct), saetze,
    ueberHolding, holdingFixkostenJahr: n(holdingFixkostenJahr), holdingGruendungskostenEinmalig: n(holdingGruendungskostenEinmalig),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    verfuegbarerGewinnVorSteuer, euGrenzsteuersatzPct, grenzsteuersatzVermietungPct,
    kaufpreis, mitMakler, nkMitfinanziert, horizontClamped, kreditLaufzeitClamped, kreditZinsPct,
    mieteMonat, indexierungPct, leerstandPct, bewirtschaftungMonat, wertsteigerungPct, verkaufskostenPct, saetze,
    ueberHolding, holdingFixkostenJahr, holdingGruendungskostenEinmalig,
  ])

  const erg = useMemo(() => berechneHoldingImmobilien(eingabe), [eingabe])

  const holdingLabel = ueberHolding ? "Holding + Immobilien-GmbH" : "GmbH (Direktkauf)"
  const kandidaten = [
    { label: "Einzelunternehmer", wert: erg.endwertEu },
    { label: "GmbH, ausgeschüttet & privat investiert", wert: erg.endwertGmbhPrivat },
    { label: holdingLabel, wert: erg.endwertHolding },
  ]
  const bester = kandidaten.reduce((a, b) => (b.wert > a.wert ? b : a))

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
        <strong>Holding &amp; Immobilien-GmbH:</strong> Vergleicht den Kauf einer vermieteten
        Anlegerwohnung über drei Wege — als Einzelunternehmer, über eine GmbH deren Gewinn erst
        ausgeschüttet wird, und über eine Kapitalgesellschaft, die direkt investiert (Direktkauf
        durch die operative GmbH oder über eine Holding mit eigener Immobilien-GmbH zur
        Haftungstrennung). Kaufnebenkosten, Tilgung und AfA rechnen wie im Finanzierungsrechner —
        hier kommt nur die Steuerfrage obendrauf: was die Rechtsform beim Kapitaltransfer und bei
        der laufenden Besteuerung ausmacht.
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Kapitalherkunft</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Feld label="Verfügbarer Gewinn vor Steuer (€)" value={verfuegbarerGewinnVorSteuer} onChange={setVerfuegbarerGewinnVorSteuer} step={5000} min={0} />
            <Feld label="Grenzsteuersatz Einzelunternehmer (%)" value={euGrenzsteuersatzPct} onChange={setEuGrenzsteuersatzPct} step={1} suffix="%" min={0} />
            <Feld label="Grenzsteuersatz auf laufende Vermietungseinkünfte, privat (%)" value={grenzsteuersatzVermietungPct} onChange={setGrenzsteuersatzVermietungPct} step={1} suffix="%" min={0} />
          </div>
          <p className="text-xs text-muted-foreground">
            Der Einzelunternehmer versteuert seinen Gewinn direkt mit dem Grenzsteuersatz (kein
            separater Ausschüttungsschritt). Bei der GmbH kommt vor der Privatinvestition die
            kombinierte Belastung aus 23&nbsp;% KöSt + 27,5&nbsp;% KESt dazu (≈{" "}
            {(GMBH_AUSSCHUETTUNG_EFFEKTIV_SATZ * 100).toFixed(1)}&nbsp;%) — bei einem Direktkauf
            durch die Kapitalgesellschaft entfällt diese Ebene komplett (nur{" "}
            {(KOEST_SATZ * 100).toFixed(0)}&nbsp;% KöSt).
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
          <h3 className="text-sm font-semibold">Kapitalgesellschaft: Direktkauf vs. Holding-Struktur</h3>
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
            <h3 className="text-sm font-semibold">Einzelunternehmer mit Immobilie</h3>
            <div className="text-xl font-bold tabular-nums">{kreditFormatEUR(erg.endwertEu)}</div>
            <div className="flex flex-col gap-1.5 border-t pt-3 text-sm">
              <ZeilePos label="Eigenmittel nach Grenzsteuersatz" value={kreditFormatEUR(erg.eigenmittelEu)} muted />
              <ZeilePos label="Kreditbetrag" value={kreditFormatEUR(erg.wohnungEu.kreditbetrag)} muted />
              <ZeilePos label="Steuer auf Vermietung, kumuliert" value={"−" + kreditFormatEUR(-erg.wohnungEu.steuerEffektKumuliert)} muted />
              <ZeilePos label="ImmoESt bei Verkauf (30 %)" value={"−" + kreditFormatEUR(erg.wohnungEu.immoEst)} muted />
              <ZeilePos label="Endwert nach Verkauf" value={kreditFormatEUR(erg.endwertEu)} bold />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">GmbH, ausgeschüttet &amp; privat investiert</h3>
            <div className="text-xl font-bold tabular-nums">{kreditFormatEUR(erg.endwertGmbhPrivat)}</div>
            <div className="flex flex-col gap-1.5 border-t pt-3 text-sm">
              <ZeilePos label="Eigenmittel nach KöSt + KESt" value={kreditFormatEUR(erg.eigenmittelGmbhPrivat)} muted />
              <ZeilePos label="Kreditbetrag" value={kreditFormatEUR(erg.wohnungGmbhPrivat.kreditbetrag)} muted />
              <ZeilePos label="Steuer auf Vermietung, kumuliert" value={"−" + kreditFormatEUR(-erg.wohnungGmbhPrivat.steuerEffektKumuliert)} muted />
              <ZeilePos label="ImmoESt bei Verkauf (30 %)" value={"−" + kreditFormatEUR(erg.wohnungGmbhPrivat.immoEst)} muted />
              <ZeilePos label="Endwert nach Verkauf" value={kreditFormatEUR(erg.endwertGmbhPrivat)} bold />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">{holdingLabel}</h3>
            <div className="text-xl font-bold tabular-nums">{kreditFormatEUR(erg.endwertHolding)}</div>
            <div className="flex flex-col gap-1.5 border-t pt-3 text-sm">
              <ZeilePos label="Eigenmittel nach KöSt" value={kreditFormatEUR(erg.eigenmittelHolding)} muted />
              <ZeilePos label="Kreditbetrag" value={kreditFormatEUR(erg.wohnungHolding.kreditbetrag)} muted />
              <ZeilePos label="KöSt auf Vermietung, kumuliert" value={"−" + kreditFormatEUR(-erg.wohnungHolding.steuerEffektKumuliert)} muted />
              <ZeilePos label="KöSt bei Verkauf (23 %)" value={"−" + kreditFormatEUR(erg.wohnungHolding.immoEst)} muted />
              {erg.holdingFixkostenGesamt > 0 && <ZeilePos label="− Holding-Fixkosten gesamt" value={"−" + kreditFormatEUR(erg.holdingFixkostenGesamt)} muted />}
              <ZeilePos label="Endwert, bleibt im Unternehmen" value={kreditFormatEUR(erg.endwertHolding)} bold />
            </div>
            <p className="text-xs text-muted-foreground">
              Bleibt in der Gesellschaft. Wird der Betrag später privat entnommen, kommt nochmal
              27,5&nbsp;% KESt obendrauf — ökonomisch landest du dann in der Nähe der mittleren
              Spalte, nur zeitlich verzögert (die laufenden Jahre profitierten trotzdem von der
              niedrigeren 23&nbsp;% KöSt statt dem persönlichen Grenzsteuersatz).
            </p>
          </CardContent>
        </Card>
      </div>

      <Card style={{ background: "linear-gradient(135deg,#0B1F2A 0%,#155767 130%)" }} className="text-white">
        <CardContent className="flex flex-col gap-1">
          <span className="text-xs text-white/70">Beste Option nach {horizontClamped} Jahren</span>
          <span className="text-2xl font-bold tabular-nums">{bester.label}: {kreditFormatEUR(bester.wert)}</span>
          <span className="mt-1 text-xs text-white/70">
            Differenz {holdingLabel} vs. Einzelunternehmer: {erg.endwertHolding - erg.endwertEu >= 0 ? "+" : ""}
            {kreditFormatEUR(erg.endwertHolding - erg.endwertEu)} · vs. GmbH ausgeschüttet: {erg.endwertHolding - erg.endwertGmbhPrivat >= 0 ? "+" : ""}
            {kreditFormatEUR(erg.endwertHolding - erg.endwertGmbhPrivat)}
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
                <h4 className="mb-2 font-semibold text-foreground">Kaufnebenkosten (bei allen drei Wegen identisch, Grunderwerbsteuer kennt keine Rechtsform)</h4>
                <div className="flex flex-col gap-1">
                  {erg.wohnungEu.kaufNK.positionen.map((p) => (
                    <ZeilePos key={p.label} label={`${p.label} (${p.hinweis})`} value={kreditFormatEUR(p.betrag)} />
                  ))}
                  <ZeilePos label="Summe Kaufnebenkosten" value={kreditFormatEUR(erg.wohnungEu.kaufNK.summe)} bold />
                </div>
              </div>
              <div>
                <h4 className="mb-2 font-semibold text-foreground">AfA</h4>
                <div className="flex flex-col gap-1">
                  <ZeilePos label="AfA-Bemessungsgrundlage" value={kreditFormatEUR(erg.wohnungEu.afaBasis)} />
                  <ZeilePos label={`Kumulierte AfA nach ${horizontClamped} Jahren`} value={kreditFormatEUR(erg.wohnungEu.afaKumuliert)} />
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
