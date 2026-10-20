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
import { PLAN_IDS, sbRoster, sbScopedTree, withDefaultPlanRates, type PlanId } from "@/lib/calc/struktur"
import { applyMonthStats, mergeRosterWithRows, newRowFor, relabelRowsByRoster, rowsMatchedToRoster } from "@/lib/calc/team"
import { ehAbwicklerOptions } from "@/lib/calc/eh"
import { readPlanUnits, withPlanUnits } from "@/lib/calc/verguetung"
import { MONTH_CLOSE_ENABLED, archiveNow, canCloseMonth, isMonthCloseDue, monthKeyOf, monthLabel, nextMonthGoal } from "@/lib/calc/archive"
import { formatISODateDE, type EmployeeRow } from "@/lib/calc/format"
import { canEditEmployee } from "@/lib/calc/roles"
import { useAuth, type UseAuthResult } from "@/hooks/useAuth"
import { useHashSection, SECTION_IDS, type SectionId } from "@/hooks/useHashSection"
import { useDashboardDoc } from "@/hooks/useDashboardDoc"
import { useAttendanceDoc } from "@/hooks/useAttendanceDoc"
import { useOrgChartDoc } from "@/hooks/useOrgChartDoc"
import { usePlanungDoc } from "@/hooks/usePlanungDoc"
import { useFinanzierungenDoc } from "@/hooks/useFinanzierungenDoc"
import { useErikTodosDoc } from "@/hooks/useErikTodosDoc"
import { useMonthArchive } from "@/hooks/useMonthArchive"
import { CLOUD_CONFIGURED } from "@/lib/firebase"
import { Sidebar } from "@/components/Sidebar"
import { Topbar } from "@/components/Topbar"
import { LoginPage } from "@/components/LoginPage"
import { Button } from "@/components/ui/button"
import { Overview } from "@/components/sections/Overview"
import { Team } from "@/components/sections/Team"
import { Rechner } from "@/components/sections/Rechner"
import { Karriere } from "@/components/sections/Karriere"
import { Guide } from "@/components/sections/Guide"
import { Kalender } from "@/components/sections/Kalender"
import { Finanzierungen } from "@/components/sections/Finanzierungen"
import { Partner } from "@/components/sections/Partner"
import { ErikDashboard } from "@/components/sections/ErikDashboard"
import { Konten } from "@/components/sections/Konten"
import { Einstellungen } from "@/components/sections/Einstellungen"
import { ChangePasswordPage } from "@/components/ChangePasswordPage"
import { StrukturBaum } from "@/components/sections/struktur/StrukturBaum"
import { Statistik } from "@/components/sections/Statistik"
import { Planung } from "@/components/sections/Planung"
import type { MonthKey } from "@/types/archive"
import type { OrgChartDoc } from "@/types/dashboard"

const SECTION_LABELS: Record<SectionId, string> = {
  overview: "Dashboard",
  team: "Mitarbeiter",
  struktur: "Strukturbaum",
  statistik: "Statistik",
  planung: "Planung",
  rechner: "Rechner",
  karriere: "Karrierepläne",
  guide: "Guide",
  kalender: "Anwesenheitsliste",
  finanzierungen: "Finanzierungen",
  partner: "Partner",
  erik: "Mein Board",
  konten: "Konten",
  einstellungen: "Einstellungen",
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

function AppShell({ auth }: { auth: UseAuthResult }) {
  const confirm = useConfirm()
  const { section, navigateTo } = useHashSection()
  const dashboard = useDashboardDoc(auth)
  // Alle Eingeloggten sehen alle Mitarbeiter (dashboard.employees); Controlling, Anwesenheit und Einheiten
  // gehören aber nur der Person selbst und ihren Vorgesetzten — die Regeln erzwingen das, hier die passenden Listen.
  const accessibleEmployees = useMemo(
    () => {
      if (!CLOUD_CONFIGURED) return dashboard.employees
      const account = { role: auth.role, employeeId: auth.employeeId, mustChangePassword: false }
      return dashboard.employees.filter((e) => canEditEmployee(account, e.id, e.ancestors))
    },
    [auth.role, auth.employeeId, dashboard.employees]
  )
  const accessibleNames = useMemo(() => new Set(accessibleEmployees.map((e) => e.name.trim().toLowerCase())), [accessibleEmployees])
  const canEditRow = useMemo(
    () => (name: string) => !CLOUD_CONFIGURED || accessibleNames.has(name.trim().toLowerCase()),
    [accessibleNames]
  )
  const attendance = useAttendanceDoc(accessibleEmployees)
  const orgChart = useOrgChartDoc(auth.isAdmin, auth.employeeId)
  const planung = usePlanungDoc(accessibleEmployees)
  const finanzierungen = useFinanzierungenDoc(auth, dashboard.employees)
  const erikTodos = useErikTodosDoc(auth.employeeId)
  const archive = useMonthArchive(auth.isAdmin, dashboard.employees)
  // Controlling, Anwesenheit, Finanzierungen und Rechner-Auswahl: Admin (und lokaler Modus) sehen den ganzen Baum,
  // alle anderen nur den Teilbaum ab dem eigenen Knoten. Dashboard, Mitarbeiter und Strukturbaum zeigen den ganzen Baum.
  const scopeId = !CLOUD_CONFIGURED || auth.isAdmin ? null : (auth.employeeId ?? "none")
  const scopedTree = useMemo(() => sbScopedTree(orgChart.tree, scopeId), [orgChart.tree, scopeId])
  const offeneFinanzierungsfaelle = finanzierungen.cases.filter((c) => !c.archived)
  const offenesFinanzierungsvolumen = offeneFinanzierungsfaelle.reduce((s, c) => s + Number(c.betrag || 0), 0)
  const offeneAnlegerwohnungen = offeneFinanzierungsfaelle.filter((c) => c.art === "anlegerwohnung").length

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

  // Soll (Einheiten) kommt live aus dem Einheitenziel der Monatsplanung (Umsatzmonat);
  // gespeicherte rows.soll wird dafür überlagert. Fehlt das Ziel, bleibt 0.
  const zielDoc = snapshot ? null : planung.getMonthNotes(monthKeyOf(dashboard.teamGoal))
  // Für Personen außerhalb der eigenen Unterstruktur (Planung nicht lesbar) kommen AT/BT/ST/ET und Soll aus den
  // vom Server berechneten Monatssummen (employees/{id}.monthStats).
  const liveRows = useMemo(() => {
    const withSoll = zielDoc
      ? dashboard.rows.map((r) => (canEditRow(r.name) ? { ...r, soll: Number(zielDoc.entries[r.name]?.ehZiel) || 0 } : r))
      : dashboard.rows
    return CLOUD_CONFIGURED ? applyMonthStats(withSoll, monthKeyOf(dashboard.teamGoal), canEditRow) : withSoll
  }, [dashboard.rows, dashboard.teamGoal, zielDoc, canEditRow])

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
      rows: relabelRowsByRoster(sbRoster(orgDoc.tree), snapshot?.rows ?? liveRows),
      teamGoal: snapshot?.teamGoal ?? dashboard.teamGoal,
      history: snapshot?.history ?? dashboard.history,
      orgTree: orgDoc.tree,
      orgDoc,
      // Archiv-Snapshots aus der Zeit vor "Investment (mit VB)" haben den Plan
      // noch nicht in planRates — withDefaultPlanRates füllt ihn mit den
      // aktuellen Defaults auf. Harmlos, da historische Zeilen dort 0
      // Einheiten haben (Satz × 0 = 0), sorgt aber dafür, dass der Key
      // existiert (SnapshotOrgChart.planRates ist nicht optional).
      planRates: withDefaultPlanRates(snapshot?.orgChart.planRates ?? orgChart.planRates),
      now: snapshot ? archiveNow(snapshot.teamGoal) : undefined,
    }
  }, [snapshot, liveRows, dashboard.teamGoal, dashboard.history, orgChart.tree, orgChart.notes, orgChart.conns, orgChart.rates, orgChart.planRates])

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
  const roster = useMemo(() => sbRoster(scopedTree), [scopedTree])
  const merged = useMemo(() => mergeRosterWithRows(roster, dashboard.rows), [roster, dashboard.rows])
  const planungRows = useMemo(() => relabelRowsByRoster(roster, dashboard.rows), [roster, dashboard.rows])
  const allRoster = useMemo(() => sbRoster(orgChart.tree), [orgChart.tree])
  const myName = useMemo(
    () => dashboard.employees.find((e) => e.id === auth.employeeId)?.name,
    [dashboard.employees, auth.employeeId]
  )
  const rechnerEmployees = useMemo(
    () => merged.map((m) => ({ name: m.name, role: m.role, units: readPlanUnits(m) })),
    [merged]
  )

  /** Bucht Einheiten (je Karriereplan) additiv auf einen Mitarbeiter — siehe
   * "Übernehmen"-Button im EH-Rechner. Legt bei Bedarf eine neue Zeile in
   * dashboard.rows an, analog zu Team.tsx commitField/commitPlanUnits. */
  function applyUnitsToEmployee(name: string, delta: Record<PlanId, number>, abwickler?: string) {
    const entry = merged.find((m) => m.name === name)
    if (!entry) return
    const current = readPlanUnits(entry)
    const next = {} as Record<PlanId, number>
    PLAN_IDS.forEach((p) => { next[p] = (Number(current[p]) || 0) + (Number(delta[p]) || 0) })
    // VB-Einheiten (Plan "investmentVb") dem gewählten Abwickler zuweisen.
    const vbDelta = Number(delta.investmentVb) || 0
    const withVb = (row: EmployeeRow): EmployeeRow => {
      const base = withPlanUnits(row, next)
      if (!abwickler || vbDelta <= 0) return base
      const vb = { ...(row.vbByAbwickler ?? {}) }
      vb[abwickler] = (Number(vb[abwickler]) || 0) + vbDelta
      return { ...base, vbByAbwickler: vb }
    }
    if (entry.rowIndex !== null) {
      const nextRows = dashboard.rows.map((r, i) => (i === entry.rowIndex ? withVb(r) : r))
      dashboard.saveRows(nextRows)
    } else {
      dashboard.saveRows([...dashboard.rows, withVb(newRowFor(entry.name))])
    }
  }

  async function handleCloseMonth() {
    const month = monthKeyOf(dashboard.teamGoal)
    const nextGoal = nextMonthGoal(dashboard.teamGoal)
    const ok = await confirm(
      `Monat ${monthLabel(month)} (${formatISODateDE(dashboard.teamGoal.periodStart)} – ${formatISODateDE(dashboard.teamGoal.periodEnd)}) abschließen?\n\n` +
      `• Der aktuelle Stand wird als Archiv gespeichert und ist danach über den Monatswähler einsehbar.\n` +
      `• Alle Ist-Werte (Einheiten, AT/BT/ET) werden auf 0 gesetzt — Plan- und Soll-Werte bleiben erhalten.\n` +
      `• "NEU"-Markierungen bleiben bestehen und werden nicht automatisch entfernt.\n` +
      `• Der laufende Monat springt auf ${monthLabel(monthKeyOf(nextGoal))}.\n` +
      `• Bitte andere offene Tabs (auch die alte Dashboard-Seite) vorher schließen.\n\n` +
      `Das lässt sich nicht rückgängig machen.`
    )
    if (!ok) return

    const result = await archive.closeMonth({
      month,
      rows: liveRows,
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
        isAdmin={auth.isAdmin}
        isLead={auth.isLead}
      />
      <main className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto">
        <Topbar
          auth={auth}
          dashboard={dashboard}
          section={section}
          archive={archive}
          archiveMonth={archiveMonth}
          onSelectMonth={setArchiveMonth}
          canEdit={auth.isAdmin && !isArchive}
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
            Nur Lesezugriff — für Änderungen fehlt dir die Berechtigung.
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
        {!isArchive && auth.isAdmin && isMonthCloseDue(dashboard.teamGoal, archive.index) && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-emerald-50 px-6 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
            <span>
              Der Monat {monthLabel(monthKeyOf(dashboard.teamGoal))} ist beendet und wurde noch nicht automatisch abgeschlossen — jetzt von Hand abschließen.
            </span>
            <Button
              size="sm"
              onClick={handleCloseMonth}
              disabled={archive.closing || !MONTH_CLOSE_ENABLED || !canCloseMonth(dashboard.teamGoal)}
              title={
                !MONTH_CLOSE_ENABLED
                  ? "Vorübergehend deaktiviert"
                  : !canCloseMonth(dashboard.teamGoal)
                  ? "Erst nach Monatsende möglich"
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
                    rows={rowsMatchedToRoster(sbRoster(view.orgTree), view.rows)}
                    teamSize={isArchive ? undefined : roster.length}
                    teamGoal={view.teamGoal}
                    history={view.history}
                    saveGoal={isArchive ? blocked : dashboard.saveGoal}
                    isEditor={auth.isAdmin && !isArchive}
                    now={view.now}
                    offenesFinanzierungsvolumen={offenesFinanzierungsvolumen}
                    offeneAnlegerwohnungen={offeneAnlegerwohnungen}
                    archiveIndex={archive.index}
                    planung={isArchive ? undefined : planung}
                    canSeeLive={canEditRow}
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
                    canEditRow={canEditRow}
                    now={view.now}
                    planung={isArchive ? undefined : planung}
                  />
                )
              )}
              {section === id && id === "planung" && (
                <Planung
                  roster={roster}
                  orgTree={scopedTree}
                  archive={archive}
                  planung={planung}
                  isEditor={auth.isEditor}
                  rows={planungRows}
                  unitsMonthKey={monthKeyOf(dashboard.teamGoal)}
                />
              )}
              {section === id && id === "rechner" && (
                <Rechner
                  employees={rechnerEmployees}
                  abwicklerCandidates={allRoster}
                  planRates={withDefaultPlanRates(orgChart.planRates)}
                  defaultEmployee={myName}
                  canBookUnits={auth.ready && !!auth.user}
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
                  abwicklerNames={ehAbwicklerOptions(allRoster).map((r) => r.name)}
                  removeCase={finanzierungen.removeCase}
                  isEditor={auth.isEditor}
                  canWrite={auth.ready && !!auth.user}
                />
              )}
              {section === id && id === "partner" && <Partner />}
              {section === id && id === "erik" && (
                <ErikDashboard
                  todos={erikTodos.todos}
                  addTodo={erikTodos.addTodo}
                  patchTodo={erikTodos.patchTodo}
                  moveTodo={erikTodos.moveTodo}
                  removeTodo={erikTodos.removeTodo}
                />
              )}
              {section === id && id === "struktur" && (
                archiveLoading ? (
                  <ArchiveStatusCard month={archiveMonth!} errored={archiveErrored} onBack={() => setArchiveMonth(null)} />
                ) : (
                  <StrukturBaum
                    key={archiveMonth ?? "live"}
                    doc={view.orgDoc}
                    rows={view.rows}
                    isEditor={auth.isEditor && !isArchive}
                    isAdmin={auth.isAdmin}
                    myNodeId={auth.employeeId}
                    saveOrgChart={isArchive ? blocked : orgChart.saveOrgChart}
                  />
                )
              )}
              {section === id && id === "statistik" && (auth.isAdmin || auth.isLead) && <Statistik archive={archive} />}
              {section === id && id === "konten" && auth.isAdmin && <Konten employees={dashboard.employees} />}
              {section === id && id === "einstellungen" && <Einstellungen auth={auth} />}
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}

// Login-Gate: ohne Anmeldung ist nichts sichtbar. Die Daten-Hooks in AppShell
// starten erst nach dem Login (kein Firestore-Zugriff ohne Token). Ohne
// Firebase-Config (lokaler Modus) entfällt das Gate.
function AuthGate() {
  const auth = useAuth()
  if (CLOUD_CONFIGURED) {
    if (!auth.ready) {
      return <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">Lädt…</div>
    }
    if (!auth.user) return <LoginPage auth={auth} />
    // Erste Anmeldung mit Startpasswort: erst neues Passwort festlegen (Datenzugriff ist bis dahin serverseitig gesperrt).
    if (auth.mustChangePassword) return <ChangePasswordPage auth={auth} />
  }
  return <AppShell key={auth.user?.uid ?? "local"} auth={auth} />
}

function App() {
  return (
    <ConfirmProvider>
      <AuthGate />
    </ConfirmProvider>
  )
}

export default App
