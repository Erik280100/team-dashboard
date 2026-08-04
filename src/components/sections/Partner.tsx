// Partner-Sektion — Reiter-Shell mit den Portal-Kacheln (unverändert aus der
// vorherigen Partner.tsx, jetzt in partner/PartnerPortale.tsx) und den neuen
// Ansprechpersonen bei Partnergesellschaften (partner/PartnerGesellschaften.tsx).
// Pill-Tab-Muster 1:1 aus Rechner.tsx / Guide.tsx übernommen.
import { useState } from "react"
import { cn } from "@/lib/utils"
import { PartnerPortale } from "@/components/sections/partner/PartnerPortale"
import { PartnerGesellschaften } from "@/components/sections/partner/PartnerGesellschaften"

type PartnerTab = "portale" | "gesellschaften"

const TABS: { id: PartnerTab; label: string }[] = [
  { id: "portale", label: "Portale" },
  { id: "gesellschaften", label: "Ansprechpersonen" },
]

export function Partner() {
  const [tab, setTab] = useState<PartnerTab>("portale")

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

      {tab === "portale" && <PartnerPortale />}
      {tab === "gesellschaften" && <PartnerGesellschaften />}
    </div>
  )
}
