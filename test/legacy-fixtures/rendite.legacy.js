// FROZEN — verbatim copy of legacy/index.html:3532,3571-3740 (Renditerechner).
// Do NOT "improve" or refactor this file. It exists solely as an immutable
// reference for the golden-master tests in test/calc/rendite.golden.test.ts,
// which prove the TS port in src/lib/calc/rendite.ts behaves identically.

const RR_KEST = 0.275;

function rrRate(pa){ return Math.pow(1 + pa, 1/12) - 1; }

function simulateFLV(provider, monat, einmal, jahre, perf, waPct = 0){
  const months = jahre * 12;
  const r = rrRate(perf);
  const waRateMonthly = waPct > 0 ? Math.pow(1 + waPct, 1/12) - 1 : 0;
  const vst = 0.04;
  const adminPraemie = provider === 'merkur' ? 0.04 : 0.07;
  const abschlussPraemie = provider === 'merkur' ? 0.04 : 0.07;
  const depotCostPraemiePa = provider === 'merkur' ? 0.0020 : 0.00348;
  const depotCostEinmalPa = provider === 'merkur' ? (0.0020 + 0.0035) : 0.00348;
  const gesamtBrutto = monat * 12 * jahre;
  const zillmerMonatlich = (abschlussPraemie * gesamtBrutto) / 60;
  const fixMonatlich = (provider === 'merkur' && einmal > 0) ? 2 : 0;
  function kickbackPa(m, leg){
    if(provider === 'merkur') return leg === 'einmal' ? 0.00835 : 0.0013;
    return m <= 84 ? 0.0020 : 0.0040;
  }

  let depotP = 0, depotE = 0;
  if(einmal > 0){
    if(provider === 'merkur'){
      const vstEinmal = jahre >= 15 ? 0.04 : 0.11;
      depotE = einmal * (1 - vstEinmal) - einmal * 0.04;
    } else {
      depotE = einmal * (jahre >= 15 ? 0.9038 : 0.8423);
    }
    if(depotE < 0) depotE = 0;
  }

  const values = [depotP + depotE];
  for(let m = 1; m <= months; m++){
    const monatAngepasst = waRateMonthly > 0 ? monat * Math.pow(1 + waRateMonthly, m - 1) : monat;
    const netPraemie = monatAngepasst * (1 - vst);
    const netNachAdmin = netPraemie * (1 - adminPraemie);
    let invest = m <= 60 ? netNachAdmin - zillmerMonatlich : netNachAdmin;
    if(invest < 0) invest = 0;
    depotP += invest;
    depotP *= (1 + r);
    depotP -= depotP * (depotCostPraemiePa / 12);
    depotP += depotP * (kickbackPa(m, 'praemie') / 12);
    if(depotP < 0) depotP = 0;

    if(einmal > 0){
      depotE *= (1 + r);
      depotE -= depotE * (depotCostEinmalPa / 12);
      depotE += depotE * (kickbackPa(m, 'einmal') / 12);
      depotE -= fixMonatlich;
      if(depotE < 0) depotE = 0;
    }
    values.push(depotP + depotE);
  }
  return values;
}

function simulateFondssparer(monat, jahre, perf, waPct = 0){
  const months = jahre * 12;
  const r = rrRate(perf);
  let depot = 0;
  const values = [0];
  for(let m = 1; m <= months; m++){
    const jahrIdx = Math.floor((m - 1) / 12);
    const monatAngepasst = waPct > 0 ? monat * Math.pow(1 + waPct, jahrIdx) : monat;
    const netNachAbzug = monatAngepasst * 0.9110;
    depot += netNachAbzug;
    depot *= (1 + r);
    depot -= depot * (0.00516 / 12);
    if(depot < 0) depot = 0;
    values.push(depot);
  }
  return values;
}

function simulateFondsdepot(monat, einmal, jahre, perf, ausgabeaufschlagPct, depotgebuehrPa, ageRenditePa, einmalFixFee = 0){
  const months = jahre * 12;
  const r = rrRate(perf);
  const aa = ausgabeaufschlagPct / 100;
  let depot = 0, cumNetto = 0, cumAge = 0;
  if(einmal > 0){
    const net = Math.max(0, einmal - einmalFixFee) * (1 - aa);
    depot += net; cumNetto += net;
  }
  const values = [depot];
  let yearStart = depot;
  for(let m = 1; m <= months; m++){
    const net = monat * (1 - aa);
    depot += net; cumNetto += net;
    depot *= (1 + r);
    depot -= depot * (depotgebuehrPa / 100 / 12);
    if(depot < 0) depot = 0;
    values.push(depot);
    if(m % 12 === 0){
      const avg = (yearStart + depot) / 2;
      const ageBetrag = Math.max(0, avg) * (ageRenditePa / 100);
      const kestAge = ageBetrag * RR_KEST;
      depot -= kestAge;
      if(depot < 0) depot = 0;
      cumAge += ageBetrag;
      values[values.length - 1] = depot;
      yearStart = depot;
    }
  }
  const restGewinn = depot - cumNetto - cumAge;
  if(restGewinn > 0){
    depot -= restGewinn * RR_KEST;
    values[values.length - 1] = depot;
  }
  return values;
}

function simulateVV(monat, einmal, jahre, perf, ageRenditePa){
  const months = jahre * 12;
  const r = rrRate(perf);
  let depot = 0, cumNetto = 0, cumAge = 0;
  if(einmal > 0){
    const net = einmal * 0.95;
    depot += net; cumNetto += net;
  }
  const values = [depot];
  let yearStart = depot;
  for(let m = 1; m <= months; m++){
    const net = m <= 3 ? 0 : monat;
    depot += net; cumNetto += net;
    depot *= (1 + r);
    depot -= depot * (0.0209 / 12);
    if(depot < 0) depot = 0;
    values.push(depot);
    if(m % 12 === 0){
      const avg = (yearStart + depot) / 2;
      const ageBetrag = Math.max(0, avg) * (ageRenditePa / 100);
      const kestAge = ageBetrag * RR_KEST;
      depot -= kestAge;
      if(depot < 0) depot = 0;
      cumAge += ageBetrag;
      values[values.length - 1] = depot;
      yearStart = depot;
    }
  }
  const restGewinn = depot - cumNetto - cumAge;
  if(restGewinn > 0){
    depot -= restGewinn * RR_KEST;
    values[values.length - 1] = depot;
  }
  return values;
}

function rrFormatEUR(n){
  return Math.round(n).toLocaleString('de-AT') + ' €';
}

function rrFormatAxis(n){
  const abs = Math.abs(n);
  if(abs >= 1000000) return (n/1000000).toLocaleString('de-AT',{minimumFractionDigits:1,maximumFractionDigits:1}) + ' Mio.';
  if(abs >= 1000) return Math.round(n/1000) + 'k';
  return Math.round(n) + ' €';
}

export {
  RR_KEST, rrRate, simulateFLV, simulateFondssparer, simulateFondsdepot,
  simulateVV, rrFormatEUR, rrFormatAxis,
};
