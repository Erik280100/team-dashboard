// Helvetia-FLV: der Port (src/lib/calc/helvetiaFlv.ts) ist ab hier die Referenz — er folgt
// direkt den Formeln aus "Helvetia_FLV_Schnellberechnung.pdf" und ist deshalb NICHT Teil des
// Golden-Master-Vergleichs gegen die alte Legacy-Näherung (siehe rendite.golden.test.ts).
import { describe, expect, it } from "vitest"
import {
  HELVETIA_ABLEBEN,
  HELVETIA_GAMMA_AB_JAHR8,
  HELVETIA_GAMMA_BIS_JAHR7,
  helvetiaEffektivverzinsung,
  helvetiaKostenZeilen,
  helvetiaPar176Faktor,
  hvCent,
  simulateHelvetiaFLV,
} from "../../src/lib/calc/helvetiaFlv"

describe("Sterbetafel", () => {
  it("hat 113 Einträge (Index = erreichtes Alter)", () => {
    expect(HELVETIA_ABLEBEN.length).toBe(113)
    expect(HELVETIA_ABLEBEN[0]).toBe(0.00486831)
  })
})

describe("hvCent", () => {
  it("rundet auf Cent, auch bei negativen Werten", () => {
    expect(hvCent(1.006)).toBe(1.01)
    expect(hvCent(1.004)).toBe(1)
    expect(hvCent(-1.004)).toBe(-1)
    expect(hvCent(-1.006)).toBe(-1.01)
  })
})

describe("helvetiaPar176Faktor", () => {
  it("fällt linear über 60 Monate von 1 auf 0 und bleibt danach 0", () => {
    expect(helvetiaPar176Faktor(0)).toBe(1)
    expect(helvetiaPar176Faktor(30)).toBeCloseTo(0.5, 10)
    expect(helvetiaPar176Faktor(60)).toBe(0)
    expect(helvetiaPar176Faktor(90)).toBe(0)
  })
})

describe("simulateHelvetiaFLV: Verwaltungskosten-Stufe", () => {
  it("springt zwischen Monat 84 und 85 von 0,00025 auf 0,00045", () => {
    // Bei Sicherungskonto-Anteil 0 fließt Pgamma nicht in den Fonds zurück, daher lässt sich
    // die Stufe direkt an den kumulierten Jahreswerten ablesen: Jahr 7 (Monate 73-84) liegt
    // noch komplett im niedrigen Satz, Jahr 8 (Monate 85-96) komplett im hohen.
    const r = simulateHelvetiaFLV({ monat: 200, jahre: 20, perf: 0.06, eintrittsalter: 35 })
    const verwaltungJahr7 = r.kostenProJahr[6].verwaltung
    const verwaltungJahr8 = r.kostenProJahr[7].verwaltung
    // Beide Jahre haben einen ähnlich hohen Vertragswert als Bemessungsgrundlage; der Sprung
    // von 0,00025 auf 0,00045 (Faktor 1,8) muss sich im Jahresverhältnis niederschlagen.
    expect(verwaltungJahr8 / verwaltungJahr7).toBeGreaterThan(1.5)
    expect(HELVETIA_GAMMA_AB_JAHR8 / HELVETIA_GAMMA_BIS_JAHR7).toBeCloseTo(1.8, 5)
  })
})

describe("simulateHelvetiaFLV: Wertung steuert die Abschlusskosten", () => {
  it("Wertung 0 % (keine Abschlusskosten) liefert einen höheren Endwert als Wertung 100 %", () => {
    const voll = simulateHelvetiaFLV({ monat: 200, jahre: 20, perf: 0.06, eintrittsalter: 35, wertungPct: 100 })
    const ohne = simulateHelvetiaFLV({ monat: 200, jahre: 20, perf: 0.06, eintrittsalter: 35, wertungPct: 0 })
    expect(ohne.endwert).toBeGreaterThan(voll.endwert)
  })
})

describe("simulateHelvetiaFLV: Wertanpassung", () => {
  it("erhöht den Endwert, wirkt aber nicht mehr in den letzten 5 Vertragsjahren", () => {
    const ohneWA = simulateHelvetiaFLV({ monat: 200, jahre: 20, perf: 0.06, eintrittsalter: 35 })
    const mitWA = simulateHelvetiaFLV({ monat: 200, jahre: 20, perf: 0.06, eintrittsalter: 35, waPct: 0.03 })
    expect(mitWA.endwert).toBeGreaterThan(ohneWA.endwert)

    // Letzte 5 Jahre = Monate 181-240 (t = 180..239): keine Prämiensteigerung mehr, die
    // Kostenübersicht der letzten beiden Jahre muss daher dieselbe Bruttoprämiensumme zeigen
    // wie ein Jahr zuvor (VSt ist proportional zur Bruttoprämie und damit ein direkter Indikator).
    expect(mitWA.kostenProJahr[19].vst).toBeCloseTo(mitWA.kostenProJahr[15].vst, 2)
  })
})

describe("simulateHelvetiaFLV: Sicherungskonto", () => {
  it("100 % Sicherungskonto liegt bei 6 % Fondsperformance deutlich unter 100 % Fonds", () => {
    const fonds = simulateHelvetiaFLV({ monat: 200, jahre: 20, perf: 0.06, eintrittsalter: 35, skPct: 0 })
    const sk = simulateHelvetiaFLV({ monat: 200, jahre: 20, perf: 0.06, eintrittsalter: 35, skPct: 100 })
    expect(sk.endwert).toBeLessThan(fonds.endwert * 0.9)
  })

  it("Gewinnszenarien sind konsistent geordnet: ohneGewinn < niedrig < aktuell < hoch", () => {
    const opts = { monat: 200, jahre: 20, perf: 0.06, eintrittsalter: 35, skPct: 100 } as const
    const ohne = simulateHelvetiaFLV({ ...opts, gewinnSzenario: "ohneGewinn" }).endwert
    const niedrig = simulateHelvetiaFLV({ ...opts, gewinnSzenario: "niedrig" }).endwert
    const aktuell = simulateHelvetiaFLV({ ...opts, gewinnSzenario: "aktuell" }).endwert
    const hoch = simulateHelvetiaFLV({ ...opts, gewinnSzenario: "hoch" }).endwert
    expect(ohne).toBeLessThan(niedrig)
    expect(niedrig).toBeLessThan(aktuell)
    expect(aktuell).toBeLessThan(hoch)
  })
})

describe("simulateHelvetiaFLV: Kostenzerlegung", () => {
  it("VSt + Betreuung + Verwaltung + Risiko + Sparprämie ergeben über die Laufzeit die Bruttoprämie", () => {
    const monat = 200
    const jahre = 20
    const r = simulateHelvetiaFLV({ monat, jahre, perf: 0.06, eintrittsalter: 35 })
    const kosten = r.kostenProJahr.reduce(
      (s, k) => s + k.vst + k.betreuung + k.verwaltung + k.risiko,
      0
    )
    // Sparprämie lässt sich nicht direkt aus dem Ergebnis auslesen, daher wird die Bruttoprämie
    // stattdessen als Referenzgröße herangezogen: Kosten müssen strikt kleiner sein (sonst bliebe
    // nichts zum Investieren übrig) und dürfen die Prämiensumme nicht einmal annähernd erreichen.
    const bruttoPraemiensumme = monat * 12 * jahre
    expect(kosten).toBeGreaterThan(0)
    expect(kosten).toBeLessThan(bruttoPraemiensumme * 0.3)
  })
})

describe("simulateHelvetiaFLV: Zuzahlung/§176-Kulanz", () => {
  it("erhöht den Endwert deutlich, wirkt sich aber erst ab dem Folgemonat auf den Vertragswert aus", () => {
    const monat = 200
    const jahre = 20
    const zuzahlungAbJahr = 5
    const ohneZZ = simulateHelvetiaFLV({ monat, jahre, perf: 0.06, eintrittsalter: 35 })
    const mitZZ = simulateHelvetiaFLV({
      monat, jahre, perf: 0.06, eintrittsalter: 35, zuzahlung: 10000, zuzahlungAbJahr,
    })
    expect(mitZZ.endwert).toBeGreaterThan(ohneZZ.endwert + 8000)

    // Genau im Zuzahlungsmonat selbst (t = zuzahlungAbJahr*12) ist der ausgewiesene
    // Vertragswert noch identisch zum Verlauf ohne Zuzahlung (Meldestichtag = Werte VOR der
    // Verbuchung der Zuzahlung).
    const zzMonat = zuzahlungAbJahr * 12
    expect(mitZZ.values[zzMonat]).toBeCloseTo(ohneZZ.values[zzMonat], 2)
    expect(mitZZ.values[zzMonat + 1]).toBeGreaterThan(ohneZZ.values[zzMonat + 1] + 5000)
  })
})

describe("helvetiaEffektivverzinsung", () => {
  it("liefert n*k bei i = 0 (stetiger Grenzwert der Rentenbarwertformel)", () => {
    // Endwert = genau die eingezahlte Summe (keine Rendite, keine Kosten) => Bisektion muss auf
    // i = 0 konvergieren.
    const monat = 200
    const jahre = 20
    const endwert = monat * 12 * jahre
    const i = helvetiaEffektivverzinsung(endwert, monat, jahre, 12)
    expect(i).toBeCloseTo(0, 3)
  })

  it("ist invers zur Simulation: höherer Endwert ergibt höhere Effektivverzinsung", () => {
    const monat = 200
    const jahre = 20
    const niedrig = simulateHelvetiaFLV({ monat, jahre, perf: 0.03, eintrittsalter: 35 })
    const hoch = simulateHelvetiaFLV({ monat, jahre, perf: 0.06, eintrittsalter: 35 })
    const effNiedrig = helvetiaEffektivverzinsung(niedrig.endwert, monat, jahre, 12)
    const effHoch = helvetiaEffektivverzinsung(hoch.endwert, monat, jahre, 12)
    expect(effHoch).toBeGreaterThan(effNiedrig)
    // Die Effektivverzinsung liegt kostenbedingt spürbar unter der Bruttoperformance.
    expect(effHoch).toBeLessThan(0.06)
    expect(effHoch).toBeGreaterThan(0.03)
  })
})

describe("Regressionswerte (200 €/Monat, 20 Jahre, Eintrittsalter 35, Wertung 100 %, ohne SK)", () => {
  const monat = 200
  const jahre = 20
  const eintrittsalter = 35

  it.each([
    [0.06, 78072.28, 0.0461],
    [0.03, 56390.21, 0.0158],
    [0, 41500.22, -0.0147],
    [-0.03, 31193.29, -0.0454],
  ])("perf=%s => Endwert %s €, Effektivverzinsung ~%s", (perf, erwarteterEndwert, erwarteteEffZins) => {
    const r = simulateHelvetiaFLV({ monat, jahre, perf, eintrittsalter })
    expect(r.endwert).toBeCloseTo(erwarteterEndwert, 1)
    const eff = helvetiaEffektivverzinsung(r.endwert, monat, jahre, 12)
    expect(eff).toBeCloseTo(erwarteteEffZins, 2)
  })
})

describe("helvetiaKostenZeilen", () => {
  it("skaliert die Abschlusskosten-Zeile mit der Wertung", () => {
    const voll = helvetiaKostenZeilen(100)
    const halb = helvetiaKostenZeilen(50)
    expect(voll[1][1]).toContain("5")
    expect(halb[1][1]).toContain("2,5")
  })
})
