// Von mir zugewiesene Todos (Absender verfolgt den Stand beim Empfänger, auch wenn dieser über ihm steht):
// Collection-Group-Abfrage auf todos mit assignedById == eigene ID (firestore.rules + Index in firestore.indexes.json).
import { useEffect, useState } from "react"
import { collectionGroup, onSnapshot, query, where } from "firebase/firestore"
import { firestore } from "@/lib/firebase"
import type { BoardTodo } from "@/types/dashboard"

export interface AssignedTodo { todo: BoardTodo; ownerId: string }

export function useAssignedByMe(myId: string | null): AssignedTodo[] {
  const [items, setItems] = useState<AssignedTodo[]>([])

  useEffect(() => {
    if (!firestore || !myId) { setItems([]); return }
    return onSnapshot(
      query(collectionGroup(firestore, "todos"), where("assignedById", "==", myId)),
      (snap) => setItems(snap.docs.map((d) => ({ todo: d.data() as BoardTodo, ownerId: d.ref.parent.parent?.id ?? "" }))),
      (err) => console.warn("Zugewiesene Todos: Cloud-Verbindung fehlgeschlagen", err)
    )
  }, [myId])

  return items
}
