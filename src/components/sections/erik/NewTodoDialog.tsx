// "Neues Todo"-Dialog für das Erik-Dashboard — analog zu EmployeeEarningsDialog.tsx
// (Entwurf im lokalen State, erst bei "Anlegen" übernehmen). Legt immer in Lane
// "todo" an (siehe useErikTodosDoc.addTodo) — die Lane-Wahl ist bewusst kein Feld hier.
import { useEffect, useState, type FormEvent } from "react"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  TODO_CATEGORIES, TODO_CATEGORY_LABELS, TODO_COLORS, TODO_COLOR_LABELS,
  type TodoCategory, type TodoColor,
} from "@/types/dashboard"
import { COLOR_DOT_CLASS } from "@/components/sections/erik/colors"

export function NewTodoDialog({
  open, onOpenChange, defaultCategory, onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Vorbelegte Kategorie (aktives Board), frei änderbar wenn "alle" aktiv ist. */
  defaultCategory: TodoCategory
  onCreate: (init: { title: string; description: string; dueDate: string; category: TodoCategory; color: TodoColor }) => void
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [category, setCategory] = useState<TodoCategory>(defaultCategory)
  const [color, setColor] = useState<TodoColor>("grau")

  // Entwurf zurücksetzen, sobald der Dialog (neu) geöffnet wird.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open) {
      setTitle("")
      setDescription("")
      setDueDate("")
      setCategory(defaultCategory)
      setColor("grau")
    }
  }, [open, defaultCategory])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    onCreate({ title: trimmed, description: description.trim(), dueDate, category, color })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neues Todo</DialogTitle>
          <DialogDescription>Wird oben in der Spalte "Todo" angelegt.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="erik-todo-title" className="text-xs font-semibold text-muted-foreground">Titel</label>
            <Input
              id="erik-todo-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z. B. Herr Mustermann – Unterlagen prüfen"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="erik-todo-description" className="text-xs font-semibold text-muted-foreground">Beschreibung</label>
            <textarea
              id="erik-todo-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
              rows={3}
              className="border-input flex w-full min-w-0 resize-none rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="erik-todo-due" className="text-xs font-semibold text-muted-foreground">Fällig bis</label>
            <Input
              id="erik-todo-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="erik-todo-category" className="text-xs font-semibold text-muted-foreground">Kategorie</label>
            <Select
              id="erik-todo-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as TodoCategory)}
            >
              {TODO_CATEGORIES.map((c) => (
                <option key={c} value={c}>{TODO_CATEGORY_LABELS[c]}</option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Farbe</span>
            <div className="flex gap-2">
              {TODO_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={TODO_COLOR_LABELS[c]}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "size-6 rounded-full ring-offset-2 ring-offset-background transition-shadow",
                    COLOR_DOT_CLASS[c],
                    color === c ? "ring-2 ring-foreground" : "hover:ring-2 hover:ring-foreground/30"
                  )}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit" disabled={!title.trim()}>Anlegen</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
