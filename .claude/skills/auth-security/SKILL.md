---
name: auth-security
description: Use when wiring up or touching Supabase Auth, login/logout, session handling, or protected routes. Auth isn't implemented yet in this scaffold — this is the checklist for when it is.
---

# Auth Security

`trips.user_id` in `supabase/schema.sql` is currently nullable so the MVP
can generate demo trips before login exists. That's a temporary hole, not
a design decision — treat it as a tracked debt.

## When you wire up Supabase Auth

- Use `@supabase/ssr`'s `createServerClient` (already a dependency) in
  Server Components / Route Handlers to read the session from cookies —
  don't try to pass a user ID from the client and trust it.
- Make `trips.user_id`, `profiles.id` etc. `not null` once auth exists,
  and update `app/api/trips/generate/route.ts` to require a session
  before generating a trip (or explicitly keep an anonymous/demo path,
  but rate-limit it separately — see `api-security`).
- Never trust a `userId` field sent in a request body. Always derive the
  authenticated user server-side from the session/cookie.

## Session handling

- Store no secrets in localStorage/sessionStorage on the client — Supabase
  Auth's own cookie-based session handling covers this if you use
  `@supabase/ssr` as intended; don't hand-roll a token store.
- Any page under the golden path that should require login (trip
  overview, day detail, once accounts exist) checks the session
  server-side and redirects — don't rely on hiding a link client-side as
  the only gate.

## Password / OAuth choices

Prefer Supabase's built-in email + OAuth (Google, Apple) flows over a
custom password implementation — there's no reason to hand-roll hashing
or reset-token logic here.

## Before shipping auth

Confirm: a logged-out user cannot fetch another user's trip by guessing
`/trip/[id]` (RLS in `supabase/schema.sql` should already block this at
the database level — verify it actually does, don't assume the policy is
correct just because it's written).
