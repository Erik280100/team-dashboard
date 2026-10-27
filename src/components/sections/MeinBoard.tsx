// Mein Board — persönliches Kanban-Board (nur der Besitzer sieht es, erzwingt firestore.rules),
// 5 fixe Swimlanes,
// Drag-&-Drop per nativer HTML5-DnD (keine zusätzliche Library, siehe StrukturBaum.tsx
// für dasselbe Prinzip bei Pointer-Events). Keine Legacy-Entsprechung — neues Feature.
import { useLayoutEffect, useRef, useState, type DragEvent } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useConfirm } from "@/hooks/useConfirm"
import { todosInLane, type BoardFilter, type LaneSort } from "@/lib/calc/todos"
import {
  TODO_CATEGORIES, TODO_CATEGORY_LABELS, TODO_LANES, TODO_LANE_LABELS,
  type BoardTodo, type TodoCategory, type TodoLane,
} from "@/types/dashboard"
import { NewTodoDialog } from "@/components/sections/board/NewTodoDialog"
import { TodoCard } from "@/components/sections/board/TodoCard"
import { EuVsGmbhRechner } from "@/components/sections/rechner/EuVsGmbhRechner"
import { HoldingImmobilienRechner } from "@/components/sections/rechner/HoldingImmobilienRechner"
import { RechtsformVergleichRechner } from "@/components/sections/rechner/RechtsformVergleichRechner"

const LANE_SORT_KEY = "meinBoard.laneSort"

function beforeIdFromPoint(container: HTMLElement, clientY: number): string | null {
  const cards = Array.from(container.querySelectorAll<HTMLElement>("[data-todo-id]"))
  for (const card of cards) {
    const rect = card.getBoundingClientRect()
    if (clientY < rect.top + rect.height / 2) return card.dataset.todoId ?? null
  }
  return null
}

const BOARD_TABS: { id: BoardFilter; label: string }[] = [
  { id: "alle", label: "Alle" },
  ...TODO_CATEGORIES.map((c) => ({ id: c as BoardFilter, label: TODO_CATEGORY_LABELS[c] })),
]

type BoardView = "todos" | "euVsGmbh" | "holdingImmoRechner" | "gmbhVsZypern"

const VIEW_TABS: { id: BoardView; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "euVsGmbh", label: "EU vs. GmbH" },
  { id: "holdingImmoRechner", label: "Holding & Immobilien" },
  { id: "gmbhVsZypern", label: "EU vs. GmbH vs. Zypern" },
]

export function MeinBoard({
  todos, addTodo, patchTodo, moveTodo, removeTodo, isAdmin,
}: {
  /** Die Rechner (EU vs. GmbH, Holding & Immobilien, Zypern) sieht nur der Admin. */
  isAdmin: boolean
  todos: BoardTodo[]
  addTodo: (init: { title: string; description: string; dueDate: string; category: TodoCategory; color: BoardTodo["color"] }) => void
  patchTodo: (id: string, patch: Partial<BoardTodo>) => void
  moveTodo: (id: string, lane: TodoLane, beforeId: string | null, seedByDue?: boolean) => void
  removeTodo: (id: string) => void
}) {
  const confirm = useConfirm()
  const [viewState, setView] = useState<BoardView>("todos")
  const visibleViewTabs = isAdmin ? VIEW_TABS : VIEW_TABS.filter((t) => t.id === "todos")
  const view: BoardView = visibleViewTabs.some((t) => t.id === viewState) ? viewState : "todos"
  const [filter, setFilter] = useState<BoardFilter>("alle")
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch] = useState("")

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
      // Position unabhängig vom Scrollstand von <main> bestimmen (sonst schaukelt sich die Höhe beim Scrollen auf).
      const main = el.closest("main")
      const top = el.getBoundingClientRect().top + (main?.scrollTop ?? 0)
      // Math.floor + 2px Extra-Puffer: die gemessene top-Position ist subpixel-genau
      // (z. B. 156.8), ein einfaches Abrunden reicht daher nicht immer — ohne Puffer
      // ragt das Board 1px über die verfügbare Höhe hinaus und erzwingt eine
      // vertikale Scrollbar auf <main>.
      setBoardHeight(Math.max(360, Math.floor(window.innerHeight - top - 24) - 2))
    }
    recompute()
    const ro = new ResizeObserver(recompute)
    // Banner/Topbar über dem Board erscheinen oder verschwinden asynchron (Login, Archiv) und
    // verschieben das Board, ohne die Fenstergröße zu ändern — daher alle Geschwister im <main> beobachten.
    ro.observe(document.body)
    const main = boardRef.current?.closest("main")
    if (main) {
      ro.observe(main)
      Array.from(main.children).forEach((c) => ro.observe(c))
    }
    // Banner können später dazukommen/wegfallen (nicht beobachtbar) — Position daher zusätzlich leicht pollen.
    const poll = window.setInterval(recompute, 500)
    window.addEventListener("resize", recompute)
    return () => {
      window.removeEventListener("resize", recompute)
      ro.disconnect()
      window.clearInterval(poll)
    }
  }, [view])

  // Sortierung je Lane: nur "faellig" (Standard) oder "manuell"; pro Browser gemerkt.
  const [laneSorts, setLaneSorts] = useState<Partial<Record<TodoLane, LaneSort>>>(() => {
    try {
      return JSON.parse(localStorage.getItem(LANE_SORT_KEY) ?? "{}")
    } catch {
      return {}
    }
  })
  const laneSort = (lane: TodoLane): LaneSort => (laneSorts[lane] === "manuell" ? "manuell" : "faellig")
  function setLaneSort(lane: TodoLane, sort: LaneSort) {
    setLaneSorts((prev) => {
      const next = { ...prev, [lane]: sort }
      try {
        localStorage.setItem(LANE_SORT_KEY, JSON.stringify(next))
      } catch { /* Speicher gesperrt — Sortierung gilt dann nur für diese Sitzung */ }
      return next
    })
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
    // Umsortieren innerhalb einer nach Fälligkeit sortierten Lane = Wechsel auf eigene Sortierung,
    // die dort startet, wo die Anzeige gerade stand. Aus einer anderen Lane landet die Karte einfach
    // an ihrer Fälligkeits-Position.
    const reorderingInDueLane = laneSort(lane) === "faellig" && todos.find((t) => t.id === id)?.lane === lane
    if (reorderingInDueLane) setLaneSort(lane, "manuell")
    moveTodo(id, lane, beforeId, reorderingInDueLane)
  }

  async function handleDelete(todo: BoardTodo) {
    const ok = await confirm(`Todo "${todo.title}" wirklich löschen?`)
    if (ok) removeTodo(todo.id)
  }

  // Suche greift erst ab 2 Zeichen (kürzere Eingaben würden bei kurzen Titeln zu viel
  // Rauschen erzeugen und sind meist noch Tippbeginn).
  const searchTerm = search.trim().toLowerCase()
  const searchActive = searchTerm.length >= 2
  const visibleTodos = todos
    .filter((t) => !flaggedOnly || t.flagged)
    .filter((t) => !searchActive || (t.title ?? "").toLowerCase().includes(searchTerm) || (t.description ?? "").toLowerCase().includes(searchTerm))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {visibleViewTabs.length > 1 && visibleViewTabs.map((t) => (
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
      </div>

      {view === "euVsGmbh" && <EuVsGmbhRechner />}
      {view === "holdingImmoRechner" && <HoldingImmobilienRechner />}
      {view === "gmbhVsZypern" && <RechtsformVergleichRechner />}

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
              <Input
                type="search"
                placeholder="Suchen…"
                aria-label="Todos durchsuchen"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-40"
              />
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
              const sort = laneSort(lane)
              const laneTodos = todosInLane(visibleTodos, lane, filter, sort)
              return (
                <div key={lane} className="flex min-w-0 flex-1 flex-col gap-2 overflow-hidden rounded-xl border bg-card p-3">
                  <div className="flex items-center justify-between gap-2 px-1">
                    <h3 className="truncate text-sm font-semibold">{TODO_LANE_LABELS[lane]}</h3>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        disabled={sort === "faellig"}
                        onClick={() => setLaneSort(lane, "faellig")}
                        title={sort === "faellig"
                          ? "Sortiert nach Fälligkeit — per Drag & Drop wechselt die Lane auf eigene Sortierung"
                          : "Eigene Sortierung — klicken, um wieder nach Fälligkeit zu sortieren"}
                        className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground enabled:hover:border-primary/40 enabled:hover:text-foreground"
                      >
                        {sort === "faellig" ? "Fälligkeit" : "Eigene ↺"}
                      </button>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {laneTodos.length}
                      </span>
                    </div>
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
