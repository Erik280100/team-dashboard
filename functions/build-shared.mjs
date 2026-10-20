// Bündelt den gemeinsamen Rechencode (src/lib/calc/archive.ts, employees.ts samt Abhängigkeiten) zu
// lib/shared.cjs, damit der automatische Monatsabschluss in den Cloud Functions exakt so rechnet wie der Browser.
// Läuft vor tsc (siehe "build" in package.json). esbuild kommt aus dem Projekt-Root (node_modules des Frontends).
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import path from "node:path"

const here = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const { build } = require(path.join(here, "..", "node_modules", "esbuild"))

await build({
  entryPoints: [path.join(here, "shared", "entry.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  outfile: path.join(here, "lib", "shared.cjs"),
  alias: { "@": path.join(here, "..", "src") },
  logLevel: "warning",
})
console.log("lib/shared.cjs gebündelt")
