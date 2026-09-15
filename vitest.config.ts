import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Unit + integration tests (npm test). End-to-end browser tests live in
// tests/e2e and run under Playwright instead (npm run test:e2e) — see
// playwright.config.ts.
//
// Default environment is node (lib/ and API route handlers). Component
// tests opt into a DOM with a `// @vitest-environment jsdom` first line.
const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": root,
      // `server-only` throws on import outside a React Server build; route
      // handler tests import server modules directly, so stub it out.
      "server-only": `${root}tests/stubs/server-only.ts`,
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
