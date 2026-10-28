import { describe, expect, it } from "vitest"
import { calcEh, EH_GROUPS, EH_ITEMS } from "../../src/lib/calc/eh"
import { umsatzDrafts, umsatzMatches } from "../../src/lib/calc/umsatz"

function inputs(j: Record<string, string>) {
  const g: Record<string, string> = {}
  EH_ITEMS.forEach((it) => { if (it.hasG) g[it.id] = String(it.gDefault ?? 0) })
  const mult = Object.fromEntries(EH_GROUPS.map((gr) => [gr.id, String(gr.multDefault)])) as Record<string, string>
  const jAll: Record<string, string> = {}
  EH_ITEMS.forEach((it) => { jAll[it.id] = "0" })
  return { g, j: { ...jAll, ...j }, mult }
}

describe("umsatzDrafts", () => {
  it("liefert keine Zeilen, wenn nichts eingetragen ist", () => {
    const i = inputs({})
    expect(umsatzDrafts(i.j, calcEh(i as never).perItem)).toEqual([])
  })

  it("erzeugt je ausgefüllter Position eine Zeile mit Produkt, Betrag und Einheiten", () => {
    const i = inputs({ flv: "100", bu: "50" })
    const result = calcEh(i as never)
    const drafts = umsatzDrafts(i.j, result.perItem)
    expect(drafts.map((d) => d.produkt)).toEqual(["FLV", "BU"])
    expect(drafts.map((d) => d.praemie)).toEqual([100, 50])
    expect(drafts[0].praemieLabel).toBe("Mtl. Prämie (€)")
    expect(drafts[0].einheiten).toBe(result.perItem.flv)
  })

  it("ignoriert negative und ungültige Eingaben", () => {
    const i = inputs({ flv: "-5", bu: "abc" })
    expect(umsatzDrafts(i.j, calcEh(i as never).perItem)).toEqual([])
  })
})

describe("umsatzDrafts mit Kundenname", () => {
  it("übernimmt den Namen für alle Positionen", () => {
    const i = inputs({ flv: "100", bu: "50" })
    const drafts = umsatzDrafts(i.j, calcEh(i as never).perItem, "  Max Muster ")
    expect(drafts.map((d) => d.kunde)).toEqual(["Max Muster", "Max Muster"])
  })

  it("lässt den Kunden ohne Eingabe weg", () => {
    const i = inputs({ flv: "100" })
    expect(umsatzDrafts(i.j, calcEh(i as never).perItem, "   ")[0]).not.toHaveProperty("kunde")
  })
})

describe("umsatzMatches", () => {
  const e = { kunde: "Max Muster", mitarbeiter: "Anna Beispiel", produkt: "Lebensversicherung", praemie: 120.5, einheiten: 36.15 }
  it("findet Kunde, Mitarbeiter und Produkt per Text", () => {
    expect(umsatzMatches(e, "muster")).toBe(true)
    expect(umsatzMatches(e, "anna")).toBe(true)
    expect(umsatzMatches(e, "leben")).toBe(true)
    expect(umsatzMatches(e, "xyz")).toBe(false)
  })
  it("findet Prämie und Einheiten per Zahl (Komma oder Punkt)", () => {
    expect(umsatzMatches(e, "120,5")).toBe(true)
    expect(umsatzMatches(e, "36.15")).toBe(true)
    expect(umsatzMatches(e, "120")).toBe(true)
    expect(umsatzMatches(e, "999")).toBe(false)
  })
  it("leere Suche trifft alles", () => {
    expect(umsatzMatches(e, "  ")).toBe(true)
  })
})
