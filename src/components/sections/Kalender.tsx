// Kalender/Anwesenheitsliste — Äquivalent zu section-kalender aus
// legacy/index.html:2035–2112 (Fixtermine-Wochenkalender: statisch;
// Anwesenheitsliste: renderAttendance()/attendanceCell()/onAttendanceToggle()/
// onAttendanceReasonChange() aus :2419–2491). Anwesenheit ist für alle
// bearbeitbar (kein isEditor-Gate), identisch zum Original. Der
// "Zurücksetzen"-Button ist neu und nur für eingeloggte Nutzer sichtbar.
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { initials } from "@/lib/calc/format"
import type { RosterEntry } from "@/lib/calc/struktur"
import type { AttendanceEntry } from "@/types/dashboard"
import { getAttendanceEntry } from "@/hooks/useAttendanceDoc"
import { useConfirm } from "@/hooks/useConfirm"
import { cn } from "@/lib/utils"

type KalenderTab = "kalender" | "anwesenheit"

const TABS: { id: KalenderTab; label: string }[] = [
  { id: "kalender", label: "Kalender" },
  { id: "anwesenheit", label: "Anwesenheitsliste" },
]

type AttendanceSort = "name" | "struktur"

interface CalEvent {
  label: string
  start: string
  end: string
  kind: "buero" | "training" | "fuehrung" | "seminar" | "event"
}

const WEEK: { day: string; events: CalEvent[] }[] = [
  { day: "Montag", events: [{ label: "PGs + Wochenplan", start: "10:00", end: "20:00", kind: "buero" }] },
  { day: "Dienstag", events: [{ label: "Termine + Kontakte", start: "10:00", end: "20:00", kind: "buero" }] },
  {
    day: "Mittwoch",
    events: [
      { label: "FK + Teleparty", start: "17:30", end: "18:30", kind: "fuehrung" },
      { label: "Seminar", start: "18:30", end: "21:00", kind: "seminar" },
    ],
  },
  { day: "Donnerstag", events: [{ label: "Termine + Kontakte", start: "10:00", end: "20:00", kind: "buero" }] },
  {
    day: "Freitag",
    events: [
      { label: "Training", start: "10:00", end: "12:00", kind: "training" },
      { label: "Monatsauftakt", start: "17:00", end: "20:00", kind: "event" },
    ],
  },
  { day: "Samstag", events: [] },
  { day: "Sonntag", events: [] },
]

const KIND_COLOR: Record<CalEvent["kind"], string> = {
  buero: "border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  training: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  fuehrung: "border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-300",
  seminar: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  event: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
}

// Stundenraster: von 8:00 bis 21:00, 64px pro Stunde.
const GRID_START_HOUR = 8
const GRID_END_HOUR = 21
const HOUR_HEIGHT = 64
const GRID_HOURS = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => GRID_START_HOUR + i)
const GRID_HEIGHT = GRID_HOURS.length * HOUR_HEIGHT

function timeToY(time: string) {
  const [h, m] = time.split(":").map(Number)
  return ((h - GRID_START_HOUR) * 60 + m) * (HOUR_HEIGHT / 60)
}

function AttendanceToggle({
  label, present, reason, onToggle, onReasonChange,
}: {
  label: string
  present: boolean
  reason: string
  onToggle: (present: boolean) => void
  onReasonChange: (reason: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={present}
          onChange={(e) => onToggle(e.target.checked)}
          aria-label={`${label} – Anwesend`}
          className="size-4"
        />
        {present ? "Anwesend" : "Abwesend"}
      </label>
      {!present && (
        <input
          type="text"
          placeholder="Absagegrund…"
          defaultValue={reason}
          onBlur={(e) => onReasonChange(e.target.value)}
          aria-label={`Absagegrund ${label}`}
          className="h-7 w-40 rounded-md border border-input bg-background px-2 text-xs"
        />
      )}
    </div>
  )
}

export function Kalender({
  employeeRoster,
  attendance,
  setAttendanceEntry,
  resetAttendance,
  isEditor,
}: {
  /** Roster aus dem Strukturbaum (Personen mit Status „Kommt vielleicht" bereits ausgeblendet, Reihenfolge = Struktur). */
  employeeRoster: RosterEntry[]
  attendance: Record<string, AttendanceEntry>
  setAttendanceEntry: (name: string, patch: Partial<AttendanceEntry>) => void
  resetAttendance: () => void
  /** Reset-Button nur für eingeloggte Nutzer sichtbar. */
  isEditor: boolean
}) {
  const [tab, setTab] = useState<KalenderTab>("kalender")
  const [sort, setSort] = useState<AttendanceSort>("name")
  const confirm = useConfirm()

  const sortedRoster = useMemo(() => {
    if (sort === "name") return [...employeeRoster].sort((a, b) => a.name.localeCompare(b.name, "de"))
    return employeeRoster // "struktur": Roster-Vorordnung (Baum-Vorordnung) unverändert lassen
  }, [employeeRoster, sort])

  async function onResetAttendance() {
    const ok = await confirm("Anwesenheitsliste wirklich für alle zurücksetzen?")
    if (!ok) return
    resetAttendance()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "kalender" && (
      <Card>
        <CardContent>
          <h2 className="mb-3 text-sm font-semibold">Fixtermine — Wochenkalender</h2>
          <div className="overflow-x-auto">
            <div className="min-w-[960px]">
              {/* Tagesköpfe */}
              <div className="flex">
                <div className="w-14 shrink-0" />
                {WEEK.map((d) => (
                  <div key={d.day} className="flex-1 border-b pb-2 text-center text-xs font-semibold">
                    {d.day}
                  </div>
                ))}
              </div>
              {/* Raster */}
              <div className="flex">
                <div className="relative w-14 shrink-0" style={{ height: GRID_HEIGHT }}>
                  {GRID_HOURS.map((h) => (
                    <div
                      key={h}
                      className="absolute right-2 -translate-y-1/2 text-[10px] text-muted-foreground"
                      style={{ top: (h - GRID_START_HOUR) * HOUR_HEIGHT }}
                    >
                      {String(h).padStart(2, "0")}:00
                    </div>
                  ))}
                </div>
                {WEEK.map((d) => (
                  <div key={d.day} className="relative flex-1 border-l" style={{ height: GRID_HEIGHT }}>
                    {GRID_HOURS.map((h) => (
                      <div
                        key={h}
                        className="absolute inset-x-0 border-t border-border/60"
                        style={{ top: (h - GRID_START_HOUR) * HOUR_HEIGHT }}
                      />
                    ))}
                    <div className="absolute inset-x-0 border-t border-border/60" style={{ top: GRID_HEIGHT }} />
                    {d.events.map((ev) => (
                      <div
                        key={ev.label}
                        className={cn(
                          "absolute inset-x-1 overflow-hidden rounded-md border px-2 py-1 text-[11px] font-medium",
                          KIND_COLOR[ev.kind]
                        )}
                        style={{ top: timeToY(ev.start), height: timeToY(ev.end) - timeToY(ev.start) }}
                      >
                        {ev.label}
                        <div className="text-[10px] font-normal opacity-80">{ev.start}–{ev.end}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span><span className="mr-1.5 inline-block size-2 rounded-full bg-teal-500" />Termine / Arbeit</span>
            <span><span className="mr-1.5 inline-block size-2 rounded-full bg-amber-500" />Training</span>
            <span><span className="mr-1.5 inline-block size-2 rounded-full bg-purple-500" />Führungskreis</span>
            <span><span className="mr-1.5 inline-block size-2 rounded-full bg-blue-500" />Seminar</span>
            <span><span className="mr-1.5 inline-block size-2 rounded-full bg-rose-500" />Monatsauftakt</span>
          </div>
        </CardContent>
      </Card>
      )}

      {tab === "anwesenheit" && (
      <Card>
        <CardContent>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Anwesenheitsliste</h2>
            <div className="flex items-center gap-3">
              <Select
                aria-label="Anwesenheitsliste sortieren"
                value={sort}
                onChange={(e) => setSort(e.target.value as AttendanceSort)}
                className="w-48"
              >
                <option value="name">Sortieren: Name (A–Z)</option>
                <option value="struktur">Nach Struktur</option>
              </Select>
              {isEditor && (
                <Button variant="outline" size="sm" onClick={onResetAttendance}>
                  Zurücksetzen
                </Button>
              )}
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                {employeeRoster.length} Mitarbeiter
              </span>
            </div>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Jede·r kann hier selbst an-/abhaken. Bei Abwesenheit bitte kurz den Absagegrund eintragen.
            Personen mit Status „Kommt vielleicht" werden hier nicht angezeigt.
          </p>

          {employeeRoster.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Noch keine Mitarbeiter angelegt.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold text-muted-foreground">
                    <th className="px-2 py-2">Mitarbeiter</th>
                    <th className="px-2 py-2">Seminar</th>
                    <th className="px-2 py-2">Training</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRoster.map(({ name }) => {
                    const a = getAttendanceEntry(attendance, name)
                    return (
                      <tr key={name} className="border-b last:border-0">
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold">
                              {initials(name)}
                            </div>
                            {name}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <AttendanceToggle
                            label={`Seminar – ${name}`}
                            present={a.seminar}
                            reason={a.seminarReason}
                            onToggle={(present) => setAttendanceEntry(name, { seminar: present, ...(present ? { seminarReason: "" } : {}) })}
                            onReasonChange={(reason) => setAttendanceEntry(name, { seminarReason: reason })}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <AttendanceToggle
                            label={`Training – ${name}`}
                            present={a.training}
                            reason={a.trainingReason}
                            onToggle={(present) => setAttendanceEntry(name, { training: present, ...(present ? { trainingReason: "" } : {}) })}
                            onReasonChange={(reason) => setAttendanceEntry(name, { trainingReason: reason })}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  )
}
