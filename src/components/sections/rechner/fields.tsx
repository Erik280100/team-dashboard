import { cn } from "@/lib/utils"

// Gemeinsame Bausteine der Rechner-Oberflächen (Eingabefeld, Regler, Ergebniszeile, Zahlen-Parser).
export const INPUT_CLASS = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm tabular-nums text-left shadow-sm transition-colors focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 disabled:opacity-40 disabled:cursor-not-allowed"
export const LABEL_CLASS = "text-sm font-semibold leading-5 text-foreground"

// Einheitliches Raster für alle Eingabe-Formulare: 1 Spalte mobil, 2 ab sm – gleiche Abstände überall.
export const FELD_GRID = "grid gap-x-8 gap-y-5 sm:grid-cols-2"

// Eingabefeld mit Einheit (€, %, Jahre …) rechts innen im Feld.
export function EinheitInput({
  value, onChange, einheit, step, min, max, disabled, placeholder, id, className, onFocus,
}: {
  value: string
  onChange: (v: string) => void
  einheit?: string
  step?: number
  min?: number
  max?: number
  disabled?: boolean
  placeholder?: string
  id?: string
  className?: string
  onFocus?: React.FocusEventHandler<HTMLInputElement>
}) {
  return (
    <div className={cn("relative w-full min-w-0", className)}>
      <input id={id} type="number" min={min} max={max} step={step} value={value} disabled={disabled} placeholder={placeholder} onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)} className={cn(INPUT_CLASS, einheit && "pr-16")} />
      {einheit && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">{einheit}</span>
      )}
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
  label, value, onChange, suffix, step = 1, min, max, className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  suffix?: string
  step?: number
  min?: number
  max?: number
  className?: string
}) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1.5", LABEL_CLASS, className)}>
      {label}
      <EinheitInput value={value} onChange={onChange} einheit={suffix} step={step} min={min} max={max} />
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
      <EinheitInput value={value} onChange={onChange} einheit={suffix} step={step} />
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
