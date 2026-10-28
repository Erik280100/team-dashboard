import { beforeEach, describe, expect, it, vi } from "vitest"
import type { EmployeeMeta } from "../../src/lib/calc/employees"

// Firestore-Zugriffe durch Attrappen ersetzen: getestet wird nur die Logik in employeeSubdocs.ts.
const mocks = vi.hoisted(() => ({
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
}))

vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  documentId: () => "__name__",
  where: (...args: unknown[]) => ({ args }),
  query: (...args: unknown[]) => ({ args }),
  setDoc: vi.fn(),
  getDoc: mocks.getDoc,
  getDocs: mocks.getDocs,
  onSnapshot: mocks.onSnapshot,
}))
vi.mock("@/lib/firebase", () => ({ firestore: {} }))

import { fetchEmployeeDocs, fetchEmployeeRange, subscribeEmployeeDocs } from "../../src/lib/employeeSubdocs"

const emp = (id: string): EmployeeMeta => ({ id, name: `Name ${id}` }) as EmployeeMeta
const people = (n: number) => Array.from({ length: n }, (_, i) => emp(`e${i}`))

beforeEach(() => vi.clearAllMocks())

describe("fetchEmployeeDocs", () => {
  it("setzt die Einträge nach Mitarbeitername zusammen und entfernt das Meta-Feld", async () => {
    mocks.getDoc.mockImplementation(async (ref: { path: string }) => ({
      exists: () => ref.path.includes("e1"),
      data: () => ({ x: 1, meta: "weg" }),
    }))
    const out = await fetchEmployeeDocs("planWeeks", "2026-W01", "meta", [emp("e1"), emp("e2")])
    expect(out).toEqual({ "Name e1": { x: 1 } })
  })

  it("nicht lesbare Dokumente werden ausgelassen, die anderen kommen trotzdem", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    mocks.getDoc.mockImplementation(async (ref: { path: string }) => {
      if (ref.path.includes("e1")) throw new Error("permission-denied")
      return { exists: () => true, data: () => ({ ok: true }) }
    })
    const out = await fetchEmployeeDocs("planWeeks", "k", "meta", [emp("e1"), emp("e2")])
    expect(out).toEqual({ "Name e2": { ok: true } })
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it("liest höchstens 24 Dokumente gleichzeitig", async () => {
    let active = 0
    let peak = 0
    mocks.getDoc.mockImplementation(async () => {
      active++
      peak = Math.max(peak, active)
      await new Promise((r) => setTimeout(r, 1))
      active--
      return { exists: () => false, data: () => ({}) }
    })
    await fetchEmployeeDocs("planWeeks", "k", "meta", people(100))
    expect(mocks.getDoc).toHaveBeenCalledTimes(100)
    expect(peak).toBeLessThanOrEqual(24)
    expect(peak).toBeGreaterThan(1)
  })
})

describe("fetchEmployeeRange", () => {
  it("meldet jedes Dokument mit Schlüssel und Mitarbeitername, ohne Meta-Feld", async () => {
    mocks.getDocs.mockResolvedValue({
      forEach: (cb: (d: { id: string; data: () => Record<string, unknown> }) => void) => {
        cb({ id: "2026-W01", data: () => ({ a: 1, meta: "x" }) })
        cb({ id: "2026-W02", data: () => ({ a: 2 }) })
      },
    })
    const seen: [string, string, unknown][] = []
    await fetchEmployeeRange("planWeeks", "meta", "2026-W01", "2026-W02", [emp("e1")], (k, n, entry) => seen.push([k, n, entry]))
    expect(seen).toEqual([["2026-W01", "Name e1", { a: 1 }], ["2026-W02", "Name e1", { a: 2 }]])
  })

  it("ein Fehler bei einer Person bricht die anderen nicht ab", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    mocks.getDocs.mockRejectedValueOnce(new Error("denied")).mockResolvedValue({ forEach: () => {} })
    await expect(fetchEmployeeRange("planWeeks", "meta", "a", "b", [emp("e1"), emp("e2")], () => {})).resolves.toBeUndefined()
    expect(mocks.getDocs).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })
})

describe("subscribeEmployeeDocs", () => {
  type Snap = { metadata: { hasPendingWrites: boolean; fromCache: boolean }; exists: () => boolean; data: () => Record<string, unknown> }
  const snap = (over: Partial<Snap["metadata"]> = {}, data: Record<string, unknown> | null = { v: 1, meta: "m" }): Snap => ({
    metadata: { hasPendingWrites: false, fromCache: false, ...over },
    exists: () => data !== null,
    data: () => data ?? {},
  })

  it("ohne Mitarbeiter wird sofort mit ready=true gemeldet", () => {
    const onData = vi.fn()
    subscribeEmployeeDocs("planWeeks", "k", "meta", [], onData, vi.fn())
    expect(onData).toHaveBeenCalledWith({}, true)
    expect(mocks.onSnapshot).not.toHaveBeenCalled()
  })

  it("ready erst, wenn jede Person einen Server-Snapshot hatte; Cache-Snapshots zählen nicht", () => {
    const handlers: Record<string, (s: Snap) => void> = {}
    mocks.onSnapshot.mockImplementation((ref: { path: string }, _opts: unknown, cb: (s: Snap) => void) => {
      handlers[ref.path] = cb
      return () => {}
    })
    const onData = vi.fn()
    subscribeEmployeeDocs("planWeeks", "k", "meta", [emp("e1"), emp("e2")], onData, vi.fn())

    handlers["employees/e1/planWeeks/k"](snap({ fromCache: true }))
    expect(onData).toHaveBeenLastCalledWith({ "Name e1": { v: 1 } }, false)
    handlers["employees/e1/planWeeks/k"](snap())
    expect(onData).toHaveBeenLastCalledWith({ "Name e1": { v: 1 } }, false) // e2 fehlt noch
    handlers["employees/e2/planWeeks/k"](snap({}, null))
    expect(onData).toHaveBeenLastCalledWith({ "Name e1": { v: 1 } }, true) // e2 existiert nicht, ist aber bestätigt
  })

  it("überspringt Snapshots eigener, noch nicht bestätigter Schreibvorgänge", () => {
    let cb: (s: Snap) => void = () => {}
    mocks.onSnapshot.mockImplementation((_ref: unknown, _opts: unknown, c: (s: Snap) => void) => { cb = c; return () => {} })
    const onData = vi.fn()
    subscribeEmployeeDocs("planWeeks", "k", "meta", [emp("e1")], onData, vi.fn())
    cb(snap({ hasPendingWrites: true }))
    expect(onData).not.toHaveBeenCalled()
  })

  it("das Abbestellen beendet alle Listener", () => {
    const unsubs = [vi.fn(), vi.fn()]
    mocks.onSnapshot.mockImplementationOnce(() => unsubs[0]).mockImplementationOnce(() => unsubs[1])
    const stop = subscribeEmployeeDocs("planWeeks", "k", "meta", [emp("e1"), emp("e2")], vi.fn(), vi.fn())
    stop()
    expect(unsubs[0]).toHaveBeenCalledOnce()
    expect(unsubs[1]).toHaveBeenCalledOnce()
  })
})
