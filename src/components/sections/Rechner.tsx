// Rechner-Sektion — Äquivalent zu section-rechner + initRechnerTabs() aus
// legacy/index.html:1842–2011, 5023–5036.
import { useState } from "react"
import { cn } from "@/lib/utils"
import { EhRechner } from "@/components/sections/rechner/EhRechner"
import { UmdrehRechner } from "@/components/sections/rechner/UmdrehRechner"
import { RenditeRechner } from "@/components/sections/rechner/RenditeRechner"
import { MsciVvRechner } from "@/components/sections/rechner/MsciVvRechner"
import type { PlanId } from "@/lib/calc/struktur"

type RechnerTab = "eh" | "umdreh" | "rendite" | "msciVv"

const TABS: { id: RechnerTab; label: string; editorOnly?: boolean }[] = [
  { id: "eh", label: "EH-Rechner" },
  { id: "umdreh", label: "Umdrehrechner" },
  { id: "rendite", label: "Renditerechner" },
  { id: "msciVv", label: "MSCI World vs. VV", editorOnly: true },
]

export function Rechner({
  employees, isEditor, canBookUnits, onApplyUnits,
}: {
  employees: { name: string; role: string; units: Record<PlanId, number> }[]
  isEditor: boolean
  /** Jeder (auch ohne echten Login, via automatischem anonymem Auth) darf im
   * EH-Rechner Einheiten auf sich buchen — siehe useAuth.ts. */
  canBookUnits: boolean
  onApplyUnits: (name: string, units: Record<PlanId, number>) => void
}) {
  const [tab, setTab] = useState<RechnerTab>("eh")
  const visibleTabs = TABS.filter((t) => !t.editorOnly || isEditor)
  const activeTab = visibleTabs.some((t) => t.id === tab) ? tab : visibleTabs[0].id

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              activeTab === t.id
                ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "eh" && (
        <EhRechner employees={employees} canBook={canBookUnits} onApplyUnits={onApplyUnits} />
      )}
      {activeTab === "umdreh" && <UmdrehRechner />}
      {activeTab === "rendite" && <RenditeRechner />}
      {activeTab === "msciVv" && <MsciVvRechner />}
    </div>
  )
}
