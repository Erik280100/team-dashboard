// Karrierepläne — Äquivalent zu initCareerPlans() aus legacy/index.html:4039–4081.
// Inhalte sind clientseitig AES-GCM-verschlüsselt (siehe src/lib/data/career.ts) —
// dasselbe Passwort wie in der Legacy-App schaltet dieselben Inhalte frei.
import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { decryptCareerPlans, type CareerPlan } from "@/lib/data/career"

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

export function Karriere() {
  const [plans, setPlans] = useState<CareerPlan[] | null>(null)
  const [active, setActive] = useState(0)
  const [password, setPassword] = useState("")
  const [error, setError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!password) return
    setSubmitting(true)
    setError(false)
    try {
      const decrypted = await decryptCareerPlans(password)
      setPlans(decrypted)
      setActive(0)
    } catch {
      setError(true)
    } finally {
      setPassword("")
      setSubmitting(false)
    }
  }

  if (!plans) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Karrierepläne</h2>
          <p className="text-sm text-muted-foreground">Dieser Bereich ist passwortgeschützt.</p>
          <form onSubmit={onSubmit} className="flex gap-2">
            <Input
              type="password"
              placeholder="Passwort"
              aria-label="Passwort für Karrierepläne"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" disabled={submitting}>Freischalten</Button>
          </form>
          {error && <div role="alert" className="text-sm text-destructive">Falsches Passwort.</div>}
        </CardContent>
      </Card>
    )
  }

  const plan = plans[active]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {plans.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              active === i
                ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {p.title}
          </button>
        ))}
      </div>
      <Card>
        <CardContent>
          <div
            className="career-plan career-tiles"
            dangerouslySetInnerHTML={{ __html: enhanceTables(enhanceStages(plan.html)) }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
