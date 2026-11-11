// Training — anwesende Trainees (Anwesenheitsliste, Spalte „Training“) auf die anwesenden Führungskräfte
// verteilen; jede Führungskraft bekommt ein Thema (Telefonieren, Analyse, Beratung, Empfehlungen).
// Nur für Führungskräfte und Admin sichtbar (Sidebar + App.tsx + firestore.rules).
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
import { TRAINING_TOPICS, type AttendanceEntry, type TrainingTopic } from "@/types/dashboard"
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
  roster, employees, attendance, topics, assignments, setTopic, assign, reset, canEdit,
}: {
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
}) {
  const confirm = useConfirm()

  const { leads, trainees } = useMemo(() => {
    const ids = idByName(employees)
    const leads: Person[] = []
    const trainees: Person[] = []
    for (const r of roster) {
      if (!getAttendanceEntry(attendance, r.name).training) continue
      const id = ids.get(r.name.trim().toLowerCase())
      if (!id) continue
      ;(isLeadRole(r.role) ? leads : trainees).push({ id, name: r.name })
    }
    const byName = (a: Person, b: Person) => a.name.localeCompare(b.name, "de")
    return { leads: leads.sort(byName), trainees: trainees.sort(byName) }
  }, [roster, employees, attendance])

  const leadIds = useMemo(() => new Set(leads.map((l) => l.id)), [leads])
  // Zuteilungen auf nicht (mehr) anwesende Führungskräfte zählen nicht.
  const validFk = (t: Person) => (assignments[t.id] && leadIds.has(assignments[t.id]) ? assignments[t.id] : null)
  const unassigned = trainees.filter((t) => !validFk(t))

  async function onReset() {
    if (!(await confirm("Einteilung (Themen und Zuteilungen) wirklich zurücksetzen?"))) return
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
        description="Es werden alle angezeigt, die in der Anwesenheitsliste beim Training angehakt sind. Jede Führungskraft bekommt ein Thema, die Trainees werden ihr zugeteilt."
        actions={
          canEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
              onClick={onReset}
            >
              Einteilung zurücksetzen
            </Button>
          )
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiTile icon={GraduationCap} label="Trainees" value={trainees.length} sub="anwesend" />
          <KpiTile icon={UserCheck} label="Führungskräfte" value={leads.length} sub="anwesend" />
          <KpiTile icon={Users} label="Nicht zugeteilt" value={unassigned.length} sub="Trainees" />
        </div>
      </SectionHero>

      {trainees.length === 0 && (
        <div className={cn("rounded-xl border py-8 text-center text-sm text-white/90", DARK_CARD)}>
          Keine Trainees beim Training angemeldet.
        </div>
      )}
      {leads.length === 0 && (
        <div className={cn("rounded-xl border py-8 text-center text-sm text-white/90", DARK_CARD)}>
          Keine Führungskraft anwesend.
        </div>
      )}

      {unassigned.length > 0 && (
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
