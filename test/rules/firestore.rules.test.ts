// Regel-Tests gegen den Firestore-Emulator. Laufen nur mit `npm run test:rules`
// (startet den Emulator; braucht Java). Ohne FIRESTORE_EMULATOR_HOST werden sie
// uebersprungen, damit `npm test` ohne Emulator gruen bleibt.
import { readFileSync } from "node:fs"
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest"
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from "@firebase/rules-unit-testing"
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore"

const emulator = process.env.FIRESTORE_EMULATOR_HOST
const [host, port] = (emulator ?? "127.0.0.1:8080").split(":")

// Struktur: boss -> lead -> m1, m2; boss2 -> other (fremde Struktur)
const EMP = {
  boss: { name: "Boss", managerId: null, ancestors: [] as string[], uid: "u_boss" },
  lead: { name: "Lead", managerId: "boss", ancestors: ["boss"], uid: "u_lead" },
  m1: { name: "M1", managerId: "lead", ancestors: ["lead", "boss"], uid: "u_m1" },
  m2: { name: "M2", managerId: "lead", ancestors: ["lead", "boss"], uid: "u_m2" },
  other: { name: "Other", managerId: "boss2", ancestors: ["boss2"], uid: "u_other" },
}

describe.skipIf(!emulator)("Firestore Security Rules", () => {
  let env: RulesTestEnvironment

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: "rules-test",
      firestore: { host, port: Number(port), rules: readFileSync("firestore.rules", "utf8") },
    })
  })
  afterAll(async () => { await env.cleanup() })

  beforeEach(async () => {
    await env.clearFirestore()
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      for (const [id, e] of Object.entries(EMP)) {
        await setDoc(doc(db, "employees", id), { ...e, atIst: 1 })
        await setDoc(doc(db, "employees", id, "planWeeks", "2026-W01"), { x: 1 })
        await setDoc(doc(db, "employees", id, "todos", "t1"), { title: "t" })
        await setDoc(doc(db, "employees", id, "private", "account"), { uid: e.uid, email: `${id}@example.test`, accountPending: false })
      }
      await setDoc(doc(db, "org", "structure"), { tree: {} })
      await setDoc(doc(db, "financings", "f1"), { ownerId: "m1", ancestors: ["lead", "boss"] })
      await setDoc(doc(db, "sales", "s1"), {
        ownerId: "m1", ancestors: ["lead", "boss"], mitarbeiter: "M1", produkt: "FLV", praemie: 100, einheiten: 5,
        bookedAt: "2026-10-01T10:00:00.000Z", kunde: "", beginn: "", policiert: false, ausbezahlt: false,
      })
      await setDoc(doc(db, "snapshots", "2026-09", "employees", "m1"), { atIst: 1 })
    })
  })

  const as = (role: string, employeeId?: string) =>
    env.authenticatedContext(`u_${employeeId ?? role}`, { role, ...(employeeId ? { employeeId } : {}) }).firestore()
  const anon = () => env.unauthenticatedContext().firestore()
  const noClaims = () => env.authenticatedContext("anon", {}).firestore() // z. B. alter anonymer Login

  it("Startpasswort noch nicht geaendert (mustChangePassword): alles gesperrt", async () => {
    const db = env.authenticatedContext("u_m1", { role: "member", employeeId: "m1", mustChangePassword: true }).firestore()
    await assertFails(getDoc(doc(db, "employees", "m1")))
    await assertFails(getDoc(doc(db, "org", "structure")))
    await assertFails(setDoc(doc(db, "employees", "m1", "todos", "x"), { title: "t" }))
  })

  describe("employees", () => {
    it("anonym / ohne Rolle: alles verboten", async () => {
      await assertFails(getDoc(doc(anon(), "employees", "m1")))
      await assertFails(getDoc(doc(noClaims(), "employees", "m1")))
      await assertFails(setDoc(doc(noClaims(), "employees", "m1"), { atIst: 5 }, { merge: true }))
    })
    it("accountPending ist gesperrt (nur Admin/Function)", async () => {
      await assertFails(updateDoc(doc(as("member", "m1"), "employees", "m1"), { accountPending: true }))
      await assertFails(updateDoc(doc(as("lead", "lead"), "employees", "m1"), { accountPending: true }))
      await assertSucceeds(updateDoc(doc(as("admin"), "employees", "m1"), { accountPending: true }))
    })
    it("Mitarbeiter liest/schreibt sich selbst, nicht fremde", async () => {
      const db = as("member", "m1")
      await assertSucceeds(getDoc(doc(db, "employees", "m1")))
      await assertSucceeds(updateDoc(doc(db, "employees", "m1"), { atIst: 9 }))
      await assertSucceeds(getDoc(doc(db, "employees", "m2")))
      await assertFails(updateDoc(doc(db, "employees", "m2"), { atIst: 9 }))
      await assertSucceeds(getDoc(doc(db, "employees", "lead")))
      await assertFails(updateDoc(doc(db, "employees", "lead"), { atIst: 9 }))
    })
    it("monthStats schreibt nur die Function (Admin SDK), kein Client", async () => {
      await assertFails(updateDoc(doc(as("member", "m1"), "employees", "m1"), { monthStats: { atIst: 99 } }))
      await assertFails(updateDoc(doc(as("lead", "lead"), "employees", "m1"), { monthStats: { atIst: 99 } }))
    })
    it("Fuehrungskraft liest und bearbeitet Unterstruktur, nicht Gleichgestellte/Fremde", async () => {
      const db = as("lead", "lead")
      await assertSucceeds(getDoc(doc(db, "employees", "m1")))
      await assertSucceeds(updateDoc(doc(db, "employees", "m2"), { atIst: 7 }))
      await assertSucceeds(updateDoc(doc(db, "employees", "lead"), { atIst: 7 }))
      await assertSucceeds(getDoc(doc(db, "employees", "other")))
      await assertFails(updateDoc(doc(db, "employees", "boss"), { atIst: 7 }))
      await assertFails(updateDoc(doc(db, "employees", "other"), { atIst: 7 }))
    })
    it("gesperrte Felder nur fuer Admin", async () => {
      for (const f of [{ ancestors: [] }, { managerId: "boss" }, { uid: "x" }, { role: "admin" }, { name: "X" }]) {
        await assertFails(updateDoc(doc(as("member", "m1"), "employees", "m1"), f))
        await assertFails(updateDoc(doc(as("lead", "lead"), "employees", "m1"), f))
        await assertSucceeds(updateDoc(doc(as("admin", "boss"), "employees", "m1"), f))
        await env.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), "employees", "m1"), { ...EMP.m1 }))
      }
    })
    it("Konto-Daten (private/account): nur self, Vorgesetzte, Admin lesen; niemand schreibt per Client", async () => {
      await assertSucceeds(getDoc(doc(as("member", "m1"), "employees", "m1", "private", "account")))
      await assertSucceeds(getDoc(doc(as("lead", "lead"), "employees", "m1", "private", "account")))
      await assertSucceeds(getDoc(doc(as("admin"), "employees", "m1", "private", "account")))
      await assertFails(getDoc(doc(as("member", "m1"), "employees", "m2", "private", "account"))) // Kollege
      await assertFails(getDoc(doc(as("lead", "lead"), "employees", "other", "private", "account"))) // fremde Struktur
      await assertFails(getDoc(doc(as("lead", "lead"), "employees", "boss", "private", "account"))) // Vorgesetzter
      await assertFails(getDoc(doc(anon(), "employees", "m1", "private", "account")))
      for (const who of [as("member", "m1"), as("lead", "lead"), as("admin")]) {
        await assertFails(setDoc(doc(who, "employees", "m1", "private", "account"), { uid: "x", email: "x@y.z", accountPending: false }))
        await assertFails(updateDoc(doc(who, "employees", "m1", "private", "account"), { accountPending: false }))
      }
    })
    it("Bonus setzen nur Vorgesetzte/Admin, nicht die Person selbst", async () => {
      await assertFails(updateDoc(doc(as("member", "m1"), "employees", "m1"), { bonus: 500 }))
      await assertSucceeds(updateDoc(doc(as("member", "m1"), "employees", "m1"), { atIst: 3 }))
      await assertSucceeds(updateDoc(doc(as("lead", "lead"), "employees", "m1"), { bonus: 500 }))
      await assertSucceeds(updateDoc(doc(as("admin"), "employees", "lead"), { bonus: 500 }))
      // Fuehrungskraft darf den eigenen Bonus nicht aendern (sie ist nicht ihr eigener Vorgesetzter)
      await assertFails(updateDoc(doc(as("lead", "lead"), "employees", "lead"), { bonus: 600 }))
    })
    it("Admin liest alles, nur Admin legt an/loescht", async () => {
      await assertSucceeds(getDoc(doc(as("admin"), "employees", "other")))
      await assertSucceeds(setDoc(doc(as("admin"), "employees", "new"), { name: "N", ancestors: [] }))
      await assertSucceeds(deleteDoc(doc(as("admin"), "employees", "new")))
      await assertFails(setDoc(doc(as("lead", "lead"), "employees", "new"), { name: "N", ancestors: [] }))
      await assertFails(deleteDoc(doc(as("lead", "lead"), "employees", "m1")))
    })
  })

  describe("Planung (Subcollections)", () => {
    it("Mitarbeiter: nur eigene Planung", async () => {
      const db = as("member", "m1")
      await assertSucceeds(getDoc(doc(db, "employees", "m1", "planWeeks", "2026-W01")))
      await assertSucceeds(setDoc(doc(db, "employees", "m1", "planWeeks", "2026-W02"), { x: 2 }))
      await assertFails(getDoc(doc(db, "employees", "m2", "planWeeks", "2026-W01")))
      await assertFails(setDoc(doc(db, "employees", "m2", "planWeeks", "2026-W02"), { x: 2 }))
    })
    it("Fuehrungskraft: Planung der Unterstruktur lesen+schreiben, fremde nicht", async () => {
      const db = as("lead", "lead")
      await assertSucceeds(getDoc(doc(db, "employees", "m1", "planWeeks", "2026-W01")))
      await assertSucceeds(setDoc(doc(db, "employees", "m1", "planWeeks", "2026-W03"), { x: 3 }))
      await assertFails(getDoc(doc(db, "employees", "other", "planWeeks", "2026-W01")))
      await assertFails(getDoc(doc(db, "employees", "boss", "planWeeks", "2026-W01")))
    })
  })

  describe("Lesemodus (viewer)", () => {
    const viewer = () => as("viewer")

    it("liest alles ausser dem persönlichen Board", async () => {
      const db = viewer()
      await assertSucceeds(getDoc(doc(db, "employees", "m1")))
      await assertSucceeds(getDoc(doc(db, "employees", "m1", "planWeeks", "2026-W01")))
      await assertSucceeds(getDoc(doc(db, "employees", "m1", "private", "account")))
      await assertSucceeds(getDoc(doc(db, "financings", "f1")))
      await assertSucceeds(getDoc(doc(db, "sales", "s1")))
      await assertSucceeds(getDoc(doc(db, "org", "structure")))
      await assertSucceeds(getDoc(doc(db, "snapshots", "2026-09", "employees", "m1")))
      await assertFails(getDoc(doc(db, "employees", "m1", "todos", "t1")))
    })

    it("schreibt nirgends", async () => {
      const db = viewer()
      await assertFails(updateDoc(doc(db, "employees", "m1"), { atIst: 2 }))
      await assertFails(setDoc(doc(db, "employees", "m1", "planWeeks", "2026-W02"), { x: 1 }))
      await assertFails(setDoc(doc(db, "employees", "m1", "planWeeks", "2026-W01"), { x: 2 }))
      await assertFails(updateDoc(doc(db, "financings", "f1"), { ownerId: "m1" }))
      await assertFails(deleteDoc(doc(db, "financings", "f1")))
      await assertFails(updateDoc(doc(db, "sales", "s1"), { kunde: "x" }))
      await assertFails(deleteDoc(doc(db, "sales", "s1")))
      await assertFails(updateDoc(doc(db, "org", "structure"), { tree: {} }))
      await assertFails(setDoc(doc(db, "celebrations", "c1"), { name: "X", at: 1 }))
      await assertFails(setDoc(doc(db, "employees", "m1", "todos", "t2"), { title: "x" }))
    })
  })

  describe("Lesemodus mit verknüpftem Mitarbeiter", () => {
    const linked = () => as("viewer", "m1")

    it("hat keine eigene Identität: schreibt weder Stammdaten noch Planung, Todos, Finanzierungen oder Umsätze", async () => {
      const db = linked()
      await assertSucceeds(getDoc(doc(db, "employees", "m2")))
      await assertFails(updateDoc(doc(db, "employees", "m1"), { atIst: 9 }))
      await assertFails(setDoc(doc(db, "employees", "m1", "planWeeks", "2026-W09"), { x: 1 }))
      await assertFails(setDoc(doc(db, "employees", "m1", "planMonthNotes", "2026-10"), { x: 1 }))
      await assertFails(setDoc(doc(db, "employees", "m1", "planAnnual", "2026"), { x: 1 }))
      await assertFails(setDoc(doc(db, "employees", "m1", "attendance", "2026-10"), { x: 1 }))
      await assertFails(setDoc(doc(db, "employees", "m1", "todos", "t9"), { title: "x" }))
      await assertFails(setDoc(doc(db, "financings", "f9"), { ownerId: "m1", ancestors: ["lead", "boss"] }))
      await assertFails(setDoc(doc(db, "sales", "s9"), { ownerId: "m1", ancestors: ["lead", "boss"] }))
    })
    it("ein Viewer mit Mitarbeiter, der Vorgesetzter wäre, schreibt ebenfalls nicht", async () => {
      const db = as("viewer", "lead")
      await assertFails(updateDoc(doc(db, "employees", "m1"), { atIst: 9 }))
      await assertFails(setDoc(doc(db, "employees", "m1", "planWeeks", "2026-W09"), { x: 1 }))
      await assertFails(deleteDoc(doc(db, "financings", "f1")))
    })
  })

  describe("Mitarbeiter-Zahlen und Karrierezähler", () => {
    const seed = (data: Record<string, unknown>) =>
      env.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), "employees", "m1"), { ...EMP.m1, ...data }))

    it("Zahlenfelder müssen Zahlen in plausiblem Bereich sein", async () => {
      const db = as("member", "m1")
      await assertSucceeds(updateDoc(doc(db, "employees", "m1"), { ist: 12, atIst: 3, ehByPlan: { insurance: 12 } }))
      await assertFails(updateDoc(doc(db, "employees", "m1"), { ist: "viel" }))
      await assertFails(updateDoc(doc(db, "employees", "m1"), { atIst: 1e12 }))
      await assertFails(updateDoc(doc(db, "employees", "m1"), { ehByPlan: { insurance: "x" } }))
      await assertFails(updateDoc(doc(db, "employees", "m1"), { ehByPlan: { unbekannt: 1 } }))
      await assertFails(updateDoc(doc(db, "employees", "m1"), { careerUnits: { insurance: 1, extra: 2 } }))
    })
    it("die Person selbst kann den Karrierezähler nur erhöhen, Vorgesetzte und Admin auch senken", async () => {
      await seed({ careerUnits: { insurance: 500, credit: 100 } })
      const self = as("member", "m1")
      await assertSucceeds(updateDoc(doc(self, "employees", "m1"), { careerUnits: { insurance: 600, credit: 100 } }))
      await assertFails(updateDoc(doc(self, "employees", "m1"), { careerUnits: { insurance: 100, credit: 100 } }))
      await assertFails(updateDoc(doc(self, "employees", "m1"), { careerUnits: { insurance: 600 } })) // credit würde auf 0 fallen
      await assertSucceeds(updateDoc(doc(as("lead", "lead"), "employees", "m1"), { careerUnits: { insurance: 100, credit: 100 } }))
      await assertSucceeds(updateDoc(doc(as("admin"), "employees", "m1"), { careerUnits: { insurance: 0 } }))
    })
  })

  describe("entfernte Mitarbeiter (active=false)", () => {
    it("verlieren trotz gültigem Token jeden Zugriff", async () => {
      await env.withSecurityRulesDisabled(async (c) =>
        setDoc(doc(c.firestore(), "employees", "m2"), { ...EMP.m2, active: false, managerId: null, ancestors: [] }))
      const db = as("member", "m2")
      await assertFails(getDoc(doc(db, "employees", "m1")))
      await assertFails(getDoc(doc(db, "org", "structure")))
      await assertFails(updateDoc(doc(db, "employees", "m2"), { atIst: 5 }))
      await assertFails(setDoc(doc(db, "celebrations", "cx"), { name: "M2", at: 1 }))
    })
    it("ein Admin ohne Mitarbeiter-Verknüpfung ist davon nicht betroffen", async () => {
      await assertSucceeds(getDoc(doc(as("admin"), "org", "structure")))
    })
  })

  describe("celebrations (Konfetti)", () => {
    it("Name höchstens 80 Zeichen, Zeitpunkt muss eine Zahl sein", async () => {
      const db = as("member", "m1")
      await assertSucceeds(setDoc(doc(db, "celebrations", "c80"), { name: "x".repeat(80), at: 1 }))
      await assertFails(setDoc(doc(db, "celebrations", "c81"), { name: "x".repeat(81), at: 1 }))
      await assertFails(setDoc(doc(db, "celebrations", "cs"), { name: "Mia", at: "heute" }))
    })
  })

  describe("org/teamGoal und archiveIndex", () => {
    it("lassen sich nicht löschen und neu anlegen (Umgehung der Rückschritt-Sperre)", async () => {
      await env.withSecurityRulesDisabled(async (c) => {
        await setDoc(doc(c.firestore(), "org", "teamGoal"), { teamGoal: { periodStart: "2026-10-01" }, history: [1, 2] })
        await setDoc(doc(c.firestore(), "org", "archiveIndex"), { months: ["2026-09"] })
      })
      const admin = as("admin")
      await assertFails(deleteDoc(doc(admin, "org", "teamGoal")))
      await assertFails(deleteDoc(doc(admin, "org", "archiveIndex")))
    })
  })

  describe("Finanzierungen: Abwickler", () => {
    it("abwicklerId muss leer oder ein vorhandener Mitarbeiter sein", async () => {
      const db = as("lead", "lead")
      await assertSucceeds(updateDoc(doc(db, "financings", "f1"), { abwicklerId: "m2" }))
      await assertSucceeds(updateDoc(doc(db, "financings", "f1"), { abwicklerId: "" }))
      await assertFails(updateDoc(doc(db, "financings", "f1"), { abwicklerId: "gibt-es-nicht" }))
      await assertFails(updateDoc(doc(db, "financings", "f1"), { abwicklerId: "a/b" }))
      await assertFails(updateDoc(doc(db, "financings", "f1"), { abwicklerId: 42 }))
    })
  })

  describe("planMonthNotes, planAnnual, attendance", () => {
    it("Person und Vorgesetzte lesen und schreiben, Kollegen und Fremde nicht", async () => {
      for (const sub of ["planMonthNotes", "planAnnual", "attendance"]) {
        await env.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), "employees", "m1", sub, "d1"), { x: 1 }))
        await assertSucceeds(getDoc(doc(as("member", "m1"), "employees", "m1", sub, "d1")))
        await assertSucceeds(setDoc(doc(as("member", "m1"), "employees", "m1", sub, "d2"), { x: 2 }))
        await assertSucceeds(setDoc(doc(as("lead", "lead"), "employees", "m1", sub, "d3"), { x: 3 }))
        await assertSucceeds(getDoc(doc(as("viewer"), "employees", "m1", sub, "d1")))
        await assertFails(getDoc(doc(as("member", "m2"), "employees", "m1", sub, "d1")))
        await assertFails(setDoc(doc(as("member", "m2"), "employees", "m1", sub, "d4"), { x: 4 }))
        await assertFails(setDoc(doc(as("viewer"), "employees", "m1", sub, "d5"), { x: 5 }))
      }
    })
  })

  describe("celebrations (Konfetti)", () => {
    it("Eingeloggte melden eine Buchung und lesen mit, ändern/löschen nicht, fremde Felder verboten", async () => {
      const db = as("member", "m1")
      await assertSucceeds(setDoc(doc(db, "celebrations", "c1"), { name: "Mia", at: Date.now() }))
      await assertSucceeds(getDoc(doc(as("member", "m2"), "celebrations", "c1")))
      await assertFails(updateDoc(doc(db, "celebrations", "c1"), { name: "X" }))
      await assertFails(setDoc(doc(db, "celebrations", "c2"), { name: "Mia", at: 1, extra: true }))
      await assertFails(setDoc(doc(anon(), "celebrations", "c3"), { name: "Mia", at: 1 }))
    })
  })

  describe("Todos (Mein Board)", () => {
    it("nur der Besitzer — weder Vorgesetzte noch Admin", async () => {
      await assertSucceeds(getDoc(doc(as("member", "m1"), "employees", "m1", "todos", "t1")))
      await assertSucceeds(setDoc(doc(as("member", "m1"), "employees", "m1", "todos", "t2"), { title: "n" }))
      await assertFails(getDoc(doc(as("lead", "lead"), "employees", "m1", "todos", "t1")))
      await assertFails(getDoc(doc(as("admin", "boss"), "employees", "m1", "todos", "t1")))
    })
  })

  describe("sales (Umsatzverfolgung)", () => {
    it("lesen: Besitzer, Vorgesetzte, Admin - nicht Kollegen oder fremde Struktur", async () => {
      await assertSucceeds(getDoc(doc(as("member", "m1"), "sales", "s1")))
      await assertSucceeds(getDoc(doc(as("lead", "lead"), "sales", "s1")))
      await assertSucceeds(getDoc(doc(as("admin", "boss"), "sales", "s1")))
      await assertFails(getDoc(doc(as("member", "m2"), "sales", "s1")))
      await assertFails(getDoc(doc(as("lead", "other"), "sales", "s1")))
    })
    it("nachtraeglich aenderbar: nur Kunde, Beginn, policiert, ausbezahlt", async () => {
      const db = as("member", "m1")
      await assertSucceeds(updateDoc(doc(db, "sales", "s1"), { kunde: "Muster", beginn: "2026-11-01", policiert: true, ausbezahlt: true }))
      await assertFails(updateDoc(doc(db, "sales", "s1"), { praemie: 1 }))
      await assertFails(updateDoc(doc(db, "sales", "s1"), { ownerId: "m2", ancestors: ["lead", "boss"] }))
      await assertFails(updateDoc(doc(as("member", "m2"), "sales", "s1"), { kunde: "x" }))
    })
    it("anlegen: nur fuer sich/Unterstruktur, ancestors muessen zum Besitzer passen", async () => {
      const row = { mitarbeiter: "M1", produkt: "BU", praemie: 50, einheiten: 2, bookedAt: "2026-10-02T10:00:00.000Z", kunde: "", beginn: "", policiert: false, ausbezahlt: false }
      await assertSucceeds(setDoc(doc(as("member", "m1"), "sales", "s2"), { ...row, ownerId: "m1", ancestors: ["lead", "boss"] }))
      await assertSucceeds(setDoc(doc(as("lead", "lead"), "sales", "s3"), { ...row, ownerId: "m1", ancestors: ["lead", "boss"] }))
      await assertFails(setDoc(doc(as("member", "m1"), "sales", "s4"), { ...row, ownerId: "m1", ancestors: ["lead", "boss", "m2"] }))
      await assertFails(setDoc(doc(as("member", "m1"), "sales", "s5"), { ...row, ownerId: "m2", ancestors: ["lead", "boss"] }))
    })
    it("loeschen: Besitzer und Vorgesetzte, nicht Kollegen", async () => {
      await assertFails(deleteDoc(doc(as("member", "m2"), "sales", "s1")))
      await assertSucceeds(deleteDoc(doc(as("member", "m1"), "sales", "s1")))
    })
  })

  describe("financings", () => {
    it("Besitzer und Vorgesetzte lesen, Fremde nicht", async () => {
      await assertSucceeds(getDoc(doc(as("member", "m1"), "financings", "f1")))
      await assertSucceeds(getDoc(doc(as("lead", "lead"), "financings", "f1")))
      await assertFails(getDoc(doc(as("member", "m2"), "financings", "f1")))
      await assertFails(getDoc(doc(as("lead", "other"), "financings", "f1")))
    })
    it("Abwickler sieht/bearbeitet zugewiesene Faelle, aendert aber Betreuer/Abwickler nicht", async () => {
      await env.withSecurityRulesDisabled(async (c) =>
        setDoc(doc(c.firestore(), "financings", "f5"), { ownerId: "m1", ancestors: ["lead", "boss"], abwicklerId: "other" }))
      const ab = as("member", "other")
      await assertSucceeds(getDoc(doc(ab, "financings", "f5")))
      await assertFails(getDoc(doc(ab, "financings", "f1")))
      await assertSucceeds(updateDoc(doc(ab, "financings", "f5"), { eingereicht: true }))
      await assertFails(updateDoc(doc(ab, "financings", "f5"), { ownerId: "other", ancestors: ["boss2"] }))
      await assertFails(updateDoc(doc(ab, "financings", "f5"), { abwicklerId: "m2" }))
      await assertFails(deleteDoc(doc(ab, "financings", "f5")))
      // Betreuer darf den Abwickler wechseln
      await assertSucceeds(updateDoc(doc(as("member", "m1"), "financings", "f5"), { abwicklerId: "m2" }))
    })
    it("Anlegen nur mit korrekten ancestors", async () => {
      const db = as("member", "m1")
      await assertSucceeds(setDoc(doc(db, "financings", "f2"), { ownerId: "m1", ancestors: ["lead", "boss"] }))
      await assertFails(setDoc(doc(db, "financings", "f3"), { ownerId: "m1", ancestors: ["lead", "boss", "m2"] }))
      await assertFails(setDoc(doc(db, "financings", "f4"), { ownerId: "m2", ancestors: ["lead", "boss"] }))
    })
    it("ownerId/ancestors nur konsistent aenderbar", async () => {
      const db = as("member", "m1")
      await assertSucceeds(updateDoc(doc(db, "financings", "f1"), { betrag: 5 }))
      await assertFails(updateDoc(doc(db, "financings", "f1"), { ancestors: [] }))
      // Betreuerwechsel auf einen Fremden: Mitarbeiter darf nicht auf "other" zugreifen
      await assertFails(updateDoc(doc(db, "financings", "f1"), { ownerId: "other", ancestors: ["boss2"] }))
      // Fuehrungskraft darf auf Mitarbeiter m2 umhaengen, aber nur mit passenden ancestors
      const lead = as("lead", "lead")
      await assertFails(updateDoc(doc(lead, "financings", "f1"), { ownerId: "m2", ancestors: [] }))
      await assertSucceeds(updateDoc(doc(lead, "financings", "f1"), { ownerId: "m2", ancestors: ["lead", "boss"] }))
    })
  })

  describe("org, users, snapshots", () => {
    it("org: alle Eingeloggten lesen, nur Admin schreibt, anonym nichts", async () => {
      await assertSucceeds(getDoc(doc(as("member", "m1"), "org", "structure")))
      await assertFails(setDoc(doc(as("member", "m1"), "org", "structure"), { tree: 1 }))
      await assertFails(setDoc(doc(as("lead", "lead"), "org", "structure"), { tree: 1 }))
      await assertSucceeds(setDoc(doc(as("admin"), "org", "structure"), { tree: 1 }))
      await assertFails(getDoc(doc(anon(), "org", "structure")))
    })
    it("users: nur eigenes lesen, nie schreiben", async () => {
      await env.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), "users", "u_m1"), { role: "member" }))
      await assertSucceeds(getDoc(doc(as("member", "m1"), "users", "u_m1")))
      await assertFails(getDoc(doc(as("member", "m2"), "users", "u_m1")))
      await assertFails(setDoc(doc(as("member", "m1"), "users", "u_m1"), { role: "admin" }))
      await assertFails(setDoc(doc(as("admin"), "users", "u_m1"), { role: "admin" }))
    })
    it("snapshots: lesbar wie employees; anlegen nur Admin, danach unveraenderlich", async () => {
      await assertSucceeds(getDoc(doc(as("lead", "lead"), "snapshots", "2026-09", "employees", "m1")))
      await assertSucceeds(getDoc(doc(as("member", "m2"), "snapshots", "2026-09", "employees", "m1")))
      await assertFails(getDoc(doc(anon(), "snapshots", "2026-09", "employees", "m1")))
      await assertFails(setDoc(doc(as("lead", "lead"), "snapshots", "2026-10", "employees", "m1"), { atIst: 0 }))
      await assertSucceeds(setDoc(doc(as("admin"), "snapshots", "2026-10", "employees", "m1"), { atIst: 0 }))
      await assertFails(setDoc(doc(as("admin"), "snapshots", "2026-09", "employees", "m1"), { atIst: 0 }))
    })
    it("alte Sammeldokumente (finova/*) sind gesperrt", async () => {
      await assertFails(getDoc(doc(as("admin"), "finova", "dashboard")))
      await assertFails(setDoc(doc(as("admin"), "finova", "dashboard"), { rows: [] }))
    })
  })

  describe("Schutz vor Zurückrollen (veralteter Admin-Tab)", () => {
    beforeEach(async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore()
        await setDoc(doc(db, "org", "teamGoal"), { teamGoal: { periodStart: "2026-10-01", periodEnd: "2026-10-31" }, history: [{ d: 1 }, { d: 2 }] })
        await setDoc(doc(db, "org", "archiveIndex"), { months: [{ month: "2026-08" }, { month: "2026-09" }] })
      })
    })
    it("Teamziel darf nicht auf einen früheren Monat zurück, vorwärts schon", async () => {
      const db = as("admin")
      await assertFails(setDoc(doc(db, "org", "teamGoal"), { teamGoal: { periodStart: "2026-09-01", periodEnd: "2026-09-30" }, history: [{ d: 1 }, { d: 2 }] }))
      await assertFails(setDoc(doc(db, "org", "teamGoal"), { teamGoal: { periodStart: "2026-09-01" } }, { merge: true }))
      await assertSucceeds(setDoc(doc(db, "org", "teamGoal"), { teamGoal: { periodStart: "2026-11-01", periodEnd: "2026-11-30" }, history: [{ d: 1 }, { d: 2 }, { d: 3 }] }))
    })
    it("Verlauf darf nicht kürzer werden, Notiz ändern geht", async () => {
      const db = as("admin")
      await assertFails(setDoc(doc(db, "org", "teamGoal"), { history: [{ d: 1 }] }, { merge: true }))
      await assertSucceeds(setDoc(doc(db, "org", "teamGoal"), { teamGoal: { note: "x" } }, { merge: true }))
    })
    it("Archivindex darf keine Monate verlieren", async () => {
      const db = as("admin")
      await assertFails(setDoc(doc(db, "org", "archiveIndex"), { months: [{ month: "2026-09" }] }))
      await assertSucceeds(setDoc(doc(db, "org", "archiveIndex"), { months: [{ month: "2026-08" }, { month: "2026-09" }, { month: "2026-10" }] }))
    })
    it("Nicht-Admins schreiben org/* nie; sonstige org-Dokumente bleiben für Admin beschreibbar", async () => {
      await assertFails(setDoc(doc(as("lead", "lead"), "org", "teamGoal"), { teamGoal: { periodStart: "2027-01-01" } }, { merge: true }))
      await assertSucceeds(updateDoc(doc(as("admin"), "org", "structure"), { notes: {} }))
    })
  })
})
