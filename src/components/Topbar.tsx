// Kopfzeile — Äquivalent zu .topbar aus legacy/index.html:1591–1617 (Titel,
// Auth-Box, Sync-Status, Export/Import). Export/Import operieren auf
// rows/teamGoal wie exportBtn/importFile in legacy/index.html:3241–3284.
// Zusätzlich: globaler Monatswähler + "Monat abschließen" (Monats-Archiv,
// siehe useMonthArchive.ts) — nur in Übersicht/Mitarbeiter/Strukturbaum sichtbar.
import { useRef, type ChangeEvent } from "react"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { AuthBox } from "@/components/AuthBox"
import { useConfirm } from "@/hooks/useConfirm"
import type { useAuth } from "@/hooks/useAuth"
import type { UseDashboardDocResult } from "@/hooks/useDashboardDoc"
import type { UseMonthArchiveResult } from "@/hooks/useMonthArchive"
import type { SectionId } from "@/hooks/useHashSection"
import { MONTH_CLOSE_ENABLED, canCloseMonth, monthLabel } from "@/lib/calc/archive"
import { CLOUD_CONFIGURED } from "@/lib/firebase"
import type { MonthKey } from "@/types/archive"
import {
  STARTER_GOAL,
  type AttendanceEntry,
  type FinanzierungCase,
  type OrgChartDoc,
} from "@/types/dashboard"

const SYNC_STATUS_TEXT: Record<string, string> = {
  "not-configured": "",
  connecting: "Verbinde mit Cloud…",
  connected: "Verbunden ✓",
  error: "Cloud-Verbindung fehlgeschlagen — nur lokal gespeichert.",
}

const ARCHIVE_SECTIONS = new Set<SectionId>(["overview", "team", "struktur"])

export function Topbar({
  auth,
  dashboard,
  section,
  archive,
  archiveMonth,
  onSelectMonth,
  canEdit,
  onCloseMonth,
  onToggleSidebar,
  attendance,
  orgChart,
  financings,
}: {
  auth: ReturnType<typeof useAuth>
  dashboard: UseDashboardDocResult
  section: SectionId
  archive: UseMonthArchiveResult
  archiveMonth: MonthKey | null
  onSelectMonth: (month: MonthKey | null) => void
  /** Editor UND kein Archiv-Monat gewählt — steuert Export/Import/Abschluss-Button. */
  canEdit: boolean
  onCloseMonth: () => void
  onToggleSidebar: () => void
  /** Für "Vollständiges Backup" — Daten, die im normalen Export (nur rows/teamGoal) fehlen. */
  attendance: Record<string, AttendanceEntry>
  orgChart: OrgChartDoc
  financings: FinanzierungCase[]
}) {
  const confirm = useConfirm()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isArchive = archiveMonth !== null
  const showMonthPicker = ARCHIVE_SECTIONS.has(section) && archive.index.length > 0

  function stepMonth(dir: -1 | 1) {
    const months = archive.index.map((e) => e.month) // aufsteigend
    if (archiveMonth === null) {
      // "Laufender Monat" -> eine Stufe zurück ins Archiv (neuester Monat).
      if (dir === -1 && months.length > 0) onSelectMonth(months[months.length - 1])
      return
    }
    const idx = months.indexOf(archiveMonth)
    const nextIdx = idx + dir
    if (nextIdx < 0) return
    if (nextIdx >= months.length) {
      onSelectMonth(null) // über den neuesten Archiv-Monat hinaus -> zurück live
      return
    }
    onSelectMonth(months[nextIdx])
  }

  function downloadJson(payload: unknown, filenamePrefix: string) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const dateStr = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `${filenamePrefix}_${dateStr}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function onExport() {
    downloadJson({ rows: dashboard.rows, teamGoal: dashboard.teamGoal }, "finova_dashboard_backup")
  }

  /** Deckt alles ab, was der normale Export (nur rows/teamGoal) auslässt:
   * Ist-Verlauf, Anwesenheitsliste, Strukturbaum und Finanzierungen. Reiner
   * Lese-Export zur Ablage — es gibt (noch) keinen passenden Import dafür. */
  function onFullBackup() {
    downloadJson(
      {
        dashboard: { rows: dashboard.rows, teamGoal: dashboard.teamGoal, history: dashboard.history },
        attendance,
        orgChart,
        financings,
      },
      "finova_full_backup"
    )
  }

  async function onImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      let newRows
      let newGoal = null
      if (Array.isArray(parsed)) {
        newRows = parsed
      } else if (parsed && Array.isArray(parsed.rows)) {
        newRows = parsed.rows
        if (parsed.teamGoal) newGoal = parsed.teamGoal
      } else {
        throw new Error("Ungültiges Format")
      }
      const ok = await confirm(
        `Import überschreibt die aktuellen ${dashboard.rows.length} Mitarbeiter-Datensätze mit ${newRows.length} importierten Datensätzen. Fortfahren?`
      )
      if (!ok) {
        e.target.value = ""
        return
      }
      dashboard.saveRows(newRows)
      if (newGoal) {
        dashboard.saveGoal({ ...STARTER_GOAL, ...dashboard.teamGoal, ...newGoal })
      }
      alert(`Import erfolgreich: ${newRows.length} Mitarbeiter geladen.`)
    } catch (err) {
      alert("Import fehlgeschlagen: " + (err instanceof Error ? err.message : String(err)))
    }
    e.target.value = ""
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b px-4 py-4 md:px-6">
      <div className="flex items-center gap-3">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Menü öffnen"
          onClick={onToggleSidebar}
          className="lg:hidden"
        >
          <Menu aria-hidden="true" className="size-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Team Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {isArchive ? `Ziele & Fortschritt — ${monthLabel(archiveMonth)} (Archiv)` : "Ziele & Fortschritt — laufender Monat"}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {showMonthPicker && (
          <div className="flex items-center gap-1.5 rounded-md border px-1.5 py-1">
            <Button size="icon" variant="ghost" className="size-7" aria-label="Vorheriger Monat" onClick={() => stepMonth(-1)}>
              ◀
            </Button>
            <Select
              aria-label="Monat auswählen"
              value={archiveMonth ?? "live"}
              onChange={(e) => onSelectMonth(e.target.value === "live" ? null : e.target.value)}
              className="w-44 border-0 shadow-none"
            >
              <option value="live">Laufender Monat</option>
              {[...archive.index].reverse().map((e) => (
                <option key={e.month} value={e.month}>{e.label}</option>
              ))}
            </Select>
            <Button
              size="icon" variant="ghost" className="size-7" aria-label="Nächster Monat"
              disabled={archiveMonth === null}
              onClick={() => stepMonth(1)}
            >
              ▶
            </Button>
          </div>
        )}
        {!isArchive && auth.isEditor && CLOUD_CONFIGURED && (
          <>
            <Button size="sm" variant="outline" onClick={onFullBackup}>
              Vollständiges Backup
            </Button>
            <Button
              size="sm"
              onClick={onCloseMonth}
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
          </>
        )}
        <AuthBox auth={auth} />
        <span role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {SYNC_STATUS_TEXT[dashboard.syncStatus]}
        </span>
        {!isArchive && section === "overview" && (
          <Button size="sm" variant="ghost" onClick={onExport}>
            Export
          </Button>
        )}
        {canEdit && (
          <>
            <Button size="sm" variant="ghost" onClick={() => fileInputRef.current?.click()}>
              Import
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={onImportFile}
            />
          </>
        )}
      </div>
    </div>
  )
}
