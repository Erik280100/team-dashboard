// FROZEN — verbatim copy of legacy/index.html:3292-3354 (EH-Rechner Datentabelle
// + Formatter). Do NOT edit. Reference for test/calc/eh.golden.test.ts.

const EH_GROUPS = [
  { id:'insurance',  title:'Insurance',   multDefault:2 },
  { id:'investment', title:'Investment',  multDefault:2 },
  { id:'credit',     title:'Credit',      multDefault:2 },
  { id:'realestate', title:'Real Estate', multDefault:2 },
];

const EH_ITEMS = [
  { id:'fsp', label:'FSP', sparte:'insurance', payout:'monatlich',
    hasG:true, gLabel:'Laufzeit', gUnit:'Jahre', gDefault:35, gMax:35,
    jLabel:'Mtl. Prämie (€)',
    calc:(g,j)=> j/2 },
  { id:'flv', label:'FLV', sparte:'insurance', payout:'einmalig',
    hasG:true, gLabel:'Laufzeit', gUnit:'Jahre', gDefault:35, gMax:35,
    jLabel:'Mtl. Prämie (€)',
    calc:(g,j)=> ((j*2.14)/35)*Math.min(g,35) },
  { id:'ableben', label:'Ableben', sparte:'insurance', payout:'einmalig',
    hasG:true, gLabel:'Laufzeit', gUnit:'Jahre', gDefault:40, gMax:40,
    jLabel:'Mtl. Prämie (€)',
    calc:(g,j)=> ((j*2.14)/30)*Math.min(g,40) },
  { id:'bu', label:'BU', sparte:'insurance', payout:'einmalig',
    hasG:true, gLabel:'Laufzeit', gUnit:'Jahre', gDefault:15, gMax:40,
    jLabel:'Mtl. Prämie (€)',
    calc:(g,j)=> (j*12*Math.min(g,40)/1000*48)/10.5 },
  { id:'uv', label:'UV', sparte:'insurance', payout:'einmalig',
    jLabel:'Mtl. Prämie (€)',
    calc:(g,j)=> j*0.9 },
  { id:'kranken', label:'Krankenversicherung', sparte:'insurance', payout:'einmalig',
    jLabel:'Mtl. Prämie (€)',
    calc:(g,j)=> j*0.7 },
  { id:'haushalt', label:'Haushalt', sparte:'insurance', payout:'einmalig',
    jLabel:'Mtl. Prämie (€)',
    calc:(g,j)=> j*0.9 },
  { id:'eigenheim', label:'Eigenheim', sparte:'insurance', payout:'einmalig',
    jLabel:'Mtl. Prämie (€)',
    calc:(g,j)=> j*0.9 },
  { id:'rechtschutz', label:'Rechtschutz', sparte:'insurance', payout:'einmalig',
    jLabel:'Mtl. Prämie (€)',
    calc:(g,j)=> j*0.9 },
  { id:'froots-vv-mtl', label:'froots VV (monatlich)', sparte:'investment', payout:'monatlich',
    jLabel:'Mtl. Prämie (€)',
    calc:(g,j)=> j*3/10.5*0.9 },
  { id:'froots-vv-einmalig', label:'froots VV (einmalig)', sparte:'investment', payout:'einmalig',
    hasG:true, gLabel:'Provision', gUnit:'Prozent', gDefault:5,
    jLabel:'Anlagebetrag gesamt (€)',
    calc:(g,j)=> (j*(g/100)*0.9)/10.5 },
  { id:'kredit', label:'Kredit', sparte:'credit', payout:'einmalig',
    hasG:true, gLabel:'Provision', gUnit:'Prozent', gDefault:3,
    jLabel:'Kredithöhe gesamt (€)',
    calc:(g,j)=> j*(g/100)/10.5 },
  { id:'immobilie', label:'Immobilienverkauf', sparte:'realestate', payout:'einmalig',
    hasG:true, gLabel:'Provision', gUnit:'Prozent', gDefault:3,
    jLabel:'Verkaufshöhe gesamt (€)',
    calc:(g,j)=> j*(g/100)/10.5 },
];

function ehFormatEH(n){
  return Math.round(n).toLocaleString('de-DE');
}

function ehFormatEUR(n){
  return n.toLocaleString('de-DE', { minimumFractionDigits:2, maximumFractionDigits:2 });
}

// Extracted verbatim from initEHRechner()'s recalc() (legacy/index.html:3398-3428),
// with DOM reads/writes replaced by function args/return so it can run outside a browser.
// The arithmetic itself is untouched.
function calcEhLegacy(inputs){
  const groupSums = {};
  EH_GROUPS.forEach(g=> groupSums[g.id]=0);

  const perItem = {};
  EH_ITEMS.forEach(it=>{
    const g = it.hasG ? parseFloat(inputs.g[it.id]) || 0 : 0;
    const j = it.disabled ? 0 : (parseFloat(inputs.j[it.id]) || 0);
    const result = it.calc(g, j);
    perItem[it.id] = result;
    groupSums[it.sparte] += result;
  });

  let grandTotal = 0;
  let grandTotalEur = 0;
  const groupEur = {};
  EH_GROUPS.forEach(g=>{
    grandTotal += groupSums[g.id];
    const mult = parseFloat(inputs.mult[g.id]) || 0;
    const groupEurVal = groupSums[g.id] * mult;
    groupEur[g.id] = groupEurVal;
    grandTotalEur += groupEurVal;
  });

  return { perItem, groupSums, groupEur, grandTotal, grandTotalEur };
}

export { EH_GROUPS, EH_ITEMS, ehFormatEH, ehFormatEUR, calcEhLegacy };
