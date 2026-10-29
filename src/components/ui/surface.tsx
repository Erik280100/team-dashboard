// Gemeinsame Bausteine im hellen Finova-Look (weiße Karten, Mint-Rand, grüner Akzent) —
// dieselbe Optik wie die offizielle Finova-App, damit alle Seiten einheitlich wirken.
import type { ReactNode } from "react"
import { Check, X, type LucideIcon } from "lucide-react"
import { SURFACE_CARD } from "@/lib/chartSetup"
import { cn } from "@/lib/utils"

export { SURFACE_CARD }

/** Eingabefelder: weiß, grauer Rand, gut lesbare Platzhalter. */
export const FIELD_INPUT = "border-slate-200 bg-card text-foreground placeholder:text-slate-400"

export const FIELD_SELECT = "border-slate-200 bg-card text-foreground [&>svg]:text-slate-400"
/** Option-Elemente bleiben auf hellem Popup-Hintergrund lesbar. */
export const FIELD_OPTION = "text-foreground"
export const SURFACE_TILE = "rounded-xl border border-finova-border bg-card"

export const SURFACE_TABLE = {
  wrap: "overflow-auto rounded-xl border border-finova-border bg-card",
  table: "w-full border-collapse text-sm text-foreground",
  head: "sticky top-0 z-10 border-b border-slate-200 bg-background px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500",
  row: "border-b border-slate-200 transition-colors last:border-b-0 hover:bg-slate-50",
  foot: "sticky bottom-0 z-10 border-t border-slate-200 bg-finova-soft px-3 py-2.5 font-bold tabular-nums",
}

const PILL_BASE = "rounded-lg border px-3 py-1.5 text-sm font-bold transition-colors"
const PILL_ACTIVE = "border-transparent bg-primary text-primary-foreground"
const PILL_INACTIVE = "border-slate-200 bg-card text-foreground hover:bg-slate-100"

/** Einzelner Filter-Tab (für Leisten, die nicht aus einer Liste entstehen). */
export function Pill({
  active, onClick, children, className,
}: { active: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(PILL_BASE, active ? PILL_ACTIVE : PILL_INACTIVE, className)}
    >
      {children}
    </button>
  )
}

export function PillTabs<T extends string>({
  tabs, value, onChange, className,
}: {
  tabs: { id: T; label: ReactNode }[]
  value: T
  onChange: (id: T) => void
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {tabs.map((t) => (
        <Pill key={t.id} active={value === t.id} onClick={() => onChange(t.id)}>{t.label}</Pill>
      ))}
    </div>
  )
}

const BADGE_TONES = {
  green: "bg-finova-soft text-finova-ink",
  blue: "bg-info-soft text-info",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-700",
  grey: "border border-slate-200 bg-card text-slate-500",
} as const

/** Runde Status-/Kategorie-Marke (KFZ, Erfolgreich, Teilweise erfolgreich …). */
export function Badge({
  tone = "green", children, className,
}: { tone?: keyof typeof BADGE_TONES; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", BADGE_TONES[tone], className)}>
      {children}
    </span>
  )
}

export function KpiTile({
  icon: Icon, label, value, sub,
}: { icon: LucideIcon; label: string; value: ReactNode; sub?: string }) {
  return (
    <div className={cn(SURFACE_TILE, "flex items-center gap-4 px-4 py-3")}>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-finova-soft">
        <Icon className="size-4 text-finova-green" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
        <div className="truncate text-2xl font-extrabold tabular-nums">{value}</div>
        {sub && <div className="truncate text-xs text-slate-500">{sub}</div>}
      </div>
    </div>
  )
}

/** Seitenkopf: Titel in Großbuchstaben, graue Unterzeile, rechts Aktionen, darunter KPI-Kacheln o. Ä. */
export function SectionHero({
  eyebrow, title, badge, description, actions, children, className,
}: {
  eyebrow?: string
  title: string
  badge?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{eyebrow}</div>}
          <h2 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold uppercase">
            {title}
            {badge && <Badge>{badge}</Badge>}
          </h2>
          {description && <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

/** Ein/Aus-Schalter (Finova-Grün). */
export function Switch({
  checked, onChange, children, title,
}: { checked: boolean; onChange: (next: boolean) => void; children: ReactNode; title?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      title={title}
      className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-card px-3 text-sm font-semibold text-foreground"
    >
      <span className={cn("relative inline-block h-5 w-9 rounded-full transition-colors", checked ? "bg-primary" : "bg-slate-200")}>
        <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </span>
      {children}
    </button>
  )
}

/** Anwesend/Abwesend als Segment statt Checkbox. */
export function PresenceToggle({
  label, present, onChange, disabled,
}: { label: string; present: boolean; onChange: (present: boolean) => void; disabled?: boolean }) {
  const seg = "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50"
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-0.5 rounded-full border border-slate-200 bg-slate-100 p-0.5">
      <button
        type="button" role="radio" aria-checked={present} disabled={disabled}
        onClick={() => onChange(true)}
        className={cn(seg, present ? "bg-primary text-primary-foreground" : "text-slate-500 hover:text-foreground")}
      >
        <Check className="size-3.5" aria-hidden="true" /> Anwesend
      </button>
      <button
        type="button" role="radio" aria-checked={!present} disabled={disabled}
        onClick={() => onChange(false)}
        className={cn(seg, !present ? "bg-destructive text-white" : "text-slate-500 hover:text-foreground")}
      >
        <X className="size-3.5" aria-hidden="true" /> Abwesend
      </button>
    </div>
  )
}

/** Fortschrittsbalken in Finova-Grün. */
export function MintBar({ pct, tone = "mint", className }: { pct: number; tone?: "mint" | "red" | "amber"; className?: string }) {
  const fill = tone === "red" ? "bg-destructive" : tone === "amber" ? "bg-amber" : "bg-primary"
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-slate-200", className)}>
      <div className={cn("h-full rounded-full transition-[width]", fill)} style={{ width: `${Math.max(0, Math.min(pct, 100))}%` }} />
    </div>
  )
}
