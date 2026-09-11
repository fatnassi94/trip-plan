---
name: vercel-react-best-practices
description: Use when writing or restructuring any Next.js App Router code — deciding Server vs Client Components, data fetching, route handlers, caching, or anything deployed to Vercel.
---

# Vercel / React (Next.js App Router) Best Practices

RoamAI runs on Next.js 14 App Router, deployed to Vercel. This is the
project's own house style, not a generic React guide.

## Server vs Client Components

- Default to Server Components. Only add `"use client"` when a file
  needs interactivity (`useState`, event handlers, browser APIs) — form
  submission itself doesn't require it if you use a native `<form
  action="...">` or a Server Action.
- Keep AI calls and Supabase service-role calls in Server Components or
  Route Handlers (`app/api/**/route.ts`) only. Never in a Client
  Component — see `ai-security` and `api-security`.

## Data fetching & mutations

- Route Handlers under `app/api/` are the boundary for anything that
  needs a secret (AI provider key, Supabase service role key). The
  existing pattern is `app/api/trips/generate/route.ts`: parse with zod →
  call `generateTrip()` → validate → write with the service-role client →
  return JSON.
- Prefer Server Actions for simple form mutations over hand-rolled
  `fetch` + API route pairs once auth is wired up; keep the current
  `action="/route"` form pattern only where a full Route Handler response
  is actually needed (like AI generation).

## Environment variables

- Anything prefixed `NEXT_PUBLIC_` ships to the browser bundle. Never put
  `GEMINI_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` behind that prefix — see
  `.env.example` for which variables are which, and `api-security`.

## Performance

- Use `next/font` (already set up in `app/layout.tsx`) rather than a
  `<link>` to Google Fonts — avoids a render-blocking request.
- Don't fetch the same destination data on every request once the
  Destination Researcher agent (see `ai-engine`) exists — this is where a
  "destination knowledge cache" (project plan §35) belongs, likely as a
  Supabase table keyed by destination, checked before calling the AI
  provider at all.

## Before shipping

`npm run build` should succeed with no new type errors. Check the Vercel
preview deployment (once connected) at the actual golden-path URLs, not
just `localhost`.
