// Einzelne Kanban-Karte im Mein Board. Drag-Start wird hier ausgelöst (native
// HTML5-DnD, siehe MeinBoard.tsx für das Gegenstück onDragOver/onDrop auf der
// Lane) — Drop-Zielberechnung (vor welcher Karte losgelassen wird) macht die Lane
// selbst anhand von data-todo-id, nicht diese Komponente.
import { useEffect, useRef, useState, type DragEvent } from "react"
import { Archive, ArchiveRestore, CheckCircle2, Flag, Trash2, UserPlus } from "lucide-react"
import { cn } from "@/lib/utils"
import { dueState } from "@/lib/calc/todos"
import { TODO_CATEGORY_LABELS, TODO_COLOR_LABELS, TODO_COLORS, type BoardTodo } from "@/types/dashboard"
import { COLOR_DOT_CLASS } from "@/components/sections/board/colors"

const CARD_BORDER_CLASS: Record<BoardTodo["color"], string> = {
  grau: "border-l-slate-400",
  gruen: "border-l-emerald-500",
  gelb: "border-l-amber-400",
  rot: "border-l-rose-500",
  blau: "border-l-sky-500",
}

const DUE_TEXT_CLASS: Record<ReturnType<typeof dueState>, string> = {
  red: "text-destructive font-medium",
  orange: "text-orange-600 font-medium",
  none: "text-muted-foreground",
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export function TodoCard({
  todo, showCategory, onPatch, onDelete, onDragStart, inArchive = false, readOnly = false, onAssign, footer,
}: {
  todo: BoardTodo
  showCategory: boolean
  onPatch: (patch: Partial<BoardTodo>) => void
  onDelete: () => void
  onDragStart: (e: DragEvent<HTMLDivElement>) => void
  /** Im Archiv: statt Archivieren/Abhaken gibt es "Wiederherstellen". */
  inArchive?: boolean
  /** Nur Ansicht (fremdes Board, verfolgte Zuweisung): nicht verschiebbar, nichts bearbeitbar. */
  readOnly?: boolean
  /** Öffnet den Zuweisen-Dialog; ohne Angabe gibt es kein Zuweisen-Symbol. */
  onAssign?: () => void
  /** Zusatzzeile unten (z. B. "Bei: Erik · Fertig"). */
  footer?: string
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
  // Fällig in höchstens 45 Tagen (orange) bzw. 30 Tagen oder überfällig (rot) — ganze Kachel
  // einfärben, nicht nur das Datum, damit es beim Überfliegen der Lane sofort auffällt.

  return (
    <div
      data-todo-id={todo.id}
      draggable={!readOnly}
      onDragStart={onDragStart}
      className={cn(
        "flex flex-col gap-2 rounded-md border border-l-4 p-3 text-sm shadow-sm",
        !readOnly && "cursor-grab active:cursor-grabbing",
        state === "red" ? "bg-rose-50" : state === "orange" ? "bg-orange-50" : "bg-background",
        CARD_BORDER_CLASS[todo.color]
      )}
    >
      {todo.assignedByName && (
        <span
          className={cn(
            "w-fit rounded-full px-2 py-0.5 text-[11px] font-medium",
            todo.assignedUnseen ? "bg-primary text-primary-foreground" : "bg-primary/15 text-foreground"
          )}
        >
          {todo.assignedUnseen ? "Neu · " : ""}Von {todo.assignedByName}
        </span>
      )}

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
          disabled={readOnly}
          onClick={() => setEditingTitle(true)}
          className={cn("text-left font-medium leading-snug", !readOnly && "hover:underline")}
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
          disabled={readOnly}
          onClick={() => setEditingDescription(true)}
          className={cn(
            "text-left text-xs leading-snug",
            !readOnly && "hover:underline",
            todo.description ? "text-muted-foreground" : "text-muted-foreground/50 italic",
            readOnly && !todo.description && "hidden"
          )}
        >
          {todo.description || "+ Beschreibung hinzufügen"}
        </button>
      )}

      <input
        type="date"
        aria-label="Fällig bis"
        disabled={readOnly}
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

      {readOnly && footer && <p className="text-[11px] font-medium text-muted-foreground">{footer}</p>}

      {!readOnly && <div className="mt-1 flex flex-wrap items-center justify-between gap-1">
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
          {onAssign && !inArchive && (
            <button
              type="button"
              aria-label="Zuweisen"
              title="Einer Person zuweisen"
              onClick={onAssign}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <UserPlus className="size-3.5" />
            </button>
          )}
          {inArchive ? (
            <button
              type="button"
              aria-label="Aus Archiv wiederherstellen"
              title="Aus Archiv wiederherstellen"
              onClick={() => onPatch({ archived: false })}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <ArchiveRestore className="size-3.5" />
            </button>
          ) : (
            <>
              {todo.lane === "fertig" && (
                <button
                  type="button"
                  aria-label={todo.completed ? "Wieder als offen markieren" : "Als erledigt abhaken"}
                  title={todo.completed ? "Wieder als offen markieren" : "Abhaken — Todo verschwindet aus der Lane"}
                  aria-pressed={!!todo.completed}
                  onClick={() => onPatch({ completed: !todo.completed })}
                  className={cn(
                    "rounded p-1 hover:bg-accent",
                    todo.completed ? "text-emerald-600" : "text-muted-foreground hover:text-emerald-600"
                  )}
                >
                  <CheckCircle2 className="size-3.5" />
                </button>
              )}
              <button
                type="button"
                aria-label="Archivieren"
                title="Archivieren"
                onClick={() => onPatch({ archived: true })}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Archive className="size-3.5" />
              </button>
            </>
          )}
          <button
            type="button"
            aria-label="Todo löschen"
            onClick={onDelete}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>}
    </div>
  )
}
