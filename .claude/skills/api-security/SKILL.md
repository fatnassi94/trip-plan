---
name: api-security
description: Use when adding or changing anything under app/api/ — request validation, rate limiting, error responses, and what a route handler is and isn't allowed to trust.
---

# API Security

Rules for everything under `app/api/`, using
`app/api/trips/generate/route.ts` as the reference implementation.

## Validate every request body

Every route parses its input through a zod schema before touching
anything else — see `RequestSchema` in `route.ts`. Return `400` with
`error.flatten()` details on failure. Never pass `req.json()` output
straight into a database call or an AI prompt.

## Don't leak internals in errors

Catch blocks return a generic message (`"Could not generate trip"`) to
the client and `console.error` the real error server-side. Never return a
raw stack trace, SQL error, or provider error message to the browser —
these can leak schema details or, worse, provider account information.

## Rate limiting (missing today — add before real traffic)

`app/api/trips/generate/route.ts` currently has no rate limit, which
means it's both a cost risk (each call spends free-tier AI quota) and an
abuse vector. Before this goes further than local testing, add per-user
(once auth exists) or per-IP limiting — Vercel's edge config or a simple
Supabase-backed counter both work for MVP scale; don't reach for
infrastructure heavier than the traffic justifies.

## CORS

Route handlers under `app/api/` are same-origin by default under Next.js
— don't add permissive CORS headers (`Access-Control-Allow-Origin: *`)
unless a specific external caller needs it, and if one does, scope the
header to that origin explicitly.

## Method and content-type checks

Confirm a route only implements the HTTP methods it needs (`route.ts`
here only exports `POST`) — an unhandled method already 405s by default
in App Router, don't add a catch-all handler that accepts anything.
