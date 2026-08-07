// App-Shell — Äquivalent zum <div class="app"> Grundgerüst aus legacy/index.html
// (Sidebar-Nav, Topbar, Banner, Section-Routing). Section-Inhalte selbst folgen
// in Phase 3; hier steht Navigation, Auth und die Datenschicht-Verdrahtung.
//
// AppShell ist von App abgespalten, weil handleCloseMonth einen Bestätigungs-
// Dialog braucht (useConfirm) — der Context dafür wird von ConfirmProvider
// bereitgestellt, das App selbst rendert. Ein Provider kann seinen eigenen
// Context nicht konsumieren, daher lebt die gesamte Logik in einer Kind-
// Komponente von ConfirmProvider statt in App (analog dazu, wie Kalender.tsx
// useConfirm() bereits als Kind-Komponente nutzt).
import { useEffect, useMemo, useState } from "react"
import { ConfirmProvider, useConfirm } from "@/hooks/useConfirm"
import { DEFAULT_PLAN_RATES, PLAN_IDS, sbRoster, type PlanId } from "@/lib/calc/struktur"
import { mergeRosterWithRows, newRowFor } from "@/lib/calc/team"
import { readPlanUnits, withPlanUnits } from "@/lib/calc/verguetung"
import { MONTH_CLOSE_ENABLED, archiveNow, canCloseMonth, isMonthCloseDue, monthKeyOf, monthLabel, nextMonthGoal } from "@/lib/calc/archive"
import { useAuth } from "@/hooks/useAuth"
import { useHashSection, SECTION_IDS, type SectionId } from "@/hooks/useHashSection"
import { useDashboardDoc } from "@/hooks/useDashboardDoc"
import { useAttendanceDoc } from "@/hooks/useAttendanceDoc"
import { useOrgChartDoc } from "@/hooks/useOrgChartDoc"
import { useFinanzierungenDoc } from "@/hooks/useFinanzierungenDoc"
import { useMonthArchive } from "@/hooks/useMonthArchive"
import { CLOUD_CONFIGURED } from "@/lib/firebase"
import { Sidebar } from "@/components/Sidebar"
import { Topbar } from "@/components/Topbar"
import { Button } from "@/components/ui/button"
import { Overview } from "@/components/sections/Overview"
import { Team } from "@/components/sections/Team"
import { Rechner } from "@/components/sections/Rechner"
import { Karriere } from "@/components/sections/Karriere"
import { Guide } from "@/components/sections/Guide"
import { Kalender } from "@/components/sections/Kalender"
import { Finanzierungen } from "@/components/sections/Finanzierungen"
import { Partner } from "@/components/sections/Partner"
import { StrukturBaum } from "@/components/sections/struktur/StrukturBaum"
import { Statistik } from "@/components/sections/Statistik"
import type { MonthKey } from "@/types/archive"
import type { OrgChartDoc } from "@/types/dashboard"

const SECTION_LABELS: Record<SectionId, string> = {
  overview: "Dashboard",
  team: "Mitarbeiter",
  struktur: "Strukturbaum",
  statistik: "Statistik",
  rechner: "Rechner",
  karriere: "Karrierepläne",
  guide: "Guide",
  kalender: "Kalender/Anwesenheitsliste",
  finanzierungen: "Finanzierungen",
  partner: "Partner",
}

// Nur diese drei Sektionen kennen einen Monatswähler/Archiv-Modus (siehe
// Plan "neues-feature-es-soll-jaunty-cascade"). Statistik zeigt Archiv-Daten
// über einen eigenen Zeitraum-Picker, nicht über den globalen Monatswähler.
const ARCHIVE_SECTIONS = new Set<SectionId>(["overview", "team", "struktur"])

function ArchiveStatusCard({
  month, errored, onBack,
}: {
  month: MonthKey
  errored: boolean
  onBack: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
      {errored ? (
        <>
          <div>Archiv für {monthLabel(month)} konnte nicht geladen werden.</div>
          <Button size="sm" variant="outline" onClick={onBack}>Zurück zum laufenden Monat</Button>
        </>
      ) : (
        <div>Monat {monthLabel(month)} wird geladen…</div>
      )}
    </div>
  )
}

function AppShell() {
  const auth = useAuth()
  const confirm = useConfirm()
  const { section, navigateTo } = useHashSection()
  const dashboard = useDashboardDoc()
  const attendance = useAttendanceDoc()
  const orgChart = useOrgChartDoc()
  const finanzierungen = useFinanzierungenDoc()
  const archive = useMonthArchive(auth.isEditor)

  const [archiveMonth, setArchiveMonth] = useState<MonthKey | null>(null)
  const isArchive = archiveMonth !== null

  // Mobil: Sidebar ist standardmäßig eingeklappt (off-canvas), siehe Sidebar.tsx.
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Archiv-Modus verlassen, sobald eine Sektion ohne Monatswähler aktiv wird
  // (Rechner/Karriere/Guide/Kalender/Partner/Statistik zeigen immer live/den
  // eigenen Zeitraum).
  useEffect(() => {
    if (!ARCHIVE_SECTIONS.has(section)) setArchiveMonth(null)
  }, [section])

  const snapshot = archiveMonth ? archive.getSnapshot(archiveMonth) : null
  const archiveLoading = isArchive && !snapshot
  const archiveErrored = isArchive && archive.snapshotStatus[archiveMonth!] === "error"

  const view = useMemo(() => {
    const orgDoc: OrgChartDoc = snapshot
      ? {
          tree: snapshot.orgChart.tree, notes: snapshot.orgChart.notes,
          conns: snapshot.orgChart.conns, rates: snapshot.orgChart.rates,
          planRates: snapshot.orgChart.planRates,
        }
      : {
          tree: orgChart.tree, notes: orgChart.notes, conns: orgChart.conns,
          rates: orgChart.rates, planRates: orgChart.planRates,
        }
    return {
      rows: snapshot?.rows ?? dashboard.rows,
      teamGoal: snapshot?.teamGoal ?? dashboard.teamGoal,
      history: snapshot?.history ?? dashboard.history,
      orgTree: orgDoc.tree,
      orgDoc,
      planRates: snapshot?.orgChart.planRates ?? (orgChart.planRates ?? DEFAULT_PLAN_RATES),
      now: snapshot ? archiveNow(snapshot.teamGoal) : undefined,
    }
  }, [snapshot, dashboard.rows, dashboard.teamGoal, dashboard.history, orgChart.tree, orgChart.notes, orgChart.conns, orgChart.rates, orgChart.planRates])

  // Sicherheitsnetz: im Archiv-Modus dürfen die Seiten nichts schreiben (die
  // Seiten selbst sind über isEditor={false} bereits schreibgeschützt — siehe
  // z.B. StrukturBaum.tsx onNodePointerDown/persist()-Gates).
  function blocked() {
    console.warn("Archiv-Ansicht ist schreibgeschützt — Änderungen werden nicht gespeichert.")
  }

  // Mitarbeiterliste (wie auf der Team-Seite: aus dem Strukturbaum gespiegelt,
  // "Kommt vielleicht" ausgeblendet), gemergt mit den aktuellen Einheiten — für
  // den Mitarbeiter-Dropdown im EH-Rechner ("Übernehmen"-Buchung) und die
  // Anwesenheitsliste (die dieselbe gefilterte Roster-Reihenfolge nutzt). Immer
  // live, unabhängig vom Archiv-Modus (Rechner/Kalender sind keine Archiv-Sektionen).
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

  async function handleCloseMonth() {
    const month = monthKeyOf(dashboard.teamGoal)
    const nextGoal = nextMonthGoal(dashboard.teamGoal)
    const ok = await confirm(
      `Monat ${monthLabel(month)} (${dashboard.teamGoal.periodStart} – ${dashboard.teamGoal.periodEnd}) abschließen?\n\n` +
      `• Der aktuelle Stand wird als Archiv gespeichert und ist danach über den Monatswähler einsehbar.\n` +
      `• Alle Ist-Werte (Einheiten, AT/BT/ET) werden auf 0 gesetzt — Plan- und Soll-Werte bleiben erhalten.\n` +
      `• "NEU"-Markierungen bleiben bestehen und werden nicht automatisch entfernt.\n` +
      `• Der Umsatzmonat springt auf ${monthLabel(monthKeyOf(nextGoal))}.\n` +
      `• Bitte andere offene Tabs (auch die alte Dashboard-Seite) vorher schließen.\n\n` +
      `Das lässt sich nicht rückgängig machen.`
    )
    if (!ok) return

    const result = await archive.closeMonth({
      month,
      rows: dashboard.rows,
      teamGoal: dashboard.teamGoal,
      history: dashboard.history,
      orgChart: {
        tree: orgChart.tree, notes: orgChart.notes, conns: orgChart.conns,
        rates: orgChart.rates, planRates: orgChart.planRates,
      },
      closedBy: auth.user?.email ?? null,
      commitReset: dashboard.saveAll,
    })
    if (!result.ok) alert(result.message)
  }

  return (
    <div className="flex h-svh overflow-hidden bg-background text-foreground">
      <Sidebar
        section={section}
        onNavigate={navigateTo}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto">
        <Topbar
          auth={auth}
          dashboard={dashboard}
          section={section}
          archive={archive}
          archiveMonth={archiveMonth}
          onSelectMonth={setArchiveMonth}
          canEdit={auth.isEditor && !isArchive}
          onCloseMonth={handleCloseMonth}
          onToggleSidebar={() => setSidebarOpen((o) => !o)}
          attendance={attendance.attendance}
          orgChart={{
            tree: orgChart.tree, notes: orgChart.notes, conns: orgChart.conns,
            rates: orgChart.rates, planRates: orgChart.planRates,
          }}
          financings={finanzierungen.cases}
        />

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
        {isArchive && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-amber-100 px-6 py-2 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <span>
              📁 Archiv-Ansicht: {monthLabel(archiveMonth!)}
              {snapshot ? ` — abgeschlossen am ${new Date(snapshot.closedAt).toLocaleDateString("de-AT")}` : ""}
              {" · nur Lesezugriff"}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setArchiveMonth(null)}>
              Zurück zum laufenden Monat
            </Button>
          </div>
        )}
        {!isArchive && auth.isEditor && isMonthCloseDue(dashboard.teamGoal, archive.index) && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-emerald-50 px-6 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
            <span>
              Der Umsatzmonat {monthLabel(monthKeyOf(dashboard.teamGoal))} ist beendet — jetzt abschließen und archivieren.
            </span>
            <Button
              size="sm"
              onClick={handleCloseMonth}
              disabled={archive.closing || !MONTH_CLOSE_ENABLED || !canCloseMonth(dashboard.teamGoal)}
              title={
                !MONTH_CLOSE_ENABLED
                  ? "Vorübergehend deaktiviert"
                  : !canCloseMonth(dashboard.teamGoal)
                  ? "Erst ab Ende des eingestellten Umsatzmonats möglich"
                  : undefined
              }
            >
              Monat abschließen
            </Button>
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
                archiveLoading ? (
                  <ArchiveStatusCard month={archiveMonth!} errored={archiveErrored} onBack={() => setArchiveMonth(null)} />
                ) : (
                  <Overview
                    key={archiveMonth ?? "live"}
                    rows={view.rows}
                    teamGoal={view.teamGoal}
                    history={view.history}
                    saveGoal={isArchive ? blocked : dashboard.saveGoal}
                    isEditor={auth.isEditor && !isArchive}
                    now={view.now}
                  />
                )
              )}
              {section === id && id === "team" && (
                archiveLoading ? (
                  <ArchiveStatusCard month={archiveMonth!} errored={archiveErrored} onBack={() => setArchiveMonth(null)} />
                ) : (
                  <Team
                    key={archiveMonth ?? "live"}
                    rows={view.rows}
                    saveRows={isArchive ? blocked : dashboard.saveRows}
                    teamGoal={view.teamGoal}
                    orgTree={view.orgTree}
                    orgPlanRates={view.planRates}
                    isEditor={auth.isEditor && !isArchive}
                    now={view.now}
                  />
                )
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
                  employeeRoster={roster}
                  attendance={attendance.attendance}
                  setAttendanceEntry={attendance.setAttendanceEntry}
                  resetAttendance={attendance.resetAttendance}
                  isEditor={auth.isEditor}
                />
              )}
              {section === id && id === "finanzierungen" && (
                <Finanzierungen
                  cases={finanzierungen.cases}
                  addCase={finanzierungen.addCase}
                  patchCase={finanzierungen.patchCase}
                  toggleDoc={finanzierungen.toggleDoc}
                  employeeRoster={roster}
                  removeCase={finanzierungen.removeCase}
                  isEditor={auth.isEditor}
                />
              )}
              {section === id && id === "partner" && <Partner />}
              {section === id && id === "struktur" && (
                archiveLoading ? (
                  <ArchiveStatusCard month={archiveMonth!} errored={archiveErrored} onBack={() => setArchiveMonth(null)} />
                ) : (
                  <StrukturBaum
                    key={archiveMonth ?? "live"}
                    doc={view.orgDoc}
                    rows={view.rows}
                    isEditor={auth.isEditor && !isArchive}
                    saveOrgChart={isArchive ? blocked : orgChart.saveOrgChart}
                  />
                )
              )}
              {section === id && id === "statistik" && <Statistik archive={archive} />}
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}

function App() {
  return (
    <ConfirmProvider>
      <AppShell />
    </ConfirmProvider>
  )
}

export default App
