// Mitarbeiter-Sektion — Äquivalent zu section-team aus legacy/index.html:1721–1764.
// Datenlogik (Filter/Sortierung, Zeilen-Highlight, Summenzeile) aus
// src/lib/calc/team.ts (golden-master-getestet). Bearbeitung committet über
// dashboard.saveRows (localStorage + Cloud-Push wie im Original, siehe
// useDashboardDoc), inkl. Tages-Snapshot-Fortschreibung.
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { useConfirm } from "@/hooks/useConfirm"
import { fmt, initials, monthWeekProgress, pctOf, progressClass, type TeamGoal } from "@/lib/calc/format"
import { getFilteredSorted, rowHighlight, teamTotals, type IndexedRow, type TeamFilter, type TeamSort } from "@/lib/calc/team"
import { sbEsc, sbGetRateForRole, sbGetRoleForName, type SbNode } from "@/lib/calc/struktur"
import type { EmployeeRow } from "@/types/dashboard"
import { cn } from "@/lib/utils"

const emptyRow = (): EmployeeRow => ({
  name: "Neuer Mitarbeiter",
  isNew: true,
  atPlan: 0, atIst: 0, btPlan: 0, btIst: 0, etPlan: 0, etIst: 0,
  soll: 0, ist: 0,
  joinDate: new Date().toISOString().slice(0, 10),
})

function NumField({
  row, field, wide, isEditor, onCommit,
}: {
  row: IndexedRow
  field: "atPlan" | "btPlan" | "etPlan" | "atIst" | "btIst" | "etIst" | "soll" | "ist"
  wide?: boolean
  isEditor: boolean
  onCommit: (idx: number, field: string, value: number) => void
}) {
  return (
    <input
      key={`${row._idx}-${field}-${row[field]}`}
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
      onBlur={(e) => onCommit(row._idx, field, Number(e.target.value) || 0)}
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
  const confirm = useConfirm()

  const list = getFilteredSorted(rows, search, filter, sort)
  const wp = monthWeekProgress(teamGoal)
  const totals = teamTotals(list)

  function commitField(idx: number, field: string, value: number | string) {
    const next = rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    saveRows(next)
  }

  function toggleNew(idx: number) {
    const next = rows.map((r, i) => {
      if (i !== idx) return r
      const isNew = !r.isNew
      const joinDate = isNew && !r.joinDate ? new Date().toISOString().slice(0, 10) : r.joinDate
      return { ...r, isNew, joinDate }
    })
    saveRows(next)
  }

  async function deleteRow(idx: number) {
    const ok = await confirm(`„${rows[idx].name}" wirklich entfernen?`)
    if (!ok) return
    saveRows(rows.filter((_, i) => i !== idx))
  }

  function addRow() {
    saveRows([...rows, emptyRow()])
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Mitarbeiter-Übersicht{" "}
          <span className="ml-2 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {list.length === rows.length ? `${rows.length} Mitarbeiter` : `${list.length} von ${rows.length} Mitarbeitern`}
          </span>
        </h2>
      </div>

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
          <option value="progress-desc">Fortschritt (hoch → niedrig)</option>
          <option value="progress-asc">Fortschritt (niedrig → hoch)</option>
          <option value="einheiten-desc">Einheiten Ist (absteigend)</option>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-center" colSpan={3}>Plan (AT / BT / ET)</th>
              <th className="px-3 py-2 text-center" colSpan={3}>Ist (AT / BT / ET)</th>
              <th className="px-3 py-2">Soll</th>
              <th className="px-3 py-2">Ist</th>
              <th className="px-3 py-2">Fortschritt</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {rows.length === 0 ? "Noch keine Mitarbeiter angelegt." : "Keine Mitarbeiter entsprechen der Suche/Filterung."}
                </td>
              </tr>
            ) : (
              list.map((r) => {
                const pct = pctOf(r)
                const highlight = rowHighlight(r, wp)
                const role = sbGetRoleForName(orgTree, r.name)
                const rate = role ? sbGetRateForRole(orgRoleRates, role) : 0
                return (
                  <tr
                    key={r._idx}
                    className={cn(
                      "border-b border-foreground/20 last:border-0",
                      highlight === "at-above" && "bg-emerald-50 dark:bg-emerald-950/30",
                      highlight === "at-below" && "bg-red-50 dark:bg-red-950/30"
                    )}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold">
                          {initials(r.name as string)}
                        </div>
                        <div className="min-w-0">
                          <input
                            key={`${r._idx}-name-${r.name}`}
                            type="text"
                            disabled={!isEditor}
                            defaultValue={r.name as string}
                            aria-label="Name"
                            className="w-40 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium outline-none hover:border-input focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-80"
                            onBlur={(e) => commitField(r._idx, "name", e.target.value)}
                          />
                          {role && (
                            <div
                              className="truncate text-xs text-muted-foreground"
                              dangerouslySetInnerHTML={{
                                __html:
                                  sbEsc(role) +
                                  (rate > 0
                                    ? ` · ${(Number(r.ist || 0) * rate).toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
                                    : ""),
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
                        onClick={() => toggleNew(r._idx)}
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
                    <td className="px-3 py-2">
                      {isEditor && (
                        <button
                          type="button"
                          title="Entfernen"
                          aria-label={`${r.name} entfernen`}
                          onClick={() => deleteRow(r._idx)}
                          className="rounded-md px-2 py-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
          {list.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-t-foreground/70 bg-primary/15 text-sm">
                <td className="px-3 py-2.5 font-bold">Summe</td>
                <td />
                <td className="px-2 py-2.5 text-center font-bold tabular-nums">{fmt(totals.atPlan)}</td>
                <td className="px-2 py-2.5 text-center font-bold tabular-nums">{fmt(totals.btPlan)}</td>
                <td className="px-2 py-2.5 text-center font-bold tabular-nums">{fmt(totals.etPlan)}</td>
                <td className="px-2 py-2.5 text-center font-bold tabular-nums">{fmt(totals.atIst)}</td>
                <td className="px-2 py-2.5 text-center font-bold tabular-nums">{fmt(totals.btIst)}</td>
                <td className="px-2 py-2.5 text-center font-bold tabular-nums">{fmt(totals.etIst)}</td>
                <td className="px-2 py-2.5 font-bold tabular-nums">{fmt(totals.soll)}</td>
                <td className="px-2 py-2.5 font-bold tabular-nums">{fmt(totals.ist)}</td>
                <td /><td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {isEditor && (
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={addRow}>+ Mitarbeiter hinzufügen</Button>
          <span className="text-xs text-muted-foreground">Neue Zeile wird unten angehängt.</span>
        </div>
      )}
    </div>
  )
}
