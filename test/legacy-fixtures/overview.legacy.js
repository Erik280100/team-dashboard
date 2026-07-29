// FROZEN — verbatim (data-computation portions) copy of legacy/index.html
// renderSummary/renderGoalProgress/renderRecruitPanel/renderTimeline/renderCharts
// (:2587-2634, 3006-3130, 3113-3222, 2853-2973), with DOM reads/writes replaced by
// explicit params/returns. Reference for test/calc/overview.golden.test.ts.

function fmt(n){ return Number(n||0).toLocaleString('de-AT'); }
function pctOf(r){ return r.soll>0 ? Math.round((r.ist/r.soll)*100) : 0; }
function teamTarget(rows){ return rows.reduce((s,r)=>s+Number(r.soll||0),0); }
function parseISODate(str){ const [y,m,d] = str.split('-').map(Number); return new Date(y, m-1, d); }
function toISODate(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function addDays(d, n){ const r = new Date(d); r.setDate(r.getDate()+n); return r; }
function defaultPeriod(){
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth()+1, 0);
  const toISO = d => d.toISOString().slice(0,10);
  return { periodStart: toISO(first), periodEnd: toISO(last) };
}
function recruitActualValue(rows, teamGoal){
  const newHiresCount = rows.filter(r=>r.isNew).length;
  return (teamGoal.recruitActual !== null && teamGoal.recruitActual !== undefined && teamGoal.recruitActual !== '')
    ? Number(teamGoal.recruitActual)
    : newHiresCount;
}

const PIE_COLORS = ['#64DDA3','#5BB8E8','#F2B84B','#E8735B','#B48EE0','#4BD1C5','#E85B9C','#8FD14B','#5B7FE8','#D1A64B'];

function summaryKpis(rows){
  const onTrack = rows.filter(r=>pctOf(r)>=70).length;
  return { employeeCount: rows.length, onTrackCount: onTrack };
}

function goalProgress(rows){
  const totalIst = rows.reduce((s,r)=>s+Number(r.ist||0),0);
  const target = teamTarget(rows);
  const pct = target>0 ? Math.round((totalIst/target)*100) : 0;
  let remainingText;
  if(target<=0) remainingText = 'Noch kein Team-Ziel — bei den Mitarbeitern „Soll"-Werte eintragen.';
  else if(totalIst >= target) remainingText = 'Ziel erreicht — stark!';
  else remainingText = 'Noch ' + fmt(target-totalIst) + ' Einheiten bis zum Ziel.';
  return { totalIst, target, pct, remainingText };
}

function recruitProgress(rows, teamGoal){
  const def = defaultPeriod();
  const start = parseISODate(teamGoal.periodStart || def.periodStart);
  const end   = parseISODate(teamGoal.periodEnd   || def.periodEnd);

  const newHires = rows.filter(r=>r.isNew);
  const count = recruitActualValue(rows, teamGoal);
  const target = Number(teamGoal.recruitGoal||0);
  const pct = target>0 ? Math.round((count/target)*100) : 0;

  const withDate = newHires.filter(r=>r.joinDate).map(r=>({...r, _d: parseISODate(r.joinDate)}))
    .sort((a,b)=> a._d - b._d);
  const withoutDate = newHires.filter(r=>!r.joinDate);

  const items = [
    ...withDate.map(r=>({
      name: r.name,
      dateLabel: r._d.toLocaleDateString('de-AT',{day:'2-digit',month:'2-digit'}),
      hasDate: true,
      inPeriod: r._d >= start && r._d <= end,
    })),
    ...withoutDate.map(r=>({ name: r.name, dateLabel: 'Datum unbekannt', hasDate:false, inPeriod:false })),
  ];
  return { count, target, pct, items };
}

function timelineData(teamGoal, rows, history, now){
  const def = defaultPeriod();
  const startStr = teamGoal.periodStart || def.periodStart;
  const endStr = teamGoal.periodEnd || def.periodEnd;
  let start = parseISODate(startStr);
  let end = parseISODate(endStr);
  const target = teamTarget(rows);

  if(!(end > start)){
    return { valid:false, points:[], forecastText: 'Ende des Zeitraums muss nach dem Start liegen — bitte Datum oben prüfen.' };
  }

  const today = now ? new Date(now) : new Date(); today.setHours(0,0,0,0);
  const totalDays = Math.round((end-start)/86400000) + 1;
  let todayIdx;
  if(today < start) todayIdx = 0;
  else if(today > end) todayIdx = totalDays - 1;
  else todayIdx = Math.round((today-start)/86400000);

  const dateList = Array.from({length:totalDays}, (_,i)=> addDays(start,i));
  const labels = dateList.map(d=> d.toLocaleDateString('de-AT',{day:'2-digit',month:'2-digit'}));

  const idealPath = dateList.map((_,i)=> target>0 ? Math.round((target/(totalDays-1||1))*i) : null);

  const histByISO = {};
  history.forEach(h=>{ histByISO[h.date] = h.ist; });
  let lastKnown = 0, lastKnownIdx = null;
  const actualSeries = dateList.map((d,i)=>{
    if(i > todayIdx) return null;
    const iso = toISODate(d);
    if(histByISO[iso] !== undefined){ lastKnown = histByISO[iso]; lastKnownIdx = i; }
    return lastKnown;
  });

  let forecastSeries = dateList.map(()=>null);
  let forecastText = 'Noch keine Verlaufsdaten — Wert wird bei jedem Speichern automatisch erfasst.';
  if(lastKnownIdx !== null && lastKnown > 0){
    const elapsedDays = lastKnownIdx + 1;
    const dailyRate = lastKnown / elapsedDays;
    for(let i=lastKnownIdx; i<totalDays; i++){
      forecastSeries[i] = Math.round(dailyRate * (i+1));
    }
    if(target>0){
      if(dailyRate<=0){
        forecastText = 'Bei aktuellem Tempo (0 Einheiten/Tag) wird das Ziel im gewählten Zeitraum nicht erreicht.';
      } else {
        const projectedIdx = Math.ceil(target/dailyRate) - 1;
        if(projectedIdx <= totalDays-1){
          const projDate = addDays(start, projectedIdx);
          forecastText = 'Bei aktuellem Tempo (' + fmt(Math.round(dailyRate)) + ' Einheiten/Tag) wird das Ziel voraussichtlich am <strong>' + projDate.toLocaleDateString('de-AT',{day:'2-digit',month:'2-digit',year:'numeric'}) + '</strong> erreicht.';
        } else {
          const shortfall = Math.round(target - dailyRate*totalDays);
          forecastText = 'Bei aktuellem Tempo (' + fmt(Math.round(dailyRate)) + ' Einheiten/Tag) fehlen am Ende des Zeitraums voraussichtlich <strong>' + fmt(shortfall) + ' Einheiten</strong> zum Ziel.';
        }
      }
    }
  }

  const points = labels.map((label,i)=>({ label, idealPath: idealPath[i], actual: actualSeries[i], forecast: forecastSeries[i] }));
  return { valid:true, points, forecastText };
}

function barChartData(rows){
  const sorted = [...rows].sort((a,b)=>Number(b.ist||0)-Number(a.ist||0));
  return sorted.map(r=>{
    const parts = r.name.split(' ');
    const shortName = parts[0] + (parts[1] ? ' ' + parts[1][0] + '.' : '');
    return { shortName, fullName: r.name, soll: Number(r.soll||0), ist: Number(r.ist||0) };
  });
}

function doughnutData(rows){
  const totalIst = rows.reduce((s,r)=>s+Number(r.ist||0),0);
  const target = teamTarget(rows);
  const rest = Math.max(target-totalIst,0);
  const pct = target>0 ? Math.round((totalIst/target)*100) : 0;
  const hasData = target>0 || totalIst>0;
  return { hasData, totalIst, target, pct, rest };
}

function revenueShareData(rows){
  const contributors = rows.filter(r=>Number(r.ist||0)>0);
  const shareRows = (contributors.length ? contributors : [...rows]).sort((a,b)=>Number(b.ist||0)-Number(a.ist||0));
  const shareTotal = shareRows.reduce((s,r)=>s+Number(r.ist||0),0);
  return shareRows.map((r,i)=>{
    const value = Number(r.ist||0);
    const pct = shareTotal>0 ? Math.round((value/shareTotal)*100) : 0;
    return { name: r.name, value, pct, color: PIE_COLORS[i % PIE_COLORS.length] };
  });
}

function leaderboardData(rows){
  return [...rows].sort((a,b)=>Number(b.atIst||0)-Number(a.atIst||0))
    .map(r=>({ name: r.name, atIst: Number(r.atIst||0) }));
}

export {
  summaryKpis, goalProgress, recruitProgress, timelineData,
  barChartData, doughnutData, revenueShareData, leaderboardData, PIE_COLORS,
};
