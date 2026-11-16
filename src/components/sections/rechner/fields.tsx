import { cn } from "@/lib/utils"

// Gemeinsame Bausteine der Rechner-Oberflächen (Eingabefeld, Regler, Ergebniszeile, Zahlen-Parser).
export const INPUT_CLASS = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm tabular-nums text-center shadow-sm transition-colors focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 disabled:opacity-40 disabled:cursor-not-allowed"
export const LABEL_CLASS = "text-[11px] leading-4 font-medium uppercase tracking-wider text-muted-foreground"

// Einheitliches Raster für alle Eingabe-Formulare: 1 Spalte mobil, 2 ab sm, 3 ab lg – gleiche Abstände überall.
export const FELD_GRID = "grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3"

function decimals(step: number) {
  const s = String(step)
  const i = s.indexOf(".")
  return i < 0 ? 0 : s.length - i - 1
}

// Zahlenfeld mit runden −/+ Buttons (für die Hauptwerte eines Rechners).
export function Stepper({
  value, onChange, step = 1, min = 0, max, disabled, id, className,
}: {
  value: string
  onChange: (v: string) => void
  step?: number
  min?: number
  max?: number
  disabled?: boolean
  id?: string
  className?: string
}) {
  const num = Number(String(value).replace(",", ".")) || 0
  const d = decimals(step)
  const set = (n: number) => {
    let v = n
    if (min !== undefined) v = Math.max(min, v)
    if (max !== undefined) v = Math.min(max, v)
    onChange(String(+v.toFixed(d)))
  }
  const btn = "flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold leading-none text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button type="button" aria-label="Verringern" disabled={disabled} className={btn} onClick={() => set(num - step)}>−</button>
      <input id={id} type="number" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(e.target.value)} className={cn(INPUT_CLASS, "min-w-0 flex-1")} />
      <button type="button" aria-label="Erhöhen" disabled={disabled} className={btn} onClick={() => set(num + step)}>+</button>
    </div>
  )
}

// Beliebiges Steuerelement als Rasterzelle: Label-Zeile (optional mit Checkbox) + Steuerelement darunter.
export function Zelle({
  label, check, children, className,
}: {
  label: string
  check?: { checked: boolean; onChange: (v: boolean) => void }
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {check ? (
        <label className={cn("flex items-center gap-2", LABEL_CLASS)}>
          <input type="checkbox" checked={check.checked} onChange={(e) => check.onChange(e.target.checked)} className="size-4" />
          {label}
        </label>
      ) : (
        <div className={LABEL_CLASS}>{label}</div>
      )}
      {children}
    </div>
  )
}

export function Feld({
  label, value, onChange, suffix, step = 1, min, max, className, stepper,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  suffix?: string
  step?: number
  min?: number
  max?: number
  className?: string
  stepper?: boolean
}) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1.5", LABEL_CLASS, className)}>
      {label}
      <div className="flex items-center gap-2">
        {stepper ? (
          <Stepper value={value} onChange={onChange} step={step} min={min ?? 0} max={max} className="flex-1" />
        ) : (
          <input type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(e.target.value)} className={cn(INPUT_CLASS, "min-w-0 flex-1")} />
        )}
        {suffix && <span className="text-xs normal-case tracking-normal">{suffix}</span>}
      </div>
    </label>
  )
}

export function SatzFeld({
  label, value, onChange, suffix = "%", step = 0.1,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  suffix?: string
  step?: number
}) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1.5", LABEL_CLASS)}>
      {label}
      <div className="flex items-center gap-2">
        <input type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)}
          className={cn(INPUT_CLASS, "min-w-0 flex-1")} />
        <span className="text-xs normal-case tracking-normal">{suffix}</span>
      </div>
    </label>
  )
}

export function Regler({
  label, value, onChange, hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  hint?: string
}) {
  const num = Math.min(100, Math.max(0, Number(value) || 0))
  return (
    <label className={cn("flex flex-col gap-1.5", LABEL_CLASS)}>
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <span className="tabular-nums text-sm font-semibold text-foreground">{num.toFixed(0)} %</span>
      </div>
      <input type="range" min={0} max={100} step={5} value={num} onChange={(e) => onChange(e.target.value)} className="w-full accent-primary" />
      {hint && <span className="text-[11px]">{hint}</span>}
    </label>
  )
}

export function ZeilePos({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className={muted ? "text-muted-foreground" : undefined}>{label}</span>
      <span className={cn("tabular-nums", bold && "font-semibold")}>{value}</span>
    </div>
  )
}

export function PillGroup<T extends string>({
  options, value, onChange, fill,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  /** In Rasterzellen: Buttons gleich breit und so hoch wie ein Eingabefeld. */
  fill?: boolean
}) {
  return (
    <div className={cn("flex gap-1.5", fill ? "h-10" : "flex-wrap")}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-bold transition-colors",
            fill && "flex-1",
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
