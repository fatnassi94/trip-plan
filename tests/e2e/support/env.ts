// Shared by playwright.config.ts and the specs. The app under test talks to
// the fake Supabase in tests/e2e/mock-supabase.mjs — never the real
// project in .env.local — so e2e runs create no real accounts or rows.
export const APP_PORT = 3100;
export const MOCK_SUPABASE_PORT = 54329;
export const MOCK_SUPABASE_URL = `http://127.0.0.1:${MOCK_SUPABASE_PORT}`;
export const MOCK_ANON_KEY = "anon-test-key";
export const MOCK_SERVICE_ROLE_KEY = "service-role-test-key";
