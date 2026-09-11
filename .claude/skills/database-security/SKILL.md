---
name: database-security
description: Use when writing queries, designing schema, or handling data that will end up in Postgres — injection, validation, and least-privilege concerns distinct from RLS itself.
---

# Database Security

Complements `supabase-security` (which covers RLS/client trust levels)
with the data-handling side.

## Injection

The Supabase JS client (`.from(...).insert(...)`/`.select(...)`) already
parameterizes queries — never build raw SQL strings by concatenating user
input. If a feature genuinely needs raw SQL (an RPC function, a complex
migration), use Postgres function parameters, not string interpolation of
request data.

## Validate before you store, not after

`trips.itinerary` is a `jsonb` column holding AI output — it must pass
`parseTripResponse()` (schema + business rules) before the insert in
`app/api/trips/generate/route.ts`. Never relax this to "validate on read
instead" — a malformed or adversarial JSON blob sitting in the database
can still break every page that reads it later, and by then the source of
the bad data is harder to trace.

## Least privilege

- The service-role client (`lib/supabase/server.ts`) should only be used
  for the specific writes that need it. Don't reach for it out of
  convenience in a new route when the anon client + RLS would do the job
  with the requesting user's own session.
- Don't add columns "just in case" for features not yet built (booking
  references, payment IDs) — see the project plan's explicit out-of-scope
  list. Unused columns are unused attack surface and migration debt.

## Sensitive data

Free-tier AI traffic (see `ai-security`) may be used by the provider to
improve their models — don't store or forward anything a user wouldn't
want retained there. Travel dates and a destination are low-sensitivity;
full names, payment details, or precise home addresses are not currently
collected anywhere in this schema, and should stay that way unless a
specific feature requires them and has been reviewed for it.
