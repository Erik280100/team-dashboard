// Erik-Dashboard — persönliches Kanban-Board. Passwortgeschützt (reiner Frontend-
// Schutz, siehe Kommentar unten und Karriere.tsx als Vorbild), 5 fixe Swimlanes,
// Drag-&-Drop per nativer HTML5-DnD (keine zusätzliche Library, siehe StrukturBaum.tsx
// für dasselbe Prinzip bei Pointer-Events). Keine Legacy-Entsprechung — neues Feature.
import { useLayoutEffect, useRef, useState, type DragEvent, type FormEvent } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useConfirm } from "@/hooks/useConfirm"
import { todosInLane, type BoardFilter } from "@/lib/calc/todos"
import {
  TODO_CATEGORIES, TODO_CATEGORY_LABELS, TODO_LANES, TODO_LANE_LABELS,
  type ErikTodo, type TodoCategory, type TodoLane,
} from "@/types/dashboard"
import { NewTodoDialog } from "@/components/sections/erik/NewTodoDialog"
import { TodoCard } from "@/components/sections/erik/TodoCard"
import { GmbhVsEuRechner } from "@/components/sections/rechner/GmbhVsEuRechner"

// Kein Verschlüsselungs-Passwort wie bei Karriere.tsx — nur ein Sichtschutz, damit
// Kolleg:innen am selben Rechner nicht versehentlich hineinsehen. Die Todos selbst
// liegen ungeschützt in Firestore (finova/erik_todos), wie jedes andere finova/*-
// Dokument. Keine sensiblen Kundendaten hier ablegen, die das nicht vertragen.
const ERIK_PASSWORD = "eriksTodos"
const UNLOCK_KEY = "finova_erik_unlocked_v1"

function beforeIdFromPoint(container: HTMLElement, clientY: number): string | null {
  const cards = Array.from(container.querySelectorAll<HTMLElement>("[data-todo-id]"))
  for (const card of cards) {
    const rect = card.getBoundingClientRect()
    if (clientY < rect.top + rect.height / 2) return card.dataset.todoId ?? null
  }
  return null
}

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState(false)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (password === ERIK_PASSWORD) {
      try { sessionStorage.setItem(UNLOCK_KEY, "1") } catch { /* noop */ }
      onUnlock()
    } else {
      setError(true)
      setPassword("")
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Erik-Dashboard</h2>
        <p className="text-sm text-muted-foreground">Dieser Bereich ist passwortgeschützt.</p>
        <form onSubmit={onSubmit} className="flex gap-2">
          <Input
            type="password"
            placeholder="Passwort"
            aria-label="Passwort für Erik-Dashboard"
            autoComplete="off"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(false) }}
          />
          <Button type="submit">Freischalten</Button>
        </form>
        {error && <div role="alert" className="text-sm text-destructive">Falsches Passwort.</div>}
      </CardContent>
    </Card>
  )
}

const BOARD_TABS: { id: BoardFilter; label: string }[] = [
  { id: "alle", label: "Alle" },
  ...TODO_CATEGORIES.map((c) => ({ id: c as BoardFilter, label: TODO_CATEGORY_LABELS[c] })),
]

type ErikView = "todos" | "gmbhRechner"

const VIEW_TABS: { id: ErikView; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "gmbhRechner", label: "GmbH vs. Einzelunternehmer" },
]

export function ErikDashboard({
  todos, addTodo, patchTodo, moveTodo, removeTodo,
}: {
  todos: ErikTodo[]
  addTodo: (init: { title: string; description: string; dueDate: string; category: TodoCategory; color: ErikTodo["color"] }) => void
  patchTodo: (id: string, patch: Partial<ErikTodo>) => void
  moveTodo: (id: string, lane: TodoLane, beforeId: string | null) => void
  removeTodo: (id: string) => void
}) {
  const confirm = useConfirm()
  const [unlocked, setUnlocked] = useState(() => {
    try { return sessionStorage.getItem(UNLOCK_KEY) === "1" } catch { return false }
  })
  const [view, setView] = useState<ErikView>("todos")
  const [filter, setFilter] = useState<BoardFilter>("alle")
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Swimlanes sollen die restliche Bildschirmhöhe unterhalb von Topbar/Bannern/Tab-
  // leiste ausfüllen, statt mit dem Rest der Seite mitzuscrollen (das Verschieben von
  // Karten in eine 5. Lane, die erst per Scroll sichtbar wird, wäre unpraktisch). Die
  // verfügbare Höhe lässt sich nicht per CSS-Prozentkette ermitteln (mehrere flex-
  // Vorfahren mit variabler, banner-abhängiger Höhe in App.tsx) — daher hier direkt
  // per getBoundingClientRect gemessen: Fensterhöhe minus Position der Board-oberkante
  // minus dem unteren Seiten-Padding (p-6 = 24px in App.tsx).
  const boardRef = useRef<HTMLDivElement>(null)
  const [boardHeight, setBoardHeight] = useState<number | null>(null)

  useLayoutEffect(() => {
    function recompute() {
      const el = boardRef.current
      if (!el) return
      const top = el.getBoundingClientRect().top
      // Math.floor + 2px Extra-Puffer: die gemessene top-Position ist subpixel-genau
      // (z. B. 156.8), ein einfaches Abrunden reicht daher nicht immer — ohne Puffer
      // ragt das Board 1px über die verfügbare Höhe hinaus und erzwingt eine
      // vertikale Scrollbar auf <main>.
      setBoardHeight(Math.max(360, Math.floor(window.innerHeight - top - 24) - 2))
    }
    recompute()
    window.addEventListener("resize", recompute)
    return () => window.removeEventListener("resize", recompute)
  }, [])

  function lock() {
    try { sessionStorage.removeItem(UNLOCK_KEY) } catch { /* noop */ }
    setUnlocked(false)
  }

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />
  }

  function handleDragStart(e: DragEvent<HTMLDivElement>, id: string) {
    e.dataTransfer.setData("text/plain", id)
    e.dataTransfer.effectAllowed = "move"
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, lane: TodoLane) {
    e.preventDefault()
    const id = e.dataTransfer.getData("text/plain")
    if (!id) return
    const beforeId = beforeIdFromPoint(e.currentTarget, e.clientY)
    moveTodo(id, lane, beforeId)
  }

  async function handleDelete(todo: ErikTodo) {
    const ok = await confirm(`Todo "${todo.title}" wirklich löschen?`)
    if (ok) removeTodo(todo.id)
  }

  const visibleTodos = flaggedOnly ? todos.filter((t) => t.flagged) : todos

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {VIEW_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setView(t.id)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                view === t.id
                  ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={lock}>Sperren</Button>
      </div>

      {view === "gmbhRechner" && <GmbhVsEuRechner />}

      {view === "todos" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {BOARD_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFilter(t.id)}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                    filter === t.id
                      ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {t.label}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={flaggedOnly}
                onClick={() => setFlaggedOnly((v) => !v)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                  flaggedOnly
                    ? "border-transparent bg-destructive text-white shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                Nur geflaggte
              </button>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus /> Neues Todo
            </Button>
          </div>

          <div
            ref={boardRef}
            className="flex gap-4"
            style={boardHeight !== null ? { height: boardHeight } : undefined}
          >
            {TODO_LANES.map((lane) => {
              const laneTodos = todosInLane(visibleTodos, lane, filter)
              return (
                <div key={lane} className="flex min-w-0 flex-1 flex-col gap-2 overflow-hidden rounded-xl border bg-card p-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-semibold">{TODO_LANE_LABELS[lane]}</h3>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {laneTodos.length}
                    </span>
                  </div>
                  <div
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, lane)}
                    className="flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto"
                  >
                    {laneTodos.map((todo) => (
                      <TodoCard
                        key={todo.id}
                        todo={todo}
                        showCategory={filter === "alle"}
                        onPatch={(patch) => patchTodo(todo.id, patch)}
                        onDelete={() => handleDelete(todo)}
                        onDragStart={(e) => handleDragStart(e, todo.id)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <NewTodoDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            defaultCategory={filter === "alle" ? "kunde" : filter}
            onCreate={addTodo}
          />
        </>
      )}
    </div>
  )
}
