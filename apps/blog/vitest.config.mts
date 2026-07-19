import path from "node:path";

import react from "@vitejs/plugin-react";
/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/__tests__/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/__tests__/setup.ts"],
    coverage: {
      // Only collected under `--coverage` (npm run test:coverage), so the
      // default `npm test` run is unaffected. Scoped to the /go/ shortener
      // core + its dev.to link transform — the code Ofri's 100% policy gates.
      provider: "v8",
      reporter: ["text", "text-summary"],
      include: [
        "src/app/go/**/*.ts",
        "scripts/devto-link-transforms.mjs",
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
