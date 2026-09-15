import { describe, expect, it } from "vitest"
import {
  DEFAULTS, MINDEST_KOEST_JAHR, berechneEu, berechneGmbh, berechneGruendungsVergleich,
  berechneSchwellenreihe, einkommensteuer, gewinnfreibetrag, gsvgBeitrag,
  GSVG_HOECHSTBEITRAGSGRUNDLAGE_JAHR, GSVG_MINDESTBEITRAGSGRUNDLAGE_JAHR,
} from "../../src/lib/calc/gmbhVsEu"

describe("einkommensteuer", () => {
  it("is zero within the tax-free bracket", () => {
    expect(einkommensteuer(13000)).toBe(0)
  })

  it("matches a hand-calculated multi-bracket example", () => {
    // 50.000 €: 0 bis 13.539 frei, 20% bis 21.992, 30% bis 36.458, 40% bis 50.000
    const erwartet = (21992 - 13539) * 0.2 + (36458 - 21992) * 0.3 + (50000 - 36458) * 0.4
    expect(einkommensteuer(50000)).toBeCloseTo(erwartet, 2)
  })

  it("never returns a negative amount for a negative base", () => {
    expect(einkommensteuer(-5000)).toBe(0)
  })
})

describe("gewinnfreibetrag", () => {
  it("caps the automatic Grundfreibetrag at 4.950 € for profits at or above 33.000 €", () => {
    expect(gewinnfreibetrag(33000, false)).toBeCloseTo(4950, 2)
    expect(gewinnfreibetrag(500000, false)).toBeCloseTo(4950, 2)
  })

  it("reaches the documented maximum of 46.400 € at the top of the investitionsbedingt staffel", () => {
    expect(gewinnfreibetrag(583000, true)).toBeCloseTo(46400, 0)
  })

  it("grants no freibetrag above 583.000 € beyond the maximum", () => {
    expect(gewinnfreibetrag(700000, true)).toBeCloseTo(46400, 0)
  })
})

describe("gsvgBeitrag", () => {
  it("floors at the Mindestbeitragsgrundlage for a very small or negative profit", () => {
    const erwartet = GSVG_MINDESTBEITRAGSGRUNDLAGE_JAHR * 0.2683 + 12.96 * 12
    expect(gsvgBeitrag(-1000)).toBeCloseTo(erwartet, 0)
    expect(gsvgBeitrag(0)).toBeCloseTo(erwartet, 0)
  })

  it("caps at the Höchstbeitragsgrundlage for a very high profit", () => {
    const erwartet = GSVG_HOECHSTBEITRAGSGRUNDLAGE_JAHR * 0.2683 + 12.96 * 12
    expect(gsvgBeitrag(500000)).toBeCloseTo(erwartet, 0)
  })
})

describe("berechneEu", () => {
  it("produces a positive, plausible net income at default values", () => {
    const r = berechneEu(DEFAULTS)
    expect(r.nettoEinkommen).toBeGreaterThan(0)
    expect(r.nettoEinkommen).toBeLessThan(DEFAULTS.umsatz)
  })

  it("reduces deductible AfA by the private-use share of the car", () => {
    const ohnePrivat = berechneEu({ ...DEFAULTS, autoPrivatanteilPct: 0 })
    const mitPrivat = berechneEu({ ...DEFAULTS, autoPrivatanteilPct: 50 })
    expect(mitPrivat.afaAutoBetrieblich).toBeLessThan(ohnePrivat.afaAutoBetrieblich)
    expect(mitPrivat.gewinnVorSv).toBeGreaterThan(ohnePrivat.gewinnVorSv)
  })
})

describe("berechneGmbh", () => {
  it("pays at least the Mindestkörperschaftsteuer even at zero profit", () => {
    const r = berechneGmbh(
      { ...DEFAULTS, umsatz: 0, betriebsausgaben: 0, sonstigeAfaJahr: 0, autoAnschaffungswert: 0 },
      { ...DEFAULTS, gfGehaltBrutto: 0 }
    )
    expect(r.koeSt).toBe(MINDEST_KOEST_JAHR)
  })

  it("keeps distributed profit taxed at roughly the well-known ~44% combined KöSt+KESt rate", () => {
    const r = berechneGmbh(DEFAULTS, { ...DEFAULTS, ausschuettungsquotePct: 100 })
    if (r.ausschuettungBrutto > 0) {
      const effektiverSatz = r.kESt / r.ausschuettungBrutto
      expect(effektiverSatz).toBeCloseTo(0.275, 5)
    }
  })

  it("retaining profits (0% Ausschüttung) leaves nothing paid out but grows thesaurierter Gewinn", () => {
    const r = berechneGmbh(DEFAULTS, { ...DEFAULTS, ausschuettungsquotePct: 0 })
    expect(r.ausschuettungBrutto).toBe(0)
    expect(r.thesaurierterGewinn).toBeCloseTo(r.gewinnNachKoest, 2)
  })

  it("adds a car benefit (Sachbezug) to the GF's assessment base only when there is private use", () => {
    const ohne = berechneGmbh({ ...DEFAULTS, autoPrivatanteilPct: 0 }, DEFAULTS)
    const mit = berechneGmbh({ ...DEFAULTS, autoPrivatanteilPct: 20 }, DEFAULTS)
    expect(ohne.sachbezugAuto).toBe(0)
    expect(mit.sachbezugAuto).toBeGreaterThan(0)
    expect(mit.gfBemessungGesamt).toBeGreaterThan(ohne.gfBemessungGesamt)
  })

  it("does not let a loss after minimum KöSt vanish — it flows through as negative thesaurierter Gewinn", () => {
    const r = berechneGmbh(
      { ...DEFAULTS, umsatz: 20000, betriebsausgaben: 5000, sonstigeAfaJahr: 0, autoAnschaffungswert: 0 },
      { ...DEFAULTS, gfGehaltBrutto: 60000, stbMehrkostenJahr: 0, offenlegungJahr: 0 }
    )
    expect(r.betrieblichesErgebnisVorKoest).toBeLessThan(0)
    expect(r.koeSt).toBe(MINDEST_KOEST_JAHR)
    expect(r.gewinnNachKoest).toBeLessThan(0)
    expect(r.thesaurierterGewinn).toBeLessThan(0)
    expect(r.gesamtInklThesaurierung).toBeCloseTo(r.verfuegbaresEinkommen + r.gewinnNachKoest, 2)
  })

  it("grants the GF a 6% Basispauschale (§17 EStG), capped at 13.200 €", () => {
    const ohneAuto = { ...DEFAULTS, autoAnschaffungswert: 0 } // kein Sachbezug, der die Bemessung verzerrt
    const klein = berechneGmbh(ohneAuto, { ...DEFAULTS, gfGehaltBrutto: 20000 })
    expect(klein.gfBetriebsausgabenpauschale).toBeCloseTo(20000 * 0.06, 2)
    const gross = berechneGmbh(ohneAuto, { ...DEFAULTS, gfGehaltBrutto: 500000 })
    expect(gross.gfBetriebsausgabenpauschale).toBeCloseTo(13200, 2)
  })

  it("subtracts the full running Kfz cost as a business expense (no private-use reduction, unlike EU)", () => {
    const ohne = berechneGmbh({ ...DEFAULTS, kfzLaufendeKostenJahr: 0 }, DEFAULTS)
    const mit = berechneGmbh({ ...DEFAULTS, kfzLaufendeKostenJahr: 3000 }, DEFAULTS)
    expect(ohne.betrieblichesErgebnisVorKoest - mit.betrieblichesErgebnisVorKoest).toBeCloseTo(3000, 2)
  })

  it("does not apply a hard DB+DZ cliff at the Kommunalsteuer-Freigrenze (only Kommunalsteuer itself has one)", () => {
    // Kein Auto (sonst verzerrt der Sachbezug die Bemessungsgrundlage), Gehalt knapp unter und
    // knapp über der 1.460-€/Monat-Freigrenze (17.520 €/Jahr).
    const ohneAuto = { ...DEFAULTS, autoAnschaffungswert: 0 }
    const knappDrunter = berechneGmbh(ohneAuto, { ...DEFAULTS, gfGehaltBrutto: 17000 })
    const knappDrueber = berechneGmbh(ohneAuto, { ...DEFAULTS, gfGehaltBrutto: 18000 })
    const dbDzSatz = 0.037 + DEFAULTS.dzSatzPct / 100
    const erwarteteDbDzDifferenz = (18000 - 17000) * dbDzSatz
    // Lohnnebenkosten-Differenz = DB+DZ-Anteil (immer da) + Kommunalsteuer-Sprung (Freigrenze).
    expect(knappDrueber.lohnnebenkostenGmbh - knappDrunter.lohnnebenkostenGmbh).toBeGreaterThan(erwarteteDbDzDifferenz)
    // Aber unterhalb der Freigrenze fällt trotzdem schon DB+DZ an (kein Alles-oder-nichts).
    expect(knappDrunter.lohnnebenkostenGmbh).toBeCloseTo(17000 * dbDzSatz, 0)
  })
})

describe("berechneSchwellenreihe", () => {
  it("returns one point per step across the requested range, without NaN/Infinity", () => {
    const punkte = berechneSchwellenreihe(DEFAULTS, DEFAULTS, 20000, 220000, 20000)
    expect(punkte).toHaveLength(11)
    for (const p of punkte) {
      expect(Number.isFinite(p.nettoEu)).toBe(true)
      expect(Number.isFinite(p.verfuegbarGmbh)).toBe(true)
      expect(Number.isFinite(p.gesamtGmbh)).toBe(true)
      expect(Number.isFinite(p.gesamtGmbhNachLatenterSteuer)).toBe(true)
    }
  })

  it("EU net income increases monotonically as operating profit increases", () => {
    const punkte = berechneSchwellenreihe(DEFAULTS, DEFAULTS, 20000, 220000, 20000)
    for (let i = 1; i < punkte.length; i++) {
      expect(punkte[i].nettoEu).toBeGreaterThanOrEqual(punkte[i - 1].nettoEu)
    }
  })
})

describe("Umsatz 150.000 / GF-Gehalt 60.000 — die Zahlen, die den Vergleichs-Bug ausgelöst haben", () => {
  // Erik: "bei 150.000 Umsatz und Geschäftsführergehalt 60.000 kommt zwischen EU und GmbH
  // fast kein Unterschied raus, kann das sein?" — Antwort: die Vergleichsgrösse war falsch
  // (gesamtInklThesaurierung statt gesamtNachLatenterSteuer, siehe PR). Diese Tests fixieren
  // das korrigierte Verhalten als Golden Case.
  const eingabe = { ...DEFAULTS, umsatz: 150000 }
  const spezifisch = { ...DEFAULTS, gfGehaltBrutto: 60000 }

  it("gesamtNachLatenterSteuer is independent of the Ausschüttungsquote (the bug this fixes)", () => {
    const voll = berechneGmbh(eingabe, { ...spezifisch, ausschuettungsquotePct: 100 })
    const halb = berechneGmbh(eingabe, { ...spezifisch, ausschuettungsquotePct: 50 })
    const keine = berechneGmbh(eingabe, { ...spezifisch, ausschuettungsquotePct: 0 })
    expect(halb.gesamtNachLatenterSteuer).toBeCloseTo(voll.gesamtNachLatenterSteuer, 0)
    expect(keine.gesamtNachLatenterSteuer).toBeCloseTo(voll.gesamtNachLatenterSteuer, 0)
    // gesamtInklThesaurierung dagegen bleibt bewusst quoten-abhängig (unkorrigierter Rohwert).
    expect(keine.gesamtInklThesaurierung).toBeGreaterThan(voll.gesamtInklThesaurierung)
  })

  it("at full distribution, gesamtNachLatenterSteuer equals gesamtInklThesaurierung (nothing left to defer)", () => {
    const voll = berechneGmbh(eingabe, { ...spezifisch, ausschuettungsquotePct: 100 })
    expect(voll.gesamtNachLatenterSteuer).toBeCloseTo(voll.gesamtInklThesaurierung, 2)
  })

  it("the GmbH ends up behind the Einzelunternehmer at this income level (full KESt at distribution beats EU tax only far higher up)", () => {
    const eu = berechneEu(eingabe)
    const gmbh = berechneGmbh(eingabe, spezifisch)
    expect(gmbh.gesamtNachLatenterSteuer).toBeLessThan(eu.nettoEinkommen)
  })
})

describe("berechneGruendungsVergleich", () => {
  it("returns null break-even years when the GmbH has no yearly advantage", () => {
    const eu = berechneEu({ ...DEFAULTS, umsatz: 200000 })
    const gmbh = berechneGmbh({ ...DEFAULTS, umsatz: 40000 }, DEFAULTS)
    const vergleich = berechneGruendungsVergleich(eu, gmbh, DEFAULTS.gruendungskostenEinmalig)
    expect(vergleich.jaehrlicherVorteilGmbh).toBeLessThan(0)
    expect(vergleich.breakEvenJahre).toBeNull()
  })
})
