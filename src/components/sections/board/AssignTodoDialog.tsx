// Todo einer Person in der eigenen Linie zuweisen (Vorgesetzte und Mitarbeiter, direkt und indirekt).
// Das Todo wandert aufs Board des Empfängers; der Absender verfolgt es unter "Von mir zugewiesen".
import { useEffect, useState } from "react"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import type { EmployeeMeta } from "@/lib/calc/employees"
import type { BoardTodo } from "@/types/dashboard"

export function TargetOptions({ superiors, subordinates }: { superiors: EmployeeMeta[]; subordinates: EmployeeMeta[] }) {
  return (
    <>
      {superiors.length > 0 && (
        <optgroup label="Führungskräfte">
          {superiors.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </optgroup>
      )}
      {subordinates.length > 0 && (
        <optgroup label="Mitarbeiter">
          {subordinates.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </optgroup>
      )}
    </>
  )
}

export function AssignTodoDialog({
  todo, superiors, subordinates, onClose, onAssign,
}: {
  /** Das zuzuweisende Todo; null = Dialog geschlossen. */
  todo: BoardTodo | null
  superiors: EmployeeMeta[]
  subordinates: EmployeeMeta[]
  onClose: () => void
  onAssign: (todo: BoardTodo, target: EmployeeMeta) => Promise<void>
}) {
  const [targetId, setTargetId] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (todo) { setTargetId(""); setBusy(false); setError("") }
  }, [todo])

  const target = [...superiors, ...subordinates].find((e) => e.id === targetId)

  async function submit() {
    if (!todo || !target) return
    setBusy(true)
    setError("")
    try {
      await onAssign(todo, target)
      onClose()
    } catch {
      setError("Zuweisen hat nicht geklappt. Bitte später erneut versuchen.")
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!todo} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Todo zuweisen</DialogTitle>
          <DialogDescription>
            „{todo?.title}“ wandert auf das Board der gewählten Person (Spalte „Todo“). Du siehst den Stand unter „Von mir zugewiesen“.
          </DialogDescription>
        </DialogHeader>
        {superiors.length + subordinates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Du hast keine Vorgesetzten oder Mitarbeiter, denen du zuweisen kannst.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="assign-target" className="text-xs font-semibold text-muted-foreground">Zuweisen an</label>
            <Select id="assign-target" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">Person wählen…</option>
              <TargetOptions superiors={superiors} subordinates={subordinates} />
            </Select>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button type="button" disabled={!target || busy} onClick={submit}>Zuweisen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
