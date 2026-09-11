---
name: frontend-design
description: Use when building or changing any screen in app/ — landing, create-trip, profile, trip overview, day detail, map, AI chat. Covers RoamAI's visual direction and component patterns.
---

# Frontend Design

RoamAI's own plan describes the target feel as "Apple + Airbnb + modern
travel magazine + AI" — and explicitly **not** "generic AI SaaS dashboard
#4817." Hold every screen to that bar before calling it done.

## Design tokens already in the repo

Don't invent new colors or spacing scales — `app/globals.css` defines the
palette as CSS custom properties (`--ink`, `--paper`, `--accent`, `--warm`,
`--line`, `--muted`), consumed through `tailwind.config.ts`
(`text-accent`, `bg-paper`, `border-border`, etc.). Fonts are wired in
`app/layout.tsx`: `font-display` (Fraunces, serif, for headings — the
warm, editorial voice), `font-sans` (Sora, body copy), `font-mono` (IBM
Plex Mono, for labels/data/eyebrows). If a screen needs a color or type
role that doesn't exist yet, add a token to `globals.css` — don't reach
for an arbitrary Tailwind color class.

## Page conventions

- One golden-path step per route under `app/`, matching the plan's flow
  (`/`, `/create-trip`, `/profile`, `/trip/[id]`, `/trip/[id]/day/[day]`).
  Each page file has a comment at the top naming its step number and job —
  keep that comment current when you change a page's purpose.
- Keep forms boring and fast: one clear question per screen where
  possible (see `/create-trip`), not a long multi-field wall.
- The Activity Card's "Why I chose this for you" line (see
  `types/trip.ts` → `ItineraryItem.reason`) is the single most important
  piece of copy in the product — it's what makes the AI feel like it
  knows the traveler. Never render an item without it, and never let it
  be generic ("matches your interests"); it should name the specific
  preference and constraint that earned the place its slot.
- Loading state for trip generation is a visible trace of agent steps
  (see project plan "AI Thinking" screen), not a bare spinner — it's a
  deliberate trust-building moment, budget real design time on it.

## Before shipping a screen

Check it against `web-design-guidelines` (spacing, accessibility, states)
and, if it uses a shadcn component, `shadcn` (don't hand-roll what the CLI
would generate correctly). Read `vercel-react-best-practices` before
deciding whether a page needs to be a Client Component at all.
