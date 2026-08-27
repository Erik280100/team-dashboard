// Erik-Dashboard — reine Board-Logik (Filtern/Sortieren/Verschieben von Todos), aus der
// UI (ErikDashboard.tsx) herausgezogen, damit sie unabhängig testbar ist (siehe
// test/calc/todos.test.ts). Keine Legacy-Entsprechung, neues Feature.
import type { ErikTodo, TodoCategory, TodoLane } from "@/types/dashboard"

export type BoardFilter = TodoCategory | "alle"

/** Todos einer Lane, optional nach Kategorie gefiltert, sortiert nach order (Tiebreak: createdAt). */
export function todosInLane(todos: ErikTodo[], lane: TodoLane, filter: BoardFilter): ErikTodo[] {
  return todos
    .filter((t) => t.lane === lane && (filter === "alle" || t.category === filter))
    .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt))
}

/**
 * Verschiebt ein Todo in `lane`, direkt vor die Karte mit id `beforeId` (oder ans Ende
 * der Lane, wenn `beforeId` null ist). Gibt ein neues Array zurück (alle anderen Todos
 * unverändert bis auf ggf. den Renumber-Fallback weiter unten). Die Sortierung der
 * Ziel-Lane wird dabei anhand des aktuellen `order`-Werts bestimmt (nicht der Anzeige),
 * daher zuerst intern die Ziel-Lane sortieren.
 */
export function reorderForMove(todos: ErikTodo[], id: string, lane: TodoLane, beforeId: string | null): ErikTodo[] {
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

  return todos.map((t) => (t.id === id ? { ...t, lane, order: newOrder } : t))
}

export type DueState = "overdue" | "today" | "soon" | "none"

/** Fälligkeitsstatus eines Todos relativ zu `today` (YYYY-MM-DD, lokale Zeit). "soon" = innerhalb 3 Tagen. */
export function dueState(dueDate: string, today: string): DueState {
  if (!dueDate) return "none"
  if (dueDate < today) return "overdue"
  if (dueDate === today) return "today"
  const soonUntil = new Date(today)
  soonUntil.setDate(soonUntil.getDate() + 3)
  const soonUntilStr = soonUntil.toISOString().slice(0, 10)
  if (dueDate <= soonUntilStr) return "soon"
  return "none"
}
