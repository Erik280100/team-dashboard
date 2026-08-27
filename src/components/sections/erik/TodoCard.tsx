// Einzelne Kanban-Karte im Erik-Dashboard. Drag-Start wird hier ausgelöst (native
// HTML5-DnD, siehe ErikDashboard.tsx für das Gegenstück onDragOver/onDrop auf der
// Lane) — Drop-Zielberechnung (vor welcher Karte losgelassen wird) macht die Lane
// selbst anhand von data-todo-id, nicht diese Komponente.
import { useEffect, useRef, useState, type DragEvent } from "react"
import { Flag, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { dueState } from "@/lib/calc/todos"
import { TODO_CATEGORY_LABELS, TODO_COLOR_LABELS, TODO_COLORS, type ErikTodo } from "@/types/dashboard"
import { COLOR_DOT_CLASS } from "@/components/sections/erik/colors"

const CARD_BORDER_CLASS: Record<ErikTodo["color"], string> = {
  grau: "border-l-slate-400",
  gruen: "border-l-emerald-500",
  gelb: "border-l-amber-400",
  rot: "border-l-rose-500",
  blau: "border-l-sky-500",
}

const DUE_TEXT_CLASS: Record<ReturnType<typeof dueState>, string> = {
  overdue: "text-destructive font-medium",
  today: "text-amber-600 dark:text-amber-400 font-medium",
  soon: "text-amber-600 dark:text-amber-400",
  none: "text-muted-foreground",
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export function TodoCard({
  todo, showCategory, onPatch, onDelete, onDragStart,
}: {
  todo: ErikTodo
  showCategory: boolean
  onPatch: (patch: Partial<ErikTodo>) => void
  onDelete: () => void
  onDragStart: (e: DragEvent<HTMLDivElement>) => void
}) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(todo.title)
  const inputRef = useRef<HTMLInputElement>(null)

  const [editingDescription, setEditingDescription] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState(todo.description)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editingTitle) inputRef.current?.focus()
  }, [editingTitle])

  useEffect(() => {
    if (editingDescription) descriptionRef.current?.focus()
  }, [editingDescription])

  function commitTitle() {
    const trimmed = titleDraft.trim()
    if (trimmed && trimmed !== todo.title) onPatch({ title: trimmed })
    else setTitleDraft(todo.title)
    setEditingTitle(false)
  }

  function commitDescription() {
    const trimmed = descriptionDraft.trim()
    if (trimmed !== todo.description) onPatch({ description: trimmed })
    setDescriptionDraft(trimmed)
    setEditingDescription(false)
  }

  const state = dueState(todo.dueDate, todayStr())
  // Fällig heute, in den nächsten 3 Tagen oder bereits überfällig — ganze Kachel
  // leicht rot einfärben, nicht nur das Datum, damit es beim Überfliegen der Lane
  // sofort auffällt.
  const isUrgent = state !== "none"

  return (
    <div
      data-todo-id={todo.id}
      draggable
      onDragStart={onDragStart}
      className={cn(
        "flex cursor-grab flex-col gap-2 rounded-md border border-l-4 p-3 text-sm shadow-sm active:cursor-grabbing",
        isUrgent ? "bg-rose-50 dark:bg-rose-950/40" : "bg-background",
        CARD_BORDER_CLASS[todo.color]
      )}
    >
      {showCategory && (
        <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {TODO_CATEGORY_LABELS[todo.category]}
        </span>
      )}

      {editingTitle ? (
        <input
          ref={inputRef}
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitTitle()
            if (e.key === "Escape") { setTitleDraft(todo.title); setEditingTitle(false) }
          }}
          className="h-7 rounded border border-input bg-transparent px-2 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditingTitle(true)}
          className="text-left font-medium leading-snug hover:underline"
        >
          {todo.title}
        </button>
      )}

      {editingDescription ? (
        <textarea
          ref={descriptionRef}
          value={descriptionDraft}
          onChange={(e) => setDescriptionDraft(e.target.value)}
          onBlur={commitDescription}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setDescriptionDraft(todo.description); setEditingDescription(false) }
          }}
          placeholder="Beschreibung"
          rows={2}
          className="w-full resize-none rounded border border-input bg-transparent px-2 py-1 text-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditingDescription(true)}
          className={cn(
            "text-left text-xs leading-snug hover:underline",
            todo.description ? "text-muted-foreground" : "text-muted-foreground/50 italic"
          )}
        >
          {todo.description || "+ Beschreibung hinzufügen"}
        </button>
      )}

      <input
        type="date"
        aria-label="Fällig bis"
        value={todo.dueDate}
        onChange={(e) => onPatch({ dueDate: e.target.value })}
        className={cn(
          // max-w-full statt w-fit: native <input type="date"> haben in Chrome eine
          // feste Mindestbreite (~150px) unabhängig vom Elternelement — in schmalen
          // Spalten (viele Swimlanes auf kleinen Bildschirmen) hat das sonst die Karte
          // und damit die ganze Lane horizontal überlaufen lassen.
          "w-full max-w-full rounded border border-transparent bg-transparent text-xs outline-none hover:border-input focus-visible:border-ring",
          DUE_TEXT_CLASS[state]
        )}
      />

      <div className="mt-1 flex flex-wrap items-center justify-between gap-1">
        <div className="flex gap-1.5">
          {TODO_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={TODO_COLOR_LABELS[c]}
              aria-pressed={todo.color === c}
              onClick={() => onPatch({ color: c })}
              className={cn(
                "size-3.5 rounded-full ring-offset-1 ring-offset-background",
                COLOR_DOT_CLASS[c],
                todo.color === c ? "ring-1 ring-foreground" : "opacity-60 hover:opacity-100"
              )}
            />
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={todo.flagged ? "Markierung entfernen" : "Markieren"}
            aria-pressed={todo.flagged}
            onClick={() => onPatch({ flagged: !todo.flagged })}
            className={cn(
              "rounded p-1 hover:bg-accent",
              todo.flagged ? "text-destructive" : "text-muted-foreground"
            )}
          >
            <Flag className="size-3.5" fill={todo.flagged ? "currentColor" : "none"} />
          </button>
          <button
            type="button"
            aria-label="Todo löschen"
            onClick={onDelete}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
