import { defineConfig, devices } from "@playwright/test";
import {
  APP_PORT,
  MOCK_ANON_KEY,
  MOCK_SERVICE_ROLE_KEY,
  MOCK_SUPABASE_PORT,
  MOCK_SUPABASE_URL,
} from "./tests/e2e/support/env";

// End-to-end tests (npm run test:e2e): a real production build of the app,
// driven in Chromium, wired to the in-memory Supabase in
// tests/e2e/mock-supabase.mjs. Process env beats .env.local in Next.js, so
// the overrides below keep every request away from the real project.
// The AI is never called: specs intercept /api/trips/generate in the
// browser and answer with fixtures.
export default defineConfig({
  testDir: "tests/e2e",
  // One worker: every spec shares the one mock database.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  timeout: 45_000,
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node tests/e2e/mock-supabase.mjs",
      url: `${MOCK_SUPABASE_URL}/health`,
      env: { MOCK_SUPABASE_PORT: String(MOCK_SUPABASE_PORT), MOCK_SERVICE_ROLE_KEY },
      reuseExistingServer: false,
    },
    {
      // npm run build (not next build) so prebuild vendors the map worker.
      command: `npm run build && npx next start -p ${APP_PORT}`,
      url: `http://localhost:${APP_PORT}`,
      timeout: 300_000,
      reuseExistingServer: false,
      env: {
        NEXT_DIST_DIR: ".next-e2e",
        NEXT_PUBLIC_SUPABASE_URL: MOCK_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: MOCK_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: MOCK_SERVICE_ROLE_KEY,
        AI_PROVIDER: "gemini",
        GEMINI_API_KEY: "e2e-never-called",
        NEXT_PUBLIC_MAP_STYLE_URL: `${MOCK_SUPABASE_URL}/map-style.json`,
        // No third-party photos in browser tests: the UI renders its own
        // gradient placeholders, which is exactly the no-API-key path.
        TRAVEL_IMAGES_MODE: "off",
      },
    },
  ],
});
