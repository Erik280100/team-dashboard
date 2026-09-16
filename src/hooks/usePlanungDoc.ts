// Planung-Cloud-Sync — analog zu useFinanzierungenDoc.ts (Live-Dokument) UND
// useMonthArchive.ts (Lazy-Load + Cache für mehrere Dokumente). Zwei Arten von
// Firestore-Dokumenten in derselben "finova"-Collection, die die Legacy-Seite
// nicht kennt:
//   - finova/plan_week_<YYYY-Www>  — ein Dokument je ISO-Woche, live editierbar
//     (onSnapshot wie bei den übrigen Live-Docs)
//   - finova/plan_annual_<YYYY>_<managerKey> — ein Dokument je Jahr UND
//     Führungskraft (siehe planManagerKey in lib/calc/planung.ts), ebenfalls live
// Monats-/Jahresansicht laden die betroffenen Wochendokumente per getDoc lazy
// nach (kein Bootstrap-setDoc — ein fehlendes Wochendokument ist der
// Normalfall, analog zu useMonthArchive.loadOne).
import { useCallback, useEffect, useRef, useState } from "react"
import { getDoc, onSnapshot, setDoc } from "firebase/firestore"
import { CLOUD_CONFIGURED, planAnnualDocRef, planMonthNotesDocRef, planWeekDocRef } from "@/lib/firebase"
import { currentMonthKey, defaultAnnual, emptyMonthNoteEntry, emptyWeekEntry, isoWeekKey, planManagerKey } from "@/lib/calc/planung"
import {
  planAnnualStorageKey, planMonthNotesStorageKey, planWeekStorageKey,
  type PlanAnnualDoc, type PlanMonthNotesDoc, type PlanMonthNotesEntry, type PlanWeekDoc, type PlanWeekEntry,
} from "@/types/dashboard"

function emptyWeekDoc(week: string): PlanWeekDoc {
  return { week, entries: {} }
}

function loadLocalWeekDoc(week: string): PlanWeekDoc {
  try {
    const raw = localStorage.getItem(planWeekStorageKey(week))
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
    const raw = localStorage.getItem(planMonthNotesStorageKey(month))
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
    const raw = localStorage.getItem(planAnnualStorageKey(year, managerKey))
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
  /** Jahresplanungs-Dokument einer Führungskraft (Fallback: defaultAnnual()). */
  annual: (year: number, managerName: string) => PlanAnnualDoc
  annualStatus: (year: number, managerName: string) => WeekDocStatus
  saveAnnual: (year: number, managerName: string, doc: PlanAnnualDoc) => void
}

export function usePlanungDoc(): UsePlanungDocResult {
  const [activeWeek, setActiveWeek] = useState<string>(() => isoWeekKey(new Date()))
  const [weekDoc, setWeekDoc] = useState<PlanWeekDoc>(() => loadLocalWeekDoc(activeWeek))
  const cloudReady = useRef(false)
  const latestWeekDoc = useRef(weekDoc)
  latestWeekDoc.current = weekDoc

  // Live-Sync der aktuell angezeigten Woche.
  useEffect(() => {
    setWeekDoc(loadLocalWeekDoc(activeWeek))
    cloudReady.current = false
    const docRef = planWeekDocRef(activeWeek)
    if (!CLOUD_CONFIGURED || !docRef) return
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (snap.metadata.hasPendingWrites) return
        if (snap.exists()) {
          const data = snap.data() as Partial<PlanWeekDoc>
          const next: PlanWeekDoc = { week: activeWeek, entries: data.entries ?? {} }
          setWeekDoc(next)
          try { localStorage.setItem(planWeekStorageKey(activeWeek), JSON.stringify(next)) } catch { /* noop */ }
        }
        // Kein setDoc bei fehlendem Dokument — eine leere Woche ist der Normalfall
        // (analog useMonthArchive), ein Lesezugriffs-Nutzer soll nichts anlegen.
        cloudReady.current = true
      },
      (err) => console.warn(`Planungswoche ${activeWeek}: Cloud-Verbindung fehlgeschlagen`, err)
    )
    return unsub
  }, [activeWeek])

  // ---- Lazy-Load-Cache für Monats-/Jahresansicht (Muster useMonthArchive.loadOne) ----
  const cacheRef = useRef<Map<string, PlanWeekDoc>>(new Map())
  const statusRef = useRef<Map<string, WeekDocStatus>>(new Map())
  const [, bumpCacheVersion] = useState(0)

  const saveWeekEntry = useCallback(
    (name: string, patch: Partial<PlanWeekEntry>) => {
      const current = latestWeekDoc.current
      const nextEntry = { ...(current.entries[name] ?? emptyWeekEntry()), ...patch }
      const next: PlanWeekDoc = { week: current.week, entries: { ...current.entries, [name]: nextEntry } }
      setWeekDoc(next)
      try { localStorage.setItem(planWeekStorageKey(next.week), JSON.stringify(next)) } catch { /* noop */ }
      // Cache mit aktualisieren, damit Monats-/Jahresansicht sofort den neuen Stand sehen.
      cacheRef.current.set(next.week, next)
      const docRef = planWeekDocRef(next.week)
      if (CLOUD_CONFIGURED && cloudReady.current && docRef) {
        setDoc(docRef, next).catch((err) =>
          console.warn(`Planungswoche ${next.week}: Cloud-Speichern fehlgeschlagen`, err)
        )
      }
    },
    []
  )

  const loadOne = useCallback(async (week: string): Promise<PlanWeekDoc> => {
    const cached = cacheRef.current.get(week)
    if (cached) return cached

    // Die aktuell live gesyncte Woche ist bereits im State — direkt übernehmen.
    if (week === activeWeek) {
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
      const ref = planWeekDocRef(week)
      if (!ref) throw new Error("Firestore nicht verfügbar")
      const snap = await getDoc(ref)
      const data: PlanWeekDoc = snap.exists()
        ? { week, entries: (snap.data() as Partial<PlanWeekDoc>).entries ?? {} }
        : emptyWeekDoc(week)
      cacheRef.current.set(week, data)
      try { localStorage.setItem(planWeekStorageKey(week), JSON.stringify(data)) } catch { /* noop */ }
      statusRef.current.set(week, "ready")
      bumpCacheVersion((n) => n + 1)
      return data
    } catch (err) {
      console.warn(`Planungswoche ${week} konnte nicht geladen werden`, err)
      statusRef.current.set(week, "error")
      const empty = emptyWeekDoc(week)
      cacheRef.current.set(week, empty)
      return empty
    }
  }, [activeWeek])

  const getWeek = useCallback(
    (week: string): PlanWeekDoc | null => {
      const cached = cacheRef.current.get(week)
      if (cached) return cached
      queueMicrotask(() => { void loadOne(week) })
      return null
    },
    [loadOne]
  )

  const loadWeeks = useCallback(
    async (weeks: string[]): Promise<PlanWeekDoc[]> => Promise.all(weeks.map((w) => loadOne(w))),
    [loadOne]
  )

  // ---- Monats-Notizen (AT/BT/ST-Kacheln der Monatsplanung) — Live-Dokument
  // analog zu weekDoc oben, nur je Kalendermonat statt je ISO-Woche. ----
  const [activeMonth, setActiveMonth] = useState<string>(() => currentMonthKey())
  const [monthNotesDoc, setMonthNotesDoc] = useState<PlanMonthNotesDoc>(() => loadLocalMonthNotesDoc(activeMonth))
  const monthCloudReady = useRef(false)
  const latestMonthNotesDoc = useRef(monthNotesDoc)
  latestMonthNotesDoc.current = monthNotesDoc

  useEffect(() => {
    setMonthNotesDoc(loadLocalMonthNotesDoc(activeMonth))
    monthCloudReady.current = false
    const docRef = planMonthNotesDocRef(activeMonth)
    if (!CLOUD_CONFIGURED || !docRef) return
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (snap.metadata.hasPendingWrites) return
        if (snap.exists()) {
          const data = snap.data() as Partial<PlanMonthNotesDoc>
          const next: PlanMonthNotesDoc = { month: activeMonth, entries: data.entries ?? {} }
          setMonthNotesDoc(next)
          try { localStorage.setItem(planMonthNotesStorageKey(activeMonth), JSON.stringify(next)) } catch { /* noop */ }
        }
        monthCloudReady.current = true
      },
      (err) => console.warn(`Monatsnotizen ${activeMonth}: Cloud-Verbindung fehlgeschlagen`, err)
    )
    return unsub
  }, [activeMonth])

  const saveMonthNoteEntry = useCallback(
    (name: string, patch: Partial<PlanMonthNotesEntry>) => {
      const current = latestMonthNotesDoc.current
      const nextEntry = { ...(current.entries[name] ?? emptyMonthNoteEntry()), ...patch }
      const next: PlanMonthNotesDoc = { month: current.month, entries: { ...current.entries, [name]: nextEntry } }
      setMonthNotesDoc(next)
      try { localStorage.setItem(planMonthNotesStorageKey(next.month), JSON.stringify(next)) } catch { /* noop */ }
      const docRef = planMonthNotesDocRef(next.month)
      if (CLOUD_CONFIGURED && monthCloudReady.current && docRef) {
        setDoc(docRef, next).catch((err) =>
          console.warn(`Monatsnotizen ${next.month}: Cloud-Speichern fehlgeschlagen`, err)
        )
      }
    },
    []
  )

  // ---- Jahresplanung — eigenes kleines Live-Cache-Set, ein Dokument je
  // Jahr + Führungskraft (siehe planManagerKey/annualCacheKey oben). ----
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
    annualStatusMap.current.set(cacheKey, "loading")

    const docRef = planAnnualDocRef(year, managerKey)
    if (!CLOUD_CONFIGURED || !docRef) {
      annualStatusMap.current.set(cacheKey, "ready")
      return
    }
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (snap.metadata.hasPendingWrites) return
        if (snap.exists()) {
          const data = snap.data() as PlanAnnualDoc
          setAnnualDocs((m) => new Map(m).set(cacheKey, data))
          try { localStorage.setItem(planAnnualStorageKey(year, managerKey), JSON.stringify(data)) } catch { /* noop */ }
        }
        annualCloudReady.current.add(cacheKey)
        annualStatusMap.current.set(cacheKey, "ready")
      },
      (err) => {
        console.warn(`Jahresplanung ${year}/${managerKey}: Cloud-Verbindung fehlgeschlagen`, err)
        annualStatusMap.current.set(cacheKey, "error")
      }
    )
    annualUnsubs.current.set(cacheKey, unsub)
  }, [])

  useEffect(() => () => {
    annualUnsubs.current.forEach((unsub) => unsub())
  }, [])

  const annual = useCallback(
    (year: number, managerName: string): PlanAnnualDoc => {
      const cacheKey = annualCacheKey(year, planManagerKey(managerName))
      // Abonnement-Aufbau (onSnapshot) ist ein externer Seiteneffekt — nicht
      // synchron aus dem Render-Body auslösen, sondern wie getSnapshot() in
      // useMonthArchive.ts auf einen Mikrotask verschieben.
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
    try { localStorage.setItem(planAnnualStorageKey(year, managerKey), JSON.stringify(doc)) } catch { /* noop */ }
    const docRef = planAnnualDocRef(year, managerKey)
    // cloudReady-Gate wie bei den übrigen *Doc-Hooks (z. B. useFinanzierungenDoc.commit):
    // verhindert, dass ein Speichern kurz nach dem Öffnen den bereits vorhandenen
    // Remote-Stand überschreibt, bevor der erste Snapshot eingetroffen ist.
    if (CLOUD_CONFIGURED && annualCloudReady.current.has(cacheKey) && docRef) {
      setDoc(docRef, doc).catch((err) =>
        console.warn(`Jahresplanung ${year}/${managerKey}: Cloud-Speichern fehlgeschlagen`, err)
      )
    }
  }, [])

  return {
    activeWeek, setActiveWeek, weekDoc, saveWeekEntry,
    getWeek, loadWeeks,
    activeMonth, setActiveMonth, monthNotesDoc, saveMonthNoteEntry,
    annual, annualStatus, saveAnnual,
  }
}
