// Gemeinsame Bausteine im dunklen Dashboard-Look (Navy-Verlauf, Mint-Akzent) —
// dieselbe Optik wie Overview.tsx und die Karriere-Kacheln, damit alle Seiten einheitlich wirken.
import type { ReactNode } from "react"
import { Check, X, type LucideIcon } from "lucide-react"
import { DARK_CARD } from "@/lib/chartSetup"
import { cn } from "@/lib/utils"

export { DARK_CARD }

/** Eingabefelder auf dunklem Grund: deutlicher Rand, hellere Füllung, gut lesbare Platzhalter. */
export const DARK_INPUT = "border-white/35 bg-white/[.12] text-white placeholder:text-white/65 [color-scheme:dark]"

export const DARK_SELECT = "border-white/35 bg-white/[.12] text-white [&>svg]:text-white/80"
/** Option-Elemente bleiben auf hellem Popup-Hintergrund lesbar. */
export const DARK_OPTION = "text-foreground"
export const DARK_TILE = "rounded-[12px] border border-white/10 bg-white/[.04]"

export const DARK_TABLE = {
  wrap: "overflow-auto rounded-xl border border-white/10",
  table: "w-full border-collapse text-sm text-white",
  head: "sticky top-0 z-10 border-b-2 border-white/25 bg-[#0f2633] px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-white/90",
  row: "border-b border-white/15 transition-colors even:bg-white/[.04] hover:bg-white/[.08]",
  foot: "sticky bottom-0 z-10 border-t border-white/15 bg-[#12372f] px-3 py-2.5 font-bold tabular-nums",
}

const PILL_BASE = "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors"
const PILL_ACTIVE = "border-transparent bg-[linear-gradient(135deg,#64DDA3,#3FCB8E)] text-[#0b1f2a] shadow-[0_4px_14px_rgba(63,203,142,.3)]"
const PILL_INACTIVE = "border-white/10 bg-[#122c3a] text-white/85 hover:border-[#64DDA3]/40 hover:text-white"

/** Einzelne Pill (für Leisten, die nicht aus einer Liste entstehen). */
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

export function KpiTile({
  icon: Icon, label, value, sub,
}: { icon: LucideIcon; label: string; value: ReactNode; sub?: string }) {
  return (
    <div className={cn(DARK_TILE, "flex items-center gap-4 px-4 py-3")}>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#64DDA3]/15">
        <Icon className="size-4 text-[#64DDA3]" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[11px] font-bold uppercase tracking-wide text-white/90">{label}</div>
        <div className="truncate text-2xl font-extrabold tabular-nums">{value}</div>
        {sub && <div className="truncate text-xs text-white/90">{sub}</div>}
      </div>
    </div>
  )
}

/** Dunkle Kopfkarte einer Seite: Titel, Badge, Erklärtext, rechts Aktionen, darunter KPI-Kacheln o. Ä. */
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
    <div className={cn("flex flex-col gap-4 rounded-xl border px-5 py-5 shadow-sm", DARK_CARD, className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <div className="text-[11px] font-bold uppercase tracking-wide text-[#64DDA3]">{eyebrow}</div>}
          <h2 className="flex flex-wrap items-center gap-2 text-xl font-extrabold">
            {title}
            {badge && (
              <span className="rounded-full bg-[#64DDA3]/15 px-2.5 py-1 text-xs font-bold text-[#64DDA3]">{badge}</span>
            )}
          </h2>
          {description && <p className="mt-1 max-w-3xl text-xs text-white/90">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

/** Ein/Aus-Schalter (Mint). */
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
      className="flex h-9 items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 text-sm text-white"
    >
      <span className={cn("relative inline-block h-5 w-9 rounded-full transition-colors", checked ? "bg-[#3FCB8E]" : "bg-white/25")}>
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
    <div role="radiogroup" aria-label={label} className="inline-flex gap-0.5 rounded-full border border-white/10 bg-white/5 p-0.5">
      <button
        type="button" role="radio" aria-checked={present} disabled={disabled}
        onClick={() => onChange(true)}
        className={cn(seg, present ? "bg-[#3FCB8E] text-[#0b1f2a]" : "text-white/90 hover:text-white")}
      >
        <Check className="size-3.5" aria-hidden="true" /> Anwesend
      </button>
      <button
        type="button" role="radio" aria-checked={!present} disabled={disabled}
        onClick={() => onChange(false)}
        className={cn(seg, !present ? "bg-[#e2685b] text-white" : "text-white/90 hover:text-white")}
      >
        <X className="size-3.5" aria-hidden="true" /> Abwesend
      </button>
    </div>
  )
}

/** Fortschrittsbalken im Mint-Verlauf wie auf dem Dashboard. */
export function MintBar({ pct, tone = "mint", className }: { pct: number; tone?: "mint" | "red" | "amber"; className?: string }) {
  const fill = tone === "red" ? "bg-[#e2685b]" : tone === "amber" ? "bg-[#E7A94C]" : "bg-[linear-gradient(90deg,#3FCB8E,#64DDA3)]"
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-white/15", className)}>
      <div className={cn("h-full rounded-full transition-[width]", fill)} style={{ width: `${Math.max(0, Math.min(pct, 100))}%` }} />
    </div>
  )
}
