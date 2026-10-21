// Beförderungs-Fortschritt (nächste Stufe + fehlende Kriterien) — gemeinsam genutzt vom
// Strukturbaum-Seitenpanel und vom Reiter "Mein Karrierestand".
import { fmt } from "@/lib/calc/format"
import type { PromotionProgress } from "@/lib/calc/befoerderung"
import { cn } from "@/lib/utils"

export function PromotionPanel({ promotion, className }: { promotion: PromotionProgress; className?: string }) {
  return (
    <div className={cn("rounded-md border bg-muted/30 p-3", className)}>
      <div className="mb-2 text-xs font-semibold">
        {promotion.nextRole
          ? <>🎯 Nächste Stufe: {promotion.nextRole}</>
          : "🏆 Höchste Stufe erreicht"}
      </div>
      {promotion.criteria.length > 0 && (
        <div className="flex flex-col gap-2">
          {promotion.criteria.map((c) => {
            const pct = c.need > 0 ? Math.min(100, Math.round((c.have / c.need) * 100)) : 100
            const done = c.have >= c.need
            return (
              <div key={c.kind}>
                <div className="mb-0.5 flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">
                    {c.label}
                    {c.relaxed && " (erleichtert)"}
                  </span>
                  <span className="font-medium tabular-nums">
                    {fmt(c.have)} / {fmt(c.need)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", done ? "bg-emerald-500" : "bg-primary")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {c.sources && c.sources.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-0.5 border-l pl-2">
                    {c.sources.map((s) => (
                      <li
                        key={s.name}
                        className={cn(
                          "flex items-center justify-between text-[10px]",
                          s.excludedReason ? "text-muted-foreground/70" : "text-muted-foreground"
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
        <div className="mt-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
          ✓ Alle erfassten Kriterien für {promotion.nextRole} erfüllt
        </div>
      )}
      {promotion.nextRole && (
        <div className="mt-2 text-[10px] leading-snug text-muted-foreground">
          Gruppenproduktion = Person + gesamter Unterbau, alle Sparten · Ziel/Monat aus
          dem Quartalsziel des Karriereplans hochgerechnet. Realisierungsquote, Wartezeiten
          und die Bestätigung durch die Geschäftsführung sind hier nicht geprüft.
        </div>
      )}
    </div>
  )
}
