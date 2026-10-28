import { describe, expect, it } from "vitest"
import { viennaMonth } from "../../functions/src/monthClose"

describe("viennaMonth", () => {
  it("nimmt den Kalendermonat in Wien, nicht in UTC", () => {
    // 30.09. 22:30 UTC ist in Wien (Sommerzeit, UTC+2) schon der 1.10. 00:30
    expect(viennaMonth(new Date("2026-09-30T22:30:00Z"))).toBe("2026-10")
    expect(viennaMonth(new Date("2026-09-30T21:30:00Z"))).toBe("2026-09")
  })

  it("Winterzeit (UTC+1): der Wechsel liegt um 23:00 UTC", () => {
    expect(viennaMonth(new Date("2026-12-31T22:59:00Z"))).toBe("2026-12")
    expect(viennaMonth(new Date("2026-12-31T23:00:00Z"))).toBe("2027-01")
  })

  it("liefert YYYY-MM mit führender Null", () => {
    expect(viennaMonth(new Date("2026-03-15T12:00:00Z"))).toBe("2026-03")
  })
})
