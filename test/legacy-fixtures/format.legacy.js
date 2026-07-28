// FROZEN — verbatim copy of legacy/index.html:2250-2256,2503-2512,2565-2585,
// 2975-3004 (allgemeine Formatter/Helfer). fmt/pctOf/teamTarget/
// recruitActualValue/monthWeekProgress take rows/teamGoal as explicit params
// instead of closing over module-globals — arithmetic/logic otherwise untouched.
// Reference for test/calc/format.golden.test.ts.

function defaultPeriod(){
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth()+1, 0);
  const toISO = d => d.toISOString().slice(0,10);
  return { periodStart: toISO(first), periodEnd: toISO(last) };
}

function migrateRow(r){
  if(r.atPlan===undefined) r.atPlan = Number(r.at)||0;
  if(r.atIst===undefined) r.atIst = 0;
  if(r.btPlan===undefined) r.btPlan = Number(r.bt)||0;
  if(r.btIst===undefined) r.btIst = 0;
  if(r.etPlan===undefined) r.etPlan = Number(r.et)||0;
  if(r.etIst===undefined) r.etIst = 0;
  return r;
}
function migrateRows(list){ return list.map(migrateRow); }

function fmt(n){ return Number(n||0).toLocaleString('de-AT'); }
function pctOf(r){ return r.soll>0 ? Math.round((r.ist/r.soll)*100) : 0; }
function teamTarget(rows){ return rows.reduce((s,r)=>s+Number(r.soll||0),0); }
function progressClass(pct){
  if(pct < 50) return 'low';
  if(pct >= 90) return 'high';
  return '';
}
function initials(name){
  const parts = name.trim().split(' ').filter(Boolean);
  if(parts.length===0) return '?';
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

function recruitActualValue(rows, teamGoal){
  const newHiresCount = rows.filter(r=>r.isNew).length;
  return (teamGoal.recruitActual !== null && teamGoal.recruitActual !== undefined && teamGoal.recruitActual !== '')
    ? Number(teamGoal.recruitActual)
    : newHiresCount;
}

function parseISODate(str){
  const [y,m,d] = str.split('-').map(Number);
  return new Date(y, m-1, d);
}
function toISODate(d){
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function addDays(d, n){
  const r = new Date(d);
  r.setDate(r.getDate()+n);
  return r;
}

function monthWeekProgress(teamGoal, nowOverride){
  const def = defaultPeriod();
  const start = parseISODate(teamGoal.periodStart || def.periodStart);
  const end   = parseISODate(teamGoal.periodEnd   || def.periodEnd);
  if(!(end >= start)) return { active:false, fraction:0 };
  const now = nowOverride ? new Date(nowOverride) : new Date(); now.setHours(0,0,0,0);
  if(now < start) return { active:false, fraction:0 };
  const totalDays  = Math.round((end-start)/86400000) + 1;
  const totalWeeks = Math.max(1, Math.ceil(totalDays/7));
  let currentWeek;
  if(now > end) currentWeek = totalWeeks;
  else currentWeek = Math.min(totalWeeks, Math.ceil((Math.round((now-start)/86400000)+1)/7));
  return { active:true, fraction: currentWeek/totalWeeks };
}

export {
  defaultPeriod, migrateRow, migrateRows, fmt, pctOf, teamTarget, progressClass,
  initials, recruitActualValue, parseISODate, toISODate, addDays, monthWeekProgress,
};
