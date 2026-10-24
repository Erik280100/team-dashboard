// Beförderungs-Fortschritt (nächste Stufe + fehlende Kriterien) — gemeinsam genutzt vom
// Strukturbaum-Seitenpanel (hell) und vom Reiter "Mein Karrierestand" (dunkel).
import { fmt } from "@/lib/calc/format"
import type { PromotionProgress } from "@/lib/calc/befoerderung"
import { DARK_CARD, MintBar } from "@/components/ui/dark"
import { cn } from "@/lib/utils"

export function PromotionPanel({
  promotion, className, variant = "light",
}: { promotion: PromotionProgress; className?: string; variant?: "light" | "dark" }) {
  const dark = variant === "dark"
  const muted = dark ? "text-white/75" : "text-muted-foreground"
  return (
    <div className={cn(dark ? cn("rounded-xl border p-4", DARK_CARD) : "rounded-md border bg-muted/30 p-3", className)}>
      <div className={cn("mb-2 font-semibold", dark ? "text-sm" : "text-xs")}>
        {promotion.nextRole
          ? <>🎯 Nächste Stufe: {promotion.nextRole}</>
          : "🏆 Höchste Stufe erreicht"}
      </div>
      {promotion.criteria.length > 0 && (
        <div className={cn("flex flex-col", dark ? "gap-3" : "gap-2")}>
          {promotion.criteria.map((c) => {
            const pct = c.need > 0 ? Math.min(100, Math.round((c.have / c.need) * 100)) : 100
            const done = c.have >= c.need
            return (
              <div key={c.kind}>
                <div className="mb-0.5 flex items-center justify-between text-[11px]">
                  <span className={muted}>
                    {c.label}
                    {c.relaxed && " (erleichtert)"}
                  </span>
                  <span className="font-medium tabular-nums">
                    {fmt(c.have)} / {fmt(c.need)}
                  </span>
                </div>
                {dark ? (
                  <MintBar pct={pct} />
                ) : (
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", done ? "bg-emerald-500" : "bg-primary")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
                {c.sources && c.sources.length > 0 && (
                  <ul className={cn("mt-1 flex flex-col gap-0.5 border-l pl-2", dark && "border-white/15")}>
                    {c.sources.map((s) => (
                      <li
                        key={s.name}
                        className={cn(
                          "flex items-center justify-between text-[10px]",
                          s.excludedReason ? (dark ? "text-white/55" : "text-muted-foreground/70") : muted
                        )}
                      >
                        <span className="truncate">
                          {s.name} <span className="opacity-70">({s.role})</span>
                          {s.excludedReason && <span className="italic"> — {s.excludedReason}</span>}
                        </span>
                        <span className="shrink-0 pl-2 tabular-nums">{s.value}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
      {promotion.ready && (
        <div className={cn("mt-2 text-[11px] font-medium", dark ? "text-[#64DDA3]" : "text-emerald-600 dark:text-emerald-400")}>
          ✓ Alle erfassten Kriterien für {promotion.nextRole} erfüllt
        </div>
      )}
      {promotion.nextRole && (
        <div className={cn("mt-2 text-[10px] leading-snug", muted)}>
          Gruppenproduktion = Person + gesamter Unterbau, alle Sparten · Ziel/Monat aus
          dem Quartalsziel des Karriereplans hochgerechnet. Realisierungsquote, Wartezeiten
          und die Bestätigung durch die Geschäftsführung sind hier nicht geprüft.
        </div>
      )}
    </div>
  )
}
