import { describe, expect, it } from "vitest"
import {
  berechneAfaJahreLinear, berechneImpliziterZinssatzPct, berechneKoestEffekt, berechnePortfolioIrrPct,
  simuliereImmoPortfolio, type ImmoPortfolioEingabe, type KoestZustand,
} from "../../src/lib/calc/immoPortfolio"
import { KREDIT_DEFAULTS, berechneTilgungsplan } from "../../src/lib/calc/kredit"

const BASIS: ImmoPortfolioEingabe = {
  eigenmittel: 0,
  sparbetragMonat: 0,
  guthabenzinsPct: 0,
  kaufpreisReferenz: 300000,
  wohnflaecheM2: 60,
  ltvKaufPct: 80,
  laufzeitJahre: 30,
  zinssatzPct: 3,
  mitMakler: false,
  nkMitfinanziert: true,
  mietModus: "direkt",
  mieteMonat: 900,
  mietpreisProM2: 15,
  indexierungPct: 2,
  leerstandPct: 0,
  befristet: false,
  hausverwaltungMonat: 0,
  instandhaltungProM2Monat: 0,
  sonstigeKostenMonat: 0,
  wertzuwachsPct: 3,
  umschuldungAlleJahre: 5,
  beleihungUmschuldungPct: 100,
  grenzsteuersatzPct: 0,
  gebaeudeanteilPct: 80,
  afaSatzPct: 1.5,
  bestandAnzahl: 0,
  bestandWert: 0,
  bestandRestschuld: 0,
  bestandRateMonat: 0,
  bestandMieteMonat: 0,
  bestandRestlaufzeitJahre: 0,
  bestandAnschaffungskosten: 0,
  bestandAfaJahreVerbraucht: 0,
  nettoeinkommenMonat: 3000,
  lebenshaltungMonat: 1500,
  // Permissiv (0), damit die harte Kaufsperre die bestehenden, nicht darauf ausgerichteten Tests
  // nicht beeinflusst — die Sperre selbst wird in einem eigenen Test unten geprüft.
  mindestResteinkommenMonat: 0,
  horizontJahre: 20,
}

describe("simuliereImmoPortfolio", () => {
  it("never buys a second property without savings, value growth, or an existing portfolio", () => {
    const erg = simuliereImmoPortfolio({ ...BASIS, wertzuwachsPct: 0, umschuldungAlleJahre: 100 })
    expect(erg.kaeufe).toHaveLength(0)
  })

  it("buys as many properties as liquidity allows within a single month, with no cap on how many", () => {
    // Bei sehr viel Liquidität (5 Mio. Eigenmittel) werden im selben Monat so viele Wohnungen
    // gekauft, wie das Kapital hergibt (z. B. ein Zinshaus mit mehreren Einheiten) — sonst bliebe
    // weiter angespartes Eigenkapital ungenutzt liegen.
    const erg = simuliereImmoPortfolio({
      // dstiGrenzePct hochgesetzt: dieser Test prüft reine Liquiditäts-/Batch-Kauflogik, nicht die
      // (separat getestete) DSTI-Sperre — bei mehreren Käufen im selben Monat würde die reale
      // 40 %-Grenze sonst schon beim zweiten Objekt greifen.
      ...BASIS, eigenmittel: 5_000_000, sparbetragMonat: 0, horizontJahre: 6, dstiGrenzePct: 1000,
    })
    expect(erg.kaeufe.length).toBeGreaterThan(2)
  })

  it("buys a second property as soon as enough capital accumulates, with no artificial minimum spacing between purchases", () => {
    // Eigenmittel reicht knapp für genau eine Wohnung (~81.000 €), danach füllt der hohe
    // Sparbetrag den nötigen Eigenmittelbedarf für die zweite Wohnung binnen weniger Monate wieder
    // auf — es gibt keine künstliche Mindestpause mehr, die das verzögern würde.
    const erg = simuliereImmoPortfolio({
      // dstiGrenzePct hochgesetzt: dieser Test prüft den zeitlichen Abstand zwischen zwei Käufen,
      // nicht die DSTI-Sperre.
      ...BASIS, eigenmittel: 82000, sparbetragMonat: 15000, horizontJahre: 2, dstiGrenzePct: 1000,
    })
    expect(erg.kaeufe.length).toBeGreaterThanOrEqual(2)
    const [erste, zweite] = erg.kaeufe
    expect(zweite.monat - erste.monat).toBeLessThan(12)
  })

  it("refinancing at 100% LTV pays out exactly Verkehrswert − Restschuld − Kosten", () => {
    const erg = simuliereImmoPortfolio({
      // dstiGrenzePct hochgesetzt: dieser Test prüft die Auszahlungsformel der Umschuldung, nicht
      // die DSTI-Sperre.
      ...BASIS, bestandAnzahl: 1, bestandWert: 300000, bestandRestschuld: 150000,
      bestandRateMonat: 1000, bestandRestlaufzeitJahre: 25, horizontJahre: 5, dstiGrenzePct: 1000,
    })
    expect(erg.umschuldungen.length).toBeGreaterThan(0)
    const u = erg.umschuldungen[0]
    expect(u.auszahlung).toBeCloseTo(u.verkehrswert - u.restschuldAlt - u.kosten, 2)
  })

  it("allows a small cashflow-negative purchase but blocks it once the deficit would eat too far into net income", () => {
    // BASIS: 300k Kaufpreis, 80% LTV -> ~240k Kredit @ 3%/30J -> Rate knapp über der Miete (900),
    // also ein kleines strukturelles Minus pro Wohnung (~-110€/Monat) — für sich genommen kein
    // Problem, solange genug vom Nettoeinkommen übrig bleibt.
    const ergErlaubt = simuliereImmoPortfolio({
      ...BASIS, eigenmittel: 1_000_000, nettoeinkommenMonat: 3000, mindestResteinkommenMonat: 2500,
    })
    expect(ergErlaubt.kaeufe.length).toBeGreaterThan(0)

    const ergBlockiert = simuliereImmoPortfolio({
      ...BASIS, eigenmittel: 1_000_000, nettoeinkommenMonat: 3000, mindestResteinkommenMonat: 2999,
    })
    expect(ergBlockiert.kaeufe.length).toBe(0)
  })

  it("blocks a purchase once its DSTI would exceed dstiGrenzePct, even though cash and Resteinkommen would otherwise allow it (nur \"privat\")", () => {
    const basis: ImmoPortfolioEingabe = {
      ...BASIS, eigenmittel: 1_000_000, nettoeinkommenMonat: 3000, mindestResteinkommenMonat: 0,
    }
    // Ohne DSTI-Sperre (hoch gesetzt) kauft die permissive Resteinkommen-Sperre allein bereits.
    const ohneDsti = simuliereImmoPortfolio({ ...basis, dstiGrenzePct: 1000 })
    expect(ohneDsti.kaeufe.length).toBeGreaterThan(0)
    // Mit einer engen, bank-üblichen DSTI-Grenze wird derselbe Kauf blockiert, obwohl Kapital und
    // Resteinkommen längst reichen würden.
    const mitEngerDsti = simuliereImmoPortfolio({ ...basis, dstiGrenzePct: 10 })
    expect(mitEngerDsti.kaeufe).toHaveLength(0)
  })

  it("ignores dstiGrenzePct for rechtsform \"gmbh\" — eine Gesellschaft wird nicht gegen ein persönliches Einkommen geprüft", () => {
    const erg = simuliereImmoPortfolio({
      ...BASIS, rechtsform: "gmbh", eigenmittel: 1_000_000, nettoeinkommenMonat: 3000,
      mindestResteinkommenMonat: 0, dstiGrenzePct: 10,
    })
    expect(erg.kaeufe.length).toBeGreaterThan(0)
  })

  it("blocks a refinance that would push the portfolio deficit past what net income can cover, allows it once income is sufficient", () => {
    // Ein bestehendes Objekt mit billigem Altkredit (500 €/Monat) wird bei Umschuldung auf 100 %
    // Beleihung des vollen (viel höheren) Verkehrswerts umgeschuldet — die neue Rate ist um ein
    // Vielfaches höher als die alte. Regression für einen Vorzeichenfehler: die Sperre hatte die
    // alte Rate ab- statt aufaddiert und damit jede Umschuldung fälschlich als Verbesserung der
    // Cashflow bewertet, statt als Verschlechterung.
    const knapp = simuliereImmoPortfolio({
      ...BASIS, bestandAnzahl: 1, bestandWert: 800000, bestandRestschuld: 100000,
      bestandRateMonat: 500, bestandMieteMonat: 1000, bestandRestlaufzeitJahre: 25,
      umschuldungAlleJahre: 1, horizontJahre: 2, 
      nettoeinkommenMonat: 3000, mindestResteinkommenMonat: 1000,
    })
    expect(knapp.umschuldungen.length).toBe(0)

    const grosszuegig = simuliereImmoPortfolio({
      ...BASIS, bestandAnzahl: 1, bestandWert: 800000, bestandRestschuld: 100000,
      bestandRateMonat: 500, bestandMieteMonat: 1000, bestandRestlaufzeitJahre: 25,
      umschuldungAlleJahre: 1, horizontJahre: 2, 
      nettoeinkommenMonat: 10000, mindestResteinkommenMonat: 1000,
    })
    expect(grosszuegig.umschuldungen.length).toBeGreaterThan(0)
  })

  it("blocks a refinance once its DSTI would exceed dstiGrenzePct, even with plenty of net income (nur \"privat\")", () => {
    const basis: ImmoPortfolioEingabe = {
      ...BASIS, bestandAnzahl: 1, bestandWert: 800000, bestandRestschuld: 100000,
      bestandRateMonat: 500, bestandMieteMonat: 1000, bestandRestlaufzeitJahre: 25,
      umschuldungAlleJahre: 1, horizontJahre: 2,
      nettoeinkommenMonat: 10000, mindestResteinkommenMonat: 0,
    }
    const ohneDsti = simuliereImmoPortfolio({ ...basis, dstiGrenzePct: 1000 })
    expect(ohneDsti.umschuldungen.length).toBeGreaterThan(0)
    const mitEngerDsti = simuliereImmoPortfolio({ ...basis, dstiGrenzePct: 10 })
    expect(mitEngerDsti.umschuldungen.length).toBe(0)
  })

  it("wachstumsphaseJahre stoppt Käufe UND Umschuldungen ab dem angegebenen Jahr, in beiden Rechtsformen", () => {
    const basis: ImmoPortfolioEingabe = {
      // dstiGrenzePct hoch und nettoeinkommenMonat groß: die (separat getesteten) privaten
      // Einkommenssperren sollen hier nicht mit hineinspielen — nur wachstumsphaseJahre soll den
      // Unterschied machen, in beiden Rechtsformen gleichermaßen.
      ...BASIS, eigenmittel: 200000, sparbetragMonat: 3000, umschuldungAlleJahre: 2,
      horizontJahre: 20, wachstumsphaseJahre: 8, dstiGrenzePct: 1000,
      nettoeinkommenMonat: 1_000_000, mindestResteinkommenMonat: 0,
    }
    for (const rechtsform of ["privat", "gmbh"] as const) {
      const erg = simuliereImmoPortfolio({ ...basis, rechtsform })
      expect(erg.kaeufe.every((k) => k.jahr <= 8)).toBe(true)
      expect(erg.umschuldungen.every((u) => u.jahr <= 8)).toBe(true)
      // Nachweis, dass ohne die Grenze tatsächlich noch später gekauft/umgeschuldet worden wäre —
      // sonst würde der Test auch bei einem kaputten/wirkungslosen Feld grün bleiben.
      const ohneGrenze = simuliereImmoPortfolio({ ...basis, rechtsform, wachstumsphaseJahre: undefined })
      expect(ohneGrenze.kaeufe.some((k) => k.jahr > 8)).toBe(true)
    }
  })

  it("wachstumsphaseJahre lässt die Restschuld danach tatsächlich sinken (Abzahlphase) statt sie durch Umschuldung wieder hochzuziehen", () => {
    const erg = simuliereImmoPortfolio({
      ...BASIS, eigenmittel: 200000, sparbetragMonat: 3000, umschuldungAlleJahre: 2,
      horizontJahre: 20, wachstumsphaseJahre: 8, dstiGrenzePct: 1000,
      nettoeinkommenMonat: 1_000_000, mindestResteinkommenMonat: 0,
    })
    const jahr8 = erg.jahre[7]
    const jahr20 = erg.jahre[19]
    expect(jahr8.anzahlObjekte).toBe(jahr20.anzahlObjekte) // keine weiteren Käufe mehr
    expect(jahr20.restschuldGesamt).toBeLessThan(jahr8.restschuldGesamt) // echte Tilgung statt Refresh
  })

  it("marks a purchase funded entirely from refinancing proceeds as gratis, and a savings-funded one as not", () => {
    // Großer Bestand mit viel Umschuldungspotenzial finanziert die erste neue Wohnung gratis.
    // Die Bestand-Rate (2.000 €/Monat auf nur 100.000 € Restschuld) impliziert einen sehr hohen
    // Zinssatz, der nach der Umschuldung auf den vollen Verkehrswert eine enorme Cashflow-Last
    // erzeugt — nettoeinkommenMonat hier bewusst hoch, damit die harte Resteinkommen-Kaufsperre
    // (die genau davor schützen soll) nicht das eigentlich getestete Verhalten verdeckt.
    const erg = simuliereImmoPortfolio({
      ...BASIS, bestandAnzahl: 1, bestandWert: 800000, bestandRestschuld: 100000,
      bestandRateMonat: 2000, bestandRestlaufzeitJahre: 20, umschuldungAlleJahre: 1,
      horizontJahre: 10, nettoeinkommenMonat: 1_000_000,
    })
    expect(erg.kaeufe.length).toBeGreaterThan(0)
    expect(erg.kaeufe[0].istGratis).toBe(true)

    // Ohne Bestand und ohne Wertzuwachs kann nichts umgeschuldet werden — der Kauf kommt
    // ausschließlich aus dem Spartopf und ist daher nicht gratis.
    const ergSpar = simuliereImmoPortfolio({
      ...BASIS, eigenmittel: 100000, sparbetragMonat: 2000, wertzuwachsPct: 0,
      umschuldungAlleJahre: 100, horizontJahre: 10,
    })
    expect(ergSpar.kaeufe.length).toBeGreaterThan(0)
    expect(ergSpar.kaeufe[0].istGratis).toBe(false)
    expect(ergSpar.kaeufe[0].gratisAnteilPct).toBeCloseTo(0, 6)
  })

  it("pays a never-refinanced loan down to exactly zero after its own laufzeitJahre", () => {
    // Eigenmittel bewusst knapp über dem Bedarf einer einzelnen Wohnung (rund 81.000 €), damit
    // trotz des Mehrfachkauf-Batches innerhalb desselben Monats nur eine einzige Wohnung gekauft
    // wird — die Restschuld eines isolierten, nie umgeschuldeten Kredits soll geprüft werden.
    const erg = simuliereImmoPortfolio({
      // dstiGrenzePct hochgesetzt: die kurze Laufzeit (10 Jahre) treibt die Rate so hoch, dass sie
      // die reale 40 %-DSTI-Grenze sprengen würde — dieser Test prüft aber die Tilgung, nicht die
      // DSTI-Sperre.
      ...BASIS, eigenmittel: 90_000, umschuldungAlleJahre: 1000,
      laufzeitJahre: 10, horizontJahre: 20, dstiGrenzePct: 1000,
    })
    expect(erg.kaeufe).toHaveLength(1)
    const kaufJahr = erg.kaeufe[0].jahr
    const jahrNachAblauf = erg.jahre[kaufJahr + 10 - 1]
    expect(jahrNachAblauf.restschuldGesamt).toBe(0)
  })

  it("total AfA across all objects never exceeds the sum of their Gebäudewerte", () => {
    const erg = simuliereImmoPortfolio({
      ...BASIS, eigenmittel: 1_000_000, sparbetragMonat: 3000, horizontJahre: 20,
    })
    const summeAfa = erg.jahre.reduce((s, j) => s + j.afaGesamt, 0)
    const summeGebaeudewerte = erg.kaeufe.reduce((s, k) => s + k.kaufpreis * 0.8, 0)
    expect(summeAfa).toBeLessThanOrEqual(summeGebaeudewerte + 1e-6)
  })

  it("indexes rent by the compounded Indexierungssatz year over year", () => {
    const erg = simuliereImmoPortfolio({
      ...BASIS, bestandAnzahl: 1, bestandWert: 300000, bestandRestschuld: 0, bestandRateMonat: 0,
      bestandRestlaufzeitJahre: 1, bestandMieteMonat: 1000, indexierungPct: 2,
      // Kaufpreisreferenz absichtlich unerreichbar hoch, damit im Betrachtungszeitraum keine
      // zusätzliche Wohnung dazukommt und die Bestandsmiete isoliert geprüft werden kann.
      kaufpreisReferenz: 50_000_000, wertzuwachsPct: 0, horizontJahre: 10,
    })
    const jahr10Miete = erg.jahre[9].mieteinnahmen
    expect(jahr10Miete).toBeCloseTo(1000 * 12 * Math.pow(1.02, 9), 0)
  })

  it("milestones always include the final horizon year, not just fixed 10/15/20 checkpoints", () => {
    const erg = simuliereImmoPortfolio({ ...BASIS, eigenmittel: 1_000_000, horizontJahre: 22 })
    const letzterMeilenstein = erg.meilensteine[erg.meilensteine.length - 1]
    expect(letzterMeilenstein.jahr).toBe(22)
    expect(letzterMeilenstein.anzahlObjekte).toBe(erg.jahre[21].anzahlObjekte)
  })

  it("the gratis count at the last milestone matches the overall gratis count, and eigenmitteleinsatzKumuliert equals the sum of self-funded purchase shares", () => {
    const erg = simuliereImmoPortfolio({
      ...BASIS, eigenmittel: 1_000_000, sparbetragMonat: 2000, bestandAnzahl: 1, bestandWert: 500000,
      bestandRestschuld: 100000, bestandRateMonat: 1000, bestandRestlaufzeitJahre: 20,
      umschuldungAlleJahre: 2, horizontJahre: 20,
    })
    const letzterMeilenstein = erg.meilensteine[erg.meilensteine.length - 1]
    expect(letzterMeilenstein.davonGratis).toBe(erg.kennzahlen.anzahlGratis)

    const summeEigenmittelAnteil = erg.kaeufe.reduce((s, k) => s + k.eigenmittelAnteil, 0)
    const letztesJahrKumuliert = erg.jahre[erg.jahre.length - 1].eigenmitteleinsatzKumuliert
    expect(letztesJahrKumuliert).toBeCloseTo(summeEigenmittelAnteil, 2)

    // eigenmitteleinsatzKumuliert darf über die Jahre nie sinken.
    for (let i = 1; i < erg.jahre.length; i++) {
      expect(erg.jahre[i].eigenmitteleinsatzKumuliert).toBeGreaterThanOrEqual(erg.jahre[i - 1].eigenmitteleinsatzKumuliert)
    }
  })

  it("never lets liquiditaet go negative — a deep cashflow deficit is bridged from net income instead of an overdraft", () => {
    // Bestand mit stark negativem Cashflow (Miete 200 € vs. Rate 3.000 €/Monat) und ohne jedes
    // Sparen/Eigenmittel — ohne Deckelung würde die Liquidität sofort und dauerhaft negativ.
    const erg = simuliereImmoPortfolio({
      ...BASIS, bestandAnzahl: 1, bestandWert: 300000, bestandRestschuld: 200000, bestandRateMonat: 3000,
      bestandMieteMonat: 200, bestandRestlaufzeitJahre: 20, horizontJahre: 5,
    })
    expect(erg.jahre.every((j) => j.liquiditaet >= 0)).toBe(true)
    expect(erg.jahre[erg.jahre.length - 1].liquiditaetsNachschussKumuliert).toBeGreaterThan(0)
    // liquiditaetsNachschussKumuliert darf über die Jahre nie sinken.
    for (let i = 1; i < erg.jahre.length; i++) {
      expect(erg.jahre[i].liquiditaetsNachschussKumuliert).toBeGreaterThanOrEqual(erg.jahre[i - 1].liquiditaetsNachschussKumuliert)
    }
    expect(erg.warnungen.some((w) => w.includes("zugeschossen"))).toBe(true)
  })

  it("a tax loss produces a positive steuerEffekt (credit), a taxable profit a negative one", () => {
    const erg = simuliereImmoPortfolio({
      ...BASIS, bestandAnzahl: 1, bestandWert: 300000, bestandRestschuld: 0, bestandRateMonat: 0,
      bestandRestlaufzeitJahre: 1, bestandMieteMonat: 3000, grenzsteuersatzPct: 40,
      horizontJahre: 3,
    })
    for (const j of erg.jahre) {
      if (j.steuerErgebnis < 0) expect(j.steuerEffekt).toBeGreaterThan(0)
      if (j.steuerErgebnis > 0) expect(j.steuerEffekt).toBeLessThan(0)
    }
  })

  it("gives a December purchase the full 3x accelerated AfA in the following full year instead of skipping it (A1 regression)", () => {
    // eigenmittel 75.000 € + 500 €/Monat Sparen trifft den Eigenmittelbedarf (81.000 €) exakt nach
    // 12 Monaten -> Kauf im Dezember des ersten Jahres. Der niedrige Sparbetrag danach (statt
    // hoher Sparbetrag, der ohne Mindestabstand rasch einen zweiten Kauf finanzieren würde) stellt
    // sicher, dass innerhalb des Betrachtungszeitraums nur dieser eine Kauf stattfindet.
    const erg = simuliereImmoPortfolio({
      ...BASIS, eigenmittel: 75000, wertzuwachsPct: 0, sparbetragMonat: 500, horizontJahre: 3,
    })
    expect(erg.kaeufe).toHaveLength(1)
    expect(erg.kaeufe[0].monat).toBe(12)
    // Kaufjahr selbst: das Objekt existierte beim Jahresend-AfA-Block noch nicht -> keine AfA.
    expect(erg.jahre[0].afaGesamt).toBe(0)
    // Jahr 2: die volle 3-fache AfA aus afaJahr1 muss jetzt tatsächlich angesetzt werden, nicht
    // die (übersprungene) 2-fache.
    expect(erg.kaeufe[0].afaJahr1).toBeGreaterThan(0)
    expect(erg.jahre[1].afaGesamt).toBeCloseTo(erg.kaeufe[0].afaJahr1, 2)
  })

  it("leaves a real remaining balance for a Bestand loan whose rate cannot amortize it in its Restlaufzeit, instead of forcing it to zero (A2 regression)", () => {
    const erg = simuliereImmoPortfolio({
      ...BASIS, bestandAnzahl: 1, bestandWert: 300000, bestandRestschuld: 200000, bestandRateMonat: 500,
      bestandRestlaufzeitJahre: 5, bestandAnschaffungskosten: 200000, horizontJahre: 5, 
    })
    // 500 €/Monat * 60 Monate = 30.000 € < 200.000 € Restschuld, selbst bei 0 % Zinsen -> es bleibt
    // eine echte Restschuld offen (rund 170.000 €), statt auf 0 zu springen.
    expect(erg.jahre[4].restschuldGesamt).toBeGreaterThan(100000)
    expect(erg.warnungen.some((w) => w.includes("tilgt die angegebene Restschuld"))).toBe(true)
  })

  it("resolves the circularity of financed Kreditnebenkosten exactly, matching kredit.ts's Auflösungsformel (A6 regression)", () => {
    const saetze = { ...KREDIT_DEFAULTS }
    const erg = simuliereImmoPortfolio({
      ...BASIS, eigenmittel: 85000, sparbetragMonat: 0, wertzuwachsPct: 0, 
      horizontJahre: 1, nkMitfinanziert: true, ltvKaufPct: 80, saetze,
    })
    expect(erg.kaeufe).toHaveLength(1)
    const kreditbetrag = erg.kaeufe[0].kaufpreis * 0.8
    const r = saetze.kreditvertragserstellungPct / 100
      + (saetze.pfandrechtPct / 100) * (1 + saetze.nebengebuehrensicherstellungPct / 100)
    const erwarteterKreditGesamt = (kreditbetrag + saetze.sonstigeKreditNK) / (1 - r)
    const erwarteteRate = berechneTilgungsplan(erwarteterKreditGesamt, BASIS.zinssatzPct, BASIS.laufzeitJahre).rate
    expect(erg.kaeufe[0].rate).toBeCloseTo(erwarteteRate, 2)
  })

  it("counts each Bestand unit individually in anzahlObjekte instead of collapsing the whole Bestand into 1 (C1 regression)", () => {
    const erg = simuliereImmoPortfolio({
      ...BASIS, bestandAnzahl: 4, bestandWert: 400000, bestandRestschuld: 100000, bestandRateMonat: 1000,
      bestandRestlaufzeitJahre: 20, horizontJahre: 1, 
    })
    expect(erg.jahre[0].anzahlObjekte).toBe(4)
  })

  it("flags an object whose own first 20 years show a cumulative tax loss as a Liebhaberei risk, evaluated per object rather than on the portfolio saldo (E3 regression)", () => {
    const verlust = simuliereImmoPortfolio({
      ...BASIS, bestandAnzahl: 1, bestandWert: 300000, bestandRestschuld: 200000, bestandRateMonat: 1200,
      bestandRestlaufzeitJahre: 20, bestandMieteMonat: 300, bestandAnschaffungskosten: 200000,
      horizontJahre: 20, 
    })
    expect(verlust.warnungen.some((w) => w.includes("Liebhaberei-Risiko") && w.includes("Bestand"))).toBe(true)

    const ueberschuss = simuliereImmoPortfolio({
      ...BASIS, bestandAnzahl: 1, bestandWert: 300000, bestandRestschuld: 0, bestandRateMonat: 0,
      bestandRestlaufzeitJahre: 1, bestandMieteMonat: 2000, bestandAnschaffungskosten: 200000,
      horizontJahre: 20, 
    })
    expect(ueberschuss.warnungen.some((w) => w.includes("Liebhaberei-Risiko"))).toBe(false)
  })

  it("applies 25% KESt to Guthabenzinsen instead of leaving them untaxed (E2/B5 regression)", () => {
    const erg = simuliereImmoPortfolio({
      ...BASIS, eigenmittel: 1_000_000, guthabenzinsPct: 12, sparbetragMonat: 0, horizontJahre: 1,
      // Kein Kauf möglich, damit die Liquiditätsentwicklung isoliert geprüft werden kann.
      kaufpreisReferenz: 50_000_000, wertzuwachsPct: 0,
    })
    const j = erg.jahre[0]
    // Ohne KESt wäre die Liquidität am Jahresende ~1.000.000 * 1{,}12 = 1.120.000 €.
    expect(j.liquiditaet).toBeLessThan(1_120_000)
    expect(j.liquiditaet).toBeGreaterThan(1_080_000)
  })

  it("computes nettovermoegenNachSteuer as nettovermoegen minus 30% ImmoESt auf den Wertzuwachs (B6/E8 regression)", () => {
    const erg = simuliereImmoPortfolio({
      ...BASIS, bestandAnzahl: 1, bestandWert: 300000, bestandAnschaffungskosten: 100000, bestandRestschuld: 0,
      bestandRateMonat: 0, bestandRestlaufzeitJahre: 1, bestandMieteMonat: 0, horizontJahre: 1,
      wertzuwachsPct: 0,
    })
    const j = erg.jahre[0]
    expect(j.nettovermoegenNachSteuer).toBeLessThan(j.nettovermoegen)
    expect(j.nettovermoegen - j.nettovermoegenNachSteuer).toBeGreaterThan(50000)
  })
})

describe("berechneImpliziterZinssatzPct", () => {
  it("reproduces the nominal rate used to build the underlying annuity", () => {
    // 200k, 3% nominal, 25 Jahre -> Rate/Restschuld nach 5 Jahren rückrechnen.
    const zinsPct = 3
    const iMonat = zinsPct / 100 / 12
    const nGesamt = 25 * 12
    const rate = (200000 * iMonat) / (1 - Math.pow(1 + iMonat, -nGesamt))
    const implied = berechneImpliziterZinssatzPct(200000, rate, nGesamt)
    expect(implied).toBeCloseTo(zinsPct, 1)
  })

  it("returns 0 for degenerate inputs instead of NaN", () => {
    expect(berechneImpliziterZinssatzPct(0, 1000, 300)).toBe(0)
    expect(berechneImpliziterZinssatzPct(100000, 0, 300)).toBe(0)
    expect(berechneImpliziterZinssatzPct(100000, 1000, 0)).toBe(0)
  })
})

describe("berechnePortfolioIrrPct", () => {
  it("returns null when no capital was ever contributed", () => {
    expect(berechnePortfolioIrrPct(0, 0, 120, 500000)).toBeNull()
  })

  it("returns a positive rate when the end value clearly exceeds the contributions", () => {
    const irr = berechnePortfolioIrrPct(50000, 500, 120, 300000)
    expect(irr).not.toBeNull()
    expect(irr as number).toBeGreaterThan(0)
  })

  it("stays within a sane range over a long 40-year horizon instead of overflowing to Infinity/NaN", () => {
    // Regression: eine zu extreme untere Bisection-Grenze (−0,99/Monat) ließ (1+i)^-m bei
    // vielen Monaten in Infinity/NaN kippen und produzierte astronomisch falsche IRR-Werte.
    const irr = berechnePortfolioIrrPct(80000, 1000, 480, 521094)
    expect(irr).not.toBeNull()
    expect(Number.isFinite(irr as number)).toBe(true)
    expect(irr as number).toBeGreaterThan(-50)
    expect(irr as number).toBeLessThan(50)
  })
})

describe("berechneKoestEffekt (rechtsform \"gmbh\")", () => {
  it("gives no immediate credit for a loss (unlike the private Grenzsteuersatz-Gutschrift), only a carryforward, but still owes the Mindest-KöSt", () => {
    const zustand: KoestZustand = { verlustvortrag: 0, mindestKoestGuthaben: 0 }
    const effekt = berechneKoestEffekt(-1200, zustand)
    expect(effekt).toBe(-500)
    expect(zustand.verlustvortrag).toBe(1200)
    expect(zustand.mindestKoestGuthaben).toBe(500)
  })

  it("caps loss-carryforward usage at 75 % of the current year's profit (§ 8 Abs. 4 Z 2 lit. a KStG)", () => {
    const zustand: KoestZustand = { verlustvortrag: 10000, mindestKoestGuthaben: 0 }
    // verrechenbar = min(10000, 1000*0.75) = 750 -> tatsächlich = (1000-750)*0.23 = 57.5 -> koest = max(57.5, 500) = 500
    const effekt = berechneKoestEffekt(1000, zustand)
    expect(zustand.verlustvortrag).toBeCloseTo(10000 - 750, 6)
    expect(effekt).toBeCloseTo(-500, 6)
  })

  it("credits previously paid Mindest-KöSt once a later year's actual tax exceeds it", () => {
    const zustand: KoestZustand = { verlustvortrag: 0, mindestKoestGuthaben: 500 }
    // tatsächlich = 5000*0.23 = 1150 -> koest = 1150 -> anrechnung = min(500, 1150-500) = 500
    const effekt = berechneKoestEffekt(5000, zustand)
    expect(effekt).toBeCloseTo(-(1150 - 500), 6)
    expect(zustand.mindestKoestGuthaben).toBe(0)
  })

  it("never returns a positive (credit) effect, regardless of how large the loss", () => {
    const zustand: KoestZustand = { verlustvortrag: 0, mindestKoestGuthaben: 0 }
    expect(berechneKoestEffekt(-500000, zustand)).toBe(-500)
  })
})

describe("simuliereImmoPortfolio — rechtsform \"gmbh\"", () => {
  it("defaults to rechtsform \"privat\" when the field is omitted (no behaviour change for existing callers)", () => {
    const ohneFeld = simuliereImmoPortfolio(BASIS)
    const mitPrivat = simuliereImmoPortfolio({ ...BASIS, rechtsform: "privat" })
    expect(ohneFeld).toEqual(mitPrivat)
  })

  it("ignoriert die Netto-Haushaltseinkommen-Kaufsperre — anders als \"privat\" kauft die GmbH auch bei einem hauchdünn negativen Cashflow und nettoeinkommenMonat=0", () => {
    // Regressionstest für ein real gemeldetes Szenario: Kaufpreis 150.000 €, 80 % Beleihung,
    // 3 % Zins, 35 Jahre Laufzeit ergibt eine Rate von ca. 462 €/Monat; Miete 495 € abzüglich
    // 45 € Instandhaltung ergibt einen operativen Cashflow von nur rund -12 €/Monat. Mit
    // nettoeinkommenMonat = 0 und mindestResteinkommenMonat = 0 blockierte das bei "privat"
    // (korrekt) jeden Kauf — bei "gmbh" ist ein "Netto-Haushaltseinkommen" aber kein sinnvolles
    // Konzept, dort darf allein das vorhandene Kapital (Eigenmittel + Sparbetrag) entscheiden.
    const basis: ImmoPortfolioEingabe = {
      ...BASIS,
      eigenmittel: 20000, sparbetragMonat: 2000, guthabenzinsPct: 6, horizontJahre: 13,
      nettoeinkommenMonat: 0, lebenshaltungMonat: 0, mindestResteinkommenMonat: 0,
      kaufpreisReferenz: 150000, wohnflaecheM2: 45, ltvKaufPct: 80, laufzeitJahre: 35, zinssatzPct: 3,
      mitMakler: true, mieteMonat: 495, instandhaltungProM2Monat: 1, wertzuwachsPct: 2,
    }
    const privat = simuliereImmoPortfolio({ ...basis, rechtsform: "privat" })
    const gmbh = simuliereImmoPortfolio({ ...basis, rechtsform: "gmbh" })
    expect(privat.kaeufe).toHaveLength(0)
    expect(gmbh.kaeufe.length).toBeGreaterThan(0)
  })

  it("taxes a profit year at the flat 23 % KöSt rate, independent of Grenzsteuersatz", () => {
    const basis: ImmoPortfolioEingabe = {
      ...BASIS,
      rechtsform: "gmbh",
      kaufpreisReferenz: 50000, // unter KAUFPREIS_MINDESTGRENZE -> keine neuen Käufe
      wertzuwachsPct: 0, indexierungPct: 0,
      bestandAnzahl: 1, bestandWert: 300000, bestandRestschuld: 0, bestandRateMonat: 0,
      bestandMieteMonat: 2000, bestandRestlaufzeitJahre: 0,
      bestandAnschaffungskosten: 300000, bestandAfaJahreVerbraucht: 1000, // bereits voll abgeschrieben
      horizontJahre: 1,
    }
    const mit40 = simuliereImmoPortfolio({ ...basis, grenzsteuersatzPct: 40 })
    const mit0 = simuliereImmoPortfolio({ ...basis, grenzsteuersatzPct: 0 })
    // steuerErgebnis = 2000*12 = 24000 -> KöSt = 24000*0.23 = 5520 (über der Mindest-KöSt)
    expect(mit40.jahre[0].steuerEffekt).toBeCloseTo(-5520, 2)
    expect(mit0.jahre[0].steuerEffekt).toBeCloseTo(-5520, 2)
  })

  it("includes Guthabenzinsen ungekürzt (no KESt) in the taxable result, unlike \"privat\" where they stay outside steuerErgebnis", () => {
    const basis: ImmoPortfolioEingabe = {
      ...BASIS,
      kaufpreisReferenz: 50000, eigenmittel: 100000, guthabenzinsPct: 5, horizontJahre: 1,
    }
    const privat = simuliereImmoPortfolio({ ...basis, rechtsform: "privat" })
    const gmbh = simuliereImmoPortfolio({ ...basis, rechtsform: "gmbh" })
    expect(privat.jahre[0].steuerErgebnis).toBe(0)
    expect(gmbh.jahre[0].steuerErgebnis).toBeGreaterThan(4900)
    expect(gmbh.jahre[0].steuerErgebnis).toBeLessThan(5200)
  })

  it("deducts one-off Gründungskosten and running Fixkosten from liquidity and carries them as a Verlustvortrag", () => {
    const basis: ImmoPortfolioEingabe = {
      ...BASIS,
      rechtsform: "gmbh",
      kaufpreisReferenz: 50000, eigenmittel: 200000, sparbetragMonat: 0, guthabenzinsPct: 0,
      horizontJahre: 1,
    }
    const ohneKosten = simuliereImmoPortfolio({ ...basis, gmbhGruendungskostenEinmalig: 0, gmbhFixkostenJahr: 0 })
    const mitKosten = simuliereImmoPortfolio({ ...basis, gmbhGruendungskostenEinmalig: 5000, gmbhFixkostenJahr: 1200 })
    // Beide landen bei der Mindest-KöSt (0 bzw. -6200 Ergebnis sind beides ein Verlustjahr) — der
    // gesamte Unterschied in der Liquidität ist daher exakt der zusätzliche Kosten-Cashout.
    expect(ohneKosten.jahre[0].liquiditaet - mitKosten.jahre[0].liquiditaet).toBeCloseTo(5000 + 1200, 2)
    expect(ohneKosten.jahre[0].verlustvortrag).toBe(0)
    expect(mitKosten.jahre[0].verlustvortrag).toBeCloseTo(5000 + 1200, 2)
  })

  it("saldiert Objekt-Veräußerungsgewinne und -verluste beim gedachten Verkauf, anders als \"privat\" (das je Objekt bei 0 kappt)", () => {
    const basis: ImmoPortfolioEingabe = {
      ...BASIS,
      eigenmittel: 50000, sparbetragMonat: 0, guthabenzinsPct: 0,
      kaufpreisReferenz: 100000, wertzuwachsPct: 5, indexierungPct: 0,
      bestandAnzahl: 1, bestandWert: 100000, bestandRestschuld: 0, bestandRateMonat: 0,
      bestandMieteMonat: 0, bestandRestlaufzeitJahre: 0,
      // Historisch deutlich teurer eingekauft als der heutige Verkehrswert -> ein klarer Buchverlust.
      bestandAnschaffungskosten: 150000, bestandAfaJahreVerbraucht: 1000,
      horizontJahre: 1,
    }
    const privat = simuliereImmoPortfolio({ ...basis, rechtsform: "privat" })
    const gmbh = simuliereImmoPortfolio({ ...basis, rechtsform: "gmbh" })
    // Vorbedingung: die zweite Wohnung wurde tatsächlich gekauft, sonst testet dieser Fall nichts.
    expect(gmbh.kaeufe.length).toBeGreaterThan(0)
    expect(privat.kaeufe.length).toBeGreaterThan(0)
    // Privat: der Bestandsverlust wird bei 0 gekappt, die neue Wohnung trägt trotzdem ihre eigene
    // ImmoESt -> Verkaufssteuer > 0.
    expect(privat.jahre[0].verkaufssteuer).toBeGreaterThan(0)
    // GmbH: derselbe Bestandsverlust mindert den Gewinn der neuen Wohnung (Saldierung) -> der
    // Gesamtsaldo ist hier ein Verlust, also keine Verkaufssteuer.
    expect(gmbh.jahre[0].verkaufssteuer).toBe(0)
  })

  it("bis zur Höhe der kumulierten Einlagen ist eine Vollausschüttung KESt-frei, nur der Überschuss trägt 27,5 % KESt", () => {
    const kleinesPolster = simuliereImmoPortfolio({
      ...BASIS, rechtsform: "gmbh",
      kaufpreisReferenz: 50000, eigenmittel: 100000, sparbetragMonat: 0, guthabenzinsPct: 0,
      horizontJahre: 1,
    })
    // Reine Mindest-KöSt-Belastung, kein Gewinn -> Nettovermögen bleibt unter den Einlagen ->
    // die volle Ausschüttung ist KESt-frei.
    expect(kleinesPolster.jahre[0].nettovermoegenNachAusschuettung).toBeCloseTo(
      kleinesPolster.jahre[0].nettovermoegenNachSteuer, 6
    )

    const mitUeberschuss = simuliereImmoPortfolio({
      ...BASIS, rechtsform: "gmbh",
      kaufpreisReferenz: 50000, eigenmittel: 100000, sparbetragMonat: 0, guthabenzinsPct: 8,
      horizontJahre: 20,
    })
    const letztes = mitUeberschuss.jahre[mitUeberschuss.jahre.length - 1]
    expect(letztes.nettovermoegenNachSteuer).toBeGreaterThan(letztes.einlagenKumuliert)
    expect(letztes.nettovermoegenNachAusschuettung).not.toBeNull()
    expect(letztes.nettovermoegenNachAusschuettung as number).toBeLessThan(letztes.nettovermoegenNachSteuer)
    expect(letztes.nettovermoegenNachAusschuettung as number).toBeGreaterThan(letztes.einlagenKumuliert)
  })

  it("ein gedachter Verkauf verändert den Verlustvortrag der Folgejahre nicht (nur eine Momentaufnahme)", () => {
    const erg = simuliereImmoPortfolio({
      ...BASIS, rechtsform: "gmbh",
      kaufpreisReferenz: 50000, eigenmittel: 0, sparbetragMonat: 0, guthabenzinsPct: 0,
      wertzuwachsPct: 0, indexierungPct: 0,
      bestandAnzahl: 1, bestandWert: 200000, bestandRestschuld: 0, bestandRateMonat: 0,
      bestandMieteMonat: 0, sonstigeKostenMonat: 100, bestandRestlaufzeitJahre: 0,
      // Deutlicher Buchgewinn (200.000 Verkehrswert vs. 100.000 Anschaffungskosten), gleichzeitig
      // ein laufender operativer Verlust (Kosten ohne Miete) -> die Verkaufssteuer-Berechnung
      // "verbraucht" im ersten Jahr einen Teil des frisch entstandenen Verlustvortrags, ohne dass
      // dieser Verbrauch in den echten Zustand der weiterlaufenden Simulation durchschlagen darf.
      bestandAnschaffungskosten: 100000, bestandAfaJahreVerbraucht: 1000,
      horizontJahre: 2,
    })
    expect(erg.jahre[0].verlustvortrag).toBeCloseTo(1200, 6)
    expect(erg.jahre[0].verkaufssteuer).toBeGreaterThan(0)
    // Jahr 2 verliert erneut 1.200 € operativ — stünde der Verlustvortrag nach der (nur gedachten)
    // Verkaufssteuer-Berechnung aus Jahr 1 tatsächlich bei 0, läge er hier bei 1.200 statt 2.400.
    expect(erg.jahre[1].verlustvortrag).toBeCloseTo(2400, 6)
  })
})

describe("berechneAfaJahreLinear", () => {
  it("applies the same factor-1 rate every year, unlike the accelerated schedule", () => {
    const jahre = berechneAfaJahreLinear(320000, 1.5, 5)
    const normaleAfa = 320000 * 0.015
    expect(jahre.every((j) => j.faktor === 1)).toBe(true)
    expect(jahre.every((j) => j.afa === normaleAfa)).toBe(true)
  })

  it("caps cumulative AfA at the Bemessungsgrundlage", () => {
    const jahre = berechneAfaJahreLinear(10000, 50, 5)
    const summe = jahre.reduce((s, j) => s + j.afa, 0)
    expect(summe).toBeLessThanOrEqual(10000)
  })

  it("starts the cumulative total already reduced by years already depreciated before simulation start (A5 support)", () => {
    const jahre = berechneAfaJahreLinear(100000, 2, 3, 10) // 10 Jahre bereits à 2 % = 20.000 € verbraucht
    expect(jahre[0].afa).toBeCloseTo(2000, 6)
    expect(jahre[0].afaKumuliert).toBeCloseTo(22000, 6)
  })
})
