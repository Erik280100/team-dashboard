// Umdrehrechner — Äquivalent zu initUmdrehRechner() aus legacy/index.html:3462–3527.
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useConfirm } from "@/hooks/useConfirm"
import { calcUmdreh, UM_EH_ALT, UM_EH_NEU } from "@/lib/calc/umdreh"
import { ehFormatEUR } from "@/lib/calc/eh"
import { cn } from "@/lib/utils"

// Zahlenfelder werden als Rohtext gehalten, damit das Inputfeld auch leer sein
// kann — bei der Berechnung wird ein leeres Feld intern als 0 behandelt.
interface UmdrehDraft {
  praemie: string
  beraterAlt: string
  beraterNeu: string
  fkAlt: string
  fkNeu: string
  stornoActive: boolean
}

const defaultInputs: UmdrehDraft = {
  praemie: "100", beraterAlt: "0", beraterNeu: "0", fkAlt: "0", fkNeu: "0", stornoActive: false,
}

function DiffValue({ value, onDark }: { value: number; onDark?: boolean }) {
  return (
    <span
      className={cn(
        "font-semibold",
        value < 0 ? (onDark ? "text-[#E2685B]" : "text-destructive") : value > 0 ? "text-[#155767]" : undefined,
        onDark && value >= 0 && "text-[#64DDA3]"
      )}
    >
      {ehFormatEUR(value)} €
    </span>
  )
}

export function UmdrehRechner() {
  const [inputs, setInputs] = useState<UmdrehDraft>(defaultInputs)
  const confirm = useConfirm()
  const r = calcUmdreh({
    praemie: Number(inputs.praemie) || 0,
    beraterAlt: Number(inputs.beraterAlt) || 0,
    beraterNeu: Number(inputs.beraterNeu) || 0,
    fkAlt: Number(inputs.fkAlt) || 0,
    fkNeu: Number(inputs.fkNeu) || 0,
    stornoActive: inputs.stornoActive,
  })

  function set<K extends keyof UmdrehDraft>(key: K, value: UmdrehDraft[K]) {
    setInputs((s) => ({ ...s, [key]: value }))
  }

  async function onReset() {
    const ok = await confirm("Alle Eingaben im Umdrehrechner wirklich zurücksetzen?")
    if (!ok) return
    setInputs(defaultInputs)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
        <strong>Umdrehrechner:</strong> Vergleicht den Verdienst bei Storno eines Altvertrags mit dem Verdienst bei finova.
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Eingabe</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Prämie (€)
              <input type="number" min={0} step={10} value={inputs.praemie}
                onFocus={(e) => e.target.select()}
                onChange={(e) => set("praemie", e.target.value)}
                className="h-9 rounded-md border border-input bg-background focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 transition-colors px-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Einheiten alt
              <input type="text" disabled value={UM_EH_ALT.toFixed(2).replace(".", ",")} className="h-9 rounded-md border border-input bg-muted px-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Einheiten neu
              <input type="text" disabled value={UM_EH_NEU.toFixed(2).replace(".", ",")} className="h-9 rounded-md border border-input bg-muted px-2 text-sm" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {([
              ["Berater-Stufe alt (€/EH)", "beraterAlt"],
              ["Berater-Stufe neu (€/EH)", "beraterNeu"],
              ["FK-Stufe alt (€/EH)", "fkAlt"],
              ["FK-Stufe neu (€/EH)", "fkNeu"],
            ] as const).map(([label, key]) => (
              <label key={key} className="flex flex-col gap-1 text-xs text-muted-foreground">
                {label}
                <input type="number" min={0} step={0.1} value={inputs[key]}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => set(key, e.target.value)}
                  className="h-9 rounded-md border border-input bg-background focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 transition-colors px-2 text-sm" />
              </label>
            ))}
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={inputs.stornoActive} onChange={(e) => set("stornoActive", e.target.checked)} className="size-4" />
            Stornoreserve berücksichtigen (15% werden von allen verdienten Summen abgezogen und nicht ausgezahlt)
          </label>
        </CardContent>
      </Card>

      {inputs.stornoActive && (
        <div className="rounded-lg border bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Hinweis: Die Stornoreserve (15%) wurde berücksichtigt — alle angezeigten Beträge sind
          bereits um die einbehaltene Stornoreserve reduziert.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Berater</h3>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Storno-Minus</span><span>{ehFormatEUR(r.beraterMinus)} €</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Aktuell</span><span>{ehFormatEUR(r.beraterAktuell)} €</span></div>
            <div className="flex justify-between border-t pt-2 text-sm"><span className="text-muted-foreground">Differenz</span><DiffValue value={r.beraterDiff} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Führungskraft</h3>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Storno-Minus</span><span>{ehFormatEUR(r.fkMinus)} €</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Aktuell</span><span>{ehFormatEUR(r.fkAktuell)} €</span></div>
            <div className="flex justify-between border-t pt-2 text-sm"><span className="text-muted-foreground">Differenz</span><DiffValue value={r.fkDiff} /></div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none bg-[linear-gradient(135deg,#0B1F2A_0%,#155767_130%)] text-white">
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs text-white/60">Storno-Minus gesamt</div>
            <div className="text-lg font-bold tabular-nums">{ehFormatEUR(r.gesamtMinus)} €</div>
          </div>
          <div>
            <div className="text-xs text-white/60">Aktuell gesamt</div>
            <div className="text-lg font-bold tabular-nums">{ehFormatEUR(r.gesamtAktuell)} €</div>
          </div>
          <div>
            <div className="text-xs text-white/60">Differenz gesamt</div>
            <div className="text-lg font-bold tabular-nums"><DiffValue value={r.gesamtDiff} onDark /></div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
            onClick={onReset}
          >
            Zurücksetzen
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
