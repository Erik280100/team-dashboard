// EH-Rechner — 1:1 portiert aus legacy/index.html:3292–3354.
// Reine Datentabelle + Formatter, keine DOM-Zugriffe. Golden-Master-Test:
// test/calc/eh.golden.test.ts.

export interface EhGroup {
  id: "insurance" | "investment" | "credit" | "realestate"
  title: string
  multDefault: number
}

export interface EhItem {
  id: string
  label: string
  sparte: EhGroup["id"]
  payout: "monatlich" | "einmalig"
  hasG?: boolean
  gLabel?: string
  gUnit?: string
  gDefault?: number
  gMax?: number
  jLabel: string
  disabled?: boolean
  disabledNote?: string
  calc: (g: number, j: number) => number
}

export const EH_GROUPS: EhGroup[] = [
  { id: "insurance", title: "Insurance", multDefault: 2 },
  { id: "investment", title: "Investment", multDefault: 2 },
  { id: "credit", title: "Credit", multDefault: 2 },
  { id: "realestate", title: "Real Estate", multDefault: 2 },
]

export const EH_ITEMS: EhItem[] = [
  {
    id: "fsp",
    label: "FSP",
    sparte: "insurance",
    payout: "monatlich",
    hasG: true,
    gLabel: "Laufzeit",
    gUnit: "Jahre",
    gDefault: 35,
    gMax: 35,
    jLabel: "Mtl. Prämie (€)",
    calc: (_g, j) => j / 2,
  },
  {
    id: "flv",
    label: "FLV",
    sparte: "insurance",
    payout: "einmalig",
    hasG: true,
    gLabel: "Laufzeit",
    gUnit: "Jahre",
    gDefault: 35,
    gMax: 35,
    jLabel: "Mtl. Prämie (€)",
    calc: (g, j) => ((j * 2.11) / 35) * Math.min(g, 35),
  },
  {
    id: "flv-ee",
    label: "FLV EE",
    sparte: "insurance",
    payout: "einmalig",
    jLabel: "Zuzahlungsbetrag (€)",
    calc: (_g, j) => (j * 0.055) / 10.5,
  },
  {
    id: "ableben",
    label: "Ableben",
    sparte: "insurance",
    payout: "einmalig",
    hasG: true,
    gLabel: "Laufzeit",
    gUnit: "Jahre",
    gDefault: 40,
    gMax: 40,
    jLabel: "Mtl. Prämie (€)",
    calc: (g, j) => ((j * 2.14) / 30) * Math.min(g, 40),
  },
  {
    id: "bu",
    label: "BU",
    sparte: "insurance",
    payout: "einmalig",
    hasG: true,
    gLabel: "Laufzeit",
    gUnit: "Jahre",
    gDefault: 40,
    gMax: 40,
    jLabel: "Mtl. Prämie (€)",
    calc: (g, j) => (((j * 12 * Math.min(g, 40)) / 1000) * 48) / 10.5,
  },
  {
    id: "uv",
    label: "UV",
    sparte: "insurance",
    payout: "einmalig",
    jLabel: "Mtl. Prämie (€)",
    calc: (_g, j) => j * 0.9,
  },
  {
    id: "kranken",
    label: "Krankenversicherung",
    sparte: "insurance",
    payout: "einmalig",
    jLabel: "Mtl. Prämie (€)",
    calc: (_g, j) => j * 0.7,
  },
  {
    id: "haushalt",
    label: "Haushalt",
    sparte: "insurance",
    payout: "einmalig",
    jLabel: "Mtl. Prämie (€)",
    calc: (_g, j) => j * 0.9,
  },
  {
    id: "eigenheim",
    label: "Eigenheim",
    sparte: "insurance",
    payout: "einmalig",
    jLabel: "Mtl. Prämie (€)",
    calc: (_g, j) => j * 0.9,
  },
  {
    id: "rechtschutz",
    label: "Rechtschutz",
    sparte: "insurance",
    payout: "einmalig",
    jLabel: "Mtl. Prämie (€)",
    calc: (_g, j) => j * 0.9,
  },
  {
    id: "froots-vv-mtl",
    label: "froots VV (monatlich)",
    sparte: "investment",
    payout: "monatlich",
    jLabel: "Mtl. Prämie (€)",
    // Ab einer mtl. Prämie über 500 € (also ab 501 €) bleibt die Einheiten-
    // berechnung unverändert. Bei 500 € oder darunter werden die Einheiten
    // um 15 % gekürzt.
    calc: (_g, j) => {
      const base = ((j * 3) / 10.5) * 0.9
      return j > 500 ? base : base * 0.85
    },
  },
  {
    id: "froots-vv-einmalig",
    label: "froots VV (einmalig)",
    sparte: "investment",
    payout: "einmalig",
    hasG: true,
    gLabel: "Provision",
    gUnit: "Prozent",
    gDefault: 5,
    jLabel: "Anlagebetrag gesamt (€)",
    // Ab einem Anlagebetrag über 10.000 € (also ab 10.000,01 €) bleibt die
    // Einheitenberechnung unverändert. Bei 10.000 € oder darunter werden die
    // Einheiten um 15 % gekürzt.
    calc: (g, j) => {
      const base = (j * (g / 100) * 0.9) / 10.5
      return j > 10000 ? base : base * 0.85
    },
  },
  {
    id: "kredit",
    label: "Kredit",
    sparte: "credit",
    payout: "einmalig",
    hasG: true,
    gLabel: "Provision",
    gUnit: "Prozent",
    gDefault: 3,
    jLabel: "Kredithöhe gesamt (€)",
    calc: (g, j) => (j * (g / 100)) / 10.5,
  },
  {
    id: "immobilie",
    label: "Immobilienverkauf",
    sparte: "realestate",
    payout: "einmalig",
    hasG: true,
    gLabel: "Provision",
    gUnit: "Prozent",
    gDefault: 3,
    jLabel: "Verkaufshöhe gesamt (€)",
    calc: (g, j) => (j * (g / 100)) / 10.5,
  },
]

export function ehFormatEH(n: number): string {
  return Math.round(n).toLocaleString("de-DE")
}

export function ehFormatEUR(n: number): string {
  return n.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export interface EhInputs {
  /** g-Wert pro Item-Id (nur für Items mit hasG relevant). String erlaubt für leere Inputfelder. */
  g: Record<string, number | string>
  /** j-Wert (Prämie/Betrag) pro Item-Id. String erlaubt für leere Inputfelder. */
  j: Record<string, number | string>
  /** Multiplikator (€/EH) pro Gruppen-Id. String erlaubt für leere Inputfelder. */
  mult: Record<EhGroup["id"], number | string>
}

export interface EhResult {
  perItem: Record<string, number>
  groupSums: Record<string, number>
  groupEur: Record<string, number>
  grandTotal: number
  grandTotalEur: number
}

/** Reine Neuberechnung des gesamten EH-Rechners aus einem Eingaben-Snapshot. */
export function calcEh(inputs: EhInputs): EhResult {
  const groupSums: Record<string, number> = {}
  EH_GROUPS.forEach((g) => (groupSums[g.id] = 0))

  const perItem: Record<string, number> = {}
  EH_ITEMS.forEach((it) => {
    const g = it.hasG ? Number(inputs.g[it.id]) || 0 : 0
    const j = it.disabled ? 0 : Number(inputs.j[it.id]) || 0
    const result = it.calc(g, j)
    perItem[it.id] = result
    groupSums[it.sparte] += result
  })

  let grandTotal = 0
  let grandTotalEur = 0
  const groupEur: Record<string, number> = {}
  EH_GROUPS.forEach((g) => {
    grandTotal += groupSums[g.id]
    const mult = Number(inputs.mult[g.id]) || 0
    const eur = groupSums[g.id] * mult
    groupEur[g.id] = eur
    grandTotalEur += eur
  })

  return { perItem, groupSums, groupEur, grandTotal, grandTotalEur }
}
