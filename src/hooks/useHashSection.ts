// Section-Routing über location.hash — Äquivalent zu activateSection()/
// navigateToSection() aus legacy/index.html:5063–5097. Gleiche section-ids,
// gleicher Default ("overview"), gleiches hashchange-Verhalten.
import { useCallback, useEffect, useState } from "react"

export const SECTION_IDS = [
  "overview", "team", "struktur", "rechner", "karriere", "guide", "kalender", "partner",
] as const

export type SectionId = (typeof SECTION_IDS)[number]

function isSectionId(v: string): v is SectionId {
  return (SECTION_IDS as readonly string[]).includes(v)
}

function sectionFromHash(): SectionId {
  const raw = location.hash.slice(1)
  return isSectionId(raw) ? raw : "overview"
}

export interface UseHashSectionResult {
  section: SectionId
  navigateTo: (section: SectionId) => void
}

export function useHashSection(): UseHashSectionResult {
  const [section, setSection] = useState<SectionId>(sectionFromHash)

  useEffect(() => {
    const onHashChange = () => setSection(sectionFromHash())
    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [])

  const navigateTo = useCallback((next: SectionId) => {
    if (location.hash.slice(1) === next) {
      setSection(next)
    } else {
      location.hash = next
    }
  }, [])

  return { section, navigateTo }
}
