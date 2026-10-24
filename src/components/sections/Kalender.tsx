// Anwesenheitsliste (früher Kalender/Anwesenheitsliste) — Äquivalent zu section-kalender aus
// legacy/index.html:2035–2112 (Fixtermine-Wochenkalender: statisch;
// Anwesenheitsliste: renderAttendance()/attendanceCell()/onAttendanceToggle()/
// onAttendanceReasonChange() aus :2419–2491). Anwesenheit ist für alle
// bearbeitbar (kein isEditor-Gate), identisch zum Original. Der
// "Zurücksetzen"-Button ist neu und nur für eingeloggte Nutzer sichtbar.
import { useMemo, useState } from "react"
import { GraduationCap, Presentation } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import {
  DARK_CARD, DARK_INPUT, DARK_OPTION, DARK_SELECT, KpiTile, MintBar, PresenceToggle, SectionHero,
} from "@/components/ui/dark"
import { initials } from "@/lib/calc/format"
import type { RosterEntry } from "@/lib/calc/struktur"
import type { AttendanceEntry } from "@/types/dashboard"
import { getAttendanceEntry } from "@/hooks/useAttendanceDoc"
import { useConfirm } from "@/hooks/useConfirm"
import { cn } from "@/lib/utils"

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
    <div className="flex flex-col items-start gap-1.5">
      <PresenceToggle label={`${label} – Anwesenheit`} present={present} onChange={onToggle} />
      {!present && (
        <input
          type="text"
          placeholder="Absagegrund…"
          defaultValue={reason}
          onBlur={(e) => onReasonChange(e.target.value)}
          aria-label={`Absagegrund ${label}`}
          className={cn("h-7 w-44 rounded-md border px-2 text-xs outline-none focus-visible:border-[#64DDA3]", DARK_INPUT)}
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

  const counts = useMemo(() => {
    let seminar = 0
    let training = 0
    employeeRoster.forEach(({ name }) => {
      const a = getAttendanceEntry(attendance, name)
      if (a.seminar) seminar++
      if (a.training) training++
    })
    return { seminar, training }
  }, [employeeRoster, attendance])
  const total = employeeRoster.length
  const pctOfTotal = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

  async function onResetAttendance() {
    const ok = await confirm("Anwesenheitsliste wirklich für alle zurücksetzen?")
    if (!ok) return
    resetAttendance()
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHero
        eyebrow="Team"
        title="Anwesenheitsliste"
        badge={`${total} Mitarbeiter`}
        description="Jede·r kann hier selbst an-/abhaken. Bei Abwesenheit bitte kurz den Absagegrund eintragen. Personen mit Status „Kommt vielleicht“ werden hier nicht angezeigt."
        actions={
          <>
            <Select
              aria-label="Anwesenheitsliste sortieren"
              value={sort}
              onChange={(e) => setSort(e.target.value as AttendanceSort)}
              className={cn("w-48", DARK_SELECT)}
            >
              <option className={DARK_OPTION} value="name">Sortieren: Name (A–Z)</option>
              <option className={DARK_OPTION} value="struktur">Nach Struktur</option>
            </Select>
            {isEditor && (
              <Button
                variant="ghost"
                size="sm"
                className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={onResetAttendance}
              >
                Zurücksetzen
              </Button>
            )}
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <KpiTile icon={Presentation} label="Seminar" value={`${counts.seminar} / ${total}`} sub="anwesend" />
            <MintBar pct={pctOfTotal(counts.seminar)} />
          </div>
          <div className="flex flex-col gap-2">
            <KpiTile icon={GraduationCap} label="Training" value={`${counts.training} / ${total}`} sub="anwesend" />
            <MintBar pct={pctOfTotal(counts.training)} />
          </div>
        </div>
      </SectionHero>

      <div className={cn("rounded-xl border", DARK_CARD)}>
        {total === 0 ? (
          <div className="py-8 text-center text-sm text-white/90">Noch keine Mitarbeiter angelegt.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-white/25 text-left text-[11px] font-bold uppercase tracking-wide text-white/90">
                  <th className="px-4 py-3">Mitarbeiter</th>
                  <th className="px-4 py-3">Seminar</th>
                  <th className="px-4 py-3">Training</th>
                </tr>
              </thead>
              <tbody>
                {sortedRoster.map(({ name }) => {
                  const a = getAttendanceEntry(attendance, name)
                  return (
                    <tr
                      key={name}
                      className={cn(
                        "border-b border-white/15 transition-colors even:bg-white/[.04] hover:bg-white/[.08]",
                        (!a.seminar || !a.training) && "shadow-[inset_3px_0_0_rgba(226,104,91,.7)]"
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#64DDA3]/15 text-xs font-bold text-[#64DDA3]">
                            {initials(name)}
                          </div>
                          <span className="font-semibold">{name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <AttendanceToggle
                          label={`Seminar – ${name}`}
                          present={a.seminar}
                          reason={a.seminarReason}
                          onToggle={(present) => setAttendanceEntry(name, { seminar: present, ...(present ? { seminarReason: "" } : {}) })}
                          onReasonChange={(reason) => setAttendanceEntry(name, { seminarReason: reason })}
                        />
                      </td>
                      <td className="px-4 py-3">
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
      </div>
    </div>
  )
}
