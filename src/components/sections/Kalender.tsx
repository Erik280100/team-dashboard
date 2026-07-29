// Kalender/Anwesenheitsliste — Äquivalent zu section-kalender aus
// legacy/index.html:2035–2112 (Fixtermine-Wochenkalender: statisch;
// Anwesenheitsliste: renderAttendance()/attendanceCell()/onAttendanceToggle()/
// onAttendanceReasonChange() aus :2419–2491). Anwesenheit ist für alle
// bearbeitbar (kein isEditor-Gate), identisch zum Original.
import { Card, CardContent } from "@/components/ui/card"
import { initials } from "@/lib/calc/format"
import type { AttendanceEntry } from "@/types/dashboard"
import { getAttendanceEntry } from "@/hooks/useAttendanceDoc"
import { cn } from "@/lib/utils"

interface CalEvent {
  label: string
  time: string
  kind: "buero" | "training" | "fuehrung"
}

const WEEK: { day: string; sub?: string; events: CalEvent[] }[] = [
  { day: "Montag", sub: "Büro", events: [{ label: "Büro", time: "10:00–16:00", kind: "buero" }] },
  { day: "Dienstag", events: [] },
  {
    day: "Mittwoch", sub: "Führungskreis / Büro",
    events: [
      { label: "Führungskreis", time: "10:00–12:00", kind: "fuehrung" },
      { label: "Büro", time: "13:00–21:00", kind: "buero" },
    ],
  },
  { day: "Donnerstag", events: [] },
  {
    day: "Freitag", sub: "Training / Büro",
    events: [
      { label: "Training", time: "10:00–12:00", kind: "training" },
      { label: "Büro", time: "12:00–16:00", kind: "buero" },
    ],
  },
  { day: "Samstag", events: [] },
  { day: "Sonntag", events: [] },
]

const KIND_COLOR: Record<CalEvent["kind"], string> = {
  buero: "border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  training: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  fuehrung: "border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-300",
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
  employeeNames,
  attendance,
  setAttendanceEntry,
}: {
  /** Namen aus dem Strukturbaum, bereits alphabetisch sortiert. */
  employeeNames: string[]
  attendance: Record<string, AttendanceEntry>
  setAttendanceEntry: (name: string, patch: Partial<AttendanceEntry>) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent>
          <h2 className="mb-3 text-sm font-semibold">Fixtermine — Wochenkalender</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
            {WEEK.map((d) => (
              <div key={d.day} className="rounded-lg border p-3">
                <div className="text-xs font-semibold">{d.day}</div>
                {d.sub && <div className="text-[10px] text-muted-foreground">{d.sub}</div>}
                <div className="mt-2 flex flex-col gap-1.5">
                  {d.events.length === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    d.events.map((ev) => (
                      <div key={ev.label} className={cn("rounded-md border px-2 py-1 text-[11px] font-medium", KIND_COLOR[ev.kind])}>
                        {ev.label}
                        <div className="text-[10px] font-normal opacity-80">{ev.time}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span><span className="mr-1.5 inline-block size-2 rounded-full bg-teal-500" />Büro</span>
            <span><span className="mr-1.5 inline-block size-2 rounded-full bg-amber-500" />Training</span>
            <span><span className="mr-1.5 inline-block size-2 rounded-full bg-purple-500" />Führungskreis</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="mb-1 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Anwesenheitsliste</h2>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              {employeeNames.length} Mitarbeiter
            </span>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Jede·r kann hier selbst an-/abhaken. Bei Abwesenheit bitte kurz den Absagegrund eintragen.
          </p>

          {employeeNames.length === 0 ? (
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
                  {employeeNames.map((name) => {
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
    </div>
  )
}
