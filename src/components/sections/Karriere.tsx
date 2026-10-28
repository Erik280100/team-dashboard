// Karrierepläne: Die Pläne liegen in org/careerPlans (siehe useCareerPlansDoc), der Zugang ist der Login.
import { useState } from "react"
import DOMPurify from "dompurify"
import { Card, CardContent } from "@/components/ui/card"
import { PillTabs } from "@/components/ui/dark"
import { useCareerPlansDoc } from "@/hooks/useCareerPlansDoc"
import { MeinKarrierestand } from "@/components/sections/karriere/MeinKarrierestand"
import type { MergedRow } from "@/lib/calc/team"
import type { PlanId } from "@/lib/calc/struktur"

/** Macht aus den Stufen-Karten Kacheln mit großem Tarif und Kriterien-Chips:
 * "€4,– / EH · ab 6 000 EH + Gewerbe" -> Tarif "€4,–" (/ EH) + Chips je " + "-Teil.
 * Ohne "€…/EH"-Anfang bleibt der Text unverändert. Zusätzlich Farbklasse je Label. */
function enhanceStages(html: string): string {
  return html.replace(
    /<div class="career-stage"><div class="stage-label">([^<]*)<\/div>([\s\S]*?)<div class="stage-desc">([^<]*)<\/div><\/div>/g,
    (_full, label: string, mid: string, desc: string) => {
      const cls = /führung/i.test(label) ? " is-fuehrung" : /start|basis/i.test(label) ? " is-start" : ""
      const [rateRaw, ...rest] = desc.split(" · ")
      const rate = rateRaw.match(/^(€[^/]*?)\s*\/\s*(\S+)$/)
      if (!rate) {
        return `<div class="career-stage${cls}"><div class="stage-label">${label}</div>${mid}<div class="stage-desc">${desc}</div></div>`
      }
      const chips = rest.join(" · ").split(" + ").map((s) => s.trim()).filter(Boolean)
        .map((c) => `<div class="stage-chip">${c}</div>`).join("")
      return (
        `<div class="career-stage${cls}"><div class="stage-label">${label}</div>${mid}` +
        `<div class="stage-rate">${rate[1]}<small>/ ${rate[2]}</small></div>` +
        (chips ? `<div class="stage-crit">${chips}</div>` : "") +
        `</div>`
      )
    }
  )
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/** Tarif-Tabellen (Kopfzeile "Stufe", Zellen mit "€…/EH") werden zu denselben
 * Stufen-Kacheln wie oben: Titel = Stufe, je € -Spalte eine Tarif-Zeile mit
 * Spaltenüberschrift, Rest (Voraussetzung) als Chips. Andere Tabellen bleiben. */
function enhanceTables(html: string): string {
  if (typeof DOMParser === "undefined") return html
  const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, "text/html")
  doc.querySelectorAll("table").forEach((table) => {
    const rows = [...table.querySelectorAll("tr")]
    const head = [...(rows[0]?.querySelectorAll("th") ?? [])].map((th) => th.textContent?.trim() ?? "")
    const body = rows.slice(1).map((tr) => [...tr.querySelectorAll("td")])
    if (head[0] !== "Stufe" || !body.some((r) => r.some((td) => td.textContent?.trim().startsWith("€")))) return
    const führung = !head.includes("Voraussetzung")
    const cards = body.map((tds) => {
      const title = esc(tds[0]?.textContent?.trim() ?? "")
      let col = 1
      let rates = ""
      let crit = ""
      tds.slice(1).forEach((td) => {
        const text = td.textContent?.trim() ?? ""
        const span = Number(td.getAttribute("colspan") || 1)
        const label = span > 1 ? "" : head[col] ?? ""
        col += span
        if (text.startsWith("€")) {
          const [money, unit] = text.split("/")
          rates += `<div class="stage-rate">${esc(money)}<small>/ ${esc(unit ?? "EH")}${label ? " · " + esc(label) : ""}</small></div>`
        } else if (text) {
          crit += text.split(" + ").map((c) => `<div class="stage-chip">${esc(c.trim())}</div>`).join("")
        }
      })
      const lbl = führung ? "Führung" : /^financial trainee/i.test(title) ? "Trainee" : /abwickler/i.test(title) ? "Abwickler" : "Beförderung"
      const cls = führung ? " is-fuehrung" : lbl === "Trainee" ? " is-start" : ""
      return `<div class="career-stage${cls}"><div class="stage-label">${lbl}</div><div class="stage-title">${title}</div>${rates}${crit ? `<div class="stage-crit">${crit}</div>` : ""}</div>`
    })
    const grid = doc.createElement("div")
    grid.className = "career-stage-grid"
    grid.innerHTML = cards.join("")
    table.replaceWith(grid)
  })
  return doc.getElementById("r")!.innerHTML
}

function KarrierePlaene() {
  const cloud = useCareerPlansDoc()
  const [active, setActive] = useState(0)

  if (cloud.status === "loading") {
    return <div className="text-sm text-muted-foreground">Karrierepläne werden geladen…</div>
  }
  if (cloud.status === "missing" || cloud.status === "error") {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col gap-2 text-sm">
          <h2 className="text-lg font-semibold">Karrierepläne</h2>
          {cloud.status === "error"
            ? "Die Karrierepläne konnten nicht geladen werden. Bitte Seite neu laden."
            : "Die Karrierepläne sind noch nicht freigeschaltet. Bitte den Admin informieren."}
        </CardContent>
      </Card>
    )
  }

  const plans = cloud.plans
  const plan = plans[active]

  return (
    <div className="flex flex-col gap-4">
      <PillTabs
        tabs={plans.map((p, i) => ({ id: String(i), label: p.title }))}
        value={String(active)}
        onChange={(id) => setActive(Number(id))}
      />
      <Card>
        <CardContent>
          <div
            className="career-plan career-tiles"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(enhanceTables(enhanceStages(plan.html))) }}
          />
        </CardContent>
      </Card>
    </div>
  )
}

interface KarriereProps {
  merged: MergedRow[]
  planRates: Record<PlanId, Record<string, number>>
  myName?: string
}

/** Reiter "Mein Karrierestand" (persönlich) und die Karrierepläne. */
export function Karriere({ merged, planRates, myName }: KarriereProps) {
  const [tab, setTab] = useState<"me" | "plans">("me")
  const tabs = [{ id: "me", label: "Mein Karrierestand" }, { id: "plans", label: "Karrierepläne" }] as const
  return (
    <div className="flex flex-col gap-4">
      <PillTabs tabs={[...tabs]} value={tab} onChange={setTab} />
      {tab === "me" ? <MeinKarrierestand merged={merged} planRates={planRates} myName={myName} /> : <KarrierePlaene />}
    </div>
  )
}
