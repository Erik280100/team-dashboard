// Mein Board — reine Board-Logik (Filtern/Sortieren/Verschieben von Todos), aus der
// UI (MeinBoard.tsx) herausgezogen, damit sie unabhängig testbar ist (siehe
// test/calc/todos.test.ts). Keine Legacy-Entsprechung, neues Feature.
import type { BoardTodo, TodoCategory, TodoLane } from "@/types/dashboard"
import type { EmployeeMeta } from "@/lib/calc/employees"

export type BoardFilter = TodoCategory | "alle"

/** Sortierung einer Lane: nach Fälligkeitsdatum (Standard) oder eigene Reihenfolge per Drag & Drop. */
export type LaneSort = "faellig" | "manuell"

/** Aufsteigend nach Fälligkeitsdatum, Todos ohne Datum zuletzt (Tiebreak: createdAt). */
function compareByDue(a: BoardTodo, b: BoardTodo): number {
  if (!a.dueDate !== !b.dueDate) return a.dueDate ? -1 : 1
  return (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || a.createdAt.localeCompare(b.createdAt)
}

/**
 * Todos einer Lane, optional nach Kategorie gefiltert. `sort` "manuell" (Standard hier) = nach order
 * (Tiebreak: createdAt), "faellig" = nach Fälligkeitsdatum.
 */
export function todosInLane(todos: BoardTodo[], lane: TodoLane, filter: BoardFilter, sort: LaneSort = "manuell"): BoardTodo[] {
  return todos
    .filter((t) => t.lane === lane && (filter === "alle" || t.category === filter))
    .sort(sort === "faellig" ? compareByDue : (a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt))
}

/**
 * Übernimmt die Fälligkeits-Reihenfolge einer Lane in `order`, damit eine anschließende manuelle
 * Sortierung genau dort startet, wo die Anzeige vorher stand.
 */
export function seedOrderByDue(todos: BoardTodo[], lane: TodoLane): BoardTodo[] {
  const ranks = new Map(todosInLane(todos, lane, "alle", "faellig").map((t, i) => [t.id, i * 10]))
  return todos.map((t) => (ranks.has(t.id) ? { ...t, order: ranks.get(t.id)! } : t))
}

/**
 * Verschiebt ein Todo in `lane`, direkt vor die Karte mit id `beforeId` (oder ans Ende
 * der Lane, wenn `beforeId` null ist). Gibt ein neues Array zurück (alle anderen Todos
 * unverändert bis auf ggf. den Renumber-Fallback weiter unten). Die Sortierung der
 * Ziel-Lane wird dabei anhand des aktuellen `order`-Werts bestimmt (nicht der Anzeige),
 * daher zuerst intern die Ziel-Lane sortieren.
 */
export function reorderForMove(todos: BoardTodo[], id: string, lane: TodoLane, beforeId: string | null): BoardTodo[] {
  const moving = todos.find((t) => t.id === id)
  if (!moving) return todos

  const targetSiblings = todos
    .filter((t) => t.id !== id && t.lane === lane)
    .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt))

  const beforeIndex = beforeId ? targetSiblings.findIndex((t) => t.id === beforeId) : -1
  const insertAt = beforeId && beforeIndex >= 0 ? beforeIndex : targetSiblings.length

  const prevOrder = insertAt > 0 ? targetSiblings[insertAt - 1].order : null
  const nextOrder = insertAt < targetSiblings.length ? targetSiblings[insertAt].order : null

  let newOrder: number
  if (prevOrder === null && nextOrder === null) {
    newOrder = 0
  } else if (prevOrder === null) {
    newOrder = nextOrder! - 1
  } else if (nextOrder === null) {
    newOrder = prevOrder + 1
  } else {
    newOrder = (prevOrder + nextOrder) / 2
    // Kollision (zu wenig Fließkomma-Abstand zwischen Nachbarn) — Lane komplett
    // durchnummerieren, dann erneut zwischen den (jetzt ganzzahligen) Nachbarn einfügen.
    if (newOrder === prevOrder || newOrder === nextOrder) {
      const renumbered = targetSiblings.map((t, i) => ({ ...t, order: i * 10 }))
      const updated = todos.map((t) => renumbered.find((r) => r.id === t.id) ?? t)
      return reorderForMove(updated, id, lane, beforeId)
    }
  }

  // "Abgehakt" gilt nur in der Lane "fertig" — wer das Todo woandershin zieht, öffnet es damit wieder.
  return todos.map((t) => (t.id === id ? { ...t, lane, order: newOrder, ...(lane !== "fertig" && t.completed ? { completed: false } : {}) } : t))
}

/** Bis so viele Tage vor der Fälligkeit wird ein Todo orange, bis RED_DUE_DAYS rot (überfällig bleibt rot). */
export const ORANGE_DUE_DAYS = 45
export const RED_DUE_DAYS = 30

export type DueState = "red" | "orange" | "none"

/** Tage von `today` bis `dueDate` (beide "YYYY-MM-DD"); negativ = überfällig. */
export function daysUntil(dueDate: string, today: string): number {
  return Math.round((Date.parse(dueDate) - Date.parse(today)) / 86_400_000)
}

/** Dringlichkeit eines Fälligkeitsdatums relativ zu `today`: rot bis 30 Tage (inkl. überfällig), orange bis 45 Tage. */
export function dueState(dueDate: string, today: string): DueState {
  if (!dueDate) return "none"
  const days = daysUntil(dueDate, today)
  if (days <= RED_DUE_DAYS) return "red"
  if (days <= ORANGE_DUE_DAYS) return "orange"
  return "none"
}

/** Offene Todos (nicht in "fertig", nicht abgehakt, nicht archiviert) mit Fälligkeit in höchstens 45 Tagen, früheste zuerst. */
export function dueSoonTodos(todos: BoardTodo[], today: string): BoardTodo[] {
  return todos
    .filter((t) => t.lane !== "fertig" && !t.completed && !t.archived && dueState(t.dueDate, today) !== "none")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.createdAt.localeCompare(b.createdAt))
}

/**
 * Gibt es ein offenes Todo, dessen Fälligkeitsdatum erreicht oder überschritten ist? (Todos in der Lane "fertig"
 * und Todos ohne Datum zählen nicht.) `today` = "YYYY-MM-DD" in lokaler Zeit. Steuert das rote Ausrufezeichen
 * bei "Mein Board" in der Sidebar.
 */
export function hasOpenDueTodos(todos: Pick<BoardTodo, "dueDate" | "lane" | "archived">[], today: string): boolean {
  return todos.some((t) => t.lane !== "fertig" && !t.archived && !!t.dueDate && t.dueDate <= today)
}

/** Alle (direkten und indirekten) Mitarbeiter von `myId`, nach Name sortiert. */
export function boardSubordinates(employees: readonly EmployeeMeta[], myId: string | null): EmployeeMeta[] {
  if (!myId) return []
  return employees.filter((e) => e.id !== myId && e.ancestors.includes(myId)).sort((a, b) => a.name.localeCompare(b.name, "de"))
}

/** Personen, denen `myId` ein Todo zuweisen darf: die eigenen Vorgesetzten (direkt und indirekt) und alle Mitarbeiter darunter. */
export function assignableEmployees(
  employees: readonly EmployeeMeta[], myId: string | null,
): { superiors: EmployeeMeta[]; subordinates: EmployeeMeta[] } {
  const me = employees.find((e) => e.id === myId)
  if (!myId || !me) return { superiors: [], subordinates: [] }
  const superiors = employees
    .filter((e) => e.id !== myId && me.ancestors.includes(e.id))
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
  return { superiors, subordinates: boardSubordinates(employees, myId) }
}

/** Das Todo, wie es beim Empfänger landet: Lane "Todo" (oben), offen, mit Hinweis auf den Absender. */
export function buildAssignedTodo(todo: BoardTodo, by: { id: string; name: string }, nowIso: string, order: number): BoardTodo {
  return {
    ...todo,
    lane: "todo",
    order,
    completed: false,
    archived: false,
    assignedById: by.id,
    assignedByName: by.name,
    assignedAt: nowIso,
    assignedUnseen: true,
  }
}

/** Gibt es zugewiesene Todos, die der Empfänger noch nicht gesehen hat? (Rufzeichen bei "Mein Board".) */
export function hasUnseenAssigned(todos: Pick<BoardTodo, "assignedUnseen" | "archived">[]): boolean {
  return todos.some((t) => t.assignedUnseen === true && !t.archived)
}
