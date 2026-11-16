// Anlegerwohnungs-Rechner — bildet "DAS IMMO EXCEL - mit Maximalkreditbetrag.xlsx" ab.
// Rechenlogik: src/lib/calc/anlegerwohnung.ts
import { useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { kreditFormatPct } from "@/lib/calc/kredit"
import { berechneAnlegerwohnung } from "@/lib/calc/anlegerwohnung"
import { Feld, ZeilePos } from "@/components/sections/rechner/fields"

const eur = (n: number) => n.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"

function Kachel({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xl font-bold tabular-nums">{value}</span>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </CardContent>
    </Card>
  )
}

const CHECKLISTE = ["Betriebskostenaufstellung", "Nutzwertgutachten", "Energieausweis", "Hausverwaltung"]

export function AnlegerwohnungRechner() {
  const [maxKredit, setMaxKredit] = useState("90")
  const [laufzeit, setLaufzeit] = useState("35")
  const [groesse, setGroesse] = useState("59")
  const [mieteM2, setMieteM2] = useState("7.09")
  const [kaufpreis, setKaufpreis] = useState("103500")
  const [zins, setZins] = useState("3.75")
  const [grenzsteuer, setGrenzsteuer] = useState("40")
  const [eigenmittel, setEigenmittel] = useState("")

  const erg = useMemo(() => berechneAnlegerwohnung({
    maxKreditPct: Number(maxKredit) || 0,
    laufzeitJahre: Math.min(60, Math.max(1, Number(laufzeit) || 0)),
    groesseM2: Number(groesse) || 0,
    mieteProM2: Number(mieteM2) || 0,
    nettokaufpreis: Math.max(0, Number(kaufpreis) || 0),
    zinsPct: Number(zins) || 0,
    grenzsteuerPct: Number(grenzsteuer) || 0,
    eigenmittel: eigenmittel.trim() === "" ? null : Number(eigenmittel) || 0,
  }), [maxKredit, laufzeit, groesse, mieteM2, kaufpreis, zins, grenzsteuer, eigenmittel])

  const neg = (v: number) => (v < 0 ? "text-amber-700" : undefined)

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <strong>Anlegerwohnung:</strong> Kaufkosten, maximaler Kreditbetrag, Rendite und jährlicher Cashflow
        (AfA steuerfrei + Nettogewinn − Tilgung) einer vermieteten Wohnung.
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Eingaben</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Feld label="Nettokaufpreis" value={kaufpreis} onChange={setKaufpreis} suffix="€" step={1000} stepper />
            <Feld label="Größe" value={groesse} onChange={setGroesse} suffix="m²" stepper />
            <Feld label="Netto-Miete / m²" value={mieteM2} onChange={setMieteM2} suffix="€" step={0.1} />
            <Feld label="Maximaler Kreditbetrag" value={maxKredit} onChange={setMaxKredit} suffix="%" />
            <Feld label="Kreditlaufzeit" value={laufzeit} onChange={setLaufzeit} suffix="J." />
            <Feld label="Zinssatz p.a." value={zins} onChange={setZins} suffix="%" step={0.05} />
            <Feld label="Grenzsteuersatz" value={grenzsteuer} onChange={setGrenzsteuer} suffix="%" />
            <div className="flex flex-col gap-1">
              <Feld label="Eigenmittel (leer = Minimum)" value={eigenmittel} onChange={setEigenmittel} suffix="€" step={1000} />
              <span className="text-[11px] text-muted-foreground">{erg.eigenmittelHinweis}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-1.5">
            <h3 className="mb-1 text-sm font-semibold">Kaufkosten</h3>
            <ZeilePos label="Kaufpreis" value={eur(Number(kaufpreis) || 0)} />
            <ZeilePos label="Kaufvertrag (1,5 % vom Bruttopreis)" value={eur(erg.kaufvertrag)} muted />
            <ZeilePos label="Notar (pauschal mit Puffer 1.000 €)" value={eur(erg.notar)} muted />
            <ZeilePos label="Eintragungsgebühren (1,1 % vom Bruttopreis)" value={eur(erg.eintragung)} muted />
            <ZeilePos label="Grunderwerbssteuer (3,5 % vom Bruttopreis)" value={eur(erg.grunderwerbsteuer)} muted />
            <ZeilePos label="Makler (3,6 % vom Bruttopreis)" value={eur(erg.makler)} muted />
            <div className="border-t pt-1.5"><ZeilePos label="Summe ohne Kreditkosten" value={eur(erg.summeOhneKreditkosten)} bold /></div>
            <ZeilePos label="Kaufnebenkosten" value={eur(erg.kaufnebenkosten)} bold />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-1.5">
            <h3 className="mb-1 text-sm font-semibold">Kredit &amp; Eigenmittel</h3>
            <ZeilePos label="Kreditbetrag (max. 90 % + 50 € – sinkt mit mehr Eigenmitteln)" value={eur(erg.kreditbetrag)} bold />
            <ZeilePos label="Errichtung des Kreditvertrages (3 % der Kreditsumme)" value={eur(erg.errichtungKredit)} muted />
            <ZeilePos label="Eintragung des Kredits (1,2 % der Kreditsumme + 20 % Steuern)" value={eur(erg.eintragungKredit)} muted />
            <div className="border-t pt-1.5"><ZeilePos label="Summe Kredit" value={eur(erg.summeKredit)} bold /></div>
            <ZeilePos label="Auszahlungsbetrag" value={eur(erg.auszahlung)} />
            <div className="border-t pt-1.5"><ZeilePos label="Mindest-Eigenmittel" value={eur(erg.mindestEigenmittel)} /></div>
            <ZeilePos label="Eingesetzte Eigenmittel" value={eur(erg.eingesetzteEigenmittel)} bold />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kachel label="Kreditrate / Monat" value={eur(erg.kreditrateMonat)} />
        <Kachel label="Miete / Monat" value={eur(erg.mieteMonat)} />
        <Kachel label="Rendite" value={erg.rendite === null ? "–" : kreditFormatPct(erg.rendite)} />
        <Kachel label="Eigenkapitalrendite" value={erg.ekRendite === null ? "–" : kreditFormatPct(erg.ekRendite)} sub="ohne AfA Vorteile" />
      </div>

      <Card>
        <CardContent>
          <h3 className="mb-3 text-sm font-semibold">AfA (steuerfrei) + Nettogewinn − Tilgung</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-1 pr-3 text-left font-medium">Jahr</th>
                  {["Miete/Monat", "Miete", "Kreditrate", "Restschuld", "Zinsen", "Überschuss vor AfA", "AfA",
                    "Steuerpflichtiger Gewinn", "Nettogewinn", "Tilgung", "Jährlicher Cashflow", "Wohnungswert"].map((h, i, a) => (
                    <th key={h} className={cn("py-1 text-right font-medium whitespace-nowrap", i < a.length - 1 && "pr-3")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {erg.jahre.map((r) => (
                  <tr key={r.jahr} className="border-b border-border/50">
                    <td className="py-1 pr-3 tabular-nums">{r.jahr}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{eur(r.mieteMonat)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{eur(r.mieteJahr)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{eur(r.kreditrate)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{eur(r.restschuld)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{eur(r.zinsen)}</td>
                    <td className={cn("py-1 pr-3 text-right tabular-nums", neg(r.ueberschussVorAfa))}>{eur(r.ueberschussVorAfa)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{eur(r.afa)}</td>
                    <td className={cn("py-1 pr-3 text-right tabular-nums", neg(r.steuerpflGewinn))}>{eur(r.steuerpflGewinn)}</td>
                    <td className={cn("py-1 pr-3 text-right tabular-nums", neg(r.nettogewinn))}>{eur(r.nettogewinn)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{eur(r.tilgung)}</td>
                    <td className={cn("py-1 pr-3 text-right font-semibold tabular-nums", neg(r.cashflow))}>{eur(r.cashflow)}</td>
                    <td className="py-1 text-right tabular-nums">{eur(r.wohnungswert)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-sm font-semibold">
                  <td className="pt-2 pr-3" colSpan={11}>Nettogewinn mit Miete</td>
                  <td className={cn("pt-2 pr-3 text-right tabular-nums", neg(erg.summeCashflow))}>{eur(erg.summeCashflow)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Brauch ich vom Makler</h3>
          <ul className="list-disc pl-5 text-sm">
            {CHECKLISTE.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
