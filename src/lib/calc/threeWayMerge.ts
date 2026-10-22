// Drei-Wege-Merge für Cloud-Dokumente: übernimmt nur das, was DIESER Browser gegenüber seinem
// zuletzt gesehenen Stand (base) geändert hat, in den aktuellen Cloud-Stand (server). Alles, was
// andere zwischenzeitlich geändert haben, bleibt erhalten, statt vom ganzen Dokument überschrieben zu werden.

type Json = unknown

const KEY_FIELDS = ["id", "name", "date"] as const

const eq = (a: Json, b: Json) => JSON.stringify(a) === JSON.stringify(b)
const isObj = (v: Json): v is Record<string, Json> => !!v && typeof v === "object" && !Array.isArray(v)

/** Schlüsselfeld, falls alle Elemente Objekte mit eindeutigem String-Schlüssel sind (sonst null). */
function keyFieldOf(...lists: Json[][]): (typeof KEY_FIELDS)[number] | null {
  const items = lists.flat()
  if (items.length === 0 || !items.every(isObj)) return null
  for (const f of KEY_FIELDS) {
    if (!items.every((it) => typeof (it as Record<string, Json>)[f] === "string")) continue
    if (lists.every((l) => new Set(l.map((it) => (it as Record<string, Json>)[f])).size === l.length)) return f
  }
  return null
}

export function mergeThreeWay(base: Json, mine: Json, server: Json): Json {
  if (eq(base, mine)) return server
  if (eq(base, server)) return mine
  if (Array.isArray(mine) && Array.isArray(server)) {
    const b = Array.isArray(base) ? base : []
    const f = keyFieldOf(b, mine, server)
    if (!f) return mine
    const key = (it: Json) => (it as Record<string, Json>)[f] as string
    const baseBy = new Map(b.map((it) => [key(it), it]))
    const mineBy = new Map(mine.map((it) => [key(it), it]))
    const serverKeys = new Set(server.map(key))
    const out: Json[] = []
    for (const s of server) {
      const k = key(s)
      if (mineBy.has(k)) out.push(mergeThreeWay(baseBy.get(k), mineBy.get(k), s))
      else if (!baseBy.has(k)) out.push(s) // von anderen neu angelegt
      // sonst: von mir gelöscht
    }
    for (const m of mine) if (!serverKeys.has(key(m)) && !baseBy.has(key(m))) out.push(m) // von mir neu angelegt
    if (f === "date") out.sort((x, y) => (key(x) < key(y) ? -1 : key(x) > key(y) ? 1 : 0))
    return out
  }
  if (isObj(mine) && isObj(server)) {
    const b = isObj(base) ? base : {}
    const out: Record<string, Json> = {}
    for (const k of new Set([...Object.keys(b), ...Object.keys(mine), ...Object.keys(server)])) {
      const v = mergeThreeWay(b[k], mine[k], server[k])
      if (v !== undefined) out[k] = v
    }
    return out
  }
  return mine
}
