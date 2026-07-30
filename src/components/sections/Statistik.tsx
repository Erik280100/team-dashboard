// Statistik-Sektion — neue Seite, die abgeschlossene Monate (Monats-Archiv,
// siehe useMonthArchive.ts) über einen frei wählbaren Zeitraum vergleicht:
// Team-Trend, A/B-Monatsvergleich, Mitarbeiter-Entwicklung, Karriereplan-
// Aufteilung. Trend/Vergleich/Split rechnen allein auf dem Archiv-Index
// (keine Snapshot-Loads); nur die Mitarbeiter-Matrix/-Kurve brauchen die
// vollen Monats-Snapshots und werden lazy nachgeladen.
import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { DARK_CARD } from "@/lib/chartSetup"
import { employeeMatrix, monthsInRange, planSplit, teamTrend } from "@/lib/calc/statistik"
import type { UseMonthArchiveResult } from "@/hooks/useMonthArchive"
import type { MonthKey, MonthSnapshot } from "@/types/archive"
import { MonthRangePicker } from "@/components/sections/statistik/MonthRangePicker"
import { TeamTrendChart } from "@/components/sections/statistik/TeamTrendChart"
import { MonthCompare } from "@/components/sections/statistik/MonthCompare"
import { EmployeeMatrix } from "@/components/sections/statistik/EmployeeMatrix"
import { EmployeeCurve } from "@/components/sections/statistik/EmployeeCurve"
import { PlanSplitChart } from "@/components/sections/statistik/PlanSplitChart"

function EmptyCard({ title, text }: { title: string; text: string }) {
  return (
    <Card className={DARK_CARD}>
      <CardContent className="py-8 text-center text-sm text-white/60">
        <div className="mb-1 font-semibold text-white/80">{title}</div>
        {text}
      </CardContent>
    </Card>
  )
}

export function Statistik({ archive }: { archive: UseMonthArchiveResult }) {
  const { index } = archive // aufsteigend nach Monat sortiert

  const [from, setFrom] = useState<MonthKey | null>(null)
  const [to, setTo] = useState<MonthKey | null>(null)
  const [monthA, setMonthA] = useState<MonthKey | null>(null)
  const [monthB, setMonthB] = useState<MonthKey | null>(null)
  const [selectedName, setSelectedName] = useState<string | null>(null)

  // Default-Zeitraum: die letzten bis zu 6 abgeschlossenen Monate.
  const effectiveTo = to ?? index.at(-1)?.month ?? null
  const effectiveFrom = from ?? index[Math.max(0, index.length - 6)]?.month ?? null
  const rangeEntries = useMemo(
    () => (effectiveFrom && effectiveTo ? monthsInRange(index, effectiveFrom, effectiveTo) : []),
    [index, effectiveFrom, effectiveTo]
  )
  const rangeMonths = useMemo(() => rangeEntries.map((e) => e.month), [rangeEntries])

  // Default A/B: die letzten beiden abgeschlossenen Monate.
  const effectiveA = monthA ?? index.at(-2)?.month ?? index.at(-1)?.month ?? null
  const effectiveB = monthB ?? index.at(-1)?.month ?? null
  const entryA = effectiveA ? index.find((e) => e.month === effectiveA) ?? null : null
  const entryB = effectiveB ? index.find((e) => e.month === effectiveB) ?? null : null

  useEffect(() => {
    if (rangeMonths.length > 0) void archive.loadSnapshots(rangeMonths)
  }, [rangeMonths, archive])

  const snapshots = rangeMonths
    .map((m) => archive.getSnapshot(m))
    .filter((s): s is MonthSnapshot => s !== null)
  const matrixLoading = snapshots.length < rangeMonths.length
  const matrix = useMemo(
    () => (rangeMonths.length > 0 && !matrixLoading ? employeeMatrix(snapshots) : []),
    [rangeMonths.length, matrixLoading, snapshots]
  )
  const selectedSeries = selectedName ? matrix.find((e) => e.name === selectedName) ?? null : null

  const trend = useMemo(() => teamTrend(rangeEntries), [rangeEntries])
  const split = useMemo(() => planSplit(rangeEntries), [rangeEntries])

  if (index.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h2 className="text-lg font-semibold">Statistik</h2>
        <EmptyCard
          title="Noch keine abgeschlossenen Monate"
          text='Sobald ein Monat über "Monat abschließen" archiviert wurde, erscheinen hier Verlauf und Vergleich.'
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Statistik</h2>
        {effectiveFrom && effectiveTo && (
          <MonthRangePicker
            index={index}
            from={effectiveFrom}
            to={effectiveTo}
            onChange={(f, t) => { setFrom(f); setTo(t) }}
          />
        )}
      </div>

      {trend.length > 0 ? (
        <TeamTrendChart points={trend} />
      ) : (
        <EmptyCard title="Team-Trend" text="Für den gewählten Zeitraum sind keine abgeschlossenen Monate vorhanden." />
      )}

      {index.length >= 2 && entryA && entryB ? (
        <MonthCompare
          index={index}
          monthA={effectiveA!}
          monthB={effectiveB!}
          onChangeA={setMonthA}
          onChangeB={setMonthB}
          entryA={entryA}
          entryB={entryB}
        />
      ) : (
        <EmptyCard title="Monatsvergleich" text="Für den Vergleich werden mindestens zwei abgeschlossene Monate benötigt." />
      )}

      {split.length > 0 ? (
        <PlanSplitChart points={split} />
      ) : (
        <EmptyCard title="Karriereplan-Aufteilung" text="Für den gewählten Zeitraum sind keine abgeschlossenen Monate vorhanden." />
      )}

      <EmployeeMatrix
        months={rangeEntries}
        series={matrix}
        loading={matrixLoading}
        loaded={snapshots.length}
        total={rangeMonths.length}
        selectedName={selectedName}
        onSelect={setSelectedName}
      />

      <EmployeeCurve series={selectedSeries} />
    </div>
  )
}
