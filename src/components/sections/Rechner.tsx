// Rechner-Sektion — Äquivalent zu section-rechner + initRechnerTabs() aus
// der früheren Einzeldatei-App.
import { useState } from "react"
import { PillTabs } from "@/components/ui/dark"
import { EhRechner } from "@/components/sections/rechner/EhRechner"
import { UmdrehRechner } from "@/components/sections/rechner/UmdrehRechner"
import { RenditeRechner } from "@/components/sections/rechner/RenditeRechner"
import { InvestVsWohnungRechner } from "@/components/sections/rechner/InvestVsWohnungRechner"
import type { PlanId } from "@/lib/calc/struktur"
import type { UmsatzDraft } from "@/lib/calc/umsatz"

type RechnerTab = "eh" | "umdreh" | "rendite" | "investVsWohnung"

const TABS: { id: RechnerTab; label: string }[] = [
  { id: "eh", label: "EH-Rechner" },
  { id: "umdreh", label: "Umdrehrechner" },
  { id: "rendite", label: "Renditerechner" },
  { id: "investVsWohnung", label: "Invest vs. Anlegerwohnung" },
]

export function Rechner({
  employees, abwicklerCandidates, planRates, defaultEmployee, canBookUnits, onApplyUnits,
}: {
  /** Buchbare Mitarbeiter: man selbst und alle darunter. */
  employees: { name: string; role: string; units: Record<PlanId, number> }[]
  /** Alle Mitarbeiter (für die Abwickler-Auswahl bei „Investment (mit VB)“). */
  abwicklerCandidates: { name: string }[]
  /** Stufensätze: bestimmen den Multiplikator je Sparte aus der Stufe des gewählten Mitarbeiters. */
  planRates: Record<PlanId, Record<string, number>>
  /** Vorausgewählter Mitarbeiter (der Eingeloggte selbst). */
  defaultEmployee?: string
  /** Jeder (auch ohne echten Login, via automatischem anonymem Auth) darf im
   * EH-Rechner Einheiten auf sich buchen — siehe useAuth.ts. */
  canBookUnits: boolean
  onApplyUnits: (name: string, units: Record<PlanId, number>, abwickler?: string, sales?: UmsatzDraft[]) => void
}) {
  const [tab, setTab] = useState<RechnerTab>("eh")
  const visibleTabs = TABS
  const activeTab = tab

  return (
    <div className="flex flex-col gap-4">
      <PillTabs tabs={visibleTabs} value={activeTab} onChange={setTab} />

      {activeTab === "eh" && (
        <EhRechner
          employees={employees} abwicklerCandidates={abwicklerCandidates} planRates={planRates}
          defaultEmployee={defaultEmployee} canBook={canBookUnits} onApplyUnits={onApplyUnits}
        />
      )}
      {activeTab === "umdreh" && <UmdrehRechner />}
      {activeTab === "rendite" && <RenditeRechner />}
      {activeTab === "investVsWohnung" && <InvestVsWohnungRechner />}
    </div>
  )
}
