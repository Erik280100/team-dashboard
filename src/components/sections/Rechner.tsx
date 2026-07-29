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
      <div className="inline-flex w-fit rounded-lg border p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
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
