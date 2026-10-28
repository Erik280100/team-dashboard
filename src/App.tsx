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
import { lazy, Suspense, useEffect, useMemo, useState } from "react"
import { ConfirmProvider, useConfirm } from "@/hooks/useConfirm"
import { isGstOrHigher, sbFind, sbRoster, sbScopedTree, withDefaultPlanRates, type PlanId } from "@/lib/calc/struktur"
import { applyMonthStats, mergeRosterWithRows, relabelRowsByRoster, rowsMatchedToRoster } from "@/lib/calc/team"
import { ehAbwicklerOptions } from "@/lib/calc/eh"
import type { UmsatzDraft } from "@/lib/calc/umsatz"
import { readPlanUnits } from "@/lib/calc/verguetung"
import { MONTH_CLOSE_ENABLED, archiveNow, canCloseMonth, isMonthCloseDue, monthKeyOf, monthLabel, nextMonthGoal } from "@/lib/calc/archive"
import { formatISODateDE, toISODate } from "@/lib/calc/format"
import { canViewEmployee } from "@/lib/calc/roles"
import { useAuth, type UseAuthResult } from "@/hooks/useAuth"
import { useHashSection, SECTION_IDS, type SectionId } from "@/hooks/useHashSection"
import { useDashboardDoc } from "@/hooks/useDashboardDoc"
import { useAttendanceDoc } from "@/hooks/useAttendanceDoc"
import { useOrgChartDoc } from "@/hooks/useOrgChartDoc"
import { usePlanungDoc } from "@/hooks/usePlanungDoc"
import { useUmsaetzeDoc } from "@/hooks/useUmsaetzeDoc"
import { useFinanzierungenDoc } from "@/hooks/useFinanzierungenDoc"
import { useBoardTodosDoc } from "@/hooks/useBoardTodosDoc"
import { useMonthArchive } from "@/hooks/useMonthArchive"
import { useFinancingStats } from "@/hooks/useFinancingStats"
import { useToday } from "@/hooks/useToday"
import { daysUntil, dueSoonTodos, dueState, hasOpenDueTodos } from "@/lib/calc/todos"
import { announceCelebration } from "@/lib/celebrate"
import { useCelebrations } from "@/hooks/useCelebrations"
import { ConfettiRain } from "@/components/ConfettiRain"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { Sidebar } from "@/components/Sidebar"
import { Topbar } from "@/components/Topbar"
import { LoginPage } from "@/components/LoginPage"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChangePasswordPage } from "@/components/ChangePasswordPage"
import type { MonthKey } from "@/types/archive"
import type { OrgChartDoc } from "@/types/dashboard"

// Sektionen außer dem Dashboard werden erst beim Öffnen geladen (kleineres Start-Paket).
const Overview = lazy(() => import("@/components/sections/Overview").then((m) => ({ default: m.Overview })))
const Team = lazy(() => import("@/components/sections/Team").then((m) => ({ default: m.Team })))
const Rechner = lazy(() => import("@/components/sections/Rechner").then((m) => ({ default: m.Rechner })))
const Karriere = lazy(() => import("@/components/sections/Karriere").then((m) => ({ default: m.Karriere })))
const Guide = lazy(() => import("@/components/sections/Guide").then((m) => ({ default: m.Guide })))
const Kalender = lazy(() => import("@/components/sections/Kalender").then((m) => ({ default: m.Kalender })))
const Finanzierungen = lazy(() => import("@/components/sections/Finanzierungen").then((m) => ({ default: m.Finanzierungen })))
const Partner = lazy(() => import("@/components/sections/Partner").then((m) => ({ default: m.Partner })))
const MeinBoard = lazy(() => import("@/components/sections/MeinBoard").then((m) => ({ default: m.MeinBoard })))
const Konten = lazy(() => import("@/components/sections/Konten").then((m) => ({ default: m.Konten })))
const Einstellungen = lazy(() => import("@/components/sections/Einstellungen").then((m) => ({ default: m.Einstellungen })))
const StrukturBaum = lazy(() => import("@/components/sections/struktur/StrukturBaum").then((m) => ({ default: m.StrukturBaum })))
const Statistik = lazy(() => import("@/components/sections/Statistik").then((m) => ({ default: m.Statistik })))
const Planung = lazy(() => import("@/components/sections/Planung").then((m) => ({ default: m.Planung })))

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
  board: "Mein Board",
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
      const account = { role: auth.role, employeeId: auth.employeeId, mustChangePassword: false }
      return dashboard.employees.filter((e) => canViewEmployee(account, e.id, e.ancestors))
    },
    [auth.role, auth.employeeId, dashboard.employees]
  )
  const accessibleNames = useMemo(() => new Set(accessibleEmployees.map((e) => e.name.trim().toLowerCase())), [accessibleEmployees])
  const canEditRow = useMemo(
    () => (name: string) => accessibleNames.has(name.trim().toLowerCase()),
    [accessibleNames]
  )
  const attendance = useAttendanceDoc(accessibleEmployees)
  const orgChart = useOrgChartDoc(auth.isAdmin, auth.employeeId)
  const planung = usePlanungDoc(accessibleEmployees)
  const umsaetze = useUmsaetzeDoc(auth, dashboard.employees)
  const finanzierungen = useFinanzierungenDoc(auth, dashboard.employees)
  const boardTodos = useBoardTodosDoc(auth.employeeId)
  useCelebrations(auth.ready && !!auth.user)
  const today = useToday()
  const boardAlert = hasOpenDueTodos(boardTodos.todos, today)
  const dueSoon = dueSoonTodos(boardTodos.todos, today)
  const archive = useMonthArchive(auth.isAdmin, dashboard.employees)
  // Controlling, Anwesenheit, Finanzierungen und Rechner-Auswahl: Admin sieht den ganzen Baum,
  // alle anderen nur den Teilbaum ab dem eigenen Knoten. Dashboard, Mitarbeiter und Strukturbaum zeigen den ganzen Baum.
  const seesAll = auth.isAdmin || auth.isViewer // Lesemodus sieht wie der Admin den ganzen Baum (schreiben darf nur der Admin)
  const scopeId = seesAll ? null : (auth.employeeId ?? "none")
  const scopedTree = useMemo(() => sbScopedTree(orgChart.tree, scopeId), [orgChart.tree, scopeId])
  const financingStats = useFinancingStats()
  // Controlling: auch der Admin sieht nur den eigenen Teilbaum (sofern er einen Knoten hat).
  const controllingTree = useMemo(
    () => sbScopedTree(orgChart.tree, auth.employeeId ?? (seesAll ? null : "none")),
    [orgChart.tree, auth.employeeId, seesAll]
  )
  const controllingRoster = useMemo(() => sbRoster(controllingTree), [controllingTree])

  // Dashboard: "Gesamt" (alle Mitarbeiter) oder "Mein Team" (man selbst und alle darunter). Wer keinem Knoten
  // zugeordnet ist (z. B. reiner Admin) kann nicht wechseln und sieht immer Gesamt.
  const canSwitchScope = !!auth.employeeId
  // Export in der Kopfzeile: Admin und alle ab Geschäftsstellenleiter.
  const myNodeRole = auth.employeeId && orgChart.tree ? sbFind(orgChart.tree, auth.employeeId)?.role : undefined
  const canExport = auth.isAdmin || isGstOrHigher(myNodeRole ?? "")
  const [dashScope, setDashScope] = useState<"gesamt" | "team">(() => {
    try { return localStorage.getItem("finova_dashboard_scope") === "team" ? "team" : "gesamt" } catch { return "gesamt" }
  })
  function changeDashScope(next: "gesamt" | "team") {
    setDashScope(next)
    try { localStorage.setItem("finova_dashboard_scope", next) } catch { /* nur Komfort */ }
  }
  const teamScope = canSwitchScope && dashScope === "team"

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
    return applyMonthStats(withSoll, monthKeyOf(dashboard.teamGoal), canEditRow)
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

  // Dashboard-Ausschnitt: ganzer Baum bzw. nur der eigene Teilbaum ("Mein Team").
  const dashTree = useMemo(
    () => (teamScope ? sbScopedTree(view.orgTree, auth.employeeId) : view.orgTree),
    [teamScope, view.orgTree, auth.employeeId]
  )
  const dashRoster = useMemo(() => sbRoster(dashTree), [dashTree])
  const dashRows = useMemo(() => rowsMatchedToRoster(dashRoster, view.rows), [dashRoster, view.rows])
  // Der gespeicherte Verlauf ist die Summe aller Mitarbeiter; für "Mein Team" gibt es keinen Teamverlauf —
  // dort zählt nur der heutige Stand des Teams (Ziel-Linie und Prognose rechnen daraus).
  const dashHistory = useMemo(() => {
    if (!teamScope) return view.history
    const today = toISODate(new Date())
    const { periodStart, periodEnd } = view.teamGoal
    const date = today > periodEnd ? periodEnd : today < periodStart ? periodStart : today
    return [{ date, ist: dashRows.reduce((s, r) => s + (Number(r.ist) || 0), 0) }]
  }, [teamScope, view.history, view.teamGoal, dashRows])
  // Die Jahreswerte im Dashboard stammen aus den archivierten Monatssummen (alle Mitarbeiter). Für "Mein Team" werden
  // sie aus den Monats-Snapshots nur über die Teammitglieder neu gerechnet.
  const archiveMonths = useMemo(() => archive.index.map((e) => e.month), [archive.index])
  useEffect(() => {
    if (teamScope && archiveMonths.length > 0) void archive.loadSnapshots(archiveMonths)
    // archive ist je Render ein neues Objekt — nur bei Änderung von Scope/Monatsliste nachladen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamScope, archiveMonths])
  const dashArchiveIndex = useMemo(() => {
    if (!teamScope) return archive.index
    return archive.index.map((e) => {
      const rows = archive.getSnapshot(e.month)?.rows
      const ehByPlan = { ...e.totals.ehByPlan }
      for (const p of Object.keys(ehByPlan) as (keyof typeof ehByPlan)[]) ehByPlan[p] = 0
      if (rows) {
        for (const r of rowsMatchedToRoster(dashRoster, rows)) {
          const u = readPlanUnits(r)
          for (const p of Object.keys(u) as (keyof typeof u)[]) ehByPlan[p] = (ehByPlan[p] || 0) + u[p]
        }
      }
      return { ...e, totals: { ...e.totals, ehByPlan } }
    })
    // getSnapshot ändert sich mit jedem geladenen Snapshot-Status.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamScope, archive.index, archive.getSnapshot, dashRoster])
  // Finanzierungen: Gesamt = Summen der Cloud Function (alle Fälle); Mein Team = sichtbare Fälle der eigenen Betreuer.
  const dashFinance = useMemo(() => {
    const names = new Set(dashRoster.map((r) => r.name.trim().toLowerCase()))
    const open = finanzierungen.cases
      .filter((c) => !c.archived)
      .filter((c) => !teamScope || names.has((c.betreuer || "").trim().toLowerCase()))
    if (!teamScope && financingStats) {
      return { volume: financingStats.openVolume, anlegerwohnungen: financingStats.anlegerwohnungen }
    }
    return {
      volume: open.reduce((s, c) => s + Number(c.betrag || 0), 0),
      anlegerwohnungen: open.filter((c) => c.art === "anlegerwohnung").length,
    }
  }, [dashRoster, teamScope, finanzierungen.cases, financingStats])
  const merged = useMemo(() => mergeRosterWithRows(roster, dashboard.rows), [roster, dashboard.rows])
  const planungRows = useMemo(() => relabelRowsByRoster(roster, dashboard.rows), [roster, dashboard.rows])
  const allRoster = useMemo(() => sbRoster(orgChart.tree), [orgChart.tree])
  const myName = useMemo(
    () => dashboard.employees.find((e) => e.id === auth.employeeId)?.name,
    [dashboard.employees, auth.employeeId]
  )
  // Profilbilder: Name -> { id, Version } für die Mitarbeiterseite (nur Personen mit hochgeladenem Bild).
  const avatarsByName = useMemo(() => {
    const out: Record<string, { id: string; version: number }> = {}
    for (const e of dashboard.employees) if (e.avatarVersion) out[e.name] = { id: e.id, version: e.avatarVersion }
    return out
  }, [dashboard.employees])
  const rechnerEmployees = useMemo(
    () => merged.map((m) => ({ name: m.name, role: m.role, units: readPlanUnits(m) })),
    [merged]
  )

  /** Bucht Einheiten (je Karriereplan) additiv auf einen Mitarbeiter — siehe
   * "Übernehmen"-Button im EH-Rechner. Legt bei Bedarf eine neue Zeile in
   * dashboard.rows an, analog zu Team.tsx commitField/commitPlanUnits. */
  function applyUnitsToEmployee(name: string, delta: Record<PlanId, number>, abwickler?: string, sales: UmsatzDraft[] = []) {
    if (!merged.some((m) => m.name === name)) return
    // VB-Einheiten (Plan "investmentVb") gehen an den gewählten Abwickler. In der Cloud wird atomar
    // hochgezählt, damit gleichzeitige Buchungen auf dieselbe Person nicht überschrieben werden.
    dashboard.bookUnits(name, delta, abwickler)
    umsaetze.addEntries(name, sales)
    announceCelebration(name)
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
      <ConfettiRain />
      <Sidebar
        section={section}
        onNavigate={navigateTo}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isAdmin={seesAll}
        isLead={auth.isLead}
        boardAlert={boardAlert}
      />
      <main className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto">
        <Topbar
          auth={auth}
          dashboard={dashboard}
          section={section}
          archive={archive}
          archiveMonth={archiveMonth}
          onSelectMonth={setArchiveMonth}
          canExport={canExport}
          onCloseMonth={handleCloseMonth}
          onToggleSidebar={() => setSidebarOpen((o) => !o)}
          attendance={attendance.attendance}
          orgChart={{
            tree: orgChart.tree, notes: orgChart.notes, conns: orgChart.conns,
            rates: orgChart.rates, planRates: orgChart.planRates,
          }}
          financings={finanzierungen.cases}
          scope={canSwitchScope ? (teamScope ? "team" : "gesamt") : undefined}
          onScopeChange={changeDashScope}
        />

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

        {section === "overview" && !isArchive && dueSoon.length > 0 && (
          <div
            role="status"
            className={cn(
              "border-b px-6 py-3 text-sm",
              dueSoon.some((t) => dueState(t.dueDate, today) === "red")
                ? "bg-rose-50 text-rose-900 dark:bg-rose-950 dark:text-rose-200"
                : "bg-orange-50 text-orange-900 dark:bg-orange-950 dark:text-orange-200"
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-medium">
                Folgende Todos haben ihre Fälligkeit bald erreicht ({dueSoon.length}):
              </span>
              <Button size="sm" variant="ghost" onClick={() => navigateTo("board")}>
                Zu Mein Board
              </Button>
            </div>
            <ul className="mt-1 flex flex-col gap-0.5">
              {dueSoon.map((t) => (
                <li key={t.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span
                    className={cn(
                      "tabular-nums font-medium",
                      dueState(t.dueDate, today) === "red" ? "text-destructive" : "text-orange-600 dark:text-orange-400"
                    )}
                  >
                    {new Date(t.dueDate).toLocaleDateString("de-AT")}
                  </span>
                  <span>{t.title}</span>
                  <span className="text-xs opacity-70">
                    {daysUntil(t.dueDate, today) < 0 ? `${-daysUntil(t.dueDate, today)} Tage überfällig` : `in ${daysUntil(t.dueDate, today)} Tagen`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex-1 p-6">
          <ErrorBoundary resetKey={section}>
          <Suspense fallback={<p className="p-6 text-sm text-muted-foreground" role="status">Lade …</p>}>
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
                    rows={dashRows}
                    teamSize={isArchive ? undefined : dashRoster.length}
                    avatars={avatarsByName}
                    teamGoal={view.teamGoal}
                    history={dashHistory}
                    saveGoal={isArchive ? blocked : dashboard.saveGoal}
                    isEditor={auth.isAdmin && !isArchive}
                    now={view.now}
                    offenesFinanzierungsvolumen={dashFinance.volume}
                    offeneAnlegerwohnungen={dashFinance.anlegerwohnungen}
                    archiveIndex={dashArchiveIndex}
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
                    noBonusFor={auth.isAdmin ? undefined : myName}
                    myName={myName}
                    now={view.now}
                    planung={isArchive ? undefined : planung}
                    avatars={avatarsByName}
                  />
                )
              )}
              {section === id && id === "planung" && (
                <Planung
                  roster={controllingRoster}
                  orgTree={controllingTree}
                  archive={archive}
                  planung={planung}
                  umsaetze={umsaetze}
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
                  canBookUnits={auth.ready && !!auth.user && !auth.isViewer}
                  onApplyUnits={applyUnitsToEmployee}
                />
              )}
              {section === id && id === "karriere" && (
                <Karriere merged={merged} planRates={withDefaultPlanRates(orgChart.planRates)} myName={myName} />
              )}
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
                  employeeRoster={controllingRoster}
                  abwicklerNames={ehAbwicklerOptions(allRoster).map((r) => r.name)}
                  removeCase={finanzierungen.removeCase}
                  isEditor={auth.isEditor}
                  canWrite={auth.ready && !!auth.user && !auth.isViewer}
                />
              )}
              {section === id && id === "partner" && <Partner />}
              {section === id && id === "board" && (
                <MeinBoard
                  todos={boardTodos.todos}
                  addTodo={boardTodos.addTodo}
                  patchTodo={boardTodos.patchTodo}
                  moveTodo={boardTodos.moveTodo}
                  removeTodo={boardTodos.removeTodo}
                  isAdmin={seesAll}
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
                    employees={dashboard.employees}
                    isEditor={auth.isEditor && !isArchive}
                    isAdmin={auth.isAdmin}
                    myNodeId={auth.employeeId}
                    saveOrgChart={isArchive ? blocked : orgChart.saveOrgChart}
                  />
                )
              )}
              {section === id && id === "statistik" && (seesAll || auth.isLead) && <Statistik archive={archive} />}
              {section === id && id === "konten" && seesAll &&<Konten employees={dashboard.employees} readOnly={auth.isViewer} />}
              {section === id && id === "einstellungen" && <Einstellungen auth={auth} name={myName} avatarVersion={dashboard.employees.find((e) => e.id === auth.employeeId)?.avatarVersion} />}
            </section>
          ))}
          </Suspense>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  )
}

// Login-Gate: ohne Anmeldung ist nichts sichtbar. Die Daten-Hooks in AppShell
// starten erst nach dem Login (kein Firestore-Zugriff ohne Token).
//
// Die Login-Seite hat eine eigene Route (#login): Nicht Eingeloggte werden dorthin umgeleitet, die ursprünglich
// angeforderte Sektion merkt sich sessionStorage und wird nach dem Login wieder angesteuert.
const LOGIN_HASH = "login"
const RETURN_KEY = "finova_return_section"

function setHash(hash: string) {
  history.replaceState(null, "", `#${hash}`)
  window.dispatchEvent(new HashChangeEvent("hashchange"))
}

function AuthGate() {
  const auth = useAuth()
  const { ready, user } = auth

  useEffect(() => {
    if (!ready) return
    const sync = () => {
      const current = location.hash.slice(1)
      if (!user) {
        if (current === LOGIN_HASH) return
        try { if (current) sessionStorage.setItem(RETURN_KEY, current) } catch { /* nur Komfort */ }
        setHash(LOGIN_HASH)
      } else if (current === LOGIN_HASH) {
        let back: string | null = null
        try { back = sessionStorage.getItem(RETURN_KEY); sessionStorage.removeItem(RETURN_KEY) } catch { /* nur Komfort */ }
        setHash(back && back !== LOGIN_HASH ? back : "overview")
      }
    }
    sync()
    window.addEventListener("hashchange", sync)
    return () => window.removeEventListener("hashchange", sync)
  }, [ready, user])

  if (!auth.ready) {
    return <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">Lädt…</div>
  }
  if (!auth.user) return <LoginPage auth={auth} />
  // Erste Anmeldung mit Startpasswort: erst neues Passwort festlegen (Datenzugriff ist bis dahin serverseitig gesperrt).
  if (auth.mustChangePassword) return <ChangePasswordPage auth={auth} />
  return <AppShell key={auth.user.uid} auth={auth} />
}

function App() {
  return (
    <ConfirmProvider>
      <AuthGate />
    </ConfirmProvider>
  )
}

export default App
