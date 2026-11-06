// Export der Dashboard-Übersicht als Excel (.xlsx) oder Word (.docx).
// Die Bibliotheken (exceljs, docx) werden erst beim Klick nachgeladen, damit sie
// das Start-Bundle nicht vergrößern.

export interface DashboardReport {
  title: string
  /** z. B. "Mein Team" / "Gesamt" bzw. "Archiv" */
  scopeLabel: string
  periodLabel: string
  note: string
  goal: { target: number; ist: number; pct: number; remainingText: string }
  kpis: { label: string; value: string }[]
  sparten: { label: string; units: number; pct: number }[]
  yearly: { year: string; items: { label: string; units: number }[] }
  top: { name: string; units: number }[]
  leaderboard: { name: string; atIst: number }[]
  employees: {
    name: string
    soll: number
    ist: number
    pct: number
    atPlan: number
    atIst: number
    btPlan: number
    btIst: number
    etPlan: number
    etIst: number
  }[]
}

const EMPLOYEE_HEADERS = ["Mitarbeiter", "Soll", "Ist", "Erfüllung %", "AT Plan", "AT Ist", "BT Plan", "BT Ist", "ET Plan", "ET Ist"]

function employeeCells(e: DashboardReport["employees"][number]): (string | number)[] {
  return [e.name, e.soll, e.ist, e.pct, e.atPlan, e.atIst, e.btPlan, e.btIst, e.etPlan, e.etIst]
}

export function exportFileName(report: DashboardReport, ext: "xlsx" | "docx"): string {
  const slug = `${report.scopeLabel}_${report.periodLabel}`
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
  return `finova_dashboard_${slug}.${ext}`
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportDashboardXlsx(report: DashboardReport): Promise<void> {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  wb.creator = "Finova Team Dashboard"
  wb.created = new Date()

  const header = (row: import("exceljs").Row) => {
    row.font = { bold: true, color: { argb: "FFFFFFFF" } }
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A5F" } }
  }

  // Blatt 1: Übersicht
  const ws = wb.addWorksheet("Übersicht")
  ws.columns = [{ width: 38 }, { width: 18 }, { width: 18 }]
  ws.addRow([report.title]).font = { bold: true, size: 16 }
  ws.addRow([`${report.scopeLabel} · ${report.periodLabel}`])
  if (report.note) ws.addRow([`Fokus: ${report.note}`])
  ws.addRow([])
  header(ws.addRow(["Team-Ziel", "Wert"]))
  ws.addRow(["Ziel (Einheiten)", report.goal.target])
  ws.addRow(["Ist (Einheiten)", report.goal.ist])
  ws.addRow(["Erfüllung %", report.goal.pct])
  ws.addRow([report.goal.remainingText])
  ws.addRow([])
  header(ws.addRow(["Kennzahl", "Wert"]))
  report.kpis.forEach((k) => ws.addRow([k.label, k.value]))
  ws.addRow([])
  header(ws.addRow(["Sparte (laufender Monat)", "Einheiten", "Anteil %"]))
  report.sparten.forEach((s) => ws.addRow([s.label, s.units, s.pct]))
  ws.addRow([])
  header(ws.addRow([`Jahreswerte ${report.yearly.year}`, "Einheiten"]))
  report.yearly.items.forEach((s) => ws.addRow([s.label, s.units]))

  // Blatt 2: Mitarbeiter
  const we = wb.addWorksheet("Mitarbeiter")
  we.columns = EMPLOYEE_HEADERS.map((_, i) => ({ width: i === 0 ? 30 : 13 }))
  header(we.addRow(EMPLOYEE_HEADERS))
  report.employees.forEach((e) => we.addRow(employeeCells(e)))
  we.views = [{ state: "frozen", ySplit: 1 }]
  we.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: EMPLOYEE_HEADERS.length } }

  // Blatt 3: Ranglisten
  const wr = wb.addWorksheet("Ranglisten")
  wr.columns = [{ width: 8 }, { width: 30 }, { width: 14 }, { width: 4 }, { width: 8 }, { width: 30 }, { width: 14 }]
  header(wr.addRow(["Platz", "Top Geschäftspartner", "Einheiten", "", "Platz", "Leaderboard (Ist AT)", "AT Ist"]))
  const n = Math.max(report.top.length, report.leaderboard.length)
  for (let i = 0; i < n; i++) {
    const t = report.top[i]
    const l = report.leaderboard[i]
    wr.addRow([t ? i + 1 : "", t?.name ?? "", t?.units ?? "", "", l ? i + 1 : "", l?.name ?? "", l?.atIst ?? ""])
  }

  const buf = await wb.xlsx.writeBuffer()
  saveBlob(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    exportFileName(report, "xlsx")
  )
}

export async function exportDashboardDocx(report: DashboardReport): Promise<void> {
  const {
    Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, ShadingType,
  } = await import("docx")

  const cell = (text: string | number, opts: { bold?: boolean; head?: boolean; right?: boolean } = {}) =>
    new TableCell({
      shading: opts.head ? { type: ShadingType.CLEAR, color: "auto", fill: "1F3A5F" } : undefined,
      children: [
        new Paragraph({
          alignment: opts.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
          children: [new TextRun({ text: String(text), bold: opts.bold || opts.head, color: opts.head ? "FFFFFF" : undefined, size: 18 })],
        }),
      ],
    })

  const table = (head: string[], body: (string | number)[][]) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ tableHeader: true, children: head.map((h, i) => cell(h, { head: true, right: i > 0 })) }),
        ...body.map((r) => new TableRow({ children: r.map((c, i) => cell(c, { right: i > 0 })) })),
      ],
    })

  const h2 = (text: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 120 }, text })

  const doc = new Document({
    creator: "Finova Team Dashboard",
    title: report.title,
    sections: [
      {
        properties: { page: { size: { orientation: "landscape" as never } } },
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, text: report.title }),
          new Paragraph({ text: `${report.scopeLabel} · ${report.periodLabel}` }),
          ...(report.note ? [new Paragraph({ children: [new TextRun({ text: `Fokus: ${report.note}`, italics: true })] })] : []),

          h2("Team-Ziel"),
          new Paragraph({
            children: [
              new TextRun({ text: `${report.goal.ist} von ${report.goal.target} Einheiten (${report.goal.pct}%)`, bold: true }),
            ],
          }),
          new Paragraph({ text: report.goal.remainingText }),

          h2("Kennzahlen"),
          table(["Kennzahl", "Wert"], report.kpis.map((k) => [k.label, k.value])),

          h2("Umsatz nach Sparte (laufender Monat)"),
          table(["Sparte", "Einheiten", "Anteil %"], report.sparten.map((s) => [s.label, s.units, s.pct])),

          h2(`Jahreswerte ${report.yearly.year}`),
          table(["Sparte", "Einheiten"], report.yearly.items.map((s) => [s.label, s.units])),

          h2("Top Geschäftspartner (Einheiten)"),
          table(["Platz", "Name", "Einheiten"], report.top.map((t, i) => [i + 1, t.name, t.units])),

          h2("Leaderboard (Ist AT)"),
          table(["Platz", "Name", "AT Ist"], report.leaderboard.map((l, i) => [i + 1, l.name, l.atIst])),

          h2("Mitarbeiter"),
          table(EMPLOYEE_HEADERS, report.employees.map(employeeCells)),
        ],
      },
    ],
  })

  saveBlob(await Packer.toBlob(doc), exportFileName(report, "docx"))
}

// ---- Mitarbeiter-Seite ----

export interface TeamReport {
  title: string
  scopeLabel: string
  periodLabel: string
  rows: {
    name: string
    role: string
    manager: string
    isNew: boolean
    atPlan: number; btPlan: number; stPlan: number; etPlan: number
    atIst: number; btIst: number; stIst: number; etIst: number
    soll: number
    ist: number
    pct: number
  }[]
}

const TEAM_HEADERS = [
  "Name", "Rolle", "Führungskraft", "Neu",
  "AT Plan", "BT Plan", "ST Plan", "ET Plan", "AT Ist", "BT Ist", "ST Ist", "ET Ist",
  "Soll", "Ist", "Fortschritt %",
]

function teamCells(r: TeamReport["rows"][number]): (string | number)[] {
  return [
    r.name, r.role, r.manager, r.isNew ? "ja" : "",
    r.atPlan, r.btPlan, r.stPlan, r.etPlan, r.atIst, r.btIst, r.stIst, r.etIst,
    r.soll, r.ist, r.pct,
  ]
}

export function teamFileName(report: TeamReport, ext: "xlsx" | "docx"): string {
  const slug = `${report.scopeLabel}_${report.periodLabel}`.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "")
  return `finova_mitarbeiter_${slug}.${ext}`
}

export async function exportTeamXlsx(report: TeamReport): Promise<void> {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  wb.creator = "Finova Team Dashboard"
  wb.created = new Date()
  const ws = wb.addWorksheet("Mitarbeiter")
  ws.addRow([`${report.title} — ${report.scopeLabel} · ${report.periodLabel}`]).font = { bold: true, size: 14 }
  ws.addRow([])
  const head = ws.addRow(TEAM_HEADERS)
  head.font = { bold: true, color: { argb: "FFFFFFFF" } }
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A5F" } }
  report.rows.forEach((r) => ws.addRow(teamCells(r)))
  ws.columns = TEAM_HEADERS.map((_, i) => ({ width: i === 0 ? 30 : i < 3 ? 22 : 11 }))
  ws.views = [{ state: "frozen", ySplit: 3, xSplit: 1 }]
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: TEAM_HEADERS.length } }
  const buf = await wb.xlsx.writeBuffer()
  saveBlob(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    teamFileName(report, "xlsx")
  )
}

export async function exportTeamDocx(report: TeamReport): Promise<void> {
  const { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, ShadingType } =
    await import("docx")
  const cell = (text: string | number, head: boolean, right: boolean) =>
    new TableCell({
      shading: head ? { type: ShadingType.CLEAR, color: "auto", fill: "1F3A5F" } : undefined,
      children: [
        new Paragraph({
          alignment: right ? AlignmentType.RIGHT : AlignmentType.LEFT,
          children: [new TextRun({ text: String(text), bold: head, color: head ? "FFFFFF" : undefined, size: 16 })],
        }),
      ],
    })
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: TEAM_HEADERS.map((h, i) => cell(h, true, i >= 4)) }),
      ...report.rows.map((r) => new TableRow({ children: teamCells(r).map((c, i) => cell(c, false, i >= 4)) })),
    ],
  })
  const doc = new Document({
    creator: "Finova Team Dashboard",
    title: report.title,
    sections: [
      {
        properties: { page: { size: { orientation: "landscape" as never } } },
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, text: report.title }),
          new Paragraph({ text: `${report.scopeLabel} · ${report.periodLabel}` }),
          new Paragraph({ text: "" }),
          table,
        ],
      },
    ],
  })
  saveBlob(await Packer.toBlob(doc), teamFileName(report, "docx"))
}
