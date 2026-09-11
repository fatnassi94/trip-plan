---
name: testing
description: Use before calling any change finished — the verification loop and what "done" means for this project, since there is no test suite yet.
---

# Testing & Verification

There is no automated test suite in this scaffold yet. That doesn't mean
"skip verification" — it means verification is currently manual, and the
first thing worth automating is named below.

## The loop for every change

Build → `npm run typecheck` → `npm run lint` → manually check the
affected page(s) → fix → repeat. Don't call a UI change done from reading
the diff alone — actually look at the page.

## Pages to check for any change that could affect layout

Landing, Create Trip, Profile, Trip Overview, Day Detail — at minimum a
375px (mobile) and 1280px (desktop) width. If the change touches shared
layout (`app/layout.tsx`) or tokens (`app/globals.css`), check all of
them, not just the one you edited.

## What to test first, once a test runner is added

Priority order, because these are the highest-consequence, easiest-to-get-
wrong pieces:

1. `lib/ai/schema.ts` — `checkBusinessRules()` and `parseTripResponse()`.
   Pure functions, no network, and this is the gate between "the model
   said something" and "we trust it." Feed it deliberately broken
   itineraries (overlapping times, empty days, 20-hour days) and assert
   it rejects them.
2. `lib/ai/scoring.ts` — `scoreCandidate()`. Assert weights sum to 1, and
   that it throws on out-of-range factors rather than silently producing
   a nonsense score.
3. `app/api/trips/generate/route.ts` — request validation (malformed
   body → 400, not a 500 or a silent AI call).

Vitest is a reasonable first choice (fast, works with the existing
TypeScript config with no extra transpilation setup).

## AI-specific verification

A generated trip "looking plausible" isn't enough — check that every item
has a non-generic `reason`, that the day count matches the requested date
range, and that `checkBusinessRules` actually ran (it throws inside
`generateTrip()`, so a 200 response from `/api/trips/generate` already
implies this — don't bypass that path when testing manually with a
different script).
