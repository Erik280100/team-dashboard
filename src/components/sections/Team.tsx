// Mitarbeiter-Sektion — Äquivalent zu section-team aus legacy/index.html:1721–1764.
// Die Personenliste wird seit dem Strukturbaum-Umbau vollständig aus dem
// Strukturbaum gespiegelt (analog zur Anwesenheitsliste, die sbAll(orgTree)
// nutzt) — Anlegen/Entfernen von Personen passiert nur noch im Strukturbaum.
// Leistungszahlen bleiben in dashboard.rows (localStorage + Cloud-Push wie im
// Original, siehe useDashboardDoc) und werden per Name mit dem Baum verknüpft
// (mergeRosterWithRows aus src/lib/calc/team.ts, golden-master-getestet).
import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { fmt, initials, monthWeekProgress, pctOf, progressClass, type EmployeeRow, type TeamGoal } from "@/lib/calc/format"
import {
  getMergedFilteredSorted, mergeRosterWithRows, rowHighlight, teamTotals,
  type MergedRow, type TeamFilter, type TeamSort,
} from "@/lib/calc/team"
import { sbEsc, sbGetRateForRole, sbRoster, type SbNode } from "@/lib/calc/struktur"
import { cn } from "@/lib/utils"

/** Baseline-Zeile für eine Strukturbaum-Person, die noch keine Zahlen in
 * dashboard.rows hat (Upsert beim ersten Bearbeiten eines Felds). */
function newRowFor(name: string): EmployeeRow {
  return {
    name,
    isNew: false,
    atPlan: 0, atIst: 0, btPlan: 0, btIst: 0, etPlan: 0, etIst: 0,
    soll: 0, ist: 0,
    joinDate: "",
  }
}

function NumField({
  row, field, wide, isEditor, onCommit,
}: {
  row: MergedRow
  field: "atPlan" | "btPlan" | "etPlan" | "atIst" | "btIst" | "etIst" | "soll" | "ist"
  wide?: boolean
  isEditor: boolean
  onCommit: (row: MergedRow, field: string, value: number) => void
}) {
  return (
    <input
      key={`${row.rowIndex}-${row.name}-${field}-${row[field]}`}
      type="number"
      disabled={!isEditor}
      defaultValue={Number(row[field] || 0)}
      aria-label={`${String(field)} – ${row.name}`}
      className={cn(
        "h-8 rounded-md border border-input bg-background px-2 text-sm tabular-nums shadow-xs outline-none",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "disabled:opacity-60",
        wide ? "w-20" : "w-16"
      )}
      onBlur={(e) => onCommit(row, field, Number(e.target.value) || 0)}
    />
  )
}

export function Team({
  rows,
  saveRows,
  teamGoal,
  orgTree,
  orgRoleRates,
  isEditor,
}: {
  rows: EmployeeRow[]
  saveRows: (next: EmployeeRow[]) => void
  teamGoal: TeamGoal
  orgTree: SbNode
  orgRoleRates: Record<string, number>
  isEditor: boolean
}) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<TeamFilter>("all")
  const [sort, setSort] = useState<TeamSort>("name")

  const roster = useMemo(() => sbRoster(orgTree), [orgTree])
  const merged = useMemo(() => mergeRosterWithRows(roster, rows), [roster, rows])
  const list = getMergedFilteredSorted(merged, search, filter, sort)
  const wp = monthWeekProgress(teamGoal)
  const totals = teamTotals(list)

  function commitField(entry: MergedRow, field: string, value: number | string) {
    if (entry.rowIndex !== null) {
      const next = rows.map((r, i) => (i === entry.rowIndex ? { ...r, [field]: value } : r))
      saveRows(next)
    } else {
      saveRows([...rows, { ...newRowFor(entry.name), [field]: value }])
    }
  }

  function toggleNew(entry: MergedRow) {
    if (entry.rowIndex !== null) {
      const next = rows.map((r, i) => {
        if (i !== entry.rowIndex) return r
        const isNew = !r.isNew
        const joinDate = isNew && !r.joinDate ? new Date().toISOString().slice(0, 10) : r.joinDate
        return { ...r, isNew, joinDate }
      })
      saveRows(next)
    } else {
      saveRows([...rows, { ...newRowFor(entry.name), isNew: true, joinDate: new Date().toISOString().slice(0, 10) }])
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Mitarbeiter-Übersicht{" "}
          <span className="ml-2 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {list.length === merged.length ? `${merged.length} Mitarbeiter` : `${list.length} von ${merged.length} Mitarbeitern`}
          </span>
        </h2>
      </div>

      <p className="text-xs text-muted-foreground">
        Die Liste wird aus dem Strukturbaum gespiegelt (Personen mit Status „Kommt vielleicht" werden ausgeblendet).
        Personen fügst du im Strukturbaum hinzu oder entfernst sie dort.
      </p>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Name suchen…"
          aria-label="Mitarbeiter nach Name suchen"
          className="w-56"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select aria-label="Mitarbeiter filtern" value={filter} onChange={(e) => setFilter(e.target.value as TeamFilter)} className="w-48">
          <option value="all">Alle Mitarbeiter</option>
          <option value="new">Nur neue MA</option>
          <option value="existing">Nur bestehendes Team</option>
        </Select>
        <Select aria-label="Mitarbeiter sortieren" value={sort} onChange={(e) => setSort(e.target.value as TeamSort)} className="w-64">
          <option value="name">Sortieren: Name (A–Z)</option>
          <option value="manager">Nach Führungskraft (Struktur)</option>
          <option value="progress-desc">Fortschritt (hoch → niedrig)</option>
          <option value="progress-asc">Fortschritt (niedrig → hoch)</option>
          <option value="einheiten-desc">Einheiten Ist (absteigend)</option>
        </Select>
      </div>

      <div className="max-h-[65vh] overflow-auto rounded-lg border">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
              <th className="sticky top-0 z-10 bg-muted/95 px-3 py-2 backdrop-blur">Name</th>
              <th className="sticky top-0 z-10 bg-muted/95 px-3 py-2 backdrop-blur">Status</th>
              <th className="sticky top-0 z-10 bg-muted/95 px-3 py-2 text-center backdrop-blur" colSpan={3}>Plan (AT / BT / ET)</th>
              <th className="sticky top-0 z-10 bg-muted/95 px-3 py-2 text-center backdrop-blur" colSpan={3}>Ist (AT / BT / ET)</th>
              <th className="sticky top-0 z-10 bg-muted/95 px-3 py-2 backdrop-blur">Soll</th>
              <th className="sticky top-0 z-10 bg-muted/95 px-3 py-2 backdrop-blur">Ist</th>
              <th className="sticky top-0 z-10 bg-muted/95 px-3 py-2 backdrop-blur">Fortschritt</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {merged.length === 0 ? "Noch keine Personen im Strukturbaum erfasst." : "Keine Mitarbeiter entsprechen der Suche/Filterung."}
                </td>
              </tr>
            ) : (
              list.map((r) => {
                const pct = pctOf(r)
                const highlight = rowHighlight(r, wp)
                const rate = r.role ? sbGetRateForRole(orgRoleRates, r.role) : 0
                const indent = sort === "manager" ? r.depth * 14 : 0
                return (
                  <tr
                    key={`${r.rowIndex}-${r.name}`}
                    className={cn(
                      "border-b border-foreground/20 last:border-0",
                      highlight === "at-above" && "bg-emerald-50 dark:bg-emerald-950/30",
                      highlight === "at-below" && "bg-red-50 dark:bg-red-950/30"
                    )}
                  >
                    <td className="px-3 py-2" style={{ paddingLeft: 12 + indent }}>
                      <div className="flex items-center gap-2">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold">
                          {initials(r.name as string)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{r.name}</div>
                          {(r.role || r.managerName) && (
                            <div
                              className="truncate text-xs text-muted-foreground"
                              dangerouslySetInnerHTML={{
                                __html:
                                  sbEsc(r.role || "") +
                                  (rate > 0
                                    ? ` · ${(Number(r.ist || 0) * rate).toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
                                    : "") +
                                  (r.managerName ? ` · unter ${sbEsc(r.managerName)}` : ""),
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        disabled={!isEditor}
                        onClick={() => toggleNew(r)}
                        aria-pressed={!!r.isNew}
                        aria-label={`Status ${r.name}: ${r.isNew ? "Neu" : "Bestand"}, umschalten`}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-60",
                          r.isNew ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {r.isNew ? "NEU" : "Bestand"}
                      </button>
                    </td>
                    <td className="px-2 py-2"><NumField row={r} field="atPlan" isEditor={isEditor} onCommit={commitField} /></td>
                    <td className="px-2 py-2"><NumField row={r} field="btPlan" isEditor={isEditor} onCommit={commitField} /></td>
                    <td className="px-2 py-2"><NumField row={r} field="etPlan" isEditor={isEditor} onCommit={commitField} /></td>
                    <td className="px-2 py-2"><NumField row={r} field="atIst" isEditor={isEditor} onCommit={commitField} /></td>
                    <td className="px-2 py-2"><NumField row={r} field="btIst" isEditor={isEditor} onCommit={commitField} /></td>
                    <td className="px-2 py-2"><NumField row={r} field="etIst" isEditor={isEditor} onCommit={commitField} /></td>
                    <td className="px-2 py-2"><NumField row={r} field="soll" wide isEditor={isEditor} onCommit={commitField} /></td>
                    <td className="px-2 py-2"><NumField row={r} field="ist" wide isEditor={isEditor} onCommit={commitField} /></td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              progressClass(pct) === "low" ? "bg-red-500" : progressClass(pct) === "high" ? "bg-emerald-500" : "bg-primary"
                            )}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium tabular-nums">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
          {list.length > 0 && (
            <tfoot>
              <tr className="text-sm">
                {(() => {
                  const cell = "sticky bottom-0 z-10 border-t-2 border-t-foreground/70 bg-[#DFF7EC] px-2 py-2.5 font-bold tabular-nums"
                  return (
                    <>
                      <td className={cn(cell, "px-3")}>Summe</td>
                      <td className={cell} />
                      <td className={cn(cell, "text-center")}>{fmt(totals.atPlan)}</td>
                      <td className={cn(cell, "text-center")}>{fmt(totals.btPlan)}</td>
                      <td className={cn(cell, "text-center")}>{fmt(totals.etPlan)}</td>
                      <td className={cn(cell, "text-center")}>{fmt(totals.atIst)}</td>
                      <td className={cn(cell, "text-center")}>{fmt(totals.btIst)}</td>
                      <td className={cn(cell, "text-center")}>{fmt(totals.etIst)}</td>
                      <td className={cell}>{fmt(totals.soll)}</td>
                      <td className={cell}>{fmt(totals.ist)}</td>
                      <td className={cell} />
                    </>
                  )
                })()}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
