// Zeitraum-Auswahl für die Statistik-Seite — Von/Bis-Select über die
// abgeschlossenen Monate im Archiv-Index, plus Schnellwahl-Buttons.
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import type { ArchiveIndexEntry, MonthKey } from "@/types/archive"

export function MonthRangePicker({
  index,
  from,
  to,
  onChange,
}: {
  index: ArchiveIndexEntry[]
  from: MonthKey
  to: MonthKey
  onChange: (from: MonthKey, to: MonthKey) => void
}) {
  function quick(n: number | "all") {
    if (index.length === 0) return
    const toMonth = index[index.length - 1].month
    const fromIdx = n === "all" ? 0 : Math.max(0, index.length - n)
    onChange(index[fromIdx].month, toMonth)
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground" htmlFor="statVonSelect">Von</label>
        <Select
          id="statVonSelect"
          aria-label="Zeitraum Von"
          value={from}
          onChange={(e) => onChange(e.target.value, to)}
          className="w-40"
        >
          {index.map((e) => (
            <option key={e.month} value={e.month}>{e.label}</option>
          ))}
        </Select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground" htmlFor="statBisSelect">Bis</label>
        <Select
          id="statBisSelect"
          aria-label="Zeitraum Bis"
          value={to}
          onChange={(e) => onChange(from, e.target.value)}
          className="w-40"
        >
          {index.map((e) => (
            <option key={e.month} value={e.month}>{e.label}</option>
          ))}
        </Select>
      </div>
      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" onClick={() => quick(3)}>3 Monate</Button>
        <Button size="sm" variant="outline" onClick={() => quick(6)}>6 Monate</Button>
        <Button size="sm" variant="outline" onClick={() => quick(12)}>12 Monate</Button>
        <Button size="sm" variant="outline" onClick={() => quick("all")}>Alle</Button>
      </div>
    </div>
  )
}
