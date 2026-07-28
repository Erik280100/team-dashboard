// FROZEN — verbatim copy of legacy/index.html:4120,4238-4334 (Strukturbaum
// sb*-Traversierungs-/Layout-Helfer). sbGetRoleForName/sbGetRateForRole are
// adapted to take tree/roleRates as explicit params instead of closing over
// module-global sbTree/sbRoleRates — arithmetic/logic otherwise untouched.
// Reference for test/calc/struktur.golden.test.ts.

const SB_NW=138, SB_NH=52, SB_HG=32, SB_VG=84;

function sbAll(n,a){ a=a||[]; a.push(n); (n.children||[]).forEach(c=>sbAll(c,a)); return a; }
function sbFind(n,id){ if(n.id===id) return n; for(const c of (n.children||[])){ const f=sbFind(c,id); if(f) return f; } return null; }
function sbFindByName(n,name){
  const target=(name||'').trim().toLowerCase(); if(!target||!n) return null;
  if((n.name||'').trim().toLowerCase()===target) return n;
  for(const c of (n.children||[])){ const f=sbFindByName(c,name); if(f) return f; }
  return null;
}
function sbLastWord(s){ const parts=(s||'').trim().split(/\s+/); return parts[parts.length-1].toLowerCase(); }
function sbFindByLastName(n,lastName){
  if(!n||!lastName) return null;
  if(sbLastWord(n.name)===lastName) return n;
  for(const c of (n.children||[])){ const f=sbFindByLastName(c,lastName); if(f) return f; }
  return null;
}
function sbGetRoleForName(sbTree, name){
  let n = sbFindByName(sbTree,name);
  if(!n) n = sbFindByLastName(sbTree, sbLastWord(name));
  return n ? (n.role||'') : '';
}
function sbGetRateForRole(sbRoleRates, role){
  return Number(sbRoleRates[role]) || 0;
}
function sbSubtreeWidth(n){
  if(!n.children || !n.children.length) return SB_NW;
  return Math.max(SB_NW, n.children.reduce((s,c)=>s+sbSubtreeWidth(c)+SB_HG, -SB_HG));
}
function sbLayout(n,x,y,d){
  const w = sbSubtreeWidth(n);
  n.x = x+(w-SB_NW)/2; n.y = y; n.d = d;
  if(n.children && n.children.length){
    let cx = x;
    n.children.forEach(c=>{ const cw=sbSubtreeWidth(c); sbLayout(c,cx,y+SB_NH+SB_VG,d+1); cx += cw+SB_HG; });
  }
}
function sbLine(x1,y1,x2,y2,stroke,w){
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"/>`;
}
function sbEsc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>'); }

export {
  SB_NW, SB_NH, SB_HG, SB_VG,
  sbAll, sbFind, sbFindByName, sbLastWord, sbFindByLastName,
  sbGetRoleForName, sbGetRateForRole, sbSubtreeWidth, sbLayout, sbLine, sbEsc,
};
