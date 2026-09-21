// Helvetia-FLV (fondsgebundene Lebensversicherung) — 1:1-Port der Formeln aus
// "Helvetia_FLV_Schnellberechnung.pdf" (Helvetias eigene Schnellberechnungs-Applikation).
//
// Herkunft: Das PDF ist ein Adobe-XFA-Formular (AES-128-verschlüsselt, leeres
// Benutzerkennwort). Die Rechenlogik steckt in zwei eingebetteten JavaScript-Skripten des
// XFA-Templates: "HochrechnungRechnen" (monatliche Vertragswert-Rekursion, Beitragszerlegung
// in Versicherungssteuer/Abschluss-/Inkasso-/Verwaltungs-/Risikokosten und Sparprämie, inkl.
// Sicherungskonto-Töpfen mit Verweildauer-Rotation) und "Renditeberechnen" (Effektivverzinsung
// per Bisektion über eine vorschüssige Rentenbarwertformel). Beide wurden Zeile für Zeile in
// dieses Modul übertragen; Variablennamen folgen bewusst eng dem Original, damit sich der Port
// gegen das PDF nachvollziehen lässt.
//
// Aus der UI (RenditeRechner.tsx) wird stets mit Zahlweise = 12 (monatlich), Wertung = 100 %
// (volle Abschlusskosten) und ohne Sicherungskonto/Zuzahlung aufgerufen — diese Stellschrauben
// existieren im PDF und sind hier mitportiert (und getestet, siehe test/calc/helvetia.test.ts),
// aber ohne eigene Eingabefelder im Rechner.

/** Unisex-Sterbetafel (Ableben-Wahrscheinlichkeit qx), Index = erreichtes technisches Alter. */
export const HELVETIA_ABLEBEN: number[] = [
  0.00486831, 0.00033962, 0.00024797, 0.00017842, 0.00013575, 0.00011639, 0.00011135, 0.0001089,
  0.0001052, 0.000106, 0.00010852, 0.00010955, 0.00011341, 0.00013875, 0.00020526, 0.00031999,
  0.00046866, 0.00063172, 0.00076367, 0.00081589, 0.00081578, 0.00080919, 0.00080081, 0.0007892,
  0.00078073, 0.00077896, 0.00077389, 0.00076107, 0.00074014, 0.00072003, 0.00071226, 0.00072928,
  0.00077299, 0.00082921, 0.00088696, 0.0009433, 0.00101361, 0.00111712, 0.00125108, 0.00140554,
  0.00157306, 0.00174531, 0.00192013, 0.00210371, 0.0023058, 0.00253471, 0.00279797, 0.00309376,
  0.00342496, 0.00379654, 0.00421161, 0.00466146, 0.00513058, 0.00560671, 0.00608457, 0.00656553,
  0.00705711, 0.00756432, 0.00809572, 0.00867135, 0.0093234, 0.01008202, 0.01097352, 0.01202351,
  0.01323867, 0.01461009, 0.01613681, 0.01782355, 0.01967886, 0.02171504, 0.02395194, 0.0264171,
  0.02914768, 0.0321927, 0.03560937, 0.03946078, 0.04381239, 0.04873549, 0.05431194, 0.06063945,
  0.0678285, 0.07600144, 0.08529737, 0.09539123, 0.10601057, 0.11745915, 0.129884, 0.14333042,
  0.15797247, 0.17427207, 0.19238239, 0.21237848, 0.23409534, 0.25725011, 0.28149027, 0.30646822,
  0.33189788, 0.3576761, 0.38373828, 0.4100141, 0.43642759, 0.46291571, 0.48943269, 0.51595505,
  0.54247735, 0.56900061, 0.59552465, 0.62204942, 0.64857545, 0.67510289, 0.70163227, 0.72816381,
  0.75469787,
]

export const HELVETIA_VST = 0.04
/** alpha bei Wertung = 100 %; effektives alpha = HELVETIA_ALPHA_MAX * Wertung/100. */
export const HELVETIA_ALPHA_MAX = 0.05
export const HELVETIA_BETA = 0.0025
/** Verwaltungskosten-Satz (monatlich auf den Vertragswert): Monat 1–84, dann ab Monat 85. */
export const HELVETIA_GAMMA_BIS_JAHR7 = 0.00025
export const HELVETIA_GAMMA_AB_JAHR8 = 0.00045
/** Ablebensleistung = HELVETIA_ABLEBENSFAKTOR * Vertragswert. */
export const HELVETIA_ABLEBENSFAKTOR = 1.05
/** Kostensatz p.a. des Sicherungskontos in der "ohne Gewinnbeteiligung"-Variante. */
export const HELVETIA_SK_KOSTEN_PA = 0.012
/** Netto-Gewinnsätze p.a. der 5 Verweildauer-Töpfe (Kosten von 1,2 % bereits abgezogen). */
export const HELVETIA_SK_GEWINN_PA: number[] = [1.0005, 1.001, 1.002, 1.005, 1.008]

export type HelvetiaGewinnSzenario = "aktuell" | "ohneGewinn" | "niedrig" | "hoch"

/** Cent-Rundung, wie sie das PDF nach praktisch jeder Zwischenrechnung anwendet. */
export function hvCent(x: number): number {
  return Math.round(x / 0.01) * 0.01
}

function helvetiaZinsSkPm(szenario: HelvetiaGewinnSzenario): number[] {
  if (szenario === "ohneGewinn") {
    const v = Math.pow(1 - HELVETIA_SK_KOSTEN_PA, 1 / 12)
    return [v, v, v, v, v]
  }
  const delta = szenario === "niedrig" ? -0.01 : szenario === "hoch" ? 0.01 : 0
  return HELVETIA_SK_GEWINN_PA.map((v) => Math.pow(v + delta, 1 / 12))
}

/** Verweildauer-Rotation der 5 SK-Töpfe: am Versicherungsstichtag wandert der Bestand einen
 * Topf weiter (Topf 1 wird geleert), sonst verzinst sich jeder Topf an Ort und Stelle. */
function rotateSk(sk: number[], zinsSkPm: number[], istStichtag: boolean): number[] {
  if (istStichtag) {
    return [
      0,
      sk[0] * zinsSkPm[0],
      sk[1] * zinsSkPm[1],
      sk[2] * zinsSkPm[2],
      sk[3] * zinsSkPm[3] + sk[4] * zinsSkPm[4],
    ]
  }
  return sk.map((v, k) => v * zinsSkPm[k])
}

function sumArr(a: number[]): number {
  return a.reduce((s, v) => s + v, 0)
}

/** §176-Kulanz-Faktor: Anteil der noch nicht verbrauchten Abschlusskosten der Zuzahlung, der
 * bei vorzeitiger Vertragsauflösung zurückerstattet wird — linear über 60 Monate ab dem
 * Zuzahlungsstichtag auf 0 auslaufend. */
export function helvetiaPar176Faktor(monateSeitZuzahlung: number): number {
  return Math.max(0, (60 - monateSeitZuzahlung) / 60)
}

/** Verrechnet die Sparprämie (positiv: Zufluss, negativ: anteilige Kostenentnahme aus allen
 * Töpfen) mit dem Fonds-/SK-Bestand — exakt die Fallunterscheidung aus dem PDF. */
function applyPeriodResult(
  fonds: number,
  sk: number[],
  spar: number,
  switchSK: number,
  navGes: number
): { fonds: number; sk: number[] } {
  if (spar < 0 && navGes > 0) {
    const q = spar / navGes
    return { fonds: fonds + q * fonds, sk: sk.map((v) => v + q * v) }
  }
  const newSk = [...sk]
  newSk[0] = newSk[0] + spar * switchSK
  return { fonds: fonds + spar * (1 - switchSK), sk: newSk }
}

export type HelvetiaKostenJahr = {
  vst: number
  betreuung: number
  verwaltung: number
  risiko: number
  gesamtkosten: number
}

export type HelvetiaFLVOptions = {
  /** Monatsprämie (Zahlweise ist im Rechner fix monatlich, wie im PDF-Default). */
  monat: number
  jahre: number
  /** Jährliche Fondsperformance (0,06 = 6 %). */
  perf: number
  /** Jährliche Wertanpassung (Prämiendynamik); entfällt in den letzten 5 Vertragsjahren. */
  waPct?: number
  eintrittsalter: number
  /** 0–100; steuert alpha = 5 % * Wertung/100. PDF-Default 100. */
  wertungPct?: number
  /** Anteil der Sparprämie, der ins Sicherungskonto statt in Fonds fließt (0–100). */
  skPct?: number
  gewinnSzenario?: HelvetiaGewinnSzenario
  /** Einmalige Zuzahlung/Einrechnung zu einem Stichtag (0 = keine). */
  zuzahlung?: number
  /** Vertragsjahr (0-basiert), in dem die Zuzahlung erfolgt. */
  zuzahlungAbJahr?: number
  zuzahlungWertungPct?: number
}

export type HelvetiaFLVResult = {
  /** Vertragswert (NAVvorPGes im PDF) zu t = 0…jahre*12 Monaten, inkl. Zuzahlungstopf und
   * §176-Kulanz. Index t entspricht dem Wert am Stichtag "t Monate nach Vertragsbeginn". */
  values: number[]
  /** Ablebensleistung (1,05 * Vertragswert), gleiche Indizierung wie values. */
  ablebensleistung: number[]
  /** Ein Eintrag je volles Vertragsjahr. */
  kostenProJahr: HelvetiaKostenJahr[]
  /** Vertragswert am Ende der Laufzeit (values[values.length - 1]). */
  endwert: number
}

/**
 * Simuliert den Helvetia-FLV-Vertragswert exakt nach der Monatsrekursion aus
 * "HochrechnungRechnen" im PDF (Beitragszerlegung, Sicherungskonto-Rotation, optionale
 * Zuzahlung/§176-Kulanz). Ohne Zuzahlung (Standardfall aus der UI) ist skPct = 0 und der
 * Zuzahlungstopf bleibt durchgehend 0.
 */
export function simulateHelvetiaFLV(opts: HelvetiaFLVOptions): HelvetiaFLVResult {
  const {
    monat,
    jahre,
    perf,
    waPct = 0,
    eintrittsalter,
    wertungPct = 100,
    skPct = 0,
    gewinnSzenario = "aktuell",
    zuzahlung = 0,
    zuzahlungAbJahr = 0,
    zuzahlungWertungPct = 100,
  } = opts

  const months = jahre * 12
  const zzMonat = zuzahlung > 0 ? zuzahlungAbJahr * 12 : -1
  const zins = Math.pow(1 + perf, 1 / 12)
  const alpha = HELVETIA_ALPHA_MAX * (wertungPct / 100)
  const alphaZZ = HELVETIA_ALPHA_MAX * (zuzahlungWertungPct / 100)
  const switchSK = Math.max(0, Math.min(100, skPct)) / 100
  const zinsSkPm = helvetiaZinsSkPm(gewinnSzenario)

  let praemieLf = monat
  let alter = Math.max(0, eintrittsalter)

  let navNachFonds = 0
  let sk = [0, 0, 0, 0, 0]

  let navNachFondsZZ = 0
  let skZZ = [0, 0, 0, 0, 0]
  let akapZZ = 0

  // Indices 0..months-1 werden direkt in der Schleife befüllt (Index = Monat t, exakt wie im
  // PDF); Index `months` (Vertragsende) kommt aus dem separaten Abschlussschritt nach der
  // Schleife. Kein push() — sonst verschiebt sich die Indizierung um eins.
  const values: number[] = new Array(months + 1)
  const ablebensleistung: number[] = new Array(months + 1)
  values[0] = 0
  ablebensleistung[0] = 0
  const kostenProJahr: HelvetiaKostenJahr[] = []
  let cum: HelvetiaKostenJahr = { vst: 0, betreuung: 0, verwaltung: 0, risiko: 0, gesamtkosten: 0 }

  let navVorGesMainThisT = 0
  let navVorGesZZThisT = 0

  for (let t = 0; t < months; t++) {
    if (t !== 0 && t % 12 === 0) {
      if (months - t >= 60 && waPct > 0) praemieLf = hvCent(praemieLf * (1 + waPct))
      alter++
    }
    const qx = HELVETIA_ABLEBEN[Math.min(alter, HELVETIA_ABLEBEN.length - 1)]
    const gamma = t < 84 ? HELVETIA_GAMMA_BIS_JAHR7 : HELVETIA_GAMMA_AB_JAHR8

    // -- Hauptprämie: Beitragszerlegung --
    const praemieGesamt = praemieLf
    const psteuer = hvCent((praemieGesamt * HELVETIA_VST) / (1 + HELVETIA_VST))
    const pOSteuer = hvCent(praemieGesamt - psteuer)
    const palpha = hvCent(pOSteuer * alpha)
    const pbeta = hvCent(pOSteuer * HELVETIA_BETA)

    let pgamma: number
    let prisiko: number
    let pspar: number

    if (t === 0) {
      navVorGesMainThisT = 0
      pgamma = 0
      prisiko = hvCent(((0 + pOSteuer - palpha - pbeta - pgamma) * ((0.05 * qx) / 12)) / (1 + (0.05 * qx) / 12))
      pspar = hvCent(pOSteuer - palpha - pbeta - pgamma - prisiko)
      navNachFonds = pspar * (1 - switchSK)
      sk = [pspar * switchSK, 0, 0, 0, 0]
    } else {
      const navVorFonds = hvCent(navNachFonds * zins)
      sk = rotateSk(sk, zinsSkPm, t % 12 === 0)
      const navVorGes = navVorFonds + sumArr(sk)
      navVorGesMainThisT = navVorGes

      pgamma = hvCent(gamma * navVorGes)
      prisiko = hvCent(
        ((navVorGes + pOSteuer - palpha - pbeta - pgamma) * ((0.05 * qx) / 12)) / (1 + (0.05 * qx) / 12)
      )
      pspar = hvCent(pOSteuer - palpha - pbeta - pgamma - prisiko)

      const applied = applyPeriodResult(navVorFonds, sk, pspar, switchSK, navVorGes)
      navNachFonds = applied.fonds
      sk = applied.sk
    }

    // -- Zuzahlung/Einrechnung: eigener Topf, eigene einmalige Beitragszerlegung --
    navVorGesZZThisT = 0
    if (zuzahlung > 0 && t === zzMonat) {
      const steuerZZ = hvCent((zuzahlung * HELVETIA_VST) / (1 + HELVETIA_VST))
      const pOSteuerZZ = hvCent(zuzahlung - steuerZZ)
      const palphaZZ = hvCent(pOSteuerZZ * alphaZZ)
      const pbetaZZ = hvCent(pOSteuerZZ * HELVETIA_BETA)
      const prisikoZZ = hvCent(((pOSteuerZZ - palphaZZ - pbetaZZ) * ((0.05 * qx) / 12)) / (1 + (0.05 * qx) / 12))
      akapZZ = pOSteuerZZ
      const psparZZ = hvCent(pOSteuerZZ - palphaZZ - pbetaZZ - prisikoZZ)
      navNachFondsZZ = psparZZ * (1 - switchSK)
      skZZ = [psparZZ * switchSK, 0, 0, 0, 0]
      cum.vst += steuerZZ
      cum.betreuung += palphaZZ + pbetaZZ
      cum.risiko += prisikoZZ
    } else if (zuzahlung > 0 && t > zzMonat) {
      const navVorFondsZZ = hvCent(navNachFondsZZ * zins)
      skZZ = rotateSk(skZZ, zinsSkPm, t % 12 === 0)
      const navVorGesZZ = navVorFondsZZ + sumArr(skZZ)
      navVorGesZZThisT = navVorGesZZ

      const pgammaZZ = hvCent(gamma * navVorGesZZ)
      const prisikoZZ = hvCent(((navVorGesZZ - pgammaZZ) * ((0.05 * qx) / 12)) / (1 + (0.05 * qx) / 12))
      const psparZZ = hvCent(-pgammaZZ - prisikoZZ)

      const appliedZZ = applyPeriodResult(navVorFondsZZ, skZZ, psparZZ, switchSK, navVorGesZZ)
      navNachFondsZZ = appliedZZ.fonds
      skZZ = appliedZZ.sk
      cum.verwaltung += pgammaZZ
      cum.risiko += prisikoZZ
    }

    // §176-Kulanz: Rückvergütung des noch nicht verbrauchten Abschlusskosten-Anteils der
    // Zuzahlung, linear über 60 Monate auf 0 auslaufend.
    const par176 =
      zuzahlung > 0 && t > zzMonat ? hvCent(helvetiaPar176Faktor(t - zzMonat) * akapZZ * alphaZZ) : 0

    cum.vst += psteuer
    cum.betreuung += palpha + pbeta
    cum.verwaltung += pgamma
    cum.risiko += prisiko
    cum.gesamtkosten = cum.betreuung + cum.verwaltung + cum.risiko

    if (t % 12 === 11) {
      kostenProJahr.push({ ...cum })
      cum = { vst: 0, betreuung: 0, verwaltung: 0, risiko: 0, gesamtkosten: 0 }
    }

    values[t] = navVorGesMainThisT + navVorGesZZThisT + par176
    // Ablebensleistung: vereinfacht als 1,05 * Gesamtvertragswert (Haupt- + Zuzahlungstopf).
    // Das PDF behandelt den Zuzahlungsanteil hier inkonsistent (mal nur der Fondsteil, mal der
    // volle Topf) — das betrifft ausschließlich die Ablebensleistungs-Tabelle bei aktiver
    // Zuzahlung, die der Rechner nicht anzeigt, daher hier bewusst vereinheitlicht.
    ablebensleistung[t] = HELVETIA_ABLEBENSFAKTOR * (navVorGesMainThisT + navVorGesZZThisT)
  }

  // Letzter Bewertungsstichtag (t = Dauer): eine weitere Verzinsung auf den zuletzt
  // fortgeschriebenen Bestand, ohne weitere Beitragszerlegung. Das PDF verwendet hier für die
  // SK-Töpfe bewusst die einfache Verzinsung je Topf, nicht die Stichtagsrotation.
  const finalNavFonds = hvCent(navNachFonds * zins)
  const finalSk = sk.map((v, k) => v * zinsSkPm[k])
  const finalNavGes = finalNavFonds + sumArr(finalSk)

  const finalNavFondsZZ = zuzahlung > 0 ? hvCent(navNachFondsZZ * zins) : 0
  const finalSkZZ = zuzahlung > 0 ? skZZ.map((v, k) => v * zinsSkPm[k]) : [0, 0, 0, 0, 0]
  const finalNavGesZZ = finalNavFondsZZ + sumArr(finalSkZZ)

  const finalPar176 =
    zuzahlung > 0 && months > zzMonat ? hvCent(helvetiaPar176Faktor(months - zzMonat) * akapZZ * alphaZZ) : 0

  values[months] = finalNavGes + finalNavGesZZ + finalPar176
  ablebensleistung[months] = HELVETIA_ABLEBENSFAKTOR * (finalNavGes + finalNavGesZZ)

  return {
    values,
    ablebensleistung,
    kostenProJahr,
    endwert: values[values.length - 1],
  }
}

/** Kostenzeilen für die Helvetia-Anzeige, spiegelt die tatsächlich verwendeten Sätze wider. */
export function helvetiaKostenZeilen(wertungPct = 100): [string, string][] {
  const alphaPct = HELVETIA_ALPHA_MAX * (wertungPct / 100) * 100
  const fmt = (n: number, digits = 2) => n.toFixed(digits).replace(".", ",")
  return [
    ["Versicherungssteuer", `${fmt(HELVETIA_VST * 100, 0)} % (in der Prämie enthalten)`],
    ["Abschluss-/Betreuungskosten", `${fmt(alphaPct)} % der Nettoprämie`],
    ["Inkassokosten", `${fmt(HELVETIA_BETA * 100)} % der Nettoprämie`],
    [
      "Verwaltungskosten mtl.",
      `${fmt(HELVETIA_GAMMA_BIS_JAHR7 * 100, 3)} % (Jahr 1–7) / ${fmt(HELVETIA_GAMMA_AB_JAHR8 * 100, 3)} % (ab Jahr 8) vom Vertragswert`,
    ],
    ["Risikokosten", "5 % Ablebens-Aufschlag, altersabhängig (Unisex-Sterbetafel)"],
  ]
}

function hvSnk(i: number, n: number, k: number): number {
  // Im PDF liefert diese Funktion bei i = 0 wörtlich "n" statt "n*k" (offenbar ein
  // übersehener Faktor im Original) — das ist der stetige Grenzwert für i -> 0 der Rentenformel
  // NICHT und würde eine Unstetigkeit an genau dieser Stelle einbauen. Die Bisektion in
  // helvetiaEffektivverzinsung trifft i = 0 als Fließkomma-Wert praktisch nie exakt, daher wird
  // hier bewusst der mathematisch korrekte, stetige Wert n*k verwendet.
  if (i === 0) return n * k
  const r = 1 + i
  const v = 1 / r
  return (Math.pow(r, n) - 1) / (1 - Math.pow(v, 1 / k))
}

/**
 * Effektivverzinsung per Bisektion — 1:1-Port von "Renditeberechnen.Rendite()" im PDF: sucht
 * den Zinssatz i, bei dem der Endwert einer vorschüssigen Rente aus `praemieProZahlung`
 * (`zahlweise` Zahlungen pro Jahr, optional mit jährlicher Dynamik `dynPct`, die in den letzten
 * 5 Jahren entfällt) genau `endwert` ergibt.
 *
 * Abweichung vom PDF: dort ist die Bisektion auf das Intervall [-0,1; 0,12] beschränkt. Der
 * Renditerechner erlaubt frei wählbare Performance-Presets bis 9 % (und höher), bei denen die
 * Effektivverzinsung dieses Intervall verlassen kann — die Original-Grenzen würden dort still
 * am Rand kleben bleiben. Das Intervall ist deshalb auf [-0,5; 0,5] geweitet; das
 * Bisektionsverfahren selbst ist unverändert.
 */
export function helvetiaEffektivverzinsung(
  endwert: number,
  praemieProZahlung: number,
  jahre: number,
  zahlweise = 12,
  dynPct = 0
): number {
  const n = jahre
  const k = zahlweise

  function f(i: number): number {
    let s = hvSnk(i, n, k) * praemieProZahlung
    if (dynPct > 0) {
      let basis = praemieProZahlung
      for (let t = 1; t <= n - 5; t++) {
        s += basis * dynPct * hvSnk(i, n - t, k)
        basis *= 1 + dynPct
      }
    }
    return s - endwert
  }

  let a = -0.5
  let b = 0.5
  for (let step = 0; step < 200; step++) {
    const i = (a + b) / 2
    const fi = f(i)
    if (Math.abs(fi) < 0.001 || (b - a) / 2 < 1e-9) return i
    const fa = f(a)
    if (fi * fa > 0) a = i
    else b = i
  }
  return (a + b) / 2
}
