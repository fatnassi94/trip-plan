---
name: travel-domain
description: Use when working on anything that touches trip data, traveler profiles, or itinerary logic — the vocabulary and rules specific to RoamAI as a product, not generic web dev.
---

# Travel Domain

The product-specific rules that don't belong in a generic frontend or
backend skill.

## Vocabulary (see `types/trip.ts`)

- **TravelerProfile**: `travelerTypes` (Explorer, Foodie, Culture lover,
  Nature, Relaxed, Photographer, Shopper, Nightlife — multi-select),
  `budgetTier` (budget / comfort / premium), `pace` (relaxed / balanced /
  packed), `walkingTolerance` (low / medium / high), `foodPreferences`,
  `dislikes`.
- **Trip**: destination, dates, travelers, and a list of `TripDay`, each
  with a `title` (a one-line theme, e.g. "Classic Paris") and `items`.
- **ItineraryItem**: always has a `reason` — the "why I chose this for
  you" line. Never generate or render an item without one.

## The scoring engine (`lib/ai/scoring.ts`)

Recommendations aren't just "whatever the model said" — every candidate
place is scored on seven weighted factors (personal relevance 30%,
distance 20%, interest match 20%, budget fit 10%, opening hours 10%,
popularity 5%, novelty 5%). This is intentionally *not* inside the LLM
prompt — it's plain, testable code so "why did X outrank Y" is always
answerable. When wiring up the real Destination Researcher (see
`ai-engine`), candidates should be scored with `rankCandidates()` before
being handed to the itinerary planner, not left to the model to rank
itself.

## Business rules (`lib/ai/schema.ts` → `checkBusinessRules`)

Every generated trip must satisfy: no overlapping items in a day, no day
exceeding ~14 planned hours, every day has at least one item, item
durations are realistic (5–720 min). Extend `checkBusinessRules` rather
than adding ad-hoc checks elsewhere — it's the single place "is this trip
sane" is answered, and both the API route and any future test suite
should call it the same way.

## Pace → item count (for prompting and validation)

`relaxed` ≈ 3–4 items/day, `balanced` ≈ 4–6, `packed` ≈ 6–8. Keep this
mapping consistent between `lib/ai/prompts.ts` (what we ask the model for)
and any future validation that flags a day as too sparse or too dense for
its stated pace.

## What's deliberately not modeled yet

Hotel/flight booking, payments, and multi-currency budget conversion are
out of scope per the roadmap — don't add fields for them speculatively.
