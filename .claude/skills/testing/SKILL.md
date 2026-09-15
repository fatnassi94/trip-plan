---
name: testing
description: Use before calling any change finished, and whenever adding a feature or fixing a bug — how RoamAI's test suite is laid out, how to write tests for each kind of code, and what "done" means (tests written, test:all green).
---

# Testing & Verification

A change is done when it has tests and `npm run test:all` passes
(typecheck → lint → `npm test` → `npm run test:e2e`). Report the real
output; never claim green without running it.

## Layout

```
tests/
  fixtures/trip.ts          valid Trip / item / request builders — mutate for broken cases
  unit/                     Vitest (npm test)
    lib/                    pure functions (node)
    api/                    route handlers with Supabase + AI mocked (node)
    components/             React components (jsdom, first line: // @vitest-environment jsdom)
    helpers/api.ts          fakeSupabase(), fakeQuery(), argsOf(), jsonRequest(), configureEnv()
  e2e/                      Playwright (npm run test:e2e)
    mock-supabase.mjs       in-memory GoTrue + PostgREST with RLS mirroring supabase/schema.sql
    support/helpers.ts      resetBackend, seedUser, seedRows, submitAuthForm, accountButton
    *.spec.ts               one spec per user flow
```

## Which test for which change

| You changed…                         | Write…                                                        |
| ------------------------------------ | ------------------------------------------------------------- |
| `lib/**` pure logic                  | unit test in `tests/unit/lib` — every branch, bad input too    |
| `app/api/**/route.ts`                | route test in `tests/unit/api` — 400 / 401 / 402 / 404 / happy |
| an interactive component             | component test in `tests/unit/components` — by role and label  |
| a user-visible flow or page wiring   | Playwright spec in `tests/e2e`                                 |
| a bug                                | a test that FAILS without the fix, first — then fix            |

## How to write them

- **Unit (lib):** build inputs from `tests/fixtures/trip.ts` and break one
  thing per test. For `lib/ai/schema.ts`, assert rejection of overlapping
  times, >14h days, empty days, bad HH:MM, missing `reason`.
- **API routes:** `vi.mock("@/lib/supabase/server", importOriginal ...)`
  replacing `createSessionClient` / `createServiceRoleClient` with
  `fakeSupabase({ user, tables })`; `vi.mock("@/lib/ai/provider")` for
  generation. Set backends with `configureEnv({ auth, persistence, ai })`.
  Assert status codes AND what was written (`argsOf(query, "insert")`) —
  e.g. an unpaid trip is inserted with `user_id: null` and the response has
  no `trip`. The user id must always come from the session, never the body.
- **Components:** Testing Library queries by role/label/text as a traveler
  would see them, `userEvent` for interaction. Mock `@/lib/supabase/client`
  and `vi.stubGlobal("fetch", ...)` for network.
- **E2E:** start each test with `resetBackend(request)`; seed users/rows
  through the mock's `/__seed` endpoints. Never call the real AI — answer
  `/api/trips/generate` with `page.route(...)` and a fixture. Scope
  `getByRole("alert")` to `main` (Next.js has its own route announcer).
  Navigate the way a traveler does (click header links), because
  client-side navigation is where caching bugs live — a hard `page.goto`
  can hide them.

## Known traps this suite already caught

- **Stale signed-out pages after login.** Next 14 reused a dynamic page's
  payload for 30s on the client, so `/account` showed "Log in" after
  logging in. Fixed with `experimental.staleTimes.dynamic = 0`
  (next.config.mjs); guarded by `tests/e2e/auth.spec.ts`.
- **Redirect targets from the URL** go through `lib/safe-redirect.ts`.

## Still check by eye for UI changes

Landing, Create Trip, Profile, Trip Overview, Day Detail at 375px and
1280px. Shared layout/tokens (`app/layout.tsx`, `app/globals.css`) → all of
them.

## AI-specific verification

A generated trip "looking plausible" isn't enough — every item needs a
non-generic `reason`, the day count must match the date range, and
`checkBusinessRules` must have run (it throws inside `generateTrip()`, so a
200 from `/api/trips/generate` implies it — don't bypass that path).
