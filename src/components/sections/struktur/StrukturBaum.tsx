// Strukturbaum (Org-Chart-Editor) — Äquivalent zu initOrgChart()/sbRender()/
// Drag&Drop/Linienmodus/Seitenpanel/Dialogen aus legacy/index.html:4113–4785.
// Layout- und Traversierungs-Logik (sbLayout/sbAll/sbFind/sbLine/sbEsc) kommt
// aus src/lib/calc/struktur.ts (golden-master-getestet); die interaktiven
// Mutationen (Drag&Drop-Umgliedern, Notizen, Verbindungen, Farben/Status)
// sind hier lokal implementiert und im Browser gegen die Legacy-App verifiziert.
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { useConfirm } from "@/hooks/useConfirm"
import { computePromotionProgress, type PromotionProgress } from "@/lib/calc/befoerderung"
import { fmt, type EmployeeRow } from "@/lib/calc/format"
import {
  DEFAULT_PLAN_RATES, PLAN_IDS, PLAN_LABELS,
  SB_COLORS, SB_NH, SB_NW, SB_ROLES, SB_STATUS, SB_VG,
  sbAll, sbEsc, sbFind, sbLayout, sbLine, sbRoster,
  type PlanId, type SbNode,
} from "@/lib/calc/struktur"
import { mergeRosterWithRows } from "@/lib/calc/team"
import type { OrgChartDoc } from "@/types/dashboard"
import { cn } from "@/lib/utils"

/** Statischer Inhalt für den "Karriereplan"-Dialog (Vorlage vom Nutzer, Kategorien A/B/C). */
const KARRIEREPLAN_COLUMNS: {
  key: string
  title: string
  /** SB_COLORS-Key — dieselbe Farbe wie im Strukturbaum/der Legende. */
  sbColorKey: string
  rows: { label: string; value: string }[]
  gegenleistung: { label: string; value: string }[]
}[] = [
  {
    key: "A",
    title: "A werdende Führungskraft",
    sbColorKey: "green",
    rows: [
      { label: "EH", value: "500 EH / Monat" },
      { label: "ET", value: "3 / Monat" },
      { label: "Erreichbarkeit", value: "Selbstverständlich für alle" },
      { label: "Seminar/Training", value: "100% Anwesenheit" },
      { label: "Termine", value: "Am Freitag muss immer Wochenplan mit Monatsplan übereinstimmen" },
    ],
    gegenleistung: [
      { label: "PG", value: "1h pro Woche" },
      { label: "Freizeit", value: "Jederzeit mit FKs bei Partys und Freizeitaktivitäten" },
    ],
  },
  {
    key: "B",
    title: "B Mitarbeiter",
    sbColorKey: "blue",
    rows: [
      { label: "EH", value: "350 EH / Monat" },
      { label: "ET", value: "1 / Monat" },
      { label: "Erreichbarkeit", value: "Selbstverständlich für alle" },
      { label: "Seminar/Training", value: "80% Anwesenheit" },
      { label: "Termine", value: "Wöchentliche Zielerreichungshilfestellung" },
    ],
    gegenleistung: [
      { label: "PG", value: "30min pro Woche" },
      { label: "Freizeit", value: "Wird bei Zielerfüllung eingeladen" },
    ],
  },
  {
    key: "C",
    title: "C Nebenverdiener",
    sbColorKey: "purple",
    rows: [
      { label: "EH", value: "500 EH / Quartal" },
      { label: "ET", value: "Eigeninitiative" },
      { label: "Erreichbarkeit", value: "Selbstverständlich für alle" },
      { label: "Seminar/Training", value: "Ja/Nein" },
      { label: "Termine", value: "MA muss eigenständig schauen, dass er seinen Aktivstatus hält" },
    ],
    gegenleistung: [
      { label: "PG", value: "1x pro Monat" },
      { label: "Freizeit", value: "Wird eingeladen bei Aufstieg zu B" },
    ],
  },
]

/** Bedeutung ausgewählter Knotenfarben, als Legende neben der Überschrift angezeigt. */
const SB_COLOR_LEGEND: { key: string; text: string }[] = [
  { key: "green", text: "A werdende Führungskraft" },
  { key: "blue", text: "B Mitarbeiter" },
  { key: "purple", text: "C Nebenverdiener" },
]

const CRITERION_UNIT: Record<string, string> = {
  eigenproduktion: "EH",
  mitarbeiter: "Mitarbeiter",
  punkte: "Punkte",
  gruppenproduktion: "EH/Monat",
}

const PAGE_TABS: { id: "baum" | "karriereplan"; label: string }[] = [
  { id: "baum", label: "Team Strukturbaum" },
  { id: "karriereplan", label: "Karriereplan" },
]

/** Pill-Tab wie die Rechner-Tabs in Rechner.tsx. */
function pageTabClass(active: boolean): string {
  return cn(
    "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
    active
      ? "border-transparent bg-primary text-primary-foreground shadow-sm"
      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
  )
}

/** Kompakter Tooltip-Text für den Fortschrittsstreifen am Knoten (title-Attribut). */
function promotionTooltip(p: PromotionProgress | undefined): string | undefined {
  if (!p || !p.nextRole) return undefined
  const open = p.criteria.filter((c) => c.missing > 0)
  if (open.length === 0) return `✓ Bereit für ${p.nextRole}`
  const parts = open.map((c) => `noch ${fmt(c.missing)} ${CRITERION_UNIT[c.kind] ?? ""}`.trim())
  return `→ ${p.nextRole}: ${parts.join(", ")}`
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}
function newNodeId(): string {
  return "n" + Math.random().toString(36).slice(2, 9) + "_" + Date.now()
}
function removeNode(n: SbNode, id: string): void {
  n.children = (n.children || []).filter((c) => c.id !== id)
  n.children.forEach((c) => removeNode(c, id))
}
function detachNode(root: SbNode, id: string): SbNode | null {
  const n = sbFind(root, id)
  if (!n) return null
  const copy = deepClone(n)
  removeNode(root, id)
  return copy
}

export function StrukturBaum({
  doc, rows, isEditor, saveOrgChart,
}: {
  doc: OrgChartDoc
  /** Leistungszahlen (Einheiten je Karriereplan) für den Beförderungs-Fortschritt,
   * siehe lib/calc/befoerderung.ts — live dashboard.rows oder ein Archiv-Snapshot. */
  rows: EmployeeRow[]
  isEditor: boolean
  saveOrgChart: (next: OrgChartDoc) => void
}) {
  const confirm = useConfirm()
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<HTMLDivElement>(null)

  const [page, setPage] = useState<"baum" | "karriereplan">("baum")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState("")
  const [roleDraft, setRoleDraft] = useState("")
  const [colorDraft, setColorDraft] = useState<string | null>(null)
  const [color2Draft, setColor2Draft] = useState<string | null>(null)
  const [statusDraft, setStatusDraft] = useState("")
  const [noteDraft, setNoteDraft] = useState("")
  const [linkMode, setLinkMode] = useState(false)
  const [linkSrc, setLinkSrc] = useState<string | null>(null)
  const [ratesOpen, setRatesOpen] = useState(false)
  const [ratesDraft, setRatesDraft] = useState<Record<PlanId, Record<string, string>>>(
    {} as Record<PlanId, Record<string, string>>
  )
  const [fullscreen, setFullscreen] = useState(false)
  const [scale, setScale] = useState(1)

  const [dialog, setDialog] = useState<
    | { kind: "add-child"; parentId: string }
    | { kind: "add-conn"; from: string; to: string }
    | null
  >(null)
  const [dlgName, setDlgName] = useState("")
  const [dlgRole, setDlgRole] = useState("")
  const [dlgStatus, setDlgStatus] = useState("")
  const [dlgLabel, setDlgLabel] = useState("")

  const dragRef = useRef<{
    nodeId: string
    active: boolean
    startX: number
    startY: number
    x: number
    y: number
    targetId: string | null
  } | null>(null)
  const [dragTick, setDragTick] = useState(0) // erzwingt Re-Render während des Drags

  // ---- Layout (auf einer Render-Kopie, damit x/y/d nicht im Dokument landen) ----
  const laidOutTree = useMemo(() => {
    const copy = deepClone(doc.tree)
    sbLayout(copy, 0, 0, 0)
    return copy
  }, [doc.tree])

  const nodes = useMemo(() => sbAll(laidOutTree), [laidOutTree])
  const nodeMap = useMemo(() => {
    const m: Record<string, SbNode> = {}
    nodes.forEach((n) => (m[n.id] = n))
    return m
  }, [nodes])

  // Beförderungs-Fortschritt je Person, für Streifen am Knoten + Panel-Block.
  // Läuft über den unveränderten doc.tree (nicht laidOutTree), Layout ist hier egal.
  const roster = useMemo(() => sbRoster(doc.tree), [doc.tree])
  const merged = useMemo(() => mergeRosterWithRows(roster, rows), [roster, rows])
  const promotionByName = useMemo(() => computePromotionProgress(merged), [merged])

  const chartW = Math.max(...nodes.map((n) => (n.x ?? 0) + SB_NW)) + 70
  const chartH = Math.max(...nodes.map((n) => (n.y ?? 0) + SB_NH)) + 70

  const selected = selectedId ? nodeMap[selectedId] : null

  // ---- Auto-Fit-Skalierung (Baum passt komplett in die sichtbare Fläche) ----
  useEffect(() => {
    function applyFit() {
      const scrollEl = scrollRef.current
      if (!scrollEl || !chartW || !chartH) return
      const availW = Math.max(100, scrollEl.clientWidth - 100)
      const availH = Math.max(100, scrollEl.clientHeight - 100)
      let s = Math.min(1, availW / chartW, availH / chartH)
      s = Math.max(s, 0.4)
      setScale(s)
    }
    applyFit()
    window.addEventListener("resize", applyFit)
    return () => window.removeEventListener("resize", applyFit)
  }, [chartW, chartH])

  // ---- Fullscreen ----
  useEffect(() => {
    function onChange() {
      setFullscreen(!!(document.fullscreenElement))
    }
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      rootRef.current?.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
  }

  function persist(patch: Partial<OrgChartDoc>) {
    saveOrgChart({ ...doc, ...patch })
  }

  function selectNode(n: SbNode) {
    setSelectedId(n.id)
    setNameDraft(n.name)
    setRoleDraft(n.role || "")
    setColorDraft(n.color ?? null)
    setColor2Draft(n.color2 ?? null)
    setStatusDraft(n.status || "")
    setNoteDraft("")
  }
  function closePanel() {
    setSelectedId(null)
  }

  // ---- Drag & Drop (Umgliedern) ----
  const onNodePointerDown = useCallback(
    (e: React.PointerEvent, n: SbNode) => {
      if (!isEditor || linkMode || n.id === doc.tree.id) return
      dragRef.current = { nodeId: n.id, active: false, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, targetId: null }
      closePanel()
    },
    [isEditor, linkMode, doc.tree.id]
  )

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const d = dragRef.current
      if (!d) return
      const dx = e.clientX - d.startX
      const dy = e.clientY - d.startY
      if (!d.active && Math.sqrt(dx * dx + dy * dy) > 6) d.active = true
      d.x = e.clientX
      d.y = e.clientY
      if (d.active) {
        const el = document.elementFromPoint(e.clientX, e.clientY)
        const dragDescendants = new Set(sbAll(nodeMap[d.nodeId] || laidOutTree).map((n) => n.id))
        let targetId: string | null = null
        const nd = el?.closest<HTMLElement>("[data-sb-node]")
        if (nd) {
          const tid = nd.dataset.sbNode!
          if (!dragDescendants.has(tid) && tid !== d.nodeId) targetId = tid
        }
        d.targetId = targetId
        setDragTick((t) => t + 1)
      }
    }
    function onUp() {
      const d = dragRef.current
      if (d?.active && d.targetId) {
        const next = deepClone(doc.tree)
        const stripLayout = (n: SbNode) => { delete n.x; delete n.y; delete n.d; (n.children || []).forEach(stripLayout) }
        const moved = detachNode(next, d.nodeId)
        const newParent = sbFind(next, d.targetId)
        if (moved && newParent) {
          stripLayout(moved)
          newParent.children = newParent.children || []
          newParent.children.push(moved)
          persist({ tree: next })
        }
      }
      dragRef.current = null
      setDragTick((t) => t + 1)
    }
    document.addEventListener("pointermove", onMove)
    document.addEventListener("pointerup", onUp)
    return () => {
      document.removeEventListener("pointermove", onMove)
      document.removeEventListener("pointerup", onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.tree, nodeMap, laidOutTree])

  function onNodeClick(n: SbNode) {
    if (dragRef.current?.active) return
    if (linkMode) {
      onLinkClick(n)
      return
    }
    selectNode(n)
  }

  // ---- Linienmodus ----
  function toggleLinkMode() {
    if (!isEditor) return
    setLinkMode((v) => !v)
    setLinkSrc(null)
    closePanel()
  }
  function onLinkClick(n: SbNode) {
    if (!linkSrc) {
      setLinkSrc(n.id)
    } else if (linkSrc === n.id) {
      setLinkSrc(null)
    } else {
      setDlgLabel("")
      setDialog({ kind: "add-conn", from: linkSrc, to: n.id })
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (linkMode) toggleLinkMode()
        closePanel()
        setDialog(null)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkMode])

  // ---- Dialog: Person hinzufügen / Verbindung benennen ----
  function submitDialog() {
    if (!dialog) return
    if (dialog.kind === "add-child") {
      const name = dlgName.trim()
      if (!name) { alert("Bitte einen Namen eingeben."); return }
      if (!dlgStatus) { alert("Bitte einen Status wählen."); return }
      const next = deepClone(doc.tree)
      const parent = sbFind(next, dialog.parentId)
      if (parent) {
        parent.children = parent.children || []
        parent.children.push({ id: newNodeId(), name, role: dlgRole.trim() || "Mitarbeiter", status: dlgStatus, children: [] })
        persist({ tree: next })
      }
    } else {
      const conns = [...doc.conns, { from: dialog.from, to: dialog.to, label: dlgLabel.trim() }]
      persist({ conns })
      setLinkSrc(null)
    }
    setDialog(null)
  }

  async function deleteConn(idx: number) {
    if (!isEditor) return
    if (!(await confirm("Verbindung löschen?"))) return
    const conns = doc.conns.filter((_, i) => i !== idx)
    persist({ conns })
  }

  async function deleteNode(id: string) {
    if (!isEditor) return
    const n = sbFind(doc.tree, id)
    if (!n) return
    const cnt = sbAll(n).length - 1
    const msg = cnt ? `"${n.name}" und ${cnt} untergeordnete Person${cnt === 1 ? "" : "en"} löschen?` : `"${n.name}" löschen?`
    if (!(await confirm(msg))) return
    const next = deepClone(doc.tree)
    removeNode(next, id)
    const conns = doc.conns.filter((c) => c.from !== id && c.to !== id)
    persist({ tree: next, conns })
    closePanel()
  }

  // Name, Rolle, Farbe und Status hängen an einem gemeinsamen "Speichern"-Button —
  // nichts davon wird beim Ändern automatisch übernommen (anders als im Original,
  // wo Farbe/Status sofort speicherten; auf Nutzerwunsch vereinheitlicht).
  function saveFields() {
    if (!selectedId || !isEditor) return
    const name = nameDraft.trim()
    if (!name) { alert("Name darf nicht leer sein."); return }
    const next = deepClone(doc.tree)
    const n = sbFind(next, selectedId)
    if (n) {
      n.name = name
      n.role = roleDraft.trim()
      n.color = colorDraft
      n.color2 = color2Draft
      n.status = statusDraft || null
      persist({ tree: next })
    }
  }
  function addNote() {
    if (!isEditor || !selectedId) return
    const text = noteDraft.trim()
    if (!text) return
    const d = new Date()
    const date = d.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }) + " · " + d.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })
    const notes = { ...doc.notes, [selectedId]: [{ text, date }, ...(doc.notes[selectedId] || [])] }
    persist({ notes })
    setNoteDraft("")
  }
  function deleteNote(i: number) {
    if (!isEditor || !selectedId) return
    const list = [...(doc.notes[selectedId] || [])]
    list.splice(i, 1)
    persist({ notes: { ...doc.notes, [selectedId]: list } })
  }

  function draftFromPlanRates(planRates: Record<PlanId, Record<string, number>>): Record<PlanId, Record<string, string>> {
    const draft = {} as Record<PlanId, Record<string, string>>
    PLAN_IDS.forEach((planId) => {
      draft[planId] = {}
      SB_ROLES.forEach((r) => {
        const v = planRates[planId]?.[r]
        draft[planId][r] = v != null ? String(v) : ""
      })
    })
    return draft
  }
  function openRates() {
    if (!isEditor) return
    setRatesDraft(draftFromPlanRates(doc.planRates ?? DEFAULT_PLAN_RATES))
    setRatesOpen(true)
  }
  function resetRatesToDefaults() {
    setRatesDraft(draftFromPlanRates(DEFAULT_PLAN_RATES))
  }
  function saveRates() {
    const planRates = {} as Record<PlanId, Record<string, number>>
    PLAN_IDS.forEach((planId) => {
      planRates[planId] = {}
      SB_ROLES.forEach((r) => {
        const v = parseFloat(ratesDraft[planId]?.[r])
        if (v > 0) planRates[planId][r] = v
      })
    })
    // Legacy-Spiegel: das alte `rates`-Feld (nur Insurance) bleibt für
    // legacy/index.html gepflegt, siehe OrgChartDoc.rates-Kommentar.
    persist({ rates: planRates.insurance, planRates })
    setRatesOpen(false)
  }

  function openAddChild(parentId: string) {
    setDlgName("")
    setDlgRole("")
    setDlgStatus("")
    setDialog({ kind: "add-child", parentId })
  }

  // ---- SVG-Linien ----
  const svgMarkup = useMemo(() => {
    let s = ""
    nodes.forEach((n) => {
      if (!n.children || !n.children.length) return
      const px = (n.x ?? 0) + SB_NW / 2, py = (n.y ?? 0) + SB_NH, my = py + SB_VG / 2
      const LC = "#c2cce0", LW = 2
      s += sbLine(px, py, px, my, LC, LW)
      if (n.children.length === 1) {
        const c = n.children[0], cx = (c.x ?? 0) + SB_NW / 2
        if (Math.abs(cx - px) > 1) s += sbLine(px, my, cx, my, LC, LW)
        s += sbLine(cx, my, cx, c.y ?? 0, LC, LW)
      } else {
        const lx = (n.children[0].x ?? 0) + SB_NW / 2, rx = (n.children[n.children.length - 1].x ?? 0) + SB_NW / 2
        s += sbLine(lx, my, rx, my, LC, LW)
        n.children.forEach((c) => { const cx = (c.x ?? 0) + SB_NW / 2; s += sbLine(cx, my, cx, c.y ?? 0, LC, LW) })
      }
    })
    ;doc.conns.forEach((c) => {
      const a = nodeMap[c.from], b = nodeMap[c.to]
      if (!a || !b) return
      const x1 = (a.x ?? 0) + SB_NW / 2, y1 = (a.y ?? 0) + SB_NH / 2, x2 = (b.x ?? 0) + SB_NW / 2, y2 = (b.y ?? 0) + SB_NH / 2
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
      s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#7c6bcc" stroke-width="2.5" stroke-dasharray="7 4" stroke-linecap="round"/>`
      if (c.label) {
        const tw = c.label.length * 6.5 + 14
        s += `<rect x="${mx - tw / 2}" y="${my - 11.5}" width="${tw}" height="17" rx="5" fill="white" stroke="#d4c8ff" stroke-width="1.2"/>`
        s += `<text x="${mx}" y="${my + 2}" text-anchor="middle" font-size="10.5" fill="#7c6bcc" font-weight="700">${sbEsc(c.label)}</text>`
      }
    })
    return s
    // dragTick sorgt für Re-Render bei jedem Pointer-Move (Ghost/Hover-Status),
    // ohne dass die SVG-Linien selbst vom Drag abhängen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, doc.conns, nodeMap])

  const totalPeople = nodes.length
  const totalNotes = Object.values(doc.notes).reduce((s, a) => s + a.length, 0)
  const drag = dragRef.current
  void dragTick

  const selectedPromotion = selected ? promotionByName.get(selected.name) : undefined

  return (
    <div ref={rootRef} className="flex flex-col gap-4 bg-background p-1">
      <div className="flex flex-wrap gap-2">
        {PAGE_TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setPage(t.id)} className={pageTabClass(page === t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {page === "baum" && (
      <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">Team Strukturbaum</h2>
          <div className="flex flex-wrap gap-1.5">
            {SB_COLOR_LEGEND.map((l) => {
              const c = SB_COLORS.find((sc) => sc.key === l.key)
              if (!c) return null
              return (
                <div
                  key={l.key}
                  className="flex max-w-[120px] items-center justify-center rounded-lg px-2 py-1.5 text-center text-[10px] font-medium leading-tight shadow-sm"
                  style={{ background: c.hex, color: c.text }}
                >
                  {l.text}
                </div>
              )
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{totalPeople} Mitarbeiter erfasst</span>
          {totalNotes > 0 && <span>{totalNotes} Notiz{totalNotes === 1 ? "" : "en"}</span>}
          {isEditor && (
            <Button size="sm" variant={linkMode ? "default" : "ghost"} onClick={toggleLinkMode}>
              🔗 Linie hinzufügen
            </Button>
          )}
          {isEditor && <Button size="sm" variant="ghost" onClick={openRates}>💶 Stufensätze</Button>}
          <Button size="sm" variant="ghost" onClick={toggleFullscreen}>
            {fullscreen ? "⤢ Vollbild beenden" : "⛶ Vollbild"}
          </Button>
        </div>
      </div>

      {!fullscreen && (
        <p className="text-xs text-muted-foreground">
          Klicke auf eine Person für Details &amp; Notizen. Ziehe eine Person auf eine andere, um sie dort einzugliedern.
        </p>
      )}

      {linkMode && (
        <div className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs font-medium text-primary">
          {linkSrc
            ? `"${nodeMap[linkSrc]?.name}" ausgewählt → klicke jetzt die zweite Person`
            : "Linienmodus aktiv — klicke Person 1, dann Person 2. ESC zum Beenden."}
        </div>
      )}

      <div ref={scrollRef} className="relative h-[600px] overflow-auto rounded-lg border bg-muted/20">
        <div style={{ width: chartW * scale, height: chartH * scale }}>
          <div
            ref={chartRef}
            className="relative origin-top-left"
            style={{ width: chartW, height: chartH, transform: `scale(${scale})` }}
          >
            <svg
              width={chartW}
              height={chartH}
              viewBox={`0 0 ${chartW} ${chartH}`}
              className="absolute inset-0"
              dangerouslySetInnerHTML={{ __html: svgMarkup }}
            />
            {nodes.map((n) => {
              const colorDef = n.color ? SB_COLORS.find((c) => c.key === n.color) : null
              const colorDef2 = n.color2 ? SB_COLORS.find((c) => c.key === n.color2) : null
              const nodeBackground =
                colorDef && colorDef2
                  ? `linear-gradient(to right, ${colorDef.hex} 50%, ${colorDef2.hex} 50%)`
                  : (colorDef ?? colorDef2)?.hex
              const nodeTextColor = (colorDef ?? colorDef2)?.text
              const statusDef = n.status ? SB_STATUS[n.status] : null
              const isDropTarget = drag?.active && drag.targetId === n.id
              const isDragging = drag?.active && drag.nodeId === n.id
              const noteCount = (doc.notes[n.id] || []).length
              const promotion = promotionByName.get(n.name)
              return (
                <div
                  key={n.id}
                  data-sb-node={n.id}
                  title={promotionTooltip(promotion)}
                  onPointerDown={(e) => onNodePointerDown(e, n)}
                  onClick={() => onNodeClick(n)}
                  className={cn(
                    "absolute flex cursor-pointer select-none flex-col items-center justify-center rounded-lg border px-2 text-center shadow-sm transition-shadow hover:shadow-md",
                    isDragging && "opacity-40",
                    isDropTarget && "ring-2 ring-primary",
                    linkMode && linkSrc === n.id && "ring-2 ring-amber-500"
                  )}
                  style={{
                    left: n.x, top: n.y, width: SB_NW, height: SB_NH,
                    background: nodeBackground, color: nodeTextColor,
                    borderColor: nodeBackground ? "transparent" : undefined,
                  }}
                >
                  <span className="truncate text-[12px] font-semibold leading-tight">{n.name}</span>
                  {n.role && <span className="truncate text-[10px] leading-tight opacity-80">{n.role}</span>}
                  {promotion?.nextRole && (
                    <span className="absolute inset-x-0 bottom-0 h-1 bg-black/10">
                      <span
                        className={cn("block h-full", promotion.ready ? "bg-emerald-500" : "bg-primary")}
                        style={{ width: `${Math.round(promotion.fraction * 100)}%` }}
                      />
                    </span>
                  )}
                  {noteCount > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                      {noteCount}
                    </span>
                  )}
                  {statusDef && (
                    <span
                      className="absolute -bottom-1.5 rounded-full px-1.5 py-0.5 text-[8px] font-semibold text-white"
                      style={{ background: statusDef.color }}
                    >
                      {statusDef.label}
                    </span>
                  )}
                  {isEditor && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openAddChild(n.id) }}
                      className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full border bg-background text-xs font-bold text-foreground shadow-sm hover:bg-muted"
                      aria-label={`Person unter ${n.name} hinzufügen`}
                    >
                      +
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Drag-Ghost */}
      {drag?.active && (
        <div
          className="pointer-events-none fixed z-50 flex flex-col items-center justify-center rounded-lg border bg-background px-2 text-center shadow-lg"
          style={{ left: drag.x - SB_NW / 2, top: drag.y - SB_NH / 2, width: SB_NW, height: SB_NH }}
        >
          <span className="truncate text-[12px] font-semibold">{nodeMap[drag.nodeId]?.name}</span>
          <span className="truncate text-[10px] text-muted-foreground">{nodeMap[drag.nodeId]?.role}</span>
        </div>
      )}

      {/* Seitenpanel */}
      {selected && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={closePanel} />
          <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col overflow-y-auto border-l bg-background p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex size-11 items-center justify-center rounded-full bg-primary/15 text-lg font-bold">
                {selected.name[0]}
              </div>
              <button type="button" onClick={closePanel} aria-label="Schließen" className="rounded-md p-1 text-muted-foreground hover:bg-muted">✕</button>
            </div>

            <label className="mb-3 flex flex-col gap-1 text-xs text-muted-foreground">
              Name
              <Input value={nameDraft} disabled={!isEditor} onChange={(e) => setNameDraft(e.target.value)} />
            </label>
            <label className="mb-3 flex flex-col gap-1 text-xs text-muted-foreground">
              Bezeichnung / Rolle
              <select
                value={roleDraft}
                disabled={!isEditor}
                onChange={(e) => setRoleDraft(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">— keine —</option>
                {SB_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                {roleDraft && !SB_ROLES.includes(roleDraft) && <option value={roleDraft}>{roleDraft}</option>}
              </select>
            </label>
            <div className="mb-4">
              <div className="mb-1.5 text-xs text-muted-foreground">Farbe (linke Hälfte)</div>
              <div className="flex flex-wrap gap-1.5">
                {SB_COLORS.map((c) => (
                  <button
                    key={c.key} type="button" disabled={!isEditor} title={c.label}
                    onClick={() => setColorDraft(c.key)}
                    className={cn("size-6 rounded-full border-2", colorDraft === c.key ? "border-foreground" : "border-transparent")}
                    style={{ background: c.hex }}
                  />
                ))}
                <button
                  type="button" disabled={!isEditor} title="Keine Farbe" onClick={() => setColorDraft(null)}
                  className={cn("flex size-6 items-center justify-center rounded-full border text-xs", !colorDraft && "border-foreground")}
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="mb-4">
              <div className="mb-1.5 text-xs text-muted-foreground">Farbe (rechte Hälfte, optional)</div>
              <div className="flex flex-wrap gap-1.5">
                {SB_COLORS.map((c) => (
                  <button
                    key={c.key} type="button" disabled={!isEditor} title={c.label}
                    onClick={() => setColor2Draft(c.key)}
                    className={cn("size-6 rounded-full border-2", color2Draft === c.key ? "border-foreground" : "border-transparent")}
                    style={{ background: c.hex }}
                  />
                ))}
                <button
                  type="button" disabled={!isEditor} title="Keine zweite Farbe" onClick={() => setColor2Draft(null)}
                  className={cn("flex size-6 items-center justify-center rounded-full border text-xs", !color2Draft && "border-foreground")}
                >
                  ✕
                </button>
              </div>
            </div>

            <label className="mb-4 flex flex-col gap-1 text-xs text-muted-foreground">
              Status
              <select
                value={statusDraft}
                disabled={!isEditor}
                onChange={(e) => setStatusDraft(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">— kein Status —</option>
                {Object.entries(SB_STATUS).map(([key, v]) => <option key={key} value={key}>{v.label}</option>)}
              </select>
            </label>

            {selectedPromotion && (
              <div className="mb-4 rounded-md border bg-muted/30 p-3">
                <div className="mb-2 text-xs font-semibold">
                  {selectedPromotion.nextRole
                    ? <>🎯 Nächste Stufe: {selectedPromotion.nextRole}</>
                    : "🏆 Höchste Stufe erreicht"}
                </div>
                {selectedPromotion.criteria.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {selectedPromotion.criteria.map((c) => {
                      const pct = c.need > 0 ? Math.min(100, Math.round((c.have / c.need) * 100)) : 100
                      const done = c.have >= c.need
                      return (
                        <div key={c.kind}>
                          <div className="mb-0.5 flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">
                              {c.label}
                              {c.relaxed && " (erleichtert)"}
                            </span>
                            <span className="font-medium tabular-nums">
                              {fmt(c.have)} / {fmt(c.need)}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn("h-full rounded-full", done ? "bg-emerald-500" : "bg-primary")}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          {c.sources && c.sources.length > 0 && (
                            <ul className="mt-1 flex flex-col gap-0.5 border-l pl-2">
                              {c.sources.map((s) => (
                                <li
                                  key={s.name}
                                  className={cn(
                                    "flex items-center justify-between text-[10px]",
                                    s.excludedReason ? "text-muted-foreground/70" : "text-muted-foreground"
                                  )}
                                >
                                  <span className="truncate">
                                    {s.name} <span className="opacity-70">({s.role})</span>
                                    {s.excludedReason && <span className="italic"> — {s.excludedReason}</span>}
                                  </span>
                                  <span className="shrink-0 pl-2 tabular-nums">{s.value}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                {selectedPromotion.ready && (
                  <div className="mt-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    ✓ Alle erfassten Kriterien für {selectedPromotion.nextRole} erfüllt
                  </div>
                )}
                {selectedPromotion.nextRole && (
                  <div className="mt-2 text-[10px] leading-snug text-muted-foreground">
                    Gruppenproduktion = Person + gesamter Unterbau, alle Sparten · Ziel/Monat aus
                    dem Quartalsziel des Karriereplans hochgerechnet. Realisierungsquote, Wartezeiten
                    und die Bestätigung durch die Geschäftsführung sind hier nicht geprüft.
                  </div>
                )}
              </div>
            )}

            {isEditor && <Button size="sm" onClick={saveFields} className="mb-4 w-full">Speichern</Button>}

            {isEditor && (
              <div className="mb-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openAddChild(selected.id)}>+ Person hinzufügen</Button>
                {selected.id !== doc.tree.id && (
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => deleteNode(selected.id)}>Löschen</Button>
                )}
              </div>
            )}

            {doc.conns.some((c) => c.from === selected.id || c.to === selected.id) && (
              <div className="mb-4">
                <div className="mb-1.5 text-xs font-semibold">🔗 Verbindungen</div>
                <div className="flex flex-col gap-1.5">
                  {doc.conns.map((c, i) => {
                    if (c.from !== selected.id && c.to !== selected.id) return null
                    const otherId = c.from === selected.id ? c.to : c.from
                    const other = nodeMap[otherId]?.name || otherId
                    const dir = c.from === selected.id ? "→" : "←"
                    return (
                      <div key={i} className="flex items-center justify-between rounded-md border px-2 py-1.5 text-xs">
                        <div>
                          <div className="font-medium">{dir} {other}</div>
                          {c.label && <div className="text-muted-foreground">{c.label}</div>}
                        </div>
                        {isEditor && (
                          <button type="button" onClick={() => deleteConn(i)} className="text-muted-foreground hover:text-destructive">✕</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="mb-2 text-xs font-semibold">📝 Notizen &amp; Ergänzungen</div>
            <div className="mb-4 flex flex-col gap-1.5">
              {(doc.notes[selected.id] || []).length === 0 ? (
                <div className="text-xs text-muted-foreground">Noch keine Einträge vorhanden</div>
              ) : (
                (doc.notes[selected.id] || []).map((nt, i) => (
                  <div key={i} className="flex items-start justify-between gap-2 rounded-md border px-2 py-1.5 text-xs">
                    <div>
                      <div>{nt.text}</div>
                      <div className="text-muted-foreground">{nt.date}</div>
                    </div>
                    {isEditor && (
                      <button type="button" onClick={() => deleteNote(i)} className="text-muted-foreground hover:text-destructive">✕</button>
                    )}
                  </div>
                ))
              )}
            </div>

            {isEditor && (
              <div className="mt-auto flex flex-col gap-2 border-t pt-3">
                <div className="text-xs font-medium">Notiz hinzufügen</div>
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote() }}
                  placeholder="Notiz, Ziel, Feedback, Termin…"
                  className="h-20 rounded-md border border-input bg-background p-2 text-sm"
                />
                <Button size="sm" onClick={addNote}>+ Speichern</Button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Dialog: Person hinzufügen / Verbindung benennen */}
      <Dialog open={!!dialog} onOpenChange={(open) => { if (!open) setDialog(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.kind === "add-child" ? "➕ Person hinzufügen" : "🔗 Neue Verbindung"}</DialogTitle>
            <DialogDescription>
              {dialog?.kind === "add-child"
                ? `Neue Person unter „${nodeMap[dialog.parentId]?.name || ""}"`
                : dialog ? `${nodeMap[dialog.from]?.name} → ${nodeMap[dialog.to]?.name}` : ""}
            </DialogDescription>
          </DialogHeader>
          {dialog?.kind === "add-child" ? (
            <div className="flex flex-col gap-3">
              <Input placeholder="Name" value={dlgName} onChange={(e) => setDlgName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitDialog()} autoFocus />
              <select
                value={dlgRole}
                onChange={(e) => setDlgRole(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Bezeichnung / Rolle wählen…</option>
                {SB_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select
                required
                value={dlgStatus}
                onChange={(e) => setDlgStatus(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Status wählen…</option>
                {Object.entries(SB_STATUS).map(([key, s]) => (
                  <option key={key} value={key}>{s.label}</option>
                ))}
              </select>
            </div>
          ) : (
            <Input
              placeholder='Bezeichnung (optional, z.B. "Mentoring")'
              value={dlgLabel}
              onChange={(e) => setDlgLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitDialog()}
              autoFocus
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Abbrechen</Button>
            <Button onClick={submitDialog}>Hinzufügen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Stufensätze */}
      <Dialog open={ratesOpen} onOpenChange={setRatesOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>💶 Stufensätze</DialogTitle>
            <DialogDescription>
              Euro pro Einheit (EH) je Karrierestufe und Karriereplan — wird auf der Mitarbeiterseite verwendet.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-auto rounded-md border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="sticky top-0 bg-muted/95 text-left text-xs font-semibold text-muted-foreground backdrop-blur">
                  <th className="px-3 py-1.5">Stufe</th>
                  {PLAN_IDS.map((planId) => (
                    <th key={planId} className="px-2 py-1.5 text-right">{PLAN_LABELS[planId]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SB_ROLES.map((r) => (
                  <tr key={r} className="border-t">
                    <td className="px-3 py-1.5 font-medium">{r}</td>
                    {PLAN_IDS.map((planId) => (
                      <td key={planId} className="px-2 py-1.5 text-right">
                        <input
                          type="number" step={0.01} min={0} placeholder="0,00"
                          aria-label={`${PLAN_LABELS[planId]} – ${r}`}
                          value={ratesDraft[planId]?.[r] ?? ""}
                          onChange={(e) =>
                            setRatesDraft((s) => ({
                              ...s,
                              [planId]: { ...s[planId], [r]: e.target.value },
                            }))
                          }
                          className="h-8 w-20 rounded-md border border-input bg-background px-2 text-right text-sm"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button variant="ghost" size="sm" onClick={resetRatesToDefaults} className="text-muted-foreground">
              Auf Karriereplan-Werte zurücksetzen
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setRatesOpen(false)}>Abbrechen</Button>
              <Button onClick={saveRates}>Speichern</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      </>
      )}

      {page === "karriereplan" && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Karriereplan</h2>
          <p className="text-xs text-muted-foreground">
            Kategorien A, B und C — Erwartungen und Gegenleistung der Führungskraft im Überblick.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {KARRIEREPLAN_COLUMNS.map((col) => {
              const c = SB_COLORS.find((sc) => sc.key === col.sbColorKey)
              return (
                <div key={col.key} className="overflow-hidden rounded-md border">
                  <div
                    className="px-3 py-2 text-center text-sm font-bold"
                    style={{ background: c?.hex, color: c?.text }}
                  >
                    {col.title}
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      {col.rows.map((r) => (
                        <tr key={r.label} className="border-t">
                          <td className="w-2/5 px-2 py-1.5 align-top font-semibold">{r.label}</td>
                          <td className="px-2 py-1.5 align-top">{r.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-3 py-1.5 text-center text-xs font-bold text-white" style={{ background: "#F59E0B" }}>
                    Gegenleistung FK
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      {col.gegenleistung.map((r) => (
                        <tr key={r.label} className="border-t">
                          <td className="w-2/5 px-2 py-1.5 align-top font-semibold">{r.label}</td>
                          <td className="px-2 py-1.5 align-top">{r.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
