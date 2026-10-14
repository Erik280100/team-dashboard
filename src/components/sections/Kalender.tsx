// Anwesenheitsliste (früher Kalender/Anwesenheitsliste) — Äquivalent zu section-kalender aus
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

type AttendanceSort = "name" | "struktur"

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
    </div>
  )
}
