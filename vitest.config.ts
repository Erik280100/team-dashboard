import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // Getestet wird die Logik (Berechnungen, Hilfsfunktionen, Functions); Oberfläche und Datenkonstanten zählen nicht.
      include: ["src/lib/**/*.ts", "functions/src/**/*.ts"],
      exclude: ["src/lib/data/**", "src/lib/firebase.ts", "src/lib/chartSetup.ts"],
      reporter: ["text-summary", "text"],
    },
  },
})
