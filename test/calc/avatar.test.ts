import { describe, expect, it } from "vitest"
import { squareCrop } from "../../src/lib/avatar"

describe("squareCrop", () => {
  it("schneidet ein Querformat mittig zu", () => {
    expect(squareCrop(400, 300)).toEqual({ sx: 50, sy: 0, size: 300 })
  })
  it("schneidet ein Hochformat mittig zu", () => {
    expect(squareCrop(300, 500)).toEqual({ sx: 0, sy: 100, size: 300 })
  })
  it("lässt ein Quadrat unverändert", () => {
    expect(squareCrop(256, 256)).toEqual({ sx: 0, sy: 0, size: 256 })
  })
})
