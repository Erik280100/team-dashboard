// Umdrehrechner — 1:1 portiert aus legacy/index.html:3458–3527 (nur die Rechenlogik
// aus recalc(), ohne DOM-Zugriffe). Golden-Master-Test: test/calc/umdreh.golden.test.ts.

export const UM_EH_ALT = 2.3
export const UM_EH_NEU = 2.14

export interface UmdrehInputs {
  praemie: number
  beraterAlt: number
  beraterNeu: number
  fkAlt: number
  fkNeu: number
  stornoActive: boolean
}

export interface UmdrehResult {
  beraterMinus: number
  beraterAktuell: number
  beraterDiff: number
  fkMinus: number
  fkAktuell: number
  fkDiff: number
  gesamtMinus: number
  gesamtAktuell: number
  gesamtDiff: number
}

export function calcUmdreh(inputs: UmdrehInputs): UmdrehResult {
  const { praemie, beraterAlt, beraterNeu, fkAlt, fkNeu, stornoActive } = inputs
  const stornoFactor = stornoActive ? 0.85 : 1

  const beraterMinus = UM_EH_ALT * praemie * beraterAlt * stornoFactor
  const beraterAktuell = UM_EH_NEU * praemie * beraterNeu * stornoFactor
  const beraterDiff = beraterAktuell - beraterMinus

  const fkMinus = UM_EH_ALT * praemie * (fkAlt - beraterAlt) * stornoFactor
  let fkNeuProEH = fkNeu - beraterNeu
  if (fkNeuProEH === 0 && beraterNeu >= 4 && fkNeu >= 4) fkNeuProEH = 0.5
  const fkAktuell = UM_EH_NEU * praemie * fkNeuProEH * stornoFactor
  const fkDiff = fkAktuell - fkMinus

  const gesamtMinus = beraterMinus + fkMinus
  const gesamtAktuell = beraterAktuell + fkAktuell
  const gesamtDiff = beraterDiff + fkDiff

  return {
    beraterMinus,
    beraterAktuell,
    beraterDiff,
    fkMinus,
    fkAktuell,
    fkDiff,
    gesamtMinus,
    gesamtAktuell,
    gesamtDiff,
  }
}
