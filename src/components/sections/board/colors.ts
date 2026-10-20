// Tailwind-Klassen je Todo-Farbe — geteilt zwischen NewTodoDialog.tsx und TodoCard.tsx.
import type { TodoColor } from "@/types/dashboard"

export const COLOR_DOT_CLASS: Record<TodoColor, string> = {
  grau: "bg-slate-400",
  gruen: "bg-emerald-500",
  gelb: "bg-amber-400",
  rot: "bg-rose-500",
  blau: "bg-sky-500",
}
