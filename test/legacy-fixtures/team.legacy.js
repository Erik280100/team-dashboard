// FROZEN — verbatim copy of legacy/index.html:2636-2650 (getFilteredSorted) and
// the row-highlight/summenzeile logic extracted from renderTable() (:2683-2688,
// 2724). Reference for test/calc/team.golden.test.ts.

function pctOf(r){ return r.soll>0 ? Math.round((r.ist/r.soll)*100) : 0; }

function getFilteredSorted(rows, search, filter, sort){
  search = (search||'').toLowerCase();
  let list = rows.map((r,i)=>({...r, _idx:i})).filter(r => r.name.toLowerCase().includes(search));
  if(filter==='new') list = list.filter(r=>r.isNew);
  if(filter==='existing') list = list.filter(r=>!r.isNew);

  if(sort==='name') list.sort((a,b)=>a.name.localeCompare(b.name,'de'));
  if(sort==='progress-desc') list.sort((a,b)=>pctOf(b)-pctOf(a));
  if(sort==='progress-asc') list.sort((a,b)=>pctOf(a)-pctOf(b));
  if(sort==='einheiten-desc') list.sort((a,b)=>b.ist-a.ist);
  return list;
}

function rowHighlight(row, wp){
  const atPlan = Number(row.atPlan||0);
  if(!(wp.active && atPlan > 0)) return '';
  const schwelle = 0.8 * atPlan * wp.fraction;
  return Number(row.atIst||0) >= schwelle ? 'at-above' : 'at-below';
}

function teamTotals(list){
  const sum = field => list.reduce((s,r)=>s+Number(r[field]||0),0);
  return {
    atPlan: sum('atPlan'), btPlan: sum('btPlan'), etPlan: sum('etPlan'),
    atIst: sum('atIst'), btIst: sum('btIst'), etIst: sum('etIst'),
    soll: sum('soll'), ist: sum('ist'),
  };
}

export { getFilteredSorted, rowHighlight, teamTotals };
