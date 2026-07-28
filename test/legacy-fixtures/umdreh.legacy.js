// FROZEN — extracted verbatim from legacy/index.html:3459-3506 (Umdrehrechner
// recalc() arithmetic only; DOM reads/writes replaced by function args/return).
// Reference for test/calc/umdreh.golden.test.ts.

const UM_EH_ALT = 2.30;
const UM_EH_NEU = 2.14;

function calcUmdrehLegacy(inputs){
  const { praemie, beraterAlt, beraterNeu, fkAlt, fkNeu, stornoActive } = inputs;
  const stornoFactor = stornoActive ? 0.85 : 1;

  const beraterMinus = UM_EH_ALT * praemie * beraterAlt * stornoFactor;
  const beraterAktuell = UM_EH_NEU * praemie * beraterNeu * stornoFactor;
  const beraterDiff = beraterAktuell - beraterMinus;

  const fkMinus = UM_EH_ALT * praemie * (fkAlt - beraterAlt) * stornoFactor;
  let fkNeuProEH = fkNeu - beraterNeu;
  if(fkNeuProEH === 0 && beraterNeu >= 4 && fkNeu >= 4) fkNeuProEH = 0.5;
  const fkAktuell = UM_EH_NEU * praemie * fkNeuProEH * stornoFactor;
  const fkDiff = fkAktuell - fkMinus;

  const gesamtMinus = beraterMinus + fkMinus;
  const gesamtAktuell = beraterAktuell + fkAktuell;
  const gesamtDiff = beraterDiff + fkDiff;

  return {
    beraterMinus, beraterAktuell, beraterDiff,
    fkMinus, fkAktuell, fkDiff,
    gesamtMinus, gesamtAktuell, gesamtDiff,
  };
}

export { UM_EH_ALT, UM_EH_NEU, calcUmdrehLegacy };
