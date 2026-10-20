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
      }
      await setDoc(doc(db, "org", "structure"), { tree: {} })
      await setDoc(doc(db, "financings", "f1"), { ownerId: "m1", ancestors: ["lead", "boss"] })
      await setDoc(doc(db, "snapshots", "2026-09", "employees", "m1"), { atIst: 1 })
    })
  })

  const as = (role: string, employeeId?: string) =>
    env.authenticatedContext(`u_${employeeId ?? role}`, { role, ...(employeeId ? { employeeId } : {}) }).firestore()
  const anon = () => env.unauthenticatedContext().firestore()
  const noClaims = () => env.authenticatedContext("anon", {}).firestore() // z. B. alter anonymer Login

  describe("employees", () => {
    it("anonym / ohne Rolle: alles verboten", async () => {
      await assertFails(getDoc(doc(anon(), "employees", "m1")))
      await assertFails(getDoc(doc(noClaims(), "employees", "m1")))
      await assertFails(setDoc(doc(noClaims(), "employees", "m1"), { atIst: 5 }, { merge: true }))
    })
    it("Mitarbeiter liest/schreibt sich selbst, nicht fremde", async () => {
      const db = as("member", "m1")
      await assertSucceeds(getDoc(doc(db, "employees", "m1")))
      await assertSucceeds(updateDoc(doc(db, "employees", "m1"), { atIst: 9 }))
      await assertFails(getDoc(doc(db, "employees", "m2")))
      await assertFails(updateDoc(doc(db, "employees", "m2"), { atIst: 9 }))
      await assertFails(getDoc(doc(db, "employees", "lead")))
    })
    it("Fuehrungskraft liest und bearbeitet Unterstruktur, nicht Gleichgestellte/Fremde", async () => {
      const db = as("lead", "lead")
      await assertSucceeds(getDoc(doc(db, "employees", "m1")))
      await assertSucceeds(updateDoc(doc(db, "employees", "m2"), { atIst: 7 }))
      await assertSucceeds(updateDoc(doc(db, "employees", "lead"), { atIst: 7 }))
      await assertFails(getDoc(doc(db, "employees", "boss")))
      await assertFails(getDoc(doc(db, "employees", "other")))
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

  describe("Todos (Mein Board)", () => {
    it("nur der Besitzer — weder Vorgesetzte noch Admin", async () => {
      await assertSucceeds(getDoc(doc(as("member", "m1"), "employees", "m1", "todos", "t1")))
      await assertSucceeds(setDoc(doc(as("member", "m1"), "employees", "m1", "todos", "t2"), { title: "n" }))
      await assertFails(getDoc(doc(as("lead", "lead"), "employees", "m1", "todos", "t1")))
      await assertFails(getDoc(doc(as("admin", "boss"), "employees", "m1", "todos", "t1")))
    })
  })

  describe("financings", () => {
    it("Besitzer und Vorgesetzte lesen, Fremde nicht", async () => {
      await assertSucceeds(getDoc(doc(as("member", "m1"), "financings", "f1")))
      await assertSucceeds(getDoc(doc(as("lead", "lead"), "financings", "f1")))
      await assertFails(getDoc(doc(as("member", "m2"), "financings", "f1")))
      await assertFails(getDoc(doc(as("lead", "other"), "financings", "f1")))
    })
    it("Anlegen nur mit korrekten ancestors", async () => {
      const db = as("member", "m1")
      await assertSucceeds(setDoc(doc(db, "financings", "f2"), { ownerId: "m1", ancestors: ["lead", "boss"] }))
      await assertFails(setDoc(doc(db, "financings", "f3"), { ownerId: "m1", ancestors: ["lead", "boss", "m2"] }))
      await assertFails(setDoc(doc(db, "financings", "f4"), { ownerId: "m2", ancestors: ["lead", "boss"] }))
    })
    it("ownerId/ancestors nicht aenderbar", async () => {
      const db = as("member", "m1")
      await assertSucceeds(updateDoc(doc(db, "financings", "f1"), { betrag: 5 }))
      await assertFails(updateDoc(doc(db, "financings", "f1"), { ownerId: "m2" }))
      await assertFails(updateDoc(doc(db, "financings", "f1"), { ancestors: [] }))
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
    it("snapshots: lesbar wie employees, nie schreibbar", async () => {
      await assertSucceeds(getDoc(doc(as("lead", "lead"), "snapshots", "2026-09", "employees", "m1")))
      await assertFails(getDoc(doc(as("member", "m2"), "snapshots", "2026-09", "employees", "m1")))
      await assertFails(setDoc(doc(as("admin"), "snapshots", "2026-09", "employees", "m1"), { atIst: 0 }))
    })
    it("alte Sammeldokumente (finova/*) sind gesperrt", async () => {
      await assertFails(getDoc(doc(as("admin"), "finova", "dashboard")))
      await assertFails(setDoc(doc(as("admin"), "finova", "dashboard"), { rows: [] }))
    })
  })
})
