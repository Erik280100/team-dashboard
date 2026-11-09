// Mein Board — persönliches Kanban-Board (der Besitzer bearbeitet es, Vorgesetzte sehen es nur an; erzwingt firestore.rules),
// 5 fixe Swimlanes,
// Drag-&-Drop per nativer HTML5-DnD (keine zusätzliche Library, siehe StrukturBaum.tsx
// für dasselbe Prinzip bei Pointer-Events). Keine Legacy-Entsprechung — neues Feature.
import { lazy, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from "react"
import { Archive, Plus, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useConfirm } from "@/hooks/useConfirm"
import { assignableEmployees, boardSubordinates, todosInLane, type BoardFilter, type LaneSort } from "@/lib/calc/todos"
import type { EmployeeMeta } from "@/lib/calc/employees"
import { useBoardTodosDoc, type PersonRef, type TodoInit } from "@/hooks/useBoardTodosDoc"
import { useAssignedByMe } from "@/hooks/useAssignedByMe"
import { Select } from "@/components/ui/select"
import { AssignTodoDialog } from "@/components/sections/board/AssignTodoDialog"
import {
  TODO_CATEGORIES, TODO_CATEGORY_LABELS, TODO_LANES, TODO_LANE_LABELS,
  type BoardTodo, type TodoCategory, type TodoLane,
} from "@/types/dashboard"
import { NewTodoDialog } from "@/components/sections/board/NewTodoDialog"
import { TodoCard } from "@/components/sections/board/TodoCard"

// Nur Admins sehen diese Rechner — erst beim Öffnen laden.
const EuVsGmbhRechner = lazy(() => import("@/components/sections/rechner/EuVsGmbhRechner").then((m) => ({ default: m.EuVsGmbhRechner })))
const HoldingImmobilienRechner = lazy(() => import("@/components/sections/rechner/HoldingImmobilienRechner").then((m) => ({ default: m.HoldingImmobilienRechner })))
const RechtsformVergleichRechner = lazy(() => import("@/components/sections/rechner/RechtsformVergleichRechner").then((m) => ({ default: m.RechtsformVergleichRechner })))

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
  todos: ownTodos, addTodo, patchTodo, moveTodo, removeTodo, isAdmin,
  employees, myId, myName, assignTodo, addTodoFor,
}: {
  /** Alle Mitarbeiter (für Zuweisen und die Board-Auswahl der Führungskraft). */
  employees: EmployeeMeta[]
  myId: string | null
  myName: string
  assignTodo: (id: string, target: PersonRef, me: PersonRef) => Promise<void>
  addTodoFor: (target: PersonRef, init: TodoInit, me: PersonRef) => Promise<void>
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
  const [showCompleted, setShowCompleted] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [showTracked, setShowTracked] = useState(false)

  // Führungskräfte können die Boards ihrer (in)direkten Mitarbeiter ansehen (nur lesen).
  const subordinates = useMemo(() => boardSubordinates(employees, myId), [employees, myId])
  const { superiors, subordinates: assignSubs } = useMemo(() => assignableEmployees(employees, myId), [employees, myId])
  const [viewedIdState, setViewedId] = useState("")
  const viewedId = subordinates.some((e) => e.id === viewedIdState) ? viewedIdState : ""
  const viewedBoard = useBoardTodosDoc(viewedId || null)
  const todos = viewedId ? viewedBoard.todos : ownTodos
  const readOnly = !!viewedId
  const viewedName = subordinates.find((e) => e.id === viewedId)?.name ?? ""
  const me: PersonRef | null = myId ? { id: myId, name: myName } : null
  const canAssign = !!me && superiors.length + assignSubs.length > 0
  const [assigning, setAssigning] = useState<BoardTodo | null>(null)
  const assignedByMe = useAssignedByMe(myId)
  const trackedTodos = assignedByMe.filter((a) => a.ownerId !== myId)

  // Neu zugewiesene Todos beim Öffnen des eigenen Boards als "Neu" markieren und danach als gesehen speichern
  // (jeweils eines pro Durchlauf: patchTodo schreibt auf Basis des letzten gerenderten Stands).
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    if (readOnly || view !== "todos") return
    const unseen = ownTodos.find((t) => t.assignedUnseen)
    if (!unseen) return
    setFreshIds((prev) => new Set(prev).add(unseen.id))
    patchTodo(unseen.id, { assignedUnseen: false })
  }, [ownTodos, readOnly, view, patchTodo])
  const shown = (t: BoardTodo): BoardTodo => (freshIds.has(t.id) ? { ...t, assignedUnseen: true } : t)

  function handleCreate(init: TodoInit, target: EmployeeMeta | null) {
    if (target && me) void addTodoFor({ id: target.id, name: target.name }, init, me)
    else addTodo(init)
  }

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
    if (!id || readOnly) return
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
  const matchingTodos = todos
    .filter((t) => !flaggedOnly || t.flagged)
    .filter((t) => !searchActive || (t.title ?? "").toLowerCase().includes(searchTerm) || (t.description ?? "").toLowerCase().includes(searchTerm))
    .filter((t) => filter === "alle" || t.category === filter)
  const archivedTodos = matchingTodos
    .filter((t) => t.archived)
    .sort((a, b) => a.title.localeCompare(b.title))
  // Abgehakte Todos sind ausgeblendet, bis "Erledigte anzeigen" aktiv ist; Archiviertes nie auf dem Board.
  const visibleTodos = matchingTodos.filter((t) => !t.archived && (showCompleted || !t.completed))
  const completedCount = todos.filter((t) => t.completed && !t.archived).length
  const archivedCount = todos.filter((t) => t.archived).length

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
              {subordinates.length > 0 && (
                <label className="flex items-center gap-2 text-sm font-medium">
                  Board von
                  <Select value={viewedId} onChange={(e) => { setViewedId(e.target.value); setShowTracked(false) }} aria-label="Board anzeigen von">
                    <option value="">Mir</option>
                    {subordinates.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </Select>
                </label>
              )}
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
              {!showArchive && !showTracked && (
                <button
                  type="button"
                  aria-pressed={showCompleted}
                  onClick={() => setShowCompleted((v) => !v)}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                    showCompleted
                      ? "border-transparent bg-emerald-600 text-white shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {showCompleted ? "Erledigte ausblenden" : "Erledigte anzeigen"} ({completedCount})
                </button>
              )}
              <button
                type="button"
                aria-pressed={showArchive}
                onClick={() => { setShowArchive((v) => !v); setShowTracked(false) }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                  showArchive
                    ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                <Archive className="size-3.5" /> {showArchive ? "Zurück zum Board" : "Archiv"} ({archivedCount})
              </button>
              {!readOnly && myId && (
                <button
                  type="button"
                  aria-pressed={showTracked}
                  onClick={() => { setShowTracked((v) => !v); setShowArchive(false) }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                    showTracked
                      ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  <Send className="size-3.5" /> {showTracked ? "Zurück zum Board" : "Von mir zugewiesen"} ({trackedTodos.length})
                </button>
              )}
              <Input
                type="search"
                placeholder="Suchen…"
                aria-label="Todos durchsuchen"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-40"
              />
            </div>
            {!readOnly && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus /> Neues Todo
              </Button>
            )}
          </div>

          {readOnly && (
            <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              Board von {viewedName} — nur Ansicht. Ändern kann nur {viewedName} selbst.
            </p>
          )}

          {showTracked && (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Von mir zugewiesen</h3>
              {trackedTodos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Du hast noch keine Todos zugewiesen.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {[...trackedTodos]
                    .sort((a, b) => (b.todo.assignedAt ?? "").localeCompare(a.todo.assignedAt ?? ""))
                    .map(({ todo, ownerId }) => (
                      <TodoCard
                        key={`${ownerId}/${todo.id}`}
                        todo={{ ...todo, assignedUnseen: false, assignedByName: undefined }}
                        showCategory
                        readOnly
                        footer={`Bei ${employees.find((e) => e.id === ownerId)?.name ?? ownerId} · ${todo.archived ? "archiviert" : todo.completed ? "erledigt" : TODO_LANE_LABELS[todo.lane]}`}
                        onPatch={() => {}}
                        onDelete={() => {}}
                        onDragStart={(e) => e.preventDefault()}
                      />
                    ))}
                </div>
              )}
            </div>
          )}

          {showArchive && (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Archiv</h3>
              {archivedTodos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine archivierten Todos.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {archivedTodos.map((todo) => (
                    <div key={todo.id} className="flex flex-col gap-1">
                      <span className="px-1 text-[11px] text-muted-foreground">Aus: {TODO_LANE_LABELS[todo.lane]}</span>
                      <TodoCard
                        todo={shown(todo)}
                        showCategory
                        inArchive
                        readOnly={readOnly}
                        onPatch={(patch) => patchTodo(todo.id, patch)}
                        onDelete={() => handleDelete(todo)}
                        onDragStart={(e) => e.preventDefault()}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div
            ref={boardRef}
            className={cn("flex gap-4", (showArchive || showTracked) && "hidden")}
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
                        todo={shown(todo)}
                        showCategory={filter === "alle"}
                        readOnly={readOnly}
                        onAssign={canAssign && !readOnly ? () => setAssigning(todo) : undefined}
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
            onCreate={handleCreate}
            superiors={superiors}
            subordinates={assignSubs}
          />
          <AssignTodoDialog
            todo={assigning}
            superiors={superiors}
            subordinates={assignSubs}
            onClose={() => setAssigning(null)}
            onAssign={async (todo, target) => { if (me) await assignTodo(todo.id, { id: target.id, name: target.name }, me) }}
          />
        </>
      )}
    </div>
  )
}
