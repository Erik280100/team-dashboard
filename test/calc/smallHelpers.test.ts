import { describe, expect, it } from "vitest"
import { callableErrorText } from "../../src/lib/callableError"
import { statsRelevant } from "../../functions/src/financingStats"
import { isValidId } from "../../functions/src/subtree"

describe("callableErrorText", () => {
  it("nimmt die Meldung des Fehlers", () => {
    expect(callableErrorText(new Error("Nur für Admins."))).toBe("Nur für Admins.")
    expect(callableErrorText({ message: 42 })).toBe("42")
  })

  it("fällt bei fehlender oder leerer Meldung auf den Standardtext zurück", () => {
    for (const bad of [null, undefined, "fehler", {}, { message: "" }]) {
      expect(callableErrorText(bad)).toBe("Unbekannter Fehler.")
    }
  })
})

describe("isValidId", () => {
  it("erlaubt Buchstaben, Ziffern, _ und - bis 64 Zeichen", () => {
    expect(isValidId("max-mustermann_1")).toBe(true)
    expect(isValidId("a".repeat(64))).toBe(true)
  })

  it("weist Pfad-Einschleusung und Sonderzeichen ab", () => {
    for (const bad of ["", "a/b", "../x", "a b", "ä", "a".repeat(65), 5, null, undefined]) {
      expect(isValidId(bad)).toBe(false)
    }
  })
})

describe("statsRelevant", () => {
  it("liefert null ohne Daten", () => {
    expect(statsRelevant(undefined)).toBeNull()
  })

  it("reduziert einen Fall auf die Felder der Gesamtzahlen", () => {
    expect(statsRelevant({ archived: false, betrag: "1500", art: "anlegerwohnung" })).toEqual({ open: true, betrag: 1500, anlegerwohnung: true })
    expect(statsRelevant({ archived: true, betrag: "kein Betrag" })).toEqual({ open: false, betrag: 0, anlegerwohnung: false })
  })
})
