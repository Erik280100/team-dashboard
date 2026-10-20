// Planung — Cloud-Modus: je Mitarbeiter eigene Dokumente
//   employees/{id}/planWeeks/{YYYY-Www}
//   employees/{id}/planMonthNotes/{YYYY-MM}
//   employees/{id}/planAnnual/{YYYY}
// (Zugriff regeln firestore.rules: selbst, Vorgesetzte, Admin). Die Schnittstelle
// bleibt die bisherige: Wochen-/Monatsdokumente mit Einträgen je Mitarbeitername,
// zusammengesetzt aus den Einzeldokumenten der für dieses Konto sichtbaren
// Mitarbeiter (`employees`). Im Cloud-Modus wird nichts in localStorage gecacht
// (mehrere Konten pro Browser). Ohne Firebase-Config: wie bisher nur localStorage.
import { useCallback, useEffect, useRef, useState } from "react"
import { CLOUD_CONFIGURED } from "@/lib/firebase"
import { fetchEmployeeDocs, fetchEmployeeRange, subscribeEmployeeDocs, writeEmployeeSubDoc } from "@/lib/employeeSubdocs"
import { idByName, type EmployeeMeta } from "@/lib/calc/employees"
import { currentMonthKey, defaultAnnual, emptyMonthNoteEntry, emptyWeekEntry, isoWeekKey, planManagerKey } from "@/lib/calc/planung"
import {
  planAnnualStorageKey, planMonthNotesStorageKey, planWeekStorageKey,
  type PlanAnnualDoc, type PlanMonthNotesDoc, type PlanMonthNotesEntry, type PlanWeekDoc, type PlanWeekEntry,
} from "@/types/dashboard"

// localStorage nur im lokalen Modus (siehe Kopfkommentar).
function lsGet(key: string): string | null {
  if (CLOUD_CONFIGURED) return null
  try { return localStorage.getItem(key) } catch { return null }
}
function lsSet(key: string, value: unknown): void {
  if (CLOUD_CONFIGURED) return
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* noop */ }
}

function emptyWeekDoc(week: string): PlanWeekDoc {
  return { week, entries: {} }
}

function loadLocalWeekDoc(week: string): PlanWeekDoc {
  try {
    const raw = lsGet(planWeekStorageKey(week))
    if (raw) {
      const parsed = JSON.parse(raw) as PlanWeekDoc
      if (parsed && typeof parsed === "object" && parsed.entries) return parsed
    }
  } catch (e) {
    console.warn(`Konnte Planungswoche ${week} nicht laden`, e)
  }
  return emptyWeekDoc(week)
}

function emptyMonthNotesDoc(month: string): PlanMonthNotesDoc {
  return { month, entries: {} }
}

function loadLocalMonthNotesDoc(month: string): PlanMonthNotesDoc {
  try {
    const raw = lsGet(planMonthNotesStorageKey(month))
    if (raw) {
      const parsed = JSON.parse(raw) as PlanMonthNotesDoc
      if (parsed && typeof parsed === "object" && parsed.entries) return parsed
    }
  } catch (e) {
    console.warn(`Konnte Monatsnotizen ${month} nicht laden`, e)
  }
  return emptyMonthNotesDoc(month)
}

function loadLocalAnnualDoc(year: number, managerKey: string): PlanAnnualDoc | null {
  try {
    const raw = lsGet(planAnnualStorageKey(year, managerKey))
    if (raw) return JSON.parse(raw) as PlanAnnualDoc
  } catch (e) {
    console.warn(`Konnte Jahresplanung ${year}/${managerKey} nicht laden`, e)
  }
  return null
}

/** Cache-Schlüssel für die Jahresplanung — Jahr + Führungskraft. */
function annualCacheKey(year: number, managerKey: string): string {
  return `${year}:${managerKey}`
}

export type WeekDocStatus = "loading" | "ready" | "error"

export interface UsePlanungDocResult {
  /** Aktuell angezeigte Woche ("YYYY-Www"), Default: die laufende ISO-Woche. */
  activeWeek: string
  setActiveWeek: (week: string) => void
  /** Live-Dokument der aktuell angezeigten Woche (editierbar). */
  weekDoc: PlanWeekDoc
  /** Schreibt/merged einen Eintrag für `name` in die aktuell angezeigte Woche. */
  saveWeekEntry: (name: string, patch: Partial<PlanWeekEntry>) => void
  /** Liest aus dem Cache; stößt bei Bedarf das Nachladen an (Monats-/Jahresansicht). */
  getWeek: (week: string) => PlanWeekDoc | null
  /** Mehrere Wochen auf einmal anfordern und auf ihr Laden warten. */
  loadWeeks: (weeks: string[]) => Promise<PlanWeekDoc[]>
  /** Aktuell angezeigter Monat ("YYYY-MM") der Monatsplanung-Notizkacheln. */
  activeMonth: string
  setActiveMonth: (month: string) => void
  /** Live-Dokument der Monats-Notizen (AT/BT/ST-Kacheln) des aktuell angezeigten Monats. */
  monthNotesDoc: PlanMonthNotesDoc
  /** Schreibt/merged einen Notiz-Eintrag für `name` im aktuell angezeigten Monat. */
  saveMonthNoteEntry: (name: string, patch: Partial<PlanMonthNotesEntry>) => void
  /** Monats-Notizen eines beliebigen Monats (z. B. Einheitenziel für die Mitarbeiterseite); null solange sie laden. */
  getMonthNotes: (month: string) => PlanMonthNotesDoc | null
  /** Jahresplanungs-Dokument einer Führungskraft (Fallback: defaultAnnual()). */
  annual: (year: number, managerName: string) => PlanAnnualDoc
  annualStatus: (year: number, managerName: string) => WeekDocStatus
  saveAnnual: (year: number, managerName: string, doc: PlanAnnualDoc) => void
}

export function usePlanungDoc(employeesIn: readonly EmployeeMeta[] = []): UsePlanungDocResult {
  // Stabile Mitarbeiterliste: ändert sich nur, wenn sich ID/Name ändern (nicht bei jeder Zahlenänderung),
  // sonst würden alle Abos bei jedem Speichern neu aufgebaut.
  const employeesKey = employeesIn.map((e) => `${e.id}:${e.name}`).join("|")
  const empRef = useRef({ key: employeesKey, list: employeesIn })
  if (empRef.current.key !== employeesKey) empRef.current = { key: employeesKey, list: employeesIn }
  const employees = empRef.current.list
  const employeesRef = useRef(employees)
  employeesRef.current = employees

  const [activeWeek, setActiveWeek] = useState<string>(() => isoWeekKey(new Date()))
  const [weekDoc, setWeekDoc] = useState<PlanWeekDoc>(() => loadLocalWeekDoc(activeWeek))
  const cloudReady = useRef(false)
  const latestWeekDoc = useRef(weekDoc)
  latestWeekDoc.current = weekDoc

  // ---- Lazy-Load-Cache für Monats-/Jahresansicht ----
  const cacheRef = useRef<Map<string, PlanWeekDoc>>(new Map())
  const statusRef = useRef<Map<string, WeekDocStatus>>(new Map())
  const [, bumpCacheVersion] = useState(0)
  // Viele Wochen laden gleichzeitig (Jahresplanung: ~53) — Re-Render gebündelt statt je Woche einmal.
  const bumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleBump = useCallback(() => {
    if (bumpTimer.current !== null) return
    bumpTimer.current = setTimeout(() => { bumpTimer.current = null; bumpCacheVersion((n) => n + 1) }, 80)
  }, [])
  const monthCacheRef = useRef<Map<string, PlanMonthNotesDoc>>(new Map())
  const monthLoadingRef = useRef<Set<string>>(new Set())
  const [, bumpMonthCache] = useState(0)

  // Sichtbare Mitarbeiter geändert -> Caches enthalten evtl. zu wenige Personen.
  useEffect(() => {
    cacheRef.current.clear()
    monthCacheRef.current.clear()
    monthLoadingRef.current.clear()
    bumpCacheVersion((n) => n + 1)
    bumpMonthCache((n) => n + 1)
  }, [employeesKey])

  // Live-Sync der aktuell angezeigten Woche.
  useEffect(() => {
    setWeekDoc(loadLocalWeekDoc(activeWeek))
    cloudReady.current = false
    if (!CLOUD_CONFIGURED) return
    return subscribeEmployeeDocs<PlanWeekEntry>(
      "planWeeks", activeWeek, "week", employees,
      (entries, ready) => {
        const next: PlanWeekDoc = { week: activeWeek, entries }
        setWeekDoc(next)
        cacheRef.current.set(activeWeek, next) // Monats-/Jahresansicht nicht veraltet lassen
        cloudReady.current = ready
      },
      (err) => console.warn(`Planungswoche ${activeWeek}: Cloud-Verbindung fehlgeschlagen`, err)
    )
  }, [activeWeek, employees])

  const saveWeekEntry = useCallback(
    (name: string, patch: Partial<PlanWeekEntry>) => {
      const current = latestWeekDoc.current
      const nextEntry = { ...(current.entries[name] ?? emptyWeekEntry()), ...patch }
      const next: PlanWeekDoc = { week: current.week, entries: { ...current.entries, [name]: nextEntry } }
      setWeekDoc(next)
      lsSet(planWeekStorageKey(next.week), next)
      // Cache mit aktualisieren, damit Monats-/Jahresansicht sofort den neuen Stand sehen.
      cacheRef.current.set(next.week, next)
      if (!CLOUD_CONFIGURED || !cloudReady.current) return
      const id = idByName(employeesRef.current).get(name.trim().toLowerCase())
      if (!id) { console.warn(`Planungswoche: kein Mitarbeiter-Dokument für "${name}"`); return }
      writeEmployeeSubDoc(id, "planWeeks", next.week, { week: next.week, ...nextEntry }).catch((err) =>
        console.warn(`Planungswoche ${next.week}: Cloud-Speichern fehlgeschlagen`, err)
      )
    },
    []
  )

  const fetchOne = useCallback(async (week: string): Promise<PlanWeekDoc> => {
    const cached = cacheRef.current.get(week)
    if (cached) return cached

    // Die aktuell live gesyncte Woche ist bereits im State — direkt übernehmen.
    // Nur wenn das State-Dokument wirklich zu dieser Woche gehört: direkt nach
    // einem Wochenwechsel hält es noch die Vorwoche (Effekt lädt erst danach) —
    // das würde sonst unter dem falschen Schlüssel gecacht und doppelt zählen.
    if (week === activeWeek && latestWeekDoc.current.week === week) {
      cacheRef.current.set(week, latestWeekDoc.current)
      return latestWeekDoc.current
    }

    const local = loadLocalWeekDoc(week)
    if (Object.keys(local.entries).length > 0) {
      cacheRef.current.set(week, local)
      return local
    }

    if (!CLOUD_CONFIGURED) {
      const empty = emptyWeekDoc(week)
      cacheRef.current.set(week, empty)
      return empty
    }

    statusRef.current.set(week, "loading")
    try {
      const entries = await fetchEmployeeDocs<PlanWeekEntry>("planWeeks", week, "week", employeesRef.current)
      const data: PlanWeekDoc = { week, entries }
      cacheRef.current.set(week, data)
      statusRef.current.set(week, "ready")
      scheduleBump()
      return data
    } catch (err) {
      console.warn(`Planungswoche ${week} konnte nicht geladen werden`, err)
      statusRef.current.set(week, "error")
      const empty = emptyWeekDoc(week)
      cacheRef.current.set(week, empty)
      return empty
    }
  }, [activeWeek, scheduleBump])

  // Ladevorgänge je Woche zusammenfassen: getWeek() stößt beim Rendern für jede noch nicht geladene Woche ein
  // Nachladen an — ohne diese Bündelung startet jeder Re-Render erneut Abrufe für alle ~53 Wochen aller
  // Mitarbeiter (Anfragen-Lawine, die Jahresplanung friert ein).
  const inflightRef = useRef<Map<string, Promise<PlanWeekDoc>>>(new Map())
  const loadOne = useCallback((week: string): Promise<PlanWeekDoc> => {
    const pending = inflightRef.current.get(week)
    if (pending) return pending
    const p = fetchOne(week).finally(() => { inflightRef.current.delete(week) })
    inflightRef.current.set(week, p)
    return p
  }, [fetchOne])

  // Mehrere Wochen auf einmal (Jahresansicht): je Mitarbeiter EINE Bereichsabfrage über alle fehlenden Wochen,
  // statt Woche x Mitarbeiter einzelne Abrufe.
  const fetchRange = useCallback(async (weeks: string[]): Promise<void> => {
    const sorted = [...weeks].sort()
    const perWeek = new Map<string, Record<string, PlanWeekEntry>>(weeks.map((w) => [w, {}]))
    await fetchEmployeeRange<PlanWeekEntry>("planWeeks", "week", sorted[0], sorted[sorted.length - 1], employeesRef.current, (key, name, entry) => {
      const bucket = perWeek.get(key)
      if (bucket) bucket[name] = entry
    })
    for (const w of weeks) {
      if (cacheRef.current.has(w)) continue // z. B. inzwischen live gesyncte Woche
      if (w === activeWeek && latestWeekDoc.current.week === w) {
        cacheRef.current.set(w, latestWeekDoc.current)
      } else {
        const local = loadLocalWeekDoc(w)
        cacheRef.current.set(w, Object.keys(local.entries).length > 0 ? local : { week: w, entries: perWeek.get(w) ?? {} })
      }
      statusRef.current.set(w, "ready")
    }
    scheduleBump()
  }, [activeWeek, scheduleBump])

  const loadMany = useCallback((weeks: string[]): Promise<PlanWeekDoc[]> => {
    const missing = weeks.filter((w) => !cacheRef.current.has(w) && !inflightRef.current.has(w))
    if (CLOUD_CONFIGURED && missing.length > 3) {
      const done = fetchRange(missing).catch((err) => console.warn("Planungswochen konnten nicht geladen werden", err))
      missing.forEach((w) => {
        const p = done
          .then(() => cacheRef.current.get(w) ?? emptyWeekDoc(w))
          .finally(() => { inflightRef.current.delete(w) })
        inflightRef.current.set(w, p)
      })
    }
    return Promise.all(weeks.map((w) => loadOne(w)))
  }, [fetchRange, loadOne])

  // getWeek() wird beim Rendern je Woche aufgerufen — die angeforderten Wochen eines Renders gesammelt laden.
  const pendingWeeksRef = useRef<Set<string>>(new Set())
  const getWeek = useCallback(
    (week: string): PlanWeekDoc | null => {
      const cached = cacheRef.current.get(week)
      if (cached) return cached
      pendingWeeksRef.current.add(week)
      if (pendingWeeksRef.current.size === 1) {
        queueMicrotask(() => {
          const weeks = [...pendingWeeksRef.current]
          pendingWeeksRef.current.clear()
          void loadMany(weeks)
        })
      }
      return null
    },
    [loadMany]
  )

  const loadWeeks = loadMany

  // ---- Monats-Notizen (AT/BT/ST-Kacheln der Monatsplanung) ----
  const [activeMonth, setActiveMonth] = useState<string>(() => currentMonthKey())
  const [monthNotesDoc, setMonthNotesDoc] = useState<PlanMonthNotesDoc>(() => loadLocalMonthNotesDoc(activeMonth))
  const monthCloudReady = useRef(false)
  const latestMonthNotesDoc = useRef(monthNotesDoc)
  latestMonthNotesDoc.current = monthNotesDoc

  useEffect(() => {
    setMonthNotesDoc(loadLocalMonthNotesDoc(activeMonth))
    monthCloudReady.current = false
    if (!CLOUD_CONFIGURED) return
    return subscribeEmployeeDocs<PlanMonthNotesEntry>(
      "planMonthNotes", activeMonth, "month", employees,
      (entries, ready) => {
        setMonthNotesDoc({ month: activeMonth, entries })
        monthCloudReady.current = ready
      },
      (err) => console.warn(`Monatsnotizen ${activeMonth}: Cloud-Verbindung fehlgeschlagen`, err)
    )
  }, [activeMonth, employees])

  const saveMonthNoteEntry = useCallback(
    (name: string, patch: Partial<PlanMonthNotesEntry>) => {
      const current = latestMonthNotesDoc.current
      const nextEntry = { ...(current.entries[name] ?? emptyMonthNoteEntry()), ...patch }
      const next: PlanMonthNotesDoc = { month: current.month, entries: { ...current.entries, [name]: nextEntry } }
      setMonthNotesDoc(next)
      monthCacheRef.current.set(next.month, next) // Mitarbeiterseite nicht veraltet lassen
      lsSet(planMonthNotesStorageKey(next.month), next)
      if (!CLOUD_CONFIGURED || !monthCloudReady.current) return
      const id = idByName(employeesRef.current).get(name.trim().toLowerCase())
      if (!id) { console.warn(`Monatsnotizen: kein Mitarbeiter-Dokument für "${name}"`); return }
      writeEmployeeSubDoc(id, "planMonthNotes", next.month, { month: next.month, ...nextEntry }).catch((err) =>
        console.warn(`Monatsnotizen ${next.month}: Cloud-Speichern fehlgeschlagen`, err)
      )
    },
    []
  )

  // Lazy-Cache für Monats-Notizen anderer Monate als activeMonth (Einheitenziel auf
  // der Mitarbeiterseite). Der aktive Monat kommt direkt aus dem Live-State.
  const getMonthNotes = useCallback(
    (month: string): PlanMonthNotesDoc | null => {
      if (monthNotesDoc.month === month) return monthNotesDoc
      const cached = monthCacheRef.current.get(month)
      if (cached) return cached
      if (!monthLoadingRef.current.has(month)) {
        monthLoadingRef.current.add(month)
        queueMicrotask(async () => {
          let doc = loadLocalMonthNotesDoc(month)
          if (CLOUD_CONFIGURED) {
            try {
              doc = { month, entries: await fetchEmployeeDocs<PlanMonthNotesEntry>("planMonthNotes", month, "month", employeesRef.current) }
            } catch (err) {
              console.warn(`Monatsnotizen ${month} konnten nicht geladen werden`, err)
            }
          }
          monthCacheRef.current.set(month, doc)
          bumpMonthCache((n) => n + 1)
        })
      }
      return null
    },
    [monthNotesDoc]
  )

  // ---- Jahresplanung — employees/{fkId}/planAnnual/{Jahr} ----
  const [annualDocs, setAnnualDocs] = useState<Map<string, PlanAnnualDoc>>(new Map())
  const annualStatusMap = useRef<Map<string, WeekDocStatus>>(new Map())
  const annualUnsubs = useRef<Map<string, () => void>>(new Map())
  const annualCloudReady = useRef<Set<string>>(new Set())

  const ensureAnnualSub = useCallback((year: number, managerName: string) => {
    const managerKey = planManagerKey(managerName)
    const cacheKey = annualCacheKey(year, managerKey)
    if (annualUnsubs.current.has(cacheKey) || annualStatusMap.current.has(cacheKey)) return
    const local = loadLocalAnnualDoc(year, managerKey)
    if (local) setAnnualDocs((m) => new Map(m).set(cacheKey, local))

    if (!CLOUD_CONFIGURED) {
      annualStatusMap.current.set(cacheKey, "ready")
      return
    }
    // Mitarbeiterliste noch nicht geladen -> später (beim nächsten Render) erneut versuchen.
    if (employeesRef.current.length === 0) return
    const id = idByName(employeesRef.current).get(managerName.trim().toLowerCase())
    if (!id) {
      annualStatusMap.current.set(cacheKey, "ready") // Führungskraft für dieses Konto nicht sichtbar -> Standardwerte
      return
    }
    annualStatusMap.current.set(cacheKey, "loading")
    const unsub = subscribeEmployeeDocs<PlanAnnualDoc>(
      "planAnnual", String(year), "__none__", [{ id, name: managerName, role: "", managerId: null, ancestors: [] }],
      (entries, ready) => {
        const data = entries[managerName]
        if (data) setAnnualDocs((m) => new Map(m).set(cacheKey, data))
        if (ready) {
          annualCloudReady.current.add(cacheKey)
          annualStatusMap.current.set(cacheKey, "ready")
        }
      },
      (err) => {
        console.warn(`Jahresplanung ${year}/${managerKey}: Cloud-Verbindung fehlgeschlagen`, err)
        annualStatusMap.current.set(cacheKey, "error")
      }
    )
    annualUnsubs.current.set(cacheKey, unsub)
  }, [])

  // Sichtbarkeit geändert -> Jahresabos verwerfen, damit sie mit der neuen Liste neu aufgebaut werden.
  useEffect(() => {
    const unsubs = annualUnsubs.current
    const status = annualStatusMap.current
    const ready = annualCloudReady.current
    return () => {
      unsubs.forEach((unsub) => unsub())
      unsubs.clear()
      status.clear()
      ready.clear()
    }
  }, [employeesKey])

  const annual = useCallback(
    (year: number, managerName: string): PlanAnnualDoc => {
      const cacheKey = annualCacheKey(year, planManagerKey(managerName))
      // Abonnement-Aufbau (onSnapshot) ist ein externer Seiteneffekt — nicht
      // synchron aus dem Render-Body auslösen, sondern auf einen Mikrotask verschieben.
      if (!annualUnsubs.current.has(cacheKey) && !annualStatusMap.current.has(cacheKey)) {
        queueMicrotask(() => ensureAnnualSub(year, managerName))
      }
      return annualDocs.get(cacheKey) ?? defaultAnnual()
    },
    [annualDocs, ensureAnnualSub]
  )

  const annualStatus = useCallback(
    (year: number, managerName: string): WeekDocStatus =>
      annualStatusMap.current.get(annualCacheKey(year, planManagerKey(managerName))) ?? "loading",
    []
  )

  const saveAnnual = useCallback((year: number, managerName: string, doc: PlanAnnualDoc) => {
    const managerKey = planManagerKey(managerName)
    const cacheKey = annualCacheKey(year, managerKey)
    setAnnualDocs((m) => new Map(m).set(cacheKey, doc))
    lsSet(planAnnualStorageKey(year, managerKey), doc)
    // cloudReady-Gate: verhindert, dass ein Speichern kurz nach dem Öffnen den
    // vorhandenen Remote-Stand überschreibt, bevor der erste Snapshot da ist.
    if (!CLOUD_CONFIGURED || !annualCloudReady.current.has(cacheKey)) return
    const id = idByName(employeesRef.current).get(managerName.trim().toLowerCase())
    if (!id) return
    writeEmployeeSubDoc(id, "planAnnual", String(year), { ...doc }).catch((err) =>
      console.warn(`Jahresplanung ${year}/${managerKey}: Cloud-Speichern fehlgeschlagen`, err)
    )
  }, [])

  return {
    activeWeek, setActiveWeek, weekDoc, saveWeekEntry,
    getWeek, loadWeeks,
    activeMonth, setActiveMonth, monthNotesDoc, saveMonthNoteEntry, getMonthNotes,
    annual, annualStatus, saveAnnual,
  }
}
