// Heutiges Datum ("YYYY-MM-DD", lokale Zeit) als State, der um Mitternacht von selbst nachzieht — damit
// datumsabhängige Anzeigen (z. B. fällige Todos) ohne Neuladen der Seite aktuell bleiben.
import { useEffect, useState } from "react"
import { toISODate } from "@/lib/calc/format"

export function useToday(): string {
  const [today, setToday] = useState(() => toISODate(new Date()))
  useEffect(() => {
    const id = setInterval(() => setToday(toISODate(new Date())), 60_000)
    return () => clearInterval(id)
  }, [])
  return today
}
