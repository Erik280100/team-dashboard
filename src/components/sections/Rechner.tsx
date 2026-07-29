// Rechner-Sektion — Äquivalent zu section-rechner + initRechnerTabs() aus
// legacy/index.html:1842–2011, 5023–5036.
import { useState } from "react"
import { cn } from "@/lib/utils"
import { EhRechner } from "@/components/sections/rechner/EhRechner"
import { UmdrehRechner } from "@/components/sections/rechner/UmdrehRechner"
import { RenditeRechner } from "@/components/sections/rechner/RenditeRechner"

type RechnerTab = "eh" | "umdreh" | "rendite"

const TABS: { id: RechnerTab; label: string }[] = [
  { id: "eh", label: "EH-Rechner" },
  { id: "umdreh", label: "Umdrehrechner" },
  { id: "rendite", label: "Renditerechner" },
]

export function Rechner() {
  const [tab, setTab] = useState<RechnerTab>("eh")

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "eh" && <EhRechner />}
      {tab === "umdreh" && <UmdrehRechner />}
      {tab === "rendite" && <RenditeRechner />}
    </div>
  )
}
