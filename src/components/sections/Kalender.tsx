// Anwesenheitsliste (früher Kalender/Anwesenheitsliste) — Äquivalent zu section-kalender aus
// der früheren Einzeldatei-App (Fixtermine-Wochenkalender: statisch;
// Anwesenheitsliste: renderAttendance()/attendanceCell()/onAttendanceToggle()/
// onAttendanceReasonChange() aus :2419–2491). Anwesenheit ist für alle
// bearbeitbar (kein isEditor-Gate), identisch zum Original. Der
// "Zurücksetzen"-Button ist neu und nur für eingeloggte Nutzer sichtbar.
import { useMemo, useState } from "react"
import { CalendarCheck, GraduationCap, Presentation } from "lucide-react"
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
    let trainingFr = 0
    let trainingSa = 0
    let monatsauftakt = 0
    employeeRoster.forEach(({ name }) => {
      const a = getAttendanceEntry(attendance, name)
      if (a.seminar) seminar++
      if (a.trainingFr) trainingFr++
      if (a.trainingSa) trainingSa++
      if (a.monatsauftakt) monatsauftakt++
    })
    return { seminar, trainingFr, trainingSa, monatsauftakt }
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-2">
            <KpiTile icon={Presentation} label="Seminar" value={`${counts.seminar} / ${total}`} sub="anwesend" />
            <MintBar pct={pctOfTotal(counts.seminar)} />
          </div>
          <div className="flex flex-col gap-2">
            <KpiTile icon={GraduationCap} label="Training Freitag" value={`${counts.trainingFr} / ${total}`} sub="anwesend" />
            <MintBar pct={pctOfTotal(counts.trainingFr)} />
          </div>
          <div className="flex flex-col gap-2">
            <KpiTile icon={GraduationCap} label="Training Samstag" value={`${counts.trainingSa} / ${total}`} sub="anwesend" />
            <MintBar pct={pctOfTotal(counts.trainingSa)} />
          </div>
          <div className="flex flex-col gap-2">
            <KpiTile icon={CalendarCheck} label="Monatsauftakt" value={`${counts.monatsauftakt} / ${total}`} sub="anwesend" />
            <MintBar pct={pctOfTotal(counts.monatsauftakt)} />
          </div>
        </div>
      </SectionHero>

      <div className={cn("rounded-xl border", DARK_CARD)}>
        {total === 0 ? (
          <div className="py-8 text-center text-sm text-white/90">Noch keine Mitarbeiter angelegt.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-white/25 text-left text-[11px] font-bold uppercase tracking-wide text-white/90">
                  <th className="px-4 py-3">Mitarbeiter</th>
                  <th className="px-4 py-3">Seminar</th>
                  <th className="px-4 py-3">Training Freitag</th>
                  <th className="px-4 py-3">Training Samstag</th>
                  <th className="px-4 py-3">Monatsauftakt</th>
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
                        (!a.seminar || !a.trainingFr || !a.trainingSa || !a.monatsauftakt) && "shadow-[inset_3px_0_0_rgba(226,104,91,.7)]"
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
                          label={`Training Freitag – ${name}`}
                          present={a.trainingFr}
                          reason={a.trainingFrReason}
                          onToggle={(present) => setAttendanceEntry(name, { trainingFr: present, ...(present ? { trainingFrReason: "" } : {}) })}
                          onReasonChange={(reason) => setAttendanceEntry(name, { trainingFrReason: reason })}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <AttendanceToggle
                          label={`Training Samstag – ${name}`}
                          present={a.trainingSa}
                          reason={a.trainingSaReason}
                          onToggle={(present) => setAttendanceEntry(name, { trainingSa: present, ...(present ? { trainingSaReason: "" } : {}) })}
                          onReasonChange={(reason) => setAttendanceEntry(name, { trainingSaReason: reason })}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <AttendanceToggle
                          label={`Monatsauftakt – ${name}`}
                          present={a.monatsauftakt}
                          reason={a.monatsauftaktReason}
                          onToggle={(present) => setAttendanceEntry(name, { monatsauftakt: present, ...(present ? { monatsauftaktReason: "" } : {}) })}
                          onReasonChange={(reason) => setAttendanceEntry(name, { monatsauftaktReason: reason })}
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
