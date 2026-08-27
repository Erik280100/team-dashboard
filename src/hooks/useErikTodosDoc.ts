// Erik-Dashboard-Cloud-Sync — analog zu useFinanzierungenDoc.ts. Eigenes Firestore-
// Dokument finova/erik_todos. Der Passwortschutz (siehe ErikDashboard.tsx) ist reiner
// Frontend-Schutz — dieses Dokument selbst ist nicht anders abgesichert als die anderen
// finova/*-Dokumente. Keine Legacy-Entsprechung — neue Sektion.
import { useCallback, useEffect, useRef, useState } from "react"
import { onSnapshot, setDoc } from "firebase/firestore"
import { CLOUD_CONFIGURED, erikTodosDocRef } from "@/lib/firebase"
import { reorderForMove } from "@/lib/calc/todos"
import {
  ERIK_TODOS_KEY,
  type ErikTodo,
  type ErikTodosDoc,
  type TodoCategory,
  type TodoColor,
  type TodoLane,
} from "@/types/dashboard"

function loadLocalTodos(): ErikTodo[] {
  try {
    const raw = localStorage.getItem(ERIK_TODOS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch (e) {
    console.warn("Konnte Erik-Todos nicht laden", e)
  }
  return []
}

function newTodoId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export interface UseErikTodosDocResult {
  todos: ErikTodo[]
  addTodo: (init: { title: string; dueDate: string; category: TodoCategory; color: TodoColor }) => void
  patchTodo: (id: string, patch: Partial<ErikTodo>) => void
  moveTodo: (id: string, lane: TodoLane, beforeId: string | null) => void
  removeTodo: (id: string) => void
}

export function useErikTodosDoc(): UseErikTodosDocResult {
  const [todos, setTodos] = useState<ErikTodo[]>(loadLocalTodos)
  const cloudReady = useRef(false)
  const latest = useRef(todos)
  latest.current = todos

  useEffect(() => {
    const docRef = erikTodosDocRef
    if (!CLOUD_CONFIGURED || !docRef) return
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (snap.metadata.hasPendingWrites) return
        if (snap.exists()) {
          const data = (snap.data() || {}) as Partial<ErikTodosDoc>
          if (Array.isArray(data.todos)) {
            setTodos(data.todos)
            try { localStorage.setItem(ERIK_TODOS_KEY, JSON.stringify(data.todos)) } catch { /* noop */ }
          }
        } else {
          void setDoc(docRef, { todos: latest.current })
        }
        cloudReady.current = true
      },
      (err) => console.warn("Erik-Todos: Cloud-Verbindung fehlgeschlagen", err)
    )
    return unsub
  }, [])

  const commit = useCallback((next: ErikTodo[]) => {
    setTodos(next)
    try { localStorage.setItem(ERIK_TODOS_KEY, JSON.stringify(next)) } catch { /* noop */ }
    const docRef = erikTodosDocRef
    if (CLOUD_CONFIGURED && cloudReady.current && docRef) {
      setDoc(docRef, { todos: next }).catch((err) =>
        console.warn("Erik-Todos: Cloud-Speichern fehlgeschlagen", err)
      )
    }
  }, [])

  const addTodo = useCallback(
    (init: { title: string; dueDate: string; category: TodoCategory; color: TodoColor }) => {
      const inTodoLane = latest.current.filter((t) => t.lane === "todo")
      const minOrder = inTodoLane.reduce((m, t) => Math.min(m, t.order), 0)
      const next: ErikTodo = {
        id: newTodoId(),
        title: init.title,
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
    (id: string, patch: Partial<ErikTodo>) => {
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
