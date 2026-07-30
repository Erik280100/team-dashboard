// App-Shell — Äquivalent zum <div class="app"> Grundgerüst aus legacy/index.html
// (Sidebar-Nav, Topbar, Banner, Section-Routing). Section-Inhalte selbst folgen
// in Phase 3; hier steht Navigation, Auth und die Datenschicht-Verdrahtung.
import { useMemo } from "react"
import { ConfirmProvider } from "@/hooks/useConfirm"
import { DEFAULT_PLAN_RATES, PLAN_IDS, sbAll, sbRoster, type PlanId } from "@/lib/calc/struktur"
import { mergeRosterWithRows, newRowFor } from "@/lib/calc/team"
import { readPlanUnits, withPlanUnits } from "@/lib/calc/verguetung"
import { useAuth } from "@/hooks/useAuth"
import { useHashSection, SECTION_IDS, type SectionId } from "@/hooks/useHashSection"
import { useDashboardDoc } from "@/hooks/useDashboardDoc"
import { useAttendanceDoc } from "@/hooks/useAttendanceDoc"
import { useOrgChartDoc } from "@/hooks/useOrgChartDoc"
import { CLOUD_CONFIGURED } from "@/lib/firebase"
import { Sidebar } from "@/components/Sidebar"
import { Topbar } from "@/components/Topbar"
import { Overview } from "@/components/sections/Overview"
import { Team } from "@/components/sections/Team"
import { Rechner } from "@/components/sections/Rechner"
import { Karriere } from "@/components/sections/Karriere"
import { Guide } from "@/components/sections/Guide"
import { Kalender } from "@/components/sections/Kalender"
import { Partner } from "@/components/sections/Partner"
import { StrukturBaum } from "@/components/sections/struktur/StrukturBaum"

const SECTION_LABELS: Record<SectionId, string> = {
  overview: "Übersicht",
  team: "Mitarbeiter",
  struktur: "Strukturbaum",
  rechner: "Rechner",
  karriere: "Karrierepläne",
  guide: "Guide",
  kalender: "Kalender/Anwesenheitsliste",
  partner: "Partnerportale",
}

function App() {
  const auth = useAuth()
  const { section, navigateTo } = useHashSection()
  const dashboard = useDashboardDoc()
  const attendance = useAttendanceDoc()
  const orgChart = useOrgChartDoc()

  // Anwesenheitsliste zeigt die Mitarbeiter aus dem Strukturbaum (nicht der
  // Team-Tabelle), alphabetisch sortiert.
  const attendanceNames = useMemo(
    () => sbAll(orgChart.tree).map((n) => n.name).sort((a, b) => a.localeCompare(b, "de")),
    [orgChart.tree]
  )

  // Mitarbeiterliste (wie auf der Team-Seite: aus dem Strukturbaum gespiegelt,
  // "Kommt vielleicht" ausgeblendet), gemergt mit den aktuellen Einheiten — für
  // den Mitarbeiter-Dropdown im EH-Rechner ("Übernehmen"-Buchung).
  const roster = useMemo(() => sbRoster(orgChart.tree), [orgChart.tree])
  const merged = useMemo(() => mergeRosterWithRows(roster, dashboard.rows), [roster, dashboard.rows])
  const rechnerEmployees = useMemo(
    () => merged.map((m) => ({ name: m.name, role: m.role, units: readPlanUnits(m) })),
    [merged]
  )

  /** Bucht Einheiten (je Karriereplan) additiv auf einen Mitarbeiter — siehe
   * "Übernehmen"-Button im EH-Rechner. Legt bei Bedarf eine neue Zeile in
   * dashboard.rows an, analog zu Team.tsx commitField/commitPlanUnits. */
  function applyUnitsToEmployee(name: string, delta: Record<PlanId, number>) {
    const entry = merged.find((m) => m.name === name)
    if (!entry) return
    const current = readPlanUnits(entry)
    const next = {} as Record<PlanId, number>
    PLAN_IDS.forEach((p) => { next[p] = (Number(current[p]) || 0) + (Number(delta[p]) || 0) })
    if (entry.rowIndex !== null) {
      const nextRows = dashboard.rows.map((r, i) => (i === entry.rowIndex ? withPlanUnits(r, next) : r))
      dashboard.saveRows(nextRows)
    } else {
      dashboard.saveRows([...dashboard.rows, withPlanUnits(newRowFor(entry.name), next)])
    }
  }

  return (
    <ConfirmProvider>
      <div className="flex h-svh overflow-hidden bg-background text-foreground">
        <Sidebar section={section} onNavigate={navigateTo} />
        <main className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto">
          <Topbar auth={auth} dashboard={dashboard} />

          {!CLOUD_CONFIGURED && (
            <div className="border-b bg-amber-50 px-6 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Cloud-Speicherung ist noch nicht eingerichtet — Änderungen werden nur in
              diesem Browser gespeichert. Firebase-Konfiguration im Quelltext ergänzen,
              damit alle im Team dieselben Daten sehen.
            </div>
          )}
          {!auth.isEditor && (
            <div className="border-b bg-muted px-6 py-2 text-sm text-muted-foreground">
              Nur Lesezugriff — melde dich an, um Zahlen zu ändern.
            </div>
          )}

          <div className="flex-1 p-6">
            {SECTION_IDS.map((id) => (
              <section
                key={id}
                id={`section-${id}`}
                aria-label={SECTION_LABELS[id]}
                hidden={section !== id}
                tabIndex={-1}
              >
                {section === id && id === "overview" && (
                  <Overview
                    rows={dashboard.rows}
                    teamGoal={dashboard.teamGoal}
                    history={dashboard.history}
                    saveGoal={dashboard.saveGoal}
                    isEditor={auth.isEditor}
                  />
                )}
                {section === id && id === "team" && (
                  <Team
                    rows={dashboard.rows}
                    saveRows={dashboard.saveRows}
                    teamGoal={dashboard.teamGoal}
                    orgTree={orgChart.tree}
                    orgPlanRates={orgChart.planRates ?? DEFAULT_PLAN_RATES}
                    isEditor={auth.isEditor}
                  />
                )}
                {section === id && id === "rechner" && (
                  <Rechner
                    employees={rechnerEmployees}
                    isEditor={auth.isEditor}
                    onApplyUnits={applyUnitsToEmployee}
                  />
                )}
                {section === id && id === "karriere" && <Karriere />}
                {section === id && id === "guide" && <Guide />}
                {section === id && id === "kalender" && (
                  <Kalender
                    employeeNames={attendanceNames}
                    attendance={attendance.attendance}
                    setAttendanceEntry={attendance.setAttendanceEntry}
                  />
                )}
                {section === id && id === "partner" && <Partner />}
                {section === id && id === "struktur" && (
                  <StrukturBaum
                    doc={{
                      tree: orgChart.tree, notes: orgChart.notes, conns: orgChart.conns,
                      rates: orgChart.rates, planRates: orgChart.planRates,
                    }}
                    isEditor={auth.isEditor}
                    saveOrgChart={orgChart.saveOrgChart}
                  />
                )}
              </section>
            ))}
          </div>
        </main>
      </div>
    </ConfirmProvider>
  )
}

export default App
