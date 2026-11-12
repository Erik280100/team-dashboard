// Training — anwesende Trainees (Anwesenheitsliste, Spalten „Training Freitag/Samstag“) bekommen je ein Thema
// (z. B. Analyse, Beratung/Verkauf); jedes Thema wird einer anwesenden Führungskraft (Trainer) zugeteilt. Die Trainees
// werden nach ihrer zuständigen Führungskraft (nächste Führungskraft nach oben im Strukturbaum) gruppiert: eine Kachel je Führungskraft.
// Führungskräfte und Admin (fullView) sehen und bearbeiten alles; alle anderen (Trainees) sehen nur das Ergebnis der
// Einteilung (Trainee, Thema, Trainer).
import { useMemo } from "react"
import { GraduationCap, UserCheck, Users } from "lucide-react"
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
  /** Zuständige Führungskraft laut Strukturbaum (nächste Führungskraft nach oben). */
  manager: string | null
}

const topicLabel = (t: TrainingTopic | undefined) => TRAINING_TOPICS.find((x) => x.id === t)?.label
const NO_MANAGER = "Ohne Führungskraft"

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
  /** Trainee-ID -> Thema. */
  topics: Record<string, TrainingTopic>
  /** Thema -> Trainer (Führungskraft-ID). */
  assignments: Record<string, string>
  setTopic: (traineeId: string, topic: TrainingTopic | null) => void
  assign: (topic: TrainingTopic, fkId: string | null) => void
  reset: () => void
  canEdit: boolean
  /** true: Anwesenheit aller ist geladen (Führungskräfte, Admin, Lesemodus). false: nur das Ergebnis der Einteilung zeigen. */
  fullView: boolean
}) {
  const confirm = useConfirm()

  const { leads, trainees } = useMemo(() => {
    const ids = idByName(employees)
    const nameById = new Map(employees.map((e) => [e.id, e.name]))
    // Zuständige Führungskraft = nächste Person nach oben im Strukturbaum mit Führungskraft-Rolle (Trainees ohne Führungsrolle überspringen).
    const entryByName = new Map(roster.map((r) => [r.name.trim().toLowerCase(), r]))
    const managerOf = (name: string): string | null => {
      const seen = new Set<string>()
      let cur = entryByName.get(name.trim().toLowerCase())
      while (cur?.managerName) {
        const key = cur.managerName.trim().toLowerCase()
        if (seen.has(key)) return null
        seen.add(key)
        const up = entryByName.get(key)
        if (!up) return cur.managerName
        if (isLeadRole(up.role)) return up.name
        cur = up
      }
      return null
    }
    const leads: { id: string; name: string }[] = []
    const trainees: Person[] = []
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "de")
    if (!fullView) {
      // Ergebnisansicht ohne Anwesenheitsdaten: Trainer = alle zugeteilten Führungskräfte, Trainees = alle mit Thema.
      for (const id of new Set(Object.values(assignments))) { const name = nameById.get(id); if (name) leads.push({ id, name }) }
      for (const id of Object.keys(topics)) { const name = nameById.get(id); if (name) trainees.push({ id, name, manager: managerOf(name) }) }
      return { leads: leads.sort(byName), trainees: trainees.sort(byName) }
    }
    for (const r of roster) {
      const a = getAttendanceEntry(attendance, r.name)
      if (!(day === "fr" ? a.trainingFr : a.trainingSa)) continue
      const id = ids.get(r.name.trim().toLowerCase())
      if (!id) continue
      if (isLeadRole(r.role)) leads.push({ id, name: r.name })
      else trainees.push({ id, name: r.name, manager: managerOf(r.name) })
    }
    return { leads: leads.sort(byName), trainees: trainees.sort(byName) }
  }, [roster, employees, attendance, day, fullView, assignments, topics])

  const leadName = useMemo(() => new Map(leads.map((l) => [l.id, l.name])), [leads])
  const trainerOf = (t: Person) => {
    const topic = topics[t.id]
    const fk = topic ? assignments[topic] : undefined
    return fk ? leadName.get(fk) ?? null : null
  }
  const withoutTopic = trainees.filter((t) => !topics[t.id]).length

  // Gruppen nach direkter Führungskraft, alphabetisch; „ohne“ am Ende.
  const groups = useMemo(() => {
    const m = new Map<string, Person[]>()
    for (const t of trainees) {
      const k = t.manager?.trim() || NO_MANAGER
      m.set(k, [...(m.get(k) ?? []), t])
    }
    return [...m.entries()].sort(([a], [b]) =>
      a === NO_MANAGER ? 1 : b === NO_MANAGER ? -1 : a.localeCompare(b, "de"))
  }, [trainees])

  async function onReset() {
    const dayLabel = TRAINING_DAYS.find((d) => d.id === day)?.label
    if (!(await confirm(`Einteilung für ${dayLabel} (Themen und Zuteilungen) wirklich zurücksetzen?`))) return
    reset()
  }

  // Render-Funktion statt Komponente: sonst würde das Select bei jedem Render neu gemountet (Fokusverlust).
  function topicSelect(trainee: Person) {
    if (!fullView) return null
    return (
      <Select
        aria-label={`Thema für ${trainee.name}`}
        value={topics[trainee.id] ?? ""}
        disabled={!canEdit}
        onChange={(e) => setTopic(trainee.id, (e.target.value || null) as TrainingTopic | null)}
        className={cn("h-8 w-44 text-xs", DARK_SELECT)}
      >
        <option className={DARK_OPTION} value="">Thema wählen…</option>
        {TRAINING_TOPICS.map((t) => (
          <option key={t.id} className={DARK_OPTION} value={t.id}>{t.label}</option>
        ))}
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
          ? "Es werden alle angezeigt, die in der Anwesenheitsliste beim gewählten Trainingstag angehakt sind. Jedes Thema wird einer Führungskraft zugeteilt, jeder Trainee bekommt ein Thema. Die Trainees sind nach ihrer Führungskraft gruppiert. Freitag und Samstag werden getrennt eingeteilt."
          : "So sind die Trainees für den gewählten Trainingstag eingeteilt (Thema und Trainer), gruppiert nach ihrer Führungskraft. Freitag und Samstag werden getrennt eingeteilt."}
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
          <KpiTile icon={UserCheck} label="Führungskräfte" value={leads.length} sub={fullView ? "anwesend" : "als Trainer"} />
          {fullView && <KpiTile icon={Users} label="Ohne Thema" value={withoutTopic} sub="Trainees" />}
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
      {!fullView && trainees.length === 0 && (
        <div className={cn("rounded-xl border py-8 text-center text-sm text-white/90", DARK_CARD)}>
          Für diesen Trainingstag gibt es noch keine Einteilung.
        </div>
      )}

      {fullView && (
        <section className={cn("rounded-xl border p-4", DARK_CARD)}>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-white/90">Themen den Führungskräften zuteilen</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {TRAINING_TOPICS.map((tp) => {
              const count = trainees.filter((t) => topics[t.id] === tp.id).length
              const current = assignments[tp.id] && leadName.has(assignments[tp.id]) ? assignments[tp.id] : ""
              return (
                <div key={tp.id} className="flex flex-col gap-2 rounded-lg border border-white/15 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{tp.label}</span>
                    <span className="text-xs text-white/70">{count} Trainee{count === 1 ? "" : "s"}</span>
                  </div>
                  <Select
                    aria-label={`Führungskraft für ${tp.label}`}
                    value={current}
                    disabled={!canEdit || leads.length === 0}
                    onChange={(e) => assign(tp.id, e.target.value || null)}
                    className={cn("h-8 w-full text-xs", DARK_SELECT)}
                  >
                    <option className={DARK_OPTION} value="">Führungskraft zuteilen…</option>
                    {leads.map((l) => (
                      <option key={l.id} className={DARK_OPTION} value={l.id}>{l.name}</option>
                    ))}
                  </Select>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {groups.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map(([manager, members]) => (
            <section key={manager} className={cn("flex flex-col gap-3 rounded-xl border p-4", DARK_CARD)}>
              <div className="flex items-center gap-3">
                {manager !== NO_MANAGER && <Avatar name={manager} />}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{manager}</div>
                  <div className="text-xs text-white/70">{members.length} Trainee{members.length === 1 ? "" : "s"}</div>
                </div>
              </div>
              <ul className="flex flex-col gap-2">
                {members.map((t) => {
                  const trainer = trainerOf(t)
                  return (
                    <li key={t.id} className="flex flex-wrap items-center gap-2">
                      <Avatar name={t.name} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{t.name}</div>
                        {!fullView && (
                          <div className="text-xs text-[#64DDA3]">
                            {topicLabel(topics[t.id]) ?? "Kein Thema"}{trainer ? ` · ${trainer}` : ""}
                          </div>
                        )}
                        {fullView && topics[t.id] && (
                          <div className="text-xs text-white/70">{trainer ? `Trainer: ${trainer}` : "Noch kein Trainer"}</div>
                        )}
                      </div>
                      {topicSelect(t)}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
