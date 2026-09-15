# RoamAI

An AI that knows how a traveler travels, builds their trip, then stays with
them once it starts. Not a trip planner — a travel companion. Full context
lives in the project plan; this file is the "always true" summary Claude
should never have to relearn.

## Stack

Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui, Supabase
(Postgres + Auth), deployed to Vercel. AI is provider-agnostic — see below.

## Commands

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — Vitest unit + API route + component tests (`tests/unit`)
- `npm run test:e2e` — Playwright end-to-end tests against a production
  build wired to a fake Supabase (`tests/e2e`); never touches the real project
- `npm run test:all` — all of the above, in order

Every feature and bug fix ships with tests, and `test:all` must pass before
a change is handed over — see the `testing` skill for how to write them.

## Non-negotiable rules

- **Never call an AI SDK outside `lib/ai/`.** Every code path that needs a
  trip generated calls `generateTrip()` from `lib/ai/provider.ts`. This is
  what lets us swap Gemini for another model without touching UI code.
- **Never call an AI provider from the browser.** Browser → our API route
  → provider, always. API keys are server-only env vars, never
  `NEXT_PUBLIC_*`.
- **AI output is untrusted input.** It's validated against
  `lib/ai/schema.ts` and the business rules in the same file before it
  touches Supabase. Never insert raw model output into the database.
- **Trips are structured JSON, not prose.** See `types/trip.ts`. An
  itinerary the user can edit via chat has to be an itinerary we can parse
  and patch — never generate paragraphs of trip description as the source
  of truth.
- **Row Level Security is not optional.** Every table holding user data
  gets an RLS policy in the same migration that creates it. See
  `supabase/schema.sql` for the pattern.

## Golden path (the only thing the MVP has to do well)

Landing → Create Trip → Travel Profile → AI Thinking → Trip Overview →
Day-by-Day → Day Detail → Map → AI Assistant. Explicitly out of scope for
now: bookings, payments, social features, voice, offline, native mobile.
Don't build toward these without being asked.

## Skills

Project skills live in `.claude/skills/`. They load automatically when
relevant, or invoke directly with `/name`:

- `frontend-design`, `web-design-guidelines`, `vercel-react-best-practices`, `shadcn` — everything about building screens
- `auth-security`, `api-security`, `supabase-security`, `database-security`, `ai-security` — everything about not shipping a hole
- `travel-domain` — the product's own vocabulary and rules (scoring engine, itinerary constraints)
- `ai-engine` — the multi-agent generation pipeline and prompt conventions
- `testing` — the build → verify loop and what "done" means here
- `code-review` — the checklist to run before calling a change finished

## Workflow

Explore → Plan → Code → Verify. Read the relevant files and propose an
approach before editing, especially for anything touching `lib/ai/` or
`supabase/schema.sql`. Then verify with `typecheck` + `lint` at minimum,
and a manual check of the affected page before calling a task complete.
