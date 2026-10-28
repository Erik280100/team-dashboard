import { cn } from "@/lib/utils"

// Gemeinsame Bausteine der Rechner-Oberflächen (Eingabefeld, Regler, Ergebniszeile, Zahlen-Parser).
export const INPUT_CLASS = "h-8 rounded-md border border-input bg-background focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 transition-colors px-2 text-sm"

export function Feld({
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

export function ZeilePos({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className={muted ? "text-muted-foreground" : undefined}>{label}</span>
      <span className={cn("tabular-nums", bold && "font-semibold")}>{value}</span>
    </div>
  )
}

export function PillGroup<T extends string>({
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
