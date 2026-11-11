// Training — anwesende Trainees (Anwesenheitsliste, Spalten „Training Freitag/Samstag“) auf die anwesenden Führungskräfte
// verteilen; jede Führungskraft bekommt ein Thema (Telefonieren, Analyse, Beratung, Empfehlungen).
// Führungskräfte und Admin (fullView) sehen und bearbeiten alles; alle anderen (Trainees) sehen nur das Ergebnis der
// Einteilung: bei welcher Führungskraft (mit Thema) welcher Trainee ist.
import { useMemo } from "react"
import { GraduationCap, UserCheck, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { DARK_CARD, DARK_OPTION, DARK_SELECT, KpiTile, SectionHero } from "@/components/ui/dark"
import { initials } from "@/lib/calc/format"
import { idByName, type EmployeeMeta } from "@/lib/calc/employees"
import { isLeadRole, type RosterEntry } from "@/lib/calc/struktur"
import { getAttendanceEntry } from "@/hooks/useAttendanceDoc"
import { useConfirm } from "@/hooks/useConfirm"
import { TRAINING_DAYS, TRAINING_TOPICS, type AttendanceEntry, type TrainingDay, type TrainingTopic } from "@/types/dashboard"
import { cn } from "@/lib/utils"

interface Person {
  id: string
  name: string
}

const topicLabel = (t: TrainingTopic | undefined) => TRAINING_TOPICS.find((x) => x.id === t)?.label

function Avatar({ name }: { name: string }) {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#64DDA3]/15 text-xs font-bold text-[#64DDA3]">
      {initials(name)}
    </div>
  )
}

export function Training({
  day, onDayChange, roster, employees, attendance, topics, assignments, setTopic, assign, reset, canEdit, fullView,
}: {
  /** Trainingstag: Freitag oder Samstag (je Tag eigene Anwesenheit und eigene Einteilung). */
  day: TrainingDay
  onDayChange: (day: TrainingDay) => void
  /** Voller Strukturbaum-Roster (Rolle + Name). */
  roster: RosterEntry[]
  employees: readonly EmployeeMeta[]
  /** Anwesenheit aller Personen (Name -> Eintrag). */
  attendance: Record<string, AttendanceEntry>
  topics: Record<string, TrainingTopic>
  assignments: Record<string, string>
  setTopic: (fkId: string, topic: TrainingTopic | null) => void
  assign: (traineeId: string, fkId: string | null) => void
  reset: () => void
  canEdit: boolean
  /** true: Anwesenheit aller ist geladen (Führungskräfte, Admin, Lesemodus). false: nur das Ergebnis der Einteilung zeigen. */
  fullView: boolean
}) {
  const confirm = useConfirm()

  const { leads, trainees } = useMemo(() => {
    const ids = idByName(employees)
    const leads: Person[] = []
    const trainees: Person[] = []
    const byName = (a: Person, b: Person) => a.name.localeCompare(b.name, "de")
    if (!fullView) {
      // Ergebnisansicht ohne Anwesenheitsdaten: Führungskräfte = alle mit Thema oder zugeteilten Trainees, Trainees = alle Zugeteilten.
      const nameById = new Map(employees.map((e) => [e.id, e.name]))
      const fkIds = new Set([...Object.keys(topics), ...Object.values(assignments)])
      for (const id of fkIds) { const name = nameById.get(id); if (name) leads.push({ id, name }) }
      for (const id of Object.keys(assignments)) { const name = nameById.get(id); if (name) trainees.push({ id, name }) }
      return { leads: leads.sort(byName), trainees: trainees.sort(byName) }
    }
    for (const r of roster) {
      const a = getAttendanceEntry(attendance, r.name)
      if (!(day === "fr" ? a.trainingFr : a.trainingSa)) continue
      const id = ids.get(r.name.trim().toLowerCase())
      if (!id) continue
      ;(isLeadRole(r.role) ? leads : trainees).push({ id, name: r.name })
    }
    return { leads: leads.sort(byName), trainees: trainees.sort(byName) }
  }, [roster, employees, attendance, day, fullView, topics, assignments])

  const leadIds = useMemo(() => new Set(leads.map((l) => l.id)), [leads])
  // Zuteilungen auf nicht (mehr) anwesende Führungskräfte zählen nicht.
  const validFk = (t: Person) => (assignments[t.id] && leadIds.has(assignments[t.id]) ? assignments[t.id] : null)
  const unassigned = trainees.filter((t) => !validFk(t))

  async function onReset() {
    const dayLabel = TRAINING_DAYS.find((d) => d.id === day)?.label
    if (!(await confirm(`Einteilung für ${dayLabel} (Themen und Zuteilungen) wirklich zurücksetzen?`))) return
    reset()
  }

  const fkOptions = (
    <>
      {leads.map((l) => (
        <option key={l.id} className={DARK_OPTION} value={l.id}>
          {l.name}{topicLabel(topics[l.id]) ? ` – ${topicLabel(topics[l.id])}` : ""}
        </option>
      ))}
    </>
  )

  // Render-Funktion statt Komponente: sonst würde das Select bei jedem Render neu gemountet (Fokusverlust).
  function fkSelect(trainee: Person, current: string | null, width: string) {
    if (!fullView) return null
    return (
      <Select
        aria-label={`Führungskraft für ${trainee.name}`}
        value={current ?? ""}
        disabled={!canEdit || leads.length === 0}
        onChange={(e) => assign(trainee.id, e.target.value || null)}
        className={cn("h-8 text-xs", width, DARK_SELECT)}
      >
        <option className={DARK_OPTION} value="">Führungskraft zuteilen…</option>
        {fkOptions}
      </Select>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHero
        eyebrow="Team"
        title="Training"
        badge={`${trainees.length} Trainees · ${leads.length} Führungskräfte`}
        description={fullView
          ? "Es werden alle angezeigt, die in der Anwesenheitsliste beim gewählten Trainingstag angehakt sind. Jede Führungskraft bekommt ein Thema, die Trainees werden ihr zugeteilt. Freitag und Samstag werden getrennt eingeteilt."
          : "So sind die Trainees für den gewählten Trainingstag auf die Führungskräfte verteilt. Freitag und Samstag werden getrennt eingeteilt."}
        actions={
          <>
            <div role="tablist" aria-label="Trainingstag" className="flex rounded-full border border-white/25 p-0.5">
              {TRAINING_DAYS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  role="tab"
                  aria-selected={day === d.id}
                  onClick={() => onDayChange(d.id)}
                  className={cn(
                    "rounded-full px-4 py-1 text-sm font-semibold transition-colors",
                    day === d.id ? "bg-[#64DDA3] text-[#0f2633]" : "text-white/80 hover:bg-white/10"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={onReset}
              >
                Einteilung zurücksetzen
              </Button>
            )}
          </>
        }
      >
        <div className={cn("grid gap-3", fullView ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          <KpiTile icon={GraduationCap} label="Trainees" value={trainees.length} sub={fullView ? "anwesend" : "eingeteilt"} />
          <KpiTile icon={UserCheck} label="Führungskräfte" value={leads.length} sub={fullView ? "anwesend" : "mit Einteilung"} />
          {fullView && <KpiTile icon={Users} label="Nicht zugeteilt" value={unassigned.length} sub="Trainees" />}
        </div>
      </SectionHero>

      {fullView && trainees.length === 0 && (
        <div className={cn("rounded-xl border py-8 text-center text-sm text-white/90", DARK_CARD)}>
          Keine Trainees für diesen Trainingstag angemeldet.
        </div>
      )}
      {fullView && leads.length === 0 && (
        <div className={cn("rounded-xl border py-8 text-center text-sm text-white/90", DARK_CARD)}>
          Keine Führungskraft anwesend.
        </div>
      )}
      {!fullView && leads.length === 0 && (
        <div className={cn("rounded-xl border py-8 text-center text-sm text-white/90", DARK_CARD)}>
          Für diesen Trainingstag gibt es noch keine Einteilung.
        </div>
      )}

      {fullView && unassigned.length > 0 && (
        <div className={cn("rounded-xl border p-4", DARK_CARD)}>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-white/90">Nicht zugeteilt ({unassigned.length})</h3>
          <ul className="flex flex-col gap-2">
            {unassigned.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={t.name} />
                  <span className="font-semibold">{t.name}</span>
                </div>
                {fkSelect(t, null, "w-56")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {leads.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {leads.map((l) => {
            const mine = trainees.filter((t) => validFk(t) === l.id)
            return (
              <div key={l.id} className={cn("flex flex-col gap-3 rounded-xl border p-4", DARK_CARD)}>
                <div className="flex items-center gap-3">
                  <Avatar name={l.name} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{l.name}</div>
                    <div className="text-xs text-white/70">{mine.length} Trainee{mine.length === 1 ? "" : "s"}</div>
                  </div>
                </div>
                {!fullView ? (
                  <div className="text-sm font-medium text-[#64DDA3]">{topicLabel(topics[l.id]) ?? "Kein Thema"}</div>
                ) : (
                <Select
                  aria-label={`Thema ${l.name}`}
                  value={topics[l.id] ?? ""}
                  disabled={!canEdit}
                  onChange={(e) => setTopic(l.id, (e.target.value || null) as TrainingTopic | null)}
                  className={cn("h-8 text-xs", DARK_SELECT)}
                >
                  <option className={DARK_OPTION} value="">Thema wählen…</option>
                  {TRAINING_TOPICS.map((t) => (
                    <option key={t.id} className={DARK_OPTION} value={t.id}>{t.label}</option>
                  ))}
                </Select>
                )}
                {mine.length === 0 ? (
                  <p className="text-xs text-white/60">Noch keine Trainees zugeteilt.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {mine.map((t) => (
                      <li key={t.id} className="flex items-center gap-2">
                        <Avatar name={t.name} />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.name}</span>
                        {fkSelect(t, l.id, "w-36")}
                        {canEdit && (
                          <button
                            type="button"
                            aria-label={`${t.name} entfernen`}
                            onClick={() => assign(t.id, null)}
                            className="rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white"
                          >
                            <X aria-hidden="true" className="size-4" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
