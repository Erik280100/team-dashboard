// Kopfzeile — Äquivalent zu .topbar aus legacy/index.html:1591–1617 (Titel,
// Auth-Box, Sync-Status, Export/Import). Export/Import operieren auf
// rows/teamGoal wie exportBtn/importFile in legacy/index.html:3241–3284.
import { useRef, type ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { AuthBox } from "@/components/AuthBox"
import { useConfirm } from "@/hooks/useConfirm"
import type { useAuth } from "@/hooks/useAuth"
import type { UseDashboardDocResult } from "@/hooks/useDashboardDoc"
import { STARTER_GOAL } from "@/types/dashboard"

const SYNC_STATUS_TEXT: Record<string, string> = {
  "not-configured": "",
  connecting: "Verbinde mit Cloud…",
  connected: "Verbunden ✓",
  error: "Cloud-Verbindung fehlgeschlagen — nur lokal gespeichert.",
}

export function Topbar({
  auth,
  dashboard,
}: {
  auth: ReturnType<typeof useAuth>
  dashboard: UseDashboardDocResult
}) {
  const confirm = useConfirm()
  const fileInputRef = useRef<HTMLInputElement>(null)

  function onExport() {
    const payload = { rows: dashboard.rows, teamGoal: dashboard.teamGoal }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const dateStr = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `finova_dashboard_backup_${dateStr}.json`
    a.click()
    URL.revokeObjectURL(url)
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
    <div className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-4">
      <div>
        <h1 className="text-xl font-bold">Team Dashboard</h1>
        <p className="text-sm text-muted-foreground">Ziele & Fortschritt — laufender Monat</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <AuthBox auth={auth} />
        <span role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {SYNC_STATUS_TEXT[dashboard.syncStatus]}
        </span>
        <Button size="sm" variant="ghost" onClick={onExport}>
          Export
        </Button>
        {auth.isEditor && (
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
