// Excel-/Word-Buttons für Übersicht und Mitarbeiterseite.
import { useState } from "react"
import { FileSpreadsheet, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ExportButtons({
  onXlsx,
  onDocx,
  light = false,
}: {
  onXlsx: () => Promise<void>
  onDocx: () => Promise<void>
  /** Helle Schrift für dunkle Karten. */
  light?: boolean
}) {
  const [busy, setBusy] = useState<"xlsx" | "docx" | null>(null)
  const [failed, setFailed] = useState(false)

  async function run(kind: "xlsx" | "docx") {
    setBusy(kind)
    setFailed(false)
    try {
      await (kind === "xlsx" ? onXlsx() : onDocx())
    } catch (err) {
      console.error("Export fehlgeschlagen", err)
      setFailed(true)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {failed && <span role="alert" className="text-xs text-red-500">Export fehlgeschlagen — bitte erneut versuchen.</span>}
      <span className={light ? "text-xs text-white/70" : "text-xs text-muted-foreground"}>Exportieren:</span>
      <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run("xlsx")}>
        <FileSpreadsheet aria-hidden="true" className="size-4" />
        {busy === "xlsx" ? "Erstelle Excel…" : "Excel"}
      </Button>
      <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run("docx")}>
        <FileText aria-hidden="true" className="size-4" />
        {busy === "docx" ? "Erstelle Word…" : "Word"}
      </Button>
    </div>
  )
}
