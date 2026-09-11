---
name: supabase-security
description: Use when adding a Supabase table, changing RLS policies, or deciding between the anon-key browser client and the service-role server client.
---

# Supabase Security

## Two clients, two trust levels

- `lib/supabase/client.ts` — browser client, anon key. Safe to expose;
  it's *meant* to be public. Every table it can touch must have RLS
  policies that make the anon key harmless on its own — the key isn't
  the security boundary, the policy is.
- `lib/supabase/server.ts` — service-role client, marked `import
  "server-only"` so an accidental client-side import fails the build. This
  key bypasses RLS entirely. Only use it in Route Handlers, and only when
  a write genuinely needs to bypass RLS (like saving an AI-generated trip
  before the requesting user's session is what stamps ownership).

## Every table gets RLS, in the same migration that creates it

See `supabase/schema.sql` for the pattern: `enable row level security`
immediately followed by a policy. A table with RLS enabled but no policy
denies all access (safe-but-broken); a table without RLS enabled is
readable/writable by anyone holding the anon key (broken). Never leave a
gap between creating a table and adding its policy.

## Reviewing a policy

Read each policy as "what can the anon key do to this table, for which
rows" — not "did I write a `create policy` statement." The existing
`ai_messages` policy is a nested `exists` through two joins back to
`trips.user_id`; if you add a new table two hops from `trips`, follow the
same join-back-to-owner pattern rather than inventing a new one.

## Migrations

Keep schema changes as additive SQL files (or extend `schema.sql` for
this early stage) rather than editing tables through the Supabase
dashboard UI only — the file is the source of truth and what a reviewer
(or Claude) can actually read.
