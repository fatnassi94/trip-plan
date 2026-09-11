---
name: ai-engine
description: Use when working inside lib/ai/ — the generation pipeline, prompts, provider abstraction, or extending the single-call MVP toward the multi-agent design.
---

# AI Engine

How trip generation actually works today, and the shape it's meant to
grow into.

## Today: one call, fully gated

`lib/ai/provider.ts` → `generateTrip()` is the entire pipeline right now:
build a prompt (`prompts.ts`), call the active provider
(`providers/gemini.ts`), validate the JSON against `schema.ts`, retry once
with a repair instruction on failure, throw if it fails twice. This is a
deliberate MVP simplification of the project plan's seven-agent design
(Profile Analyzer → Destination Researcher → Itinerary Planner → Route
Optimizer → Personalization Agent → Critic Agent → Safety Agent) — one
well-prompted call stands in for all seven until real usage shows where
it breaks down.

## Growing it into real agents

When a specific failure mode shows up repeatedly (e.g. hallucinated
venues, bad routing, overloaded days that `checkBusinessRules` keeps
catching), split that concern out as its own step in `generateTrip()`
rather than trying to fix it by editing the prompt further:

- A **Critic** step: after the first response validates against schema,
  make a second call asking the model to find problems in its own plan,
  then repair.
- A **Route Optimizer** step: once `lat`/`lng` are populated on items,
  reorder each day by actual proximity instead of trusting model-chosen
  order.
- A **Destination Researcher** step: cache real place data (hours,
  location, price) per destination in Supabase and pass it into the
  prompt as grounding, rather than trusting the model to know current
  opening hours (it doesn't, reliably).

Add each as a new function in `lib/ai/`, called from `generateTrip()` in
sequence — don't inline more logic into `providers/gemini.ts`, which
should stay a thin, swappable transport.

## Provider isolation

`providers/gemini.ts` is the only file that imports `@google/genai`. To
add another provider (Claude, OpenAI, a local model), implement the same
`AIProvider` interface in a new file and register it in `provider.ts`'s
`PROVIDERS` map — never add a second SDK import anywhere else.

## Cost control on a free tier

Gemini's free flash models are rate-limited (see `.env.example`). Cache
destination-level research (project plan §35) so ten users planning Paris
trips don't trigger ten redundant "what's good in Paris" calls — score
and personalize on top of cached data rather than regenerating it per
request.
