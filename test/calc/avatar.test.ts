import { describe, expect, it } from "vitest"
import { cropAt, squareCrop } from "../../src/lib/avatar"

describe("cropAt", () => {
  it("zoom 1 nimmt die ganze kurze Seite", () => {
    expect(cropAt(300, 500, 1, 0, 50)).toEqual({ sx: 0, sy: 50, size: 300 })
  })
  it("zoomt hinein und hält den Ausschnitt im Bild", () => {
    expect(cropAt(300, 500, 2, 400, 900)).toEqual({ sx: 150, sy: 350, size: 150 })
    expect(cropAt(300, 500, 2, -10, -10)).toEqual({ sx: 0, sy: 0, size: 150 })
  })
  it("Zoom unter 1 wird wie 1 behandelt", () => {
    expect(cropAt(400, 300, 0.5, 0, 0).size).toBe(300)
  })
})

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
