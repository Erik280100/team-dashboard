// Monatsplanung — read-only Verdichtung der Wochen des Monats. Vorbild
// Finova_Controlling.html:824-829 (KPI-Kacheln) und 1558-1587 (Tabelle).
// Lädt die betroffenen Wochendokumente lazy nach (usePlanungDoc.loadWeeks).
import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { fmt, initials } from "@/lib/calc/format"
import {
  aggregateByGroup, aggregateByName, currentMonthKey, emptyMonthNoteEntry, monthLabel, monthWeekKeys, quotePct,
  sumWeekEntries, type PlanTeamGroup,
} from "@/lib/calc/planung"
import type { RosterEntry } from "@/lib/calc/struktur"
import type { UsePlanungDocResult } from "@/hooks/usePlanungDoc"
import type { PlanMonthNotesEntry } from "@/types/dashboard"

const NOTE_FIELDS: { key: keyof PlanMonthNotesEntry; label: string }[] = [
  { key: "at", label: "AT" },
  { key: "bt", label: "BT" },
  { key: "st", label: "ST" },
  { key: "et", label: "ET" },
]

function MonthNoteCard({
  person, entry, isEditor, onCommit,
}: {
  person: RosterEntry
  entry: PlanMonthNotesEntry
  isEditor: boolean
  onCommit: (field: keyof PlanMonthNotesEntry, value: string) => void
}) {
  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold">
            {initials(person.name)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{person.name}</div>
            <div className="truncate text-xs text-muted-foreground">{person.role}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-3">
        {NOTE_FIELDS.map((f) => (
          <div key={f.key}>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{f.label}</div>
            <textarea
              key={`${person.name}-${f.key}-${entry[f.key]}`}
              disabled={!isEditor}
              defaultValue={entry[f.key]}
              placeholder="Namen…"
              aria-label={`${f.label} – ${person.name}`}
              className="min-h-24 w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-60"
              onBlur={(e) => onCommit(f.key, e.target.value)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function shiftMonth(monthKey: string, n: number): string {
  const [y, m] = monthKey.split("-").map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function KpiTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-2xl font-medium tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  )
}

export function Monatsplanung({
  people, planung, isEditor, teamGroups,
}: {
  people: RosterEntry[]
  planung: UsePlanungDocResult
  isEditor: boolean
  teamGroups?: PlanTeamGroup[] | null
}) {
  const [monthKey, setMonthKey] = useState<string>(currentMonthKey)
  const weeks = useMemo(() => monthWeekKeys(monthKey), [monthKey])

  useEffect(() => {
    void planung.loadWeeks(weeks)
    // planung.loadWeeks bewusst nicht als Dependency: es hängt an activeWeek
    // (Wochenplanung-Tab) und würde sonst unnötig oft neu anfordern — das
    // Nachladen soll nur bei einem Monatswechsel neu angestoßen werden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks])

  useEffect(() => {
    planung.setActiveMonth(monthKey)
    // planung bewusst nicht als Dependency (neues Objekt je Render) — siehe
    // Kommentar oben bei loadWeeks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey])

  const weekDocs = weeks.map((w) => planung.getWeek(w))
  const loaded = weekDocs.filter((d) => d !== null)
  const loading = loaded.length < weeks.length

  const byName = useMemo(
    () => aggregateByName(loaded, people.map((p) => p.name)),
    // loaded ist ein neues Array je Render (planung.getWeek liest aus einem Ref-
    // Cache) — über weeks/loading/people gated, damit hier nicht bei jedem
    // Render neu aggregiert wird, sondern erst wenn sich echt etwas ändert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weeks, loading, people]
  )
  const total = useMemo(() => sumWeekEntries([...byName.values()]), [byName])

  const byGroup = useMemo(
    () => (teamGroups && teamGroups.length > 0 ? aggregateByGroup(loaded, teamGroups) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weeks, loading, teamGroups]
  )
  const rows: { key: string; label: string; sub: string; data: ReturnType<typeof sumWeekEntries> }[] = byGroup
    ? teamGroups!.map((g) => ({ key: g.name, label: g.name, sub: `${g.role} · Team gesamt (${g.names.length})`, data: byGroup.get(g.name) ?? sumWeekEntries([]) }))
    : people.map((p) => ({ key: p.name, label: p.name, sub: p.role, data: byName.get(p.name) ?? sumWeekEntries([]) }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="icon" onClick={() => setMonthKey((m) => shiftMonth(m, -1))} aria-label="Vormonat">
          ‹
        </Button>
        <div className="text-sm font-medium">{monthLabel(monthKey)}</div>
        <Button type="button" variant="outline" size="icon" onClick={() => setMonthKey((m) => shiftMonth(m, 1))} aria-label="Folgemonat">
          ›
        </Button>
        <span className="text-xs text-muted-foreground">Kumulierte Wochenpläne</span>
        {loading && <span className="ml-auto text-xs text-muted-foreground">Lade Wochendaten…</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile label="ATG Gesamt" value={fmt(total.atg)} sub="Monat kumuliert" />
        <KpiTile label="Analysen" value={`${fmt(total.analysen)}/${fmt(total.analysenZ)}`} sub="stattgef. / ausgemacht" />
        <KpiTile label="Verträge" value={fmt(total.vertraege)} sub={`${quotePct(total.vertraege, total.beratungen)}% Abschlussquote`} />
        <KpiTile label="Einheiten gemacht" value={fmt(total.ehGemacht)} sub={`${fmt(total.ehOffen)} EH offen`} />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
          Keine Personen für diese Führungskraft im Strukturbaum.
        </div>
      ) : (
        <div className="max-h-[65vh] overflow-auto rounded-lg border">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
                <th className="sticky top-0 z-10 min-w-[220px] bg-muted/95 px-3 py-2 backdrop-blur">{byGroup ? "Führungskraft" : "Name"}</th>
                <th className="sticky top-0 z-10 bg-muted/95 px-3 py-2 text-right backdrop-blur">ATG/ATZ</th>
                <th className="sticky top-0 z-10 bg-muted/95 px-3 py-2 text-right backdrop-blur">An. stat/ausm</th>
                <th className="sticky top-0 z-10 bg-muted/95 px-3 py-2 text-right backdrop-blur">Ber. stat/ausm</th>
                <th className="sticky top-0 z-10 bg-muted/95 px-3 py-2 text-right backdrop-blur">Verträge</th>
                <th className="sticky top-0 z-10 bg-muted/95 px-3 py-2 text-right backdrop-blur">Quote</th>
                <th className="sticky top-0 z-10 bg-muted/95 px-3 py-2 text-right backdrop-blur">ST g/z</th>
                <th className="sticky top-0 z-10 bg-muted/95 px-3 py-2 text-right backdrop-blur">ET g/z</th>
                <th className="sticky top-0 z-10 bg-muted/95 px-3 py-2 text-right backdrop-blur">EH gemacht</th>
                <th className="sticky top-0 z-10 bg-muted/95 px-3 py-2 text-right backdrop-blur">EH offen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const d = r.data
                return (
                  <tr key={r.key} className="border-b border-foreground/20 last:border-0">
                    <td className="px-3 py-2">
                      <div className="truncate text-sm font-medium">{r.label}</div>
                      <div className="truncate text-xs text-muted-foreground">{r.sub}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(d.atg)}/{fmt(d.atz)}</td>
                    <td className="px-3 py-2 text-right tabular-nums"><strong>{fmt(d.analysen)}</strong><span className="text-muted-foreground">/{fmt(d.analysenZ)}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums"><strong>{fmt(d.beratungen)}</strong><span className="text-muted-foreground">/{fmt(d.beratungenZ)}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums"><strong>{fmt(d.vertraege)}</strong></td>
                    <td className="px-3 py-2 text-right tabular-nums">{quotePct(d.vertraege, d.beratungen)}%</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(d.stg)}/{fmt(d.stz)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(d.etg)}/{fmt(d.etz)}</td>
                    <td className="px-3 py-2 text-right tabular-nums"><strong>{fmt(d.ehGemacht)}</strong></td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmt(d.ehOffen)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="text-sm">
                {(() => {
                  const cell = "sticky bottom-0 z-10 border-t-2 border-t-foreground/70 bg-[#DFF7EC] px-3 py-2.5 text-right font-bold tabular-nums"
                  return (
                    <>
                      <td className={cell.replace("text-right", "")}>Summe</td>
                      <td className={cell}>{fmt(total.atg)}/{fmt(total.atz)}</td>
                      <td className={cell}>{fmt(total.analysen)}/{fmt(total.analysenZ)}</td>
                      <td className={cell}>{fmt(total.beratungen)}/{fmt(total.beratungenZ)}</td>
                      <td className={cell}>{fmt(total.vertraege)}</td>
                      <td className={cell}>{quotePct(total.vertraege, total.beratungen)}%</td>
                      <td className={cell}>{fmt(total.stg)}/{fmt(total.stz)}</td>
                      <td className={cell}>{fmt(total.etg)}/{fmt(total.etz)}</td>
                      <td className={cell}>{fmt(total.ehGemacht)}</td>
                      <td className={cell}>{fmt(total.ehOffen)}</td>
                    </>
                  )
                })()}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {people.length > 0 && (
        <>
          <div className="mt-2 text-sm font-medium">Termin-Notizen · {monthLabel(monthKey)}</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {people.map((p) => (
              <MonthNoteCard
                key={p.name}
                person={p}
                entry={planung.monthNotesDoc.entries[p.name] ?? emptyMonthNoteEntry()}
                isEditor={isEditor}
                onCommit={(field, value) => planung.saveMonthNoteEntry(p.name, { [field]: value })}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
