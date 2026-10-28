// Umdrehrechner — 1:1 portiert aus legacy/index.html:3458–3527 (nur die Rechenlogik
// aus recalc(), ohne DOM-Zugriffe). Golden-Master-Test: test/calc/umdreh.golden.test.ts.

export const UM_EH_ALT = 2.3
export const UM_EH_NEU = 2.11

export interface UmdrehInputs {
  praemie: number
  beraterAlt: number
  beraterNeu: number
  fkAlt: number
  fkNeu: number
  stornoActive: boolean
  /** Einheiten je Prämien-Euro; Standard UM_EH_ALT / UM_EH_NEU. */
  ehAlt?: number
  ehNeu?: number
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
  const { praemie, beraterAlt, beraterNeu, fkAlt, fkNeu, stornoActive, ehAlt = UM_EH_ALT, ehNeu = UM_EH_NEU } = inputs
  const stornoFactor = stornoActive ? 0.85 : 1

  const beraterMinus = ehAlt * praemie * beraterAlt * stornoFactor
  const beraterAktuell = ehNeu * praemie * beraterNeu * stornoFactor
  const beraterDiff = beraterAktuell - beraterMinus

  const fkMinus = ehAlt * praemie * (fkAlt - beraterAlt) * stornoFactor
  let fkNeuProEH = fkNeu - beraterNeu
  if (fkNeuProEH === 0 && beraterNeu >= 4 && fkNeu >= 4) fkNeuProEH = 0.5
  const fkAktuell = ehNeu * praemie * fkNeuProEH * stornoFactor
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
