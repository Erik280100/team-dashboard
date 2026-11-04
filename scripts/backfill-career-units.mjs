// Karrierezähler (employees/{id}.careerUnits) auf die gesamten historischen Einheiten hochsetzen:
// Summe über alle Archivmonate + laufender Monat, je Plan (investment = investment + investmentVb).
// Nur nach oben (max aus bisherigem Zähler und Historie). Vergleicht die Stufe vorher/nachher.
//   node scripts/backfill-career-units.mjs [--apply]
import { writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { initializeApp, applicationDefault } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

const apply = process.argv.includes("--apply")
initializeApp({ credential: applicationDefault(), projectId: "finova-team-dashboard" })
const db = getFirestore()
const num = (v) => Number(v) || 0
const r2 = (n) => Math.round(n * 100) / 100

const LADDER = {
  insurance: [["FT1", 0], ["FT2", 1000], ["FT3", 2000], ["FT4", 4000]],
  realestate: [["FT1", 0], ["FT2", 1000]],
  credit: [["FT1", 0], ["FT2", 2000], ["FT3", 4000]],
  investment: [["FT1", 0], ["FT2", 1000], ["FT3", 2000]],
}
const PLANS = Object.keys(LADDER)
const ftRole = (r) => { const m = String(r || "").replace(/\s+/g, "").match(/^FT([1-4])$/i); return m ? `FT${m[1]}` : null }
const stageOf = (plan, units) => LADDER[plan].reduce((cur, [role, u]) => (units >= u ? role : cur), "FT1")
const insThreshold = (role) => LADDER.insurance.find(([r]) => r === ftRole(role))?.[1] ?? 0
const isTrainee = (role) => !!ftRole(role) || !/teamleiter|gesch|regional|direktor/i.test(role || "")
const unitsOf = (x) => {
  const e = x.ehByPlan
  if (!e) return { insurance: num(x.ist), investment: 0, credit: 0, realestate: 0 }
  return { insurance: num(e.insurance), investment: num(e.investment) + num(e.investmentVb), credit: num(e.credit), realestate: num(e.realestate) }
}

const emps = await db.collection("employees").get()
const idx = (await db.doc("org/archiveIndex").get()).data()
const months = (idx?.months ?? []).map((m) => m.month ?? m)
const hist = new Map() // key -> {plan: sum}
const seenMonths = {}
const add = (key, u, m) => {
  const cur = hist.get(key) ?? { insurance: 0, investment: 0, credit: 0, realestate: 0 }
  PLANS.forEach((p) => (cur[p] += u[p]))
  hist.set(key, cur)
  ;(seenMonths[key] ??= new Set()).add(m)
}
const idByName = new Map(emps.docs.map((d) => [d.get("name"), d.id]))
for (const m of months) {
  const s = await db.collection(`snapshots/${m}/employees`).get()
  for (const d of s.docs) add(idByName.get(d.get("name")) ?? d.id, unitsOf(d.data()), m)
}
// laufender Monat (nur falls nicht schon archiviert)
const cur = (await db.doc("org/teamGoal").get()).data()?.teamGoal
console.log("Archivmonate:", months.join(", "), "| laufender Zeitraum:", cur?.periodStart, "–", cur?.periodEnd)
for (const d of emps.docs) add(d.id, unitsOf(d.data()), "laufend")

const out = []
for (const d of emps.docs) {
  const x = d.data()
  const h = hist.get(d.id)
  const old = { insurance: num(x.careerUnits?.insurance), investment: num(x.careerUnits?.investment), credit: num(x.careerUnits?.credit), realestate: num(x.careerUnits?.realestate) }
  const next = Object.fromEntries(PLANS.map((p) => [p, r2(Math.max(old[p], h[p]))]))
  // Insurance-Zähler = gesamte historische Produktion aus ALLEN Sparten (Vorgabe Erik)
  next.insurance = r2(Math.max(old.insurance, PLANS.reduce((s, p) => s + h[p], 0)))
  const trainee = isTrainee(x.role)
  const shown = (p, c) => stageOf(p, p === "insurance" ? Math.max(c, insThreshold(x.role)) : c)
  const changes = trainee ? PLANS.map((p) => [p, shown(p, old[p]), shown(p, next[p])]).filter(([, a, b]) => a !== b) : []
  out.push({ id: d.id, name: x.name, role: x.role, trainee, months: [...seenMonths[d.id]].join(","), old, next, changes })
}
for (const o of out) {
  const diff = PLANS.filter((p) => o.next[p] !== o.old[p]).map((p) => `${p} ${o.old[p]}→${o.next[p]}`).join(", ")
  console.log(`${o.name} [${o.role}] Monate: ${o.months}\n   Zähler: ${diff || "unverändert"}${o.changes.length ? `\n   >>> STUFE ÄNDERT SICH: ${o.changes.map(([p, a, b]) => `${p} ${a}→${b}`).join(", ")}` : ""}`)
}
const backup = join(tmpdir(), `career-units-backup-${Date.now()}.json`)
writeFileSync(backup, JSON.stringify(out.map((o) => ({ id: o.id, name: o.name, old: o.old })), null, 1))
console.log("\nSicherung der alten Zähler:", backup)
if (!apply) { console.log("Trockenlauf – nichts geschrieben. Mit --apply schreiben."); process.exit(0) }
const batch = db.batch()
out.forEach((o) => batch.update(db.doc(`employees/${o.id}`), { careerUnits: o.next }))
await batch.commit()
console.log("Geschrieben:", out.length, "Mitarbeiter")
