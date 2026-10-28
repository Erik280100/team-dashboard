import { describe, expect, it } from "vitest"
import { cn } from "../../src/lib/utils"

describe("cn", () => {
  it("löst widersprüchliche Tailwind-Klassen zugunsten der letzten auf", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4")
  })

  it("ignoriert falsche Werte", () => {
    const off = false as boolean
    expect(cn("a", off && "b", undefined, null, "c")).toBe("a c")
  })
})
