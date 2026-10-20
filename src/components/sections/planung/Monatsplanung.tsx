// Monatsplanung — read-only Verdichtung der Wochen des Monats. Vorbild
// Finova_Controlling.html:824-829 (KPI-Kacheln) und 1558-1587 (Tabelle).
// Lädt die betroffenen Wochendokumente lazy nach (usePlanungDoc.loadWeeks).
import { useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { fmt, initials } from "@/lib/calc/format"
import {
  aggregateByGroup, aggregateByName, emptyMonthNoteEntry, monthLabel, monthWeekKeys, quotePct,
  sumWeekEntries, type PlanTeamGroup,
} from "@/lib/calc/planung"
import type { RosterEntry } from "@/lib/calc/struktur"
import type { UsePlanungDocResult } from "@/hooks/usePlanungDoc"
import { readPlanUnits, sumPlanUnits } from "@/lib/calc/verguetung"
import type { EmployeeRow, PlanMonthNotesEntry } from "@/types/dashboard"

const NOTE_FIELDS: { key: keyof PlanMonthNotesEntry; label: string }[] = [
  { key: "at", label: "AT" },
  { key: "bt", label: "BT" },
  { key: "st", label: "ST" },
  { key: "et", label: "ET" },
  { key: "feedback", label: "Feedback" },
]

function MonthNoteCard({
  person, entry, isEditor, onCommit, onCommitZiel,
}: {
  person: RosterEntry
  entry: PlanMonthNotesEntry
  isEditor: boolean
  onCommit: (field: keyof PlanMonthNotesEntry, value: string) => void
  onCommitZiel: (value: number) => void
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
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Einheitenziel</div>
          <input
            key={`${person.name}-ehZiel-${entry.ehZiel ?? 0}`}
            type="number"
            min={0}
            disabled={!isEditor}
            defaultValue={entry.ehZiel ?? 0}
            aria-label={`Einheitenziel – ${person.name}`}
            className="h-8 w-28 rounded-md border border-input bg-background px-2 text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-60"
            onBlur={(e) => onCommitZiel(Number(e.target.value) || 0)}
          />
        </div>
        {NOTE_FIELDS.map((f) => (
          <div key={f.key}>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{f.label}</div>
            <textarea
              key={`${person.name}-${f.key}-${entry[f.key]}`}
              disabled={!isEditor}
              defaultValue={entry[f.key] ?? ""}
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

function KpiTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-2xl font-medium tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  )
}

type RaceLine = { key: string; label: string; color: string; soll: number; ist: number; max: number }

// Rennliste wie im Excel: je Person eine Kachel, darin je Kennzahl (AT/BT/ST/ET)
// ein farbiger Balken (Ist) mit roter Soll-Markierung. Die Skala ist je Kennzahl
// über alle Kacheln gleich, damit Personen untereinander vergleichbar bleiben.
function RaceCard({ title, sub, lines }: { title: string; sub?: string; lines: RaceLine[] }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b bg-muted/50 px-4 py-2.5">
        <div className="truncate text-sm font-bold">{title}</div>
        {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
      </div>
      <div className="flex flex-col gap-1.5 p-3">
        {lines.map((l) => {
          const reached = l.soll > 0 && l.ist >= l.soll
          return (
            <div key={l.key} className="flex items-center gap-3">
              <div
                className="w-10 shrink-0 rounded-sm py-0.5 text-center text-xs font-bold text-black/80"
                style={{ backgroundColor: l.color }}
              >
                {l.label}
              </div>
              <div className="relative h-5 flex-1 rounded-sm bg-muted/60">
                <div
                  className="h-full rounded-sm"
                  style={{ width: `${(l.ist / l.max) * 100}%`, backgroundColor: l.color, opacity: reached ? 1 : 0.6 }}
                />
                {l.soll > 0 && (
                  <div
                    className="absolute inset-y-[-2px] w-0.5 bg-red-600"
                    style={{ left: `${Math.min(100, (l.soll / l.max) * 100)}%` }}
                    title={`Soll ${fmt(l.soll)}`}
                  />
                )}
              </div>
              <div className="w-24 shrink-0 whitespace-nowrap text-right text-xs tabular-nums">
                <strong>{fmt(l.ist)}</strong>
                <span className="text-muted-foreground">/{fmt(l.soll)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type WeekSum = ReturnType<typeof sumWeekEntries>
// EH: Soll wird in Monatsplanung() durch das Einheitenziel überschrieben (hier nur Fallback).
const RACE_CATS: { label: string; color: string; soll: (d: WeekSum) => number; ist: (d: WeekSum) => number }[] = [
  { label: "EH", color: "#FFE000", soll: (d) => d.ehGemacht + d.ehOffen, ist: (d) => d.ehGemacht },
  { label: "AT", color: "#93C47D", soll: (d) => d.analysenZ, ist: (d) => d.analysen },
  { label: "BT", color: "#6FA8DC", soll: (d) => d.beratungenZ, ist: (d) => d.beratungen },
  { label: "ST", color: "#FF9900", soll: (d) => d.stz, ist: (d) => d.stg },
  { label: "ET", color: "#FF2A1A", soll: (d) => d.etz, ist: (d) => d.etg },
]

export function Monatsplanung({
  people, planung, isEditor, teamGroups, rows: employeeRows, unitsMonthKey,
}: {
  /** Mitarbeiterseite (dashboard.rows): dort werden ALLE Einheiten erfasst. */
  rows: EmployeeRow[]
  /** Umsatzmonat ("YYYY-MM"), auf den sich die Einheiten in rows beziehen. */
  unitsMonthKey: string
  people: RosterEntry[]
  planung: UsePlanungDocResult
  isEditor: boolean
  teamGroups?: PlanTeamGroup[] | null
}) {
  // Immer der aktuelle (offene) Monat — vergangene Monate stehen im Archiv/Statistik.
  const monthKey = unitsMonthKey
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

  // Einheiten gemacht: für den laufenden Umsatzmonat kommt die Zahl von der
  // Mitarbeiterseite (dort werden alle Einheiten gebucht), nicht aus den nur
  // sporadisch gepflegten Wochenplänen. Andere Monate: weiter Wochenplan-Summe.
  const unitsByName = useMemo(() => {
    if (monthKey !== unitsMonthKey) return null
    const m = new Map<string, number>()
    employeeRows.forEach((r) => m.set(r.name, sumPlanUnits(readPlanUnits(r))))
    return m
  }, [monthKey, unitsMonthKey, employeeRows])

  const byName = useMemo(
    () => {
      const agg = aggregateByName(loaded, people.map((p) => p.name))
      if (unitsByName) {
        agg.forEach((e, name) => agg.set(name, { ...e, ehGemacht: unitsByName.get(name) ?? 0 }))
      }
      return agg
    },
    // loaded ist ein neues Array je Render (planung.getWeek liest aus einem Ref-
    // Cache) — über weeks/loading/people gated, damit hier nicht bei jedem
    // Render neu aggregiert wird, sondern erst wenn sich echt etwas ändert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weeks, loading, people, unitsByName]
  )
  const total = useMemo(() => sumWeekEntries([...byName.values()]), [byName])

  const byGroup = useMemo(
    () => {
      if (!teamGroups || teamGroups.length === 0) return null
      const agg = aggregateByGroup(loaded, teamGroups)
      if (unitsByName) {
        teamGroups.forEach((g) => {
          const e = agg.get(g.name)
          if (e) agg.set(g.name, { ...e, ehGemacht: g.names.reduce((s, n) => s + (unitsByName.get(n) ?? 0), 0) })
        })
      }
      return agg
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weeks, loading, teamGroups, unitsByName]
  )
  // Einheitenziel je Person aus den Monats-Notizkacheln (nur gültig, wenn das
  // Notizdokument zum angezeigten Monat gehört — direkt nach Monatswechsel noch nicht).
  const zielOf = (name: string): number =>
    planung.monthNotesDoc.month === monthKey ? Number(planung.monthNotesDoc.entries[name]?.ehZiel) || 0 : 0
  const rows: { key: string; label: string; sub: string; data: WeekSum; ehZiel: number }[] = byGroup
    ? teamGroups!.map((g) => ({
        key: g.name, label: g.name, sub: `${g.role} · Team gesamt (${g.names.length})`,
        data: byGroup.get(g.name) ?? sumWeekEntries([]),
        ehZiel: g.names.reduce((s, n) => s + zielOf(n), 0),
      }))
    : people.map((p) => ({ key: p.name, label: p.name, sub: p.role, data: byName.get(p.name) ?? sumWeekEntries([]), ehZiel: zielOf(p.name) }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-sm font-medium">{monthLabel(monthKey)}</div>
        <span className="text-xs text-muted-foreground">Kumulierte Wochenpläne</span>
        {loading && <span className="ml-auto text-xs text-muted-foreground">Lade Wochendaten…</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile label="Wählversuche Ist" value={fmt(total.atg)} sub="Monat kumuliert" />
        <KpiTile label="AT Soll / Ist" value={`${fmt(total.analysenZ)}/${fmt(total.analysen)}`} sub="Monat kumuliert" />
        <KpiTile label="AT-Quote" value={`${quotePct(total.analysen, total.analysenZ)}%`} sub="AT Ist von AT Soll" />
        <KpiTile label="Einheiten gemacht" value={fmt(total.ehGemacht)} sub="Laut Mitarbeiterseite" />
      </div>

      {rows.length > 0 && (() => {
        // EH-Soll ist das Einheitenziel des Monats (Notizkachel), die übrigen Kennzahlen kommen aus den Wochenplänen.
        const sollOf = (c: (typeof RACE_CATS)[number], r: (typeof rows)[number]) => (c.label === "EH" ? r.ehZiel : c.soll(r.data))
        const maxByCat = RACE_CATS.map((c) =>
          Math.max(1, ...rows.map((r) => Math.max(sollOf(c, r), c.ist(r.data))))
        )
        const linesFor = (r: (typeof rows)[number]): RaceLine[] =>
          RACE_CATS.map((c, i) => ({ key: `${r.key}-${c.label}`, label: c.label, color: c.color, soll: sollOf(c, r), ist: c.ist(r.data), max: maxByCat[i] }))
        return (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((r) => (
              <RaceCard key={r.key} title={r.label} sub={r.sub} lines={linesFor(r)} />
            ))}
          </div>
        )
      })()}

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
                <th className="sticky top-0 z-10 bg-muted/95 px-3 py-2 text-right backdrop-blur">Wählversuche Soll / Ist</th>
                <th className="sticky top-0 z-10 bg-muted/95 px-3 py-2 text-right backdrop-blur">AT Soll / Ist</th>
                <th className="sticky top-0 z-10 bg-muted/95 px-3 py-2 text-right backdrop-blur">BT Soll / Ist</th>
                <th className="sticky top-0 z-10 bg-muted/95 px-3 py-2 text-right backdrop-blur">AT-Quote</th>
                <th className="sticky top-0 z-10 bg-muted/95 px-3 py-2 text-right backdrop-blur">ST Soll / Ist</th>
                <th className="sticky top-0 z-10 bg-muted/95 px-3 py-2 text-right backdrop-blur">ET Soll / Ist</th>
                <th className="sticky top-0 z-10 bg-muted/95 px-3 py-2 text-right backdrop-blur">EH gemacht</th>
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
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(d.atz)}/{fmt(d.atg)}</td>
                    <td className="px-3 py-2 text-right tabular-nums"><span className="text-muted-foreground">{fmt(d.analysenZ)}</span>/<strong>{fmt(d.analysen)}</strong></td>
                    <td className="px-3 py-2 text-right tabular-nums"><span className="text-muted-foreground">{fmt(d.beratungenZ)}</span>/<strong>{fmt(d.beratungen)}</strong></td>
                    <td className="px-3 py-2 text-right tabular-nums">{quotePct(d.analysen, d.analysenZ)}%</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(d.stz)}/{fmt(d.stg)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(d.etz)}/{fmt(d.etg)}</td>
                    <td className="px-3 py-2 text-right tabular-nums"><strong>{fmt(d.ehGemacht)}</strong></td>
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
                      <td className={cell}>{fmt(total.atz)}/{fmt(total.atg)}</td>
                      <td className={cell}>{fmt(total.analysenZ)}/{fmt(total.analysen)}</td>
                      <td className={cell}>{fmt(total.beratungenZ)}/{fmt(total.beratungen)}</td>
                      <td className={cell}>{quotePct(total.analysen, total.analysenZ)}%</td>
                      <td className={cell}>{fmt(total.stz)}/{fmt(total.stg)}</td>
                      <td className={cell}>{fmt(total.etz)}/{fmt(total.etg)}</td>
                      <td className={cell}>{fmt(total.ehGemacht)}</td>
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
                onCommitZiel={(value) => planung.saveMonthNoteEntry(p.name, { ehZiel: value })}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
