// "Mein Board" (persönliches Kanban): ein Dokument je Todo unter
// employees/{eigeneId}/todos/{todoId}; laut firestore.rules nur für den Besitzer
// lesbar/schreibbar (auch Vorgesetzte und Admin nicht). Kein localStorage-Cache
// (mehrere Konten pro Browser).
import { useCallback, useEffect, useRef, useState } from "react"
import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore"
import { firestore } from "@/lib/firebase"
import { reorderForMove } from "@/lib/calc/todos"
import {
  type BoardTodo,
  type TodoCategory,
  type TodoColor,
  type TodoLane,
} from "@/types/dashboard"

function newTodoId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export interface UseBoardTodosDocResult {
  todos: BoardTodo[]
  addTodo: (init: { title: string; description: string; dueDate: string; category: TodoCategory; color: TodoColor }) => void
  patchTodo: (id: string, patch: Partial<BoardTodo>) => void
  moveTodo: (id: string, lane: TodoLane, beforeId: string | null) => void
  removeTodo: (id: string) => void
}

export function useBoardTodosDoc(employeeId: string | null = null): UseBoardTodosDocResult {
  const [todos, setTodos] = useState<BoardTodo[]>([])
  const cloudReady = useRef(false)
  const latest = useRef(todos)
  latest.current = todos

  useEffect(() => {
    if (!firestore || !employeeId) return
    cloudReady.current = false
    return onSnapshot(
      collection(firestore, "employees", employeeId, "todos"),
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.metadata.hasPendingWrites) return
        setTodos(snap.docs.map((d) => d.data() as BoardTodo))
        if (!snap.metadata.fromCache) cloudReady.current = true
      },
      (err) => console.warn("Mein Board: Cloud-Verbindung fehlgeschlagen", err)
    )
  }, [employeeId])

  const commit = useCallback((next: BoardTodo[]) => {
    const prev = latest.current
    setTodos(next)
    if (!cloudReady.current || !firestore || !employeeId) return
    const prevById = new Map(prev.map((t) => [t.id, JSON.stringify(t)]))
    const nextIds = new Set(next.map((t) => t.id))
    const fail = (err: unknown) => console.warn("Mein Board: Cloud-Speichern fehlgeschlagen", err)
    for (const t of next) {
      if (prevById.get(t.id) !== JSON.stringify(t)) {
        setDoc(doc(firestore, "employees", employeeId, "todos", t.id), t).catch(fail)
      }
    }
    for (const t of prev) {
      if (!nextIds.has(t.id)) deleteDoc(doc(firestore, "employees", employeeId, "todos", t.id)).catch(fail)
    }
  }, [employeeId])

  const addTodo = useCallback(
    (init: { title: string; description: string; dueDate: string; category: TodoCategory; color: TodoColor }) => {
      const inTodoLane = latest.current.filter((t) => t.lane === "todo")
      const minOrder = inTodoLane.reduce((m, t) => Math.min(m, t.order), 0)
      const next: BoardTodo = {
        id: newTodoId(),
        title: init.title,
        description: init.description,
        dueDate: init.dueDate,
        lane: "todo",
        category: init.category,
        color: init.color,
        flagged: false,
        order: minOrder - 1,
        createdAt: new Date().toISOString(),
      }
      commit([...latest.current, next])
    },
    [commit]
  )

  const patchTodo = useCallback(
    (id: string, patch: Partial<BoardTodo>) => {
      commit(latest.current.map((t) => (t.id === id ? { ...t, ...patch } : t)))
    },
    [commit]
  )

  const moveTodo = useCallback(
    (id: string, lane: TodoLane, beforeId: string | null) => {
      commit(reorderForMove(latest.current, id, lane, beforeId))
    },
    [commit]
  )

  const removeTodo = useCallback(
    (id: string) => {
      commit(latest.current.filter((t) => t.id !== id))
    },
    [commit]
  )

  return { todos, addTodo, patchTodo, moveTodo, removeTodo }
}
