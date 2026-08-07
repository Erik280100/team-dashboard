// Feature 3 (Statistik): Mitarbeiter-Entwicklung — Tabelle Mitarbeiter × Monat
// mit Σ/Ø/Trend, Suche + Sortierung analog zur Mitarbeiterseite (Team.tsx).
// Zellenfarbe folgt progressClass() (format.ts) wie die Fortschrittsbalken dort.
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { DARK_CARD } from "@/lib/chartSetup"
import { fmt, progressClass } from "@/lib/calc/format"
import type { EmployeeSeries } from "@/lib/calc/statistik"
import type { ArchiveIndexEntry } from "@/types/archive"
import { cn } from "@/lib/utils"

type MatrixSort = "name" | "total-desc" | "trend-desc" | "struktur"

export function EmployeeMatrix({
  months,
  series,
  loading,
  loaded,
  total,
  selectedName,
  onSelect,
}: {
  months: ArchiveIndexEntry[]
  series: EmployeeSeries[]
  loading: boolean
  loaded: number
  total: number
  selectedName: string | null
  onSelect: (name: string) => void
}) {
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<MatrixSort>("name")

  const filtered = series.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "total-desc") return b.total - a.total
    if (sort === "trend-desc") return b.trend - a.trend
    if (sort === "struktur") return a.structureIndex - b.structureIndex
    return a.name.localeCompare(b.name, "de")
  })

  return (
    <Card className={DARK_CARD}>
      <CardHeader>
        <CardTitle className="text-white">Mitarbeiter-Entwicklung</CardTitle>
        <p className="text-xs text-white/50">
          {loading ? `Lädt Monate… (${loaded} von ${total})` : "Einheiten je Mitarbeiter und Monat, anklickbar für den Verlauf"}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Name suchen…"
            aria-label="Mitarbeiter nach Name suchen"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56 border-white/20 bg-white/10 text-white placeholder:text-white/40"
          />
          <Select
            aria-label="Mitarbeiter sortieren"
            value={sort}
            onChange={(e) => setSort(e.target.value as MatrixSort)}
            className="w-56 border-white/20 bg-white/10 text-white"
          >
            <option value="name" className="text-black">Sortieren: Name (A–Z)</option>
            <option value="struktur" className="text-black">Nach Führungskraft (Struktur)</option>
            <option value="total-desc" className="text-black">Summe Einheiten (absteigend)</option>
            <option value="trend-desc" className="text-black">Trend (absteigend)</option>
          </Select>
        </div>

        {months.length === 0 || sorted.length === 0 ? (
          <div className="py-6 text-center text-sm text-white/50">
            {months.length === 0
              ? "Kein Zeitraum gewählt."
              : loading
                ? "Monate werden geladen…"
                : "Keine Mitarbeiter für diesen Zeitraum/Suche."}
          </div>
        ) : (
          <div className="max-h-[420px] overflow-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[600px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-white/50">
                  <th className="sticky left-0 top-0 z-20 bg-[#0B1F2A] px-3 py-2">Name</th>
                  {months.map((m) => (
                    <th key={m.month} className="sticky top-0 z-10 bg-[#0B1F2A] px-2 py-2 text-right">{m.label}</th>
                  ))}
                  <th className="sticky top-0 z-10 bg-[#0B1F2A] px-2 py-2 text-right">Σ</th>
                  <th className="sticky top-0 z-10 bg-[#0B1F2A] px-2 py-2 text-right">Ø</th>
                  <th className="sticky top-0 z-10 bg-[#0B1F2A] px-2 py-2 text-right">Trend</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) => (
                  <tr
                    key={s.name}
                    onClick={() => onSelect(s.name)}
                    className={cn(
                      "cursor-pointer border-t border-white/10 hover:bg-white/5",
                      selectedName === s.name && "bg-white/10"
                    )}
                  >
                    <td
                      className="sticky left-0 z-10 bg-[#0B1F2A] px-3 py-2 font-medium text-white/90"
                      style={sort === "struktur" ? { paddingLeft: 12 + s.depth * 14 } : undefined}
                    >
                      {s.name}
                    </td>
                    {s.cells.map((c) => {
                      const pc = progressClass(c.pct)
                      return (
                        <td
                          key={c.month}
                          className={cn(
                            "px-2 py-2 text-right tabular-nums",
                            !c.present ? "text-white/25" : pc === "low" ? "text-red-300" : pc === "high" ? "text-emerald-300" : "text-white/70"
                          )}
                        >
                          {c.present ? fmt(c.ist) : "—"}
                        </td>
                      )
                    })}
                    <td className="px-2 py-2 text-right tabular-nums font-semibold text-white">{fmt(s.total)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-white/70">{fmt(Math.round(s.avg))}</td>
                    <td
                      className={cn(
                        "px-2 py-2 text-right tabular-nums font-medium",
                        s.trend > 0 ? "text-emerald-400" : s.trend < 0 ? "text-red-400" : "text-white/50"
                      )}
                    >
                      {s.trend > 0 ? "+" : ""}{fmt(s.trend)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
