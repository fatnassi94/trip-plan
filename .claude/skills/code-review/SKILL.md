---
name: code-review
description: Use before calling any non-trivial change finished — the checklist that catches the mistakes specific to this codebase's structure.
---

# Code Review Checklist

Run through this before saying a change is done, on top of general good
practice.

## Structural rules (fail the review if violated)

- No new import of an AI SDK outside `lib/ai/providers/*.ts`.
- No new import of `@supabase/supabase-js` service-role usage outside
  `lib/supabase/server.ts` and files that explicitly need server-only
  writes (like `app/api/trips/generate/route.ts`).
- No `NEXT_PUBLIC_`-prefixed env var holding a secret (AI key, service
  role key).
- No raw AI JSON output reaching a Supabase `insert`/`update` without
  passing through `parseTripResponse()` first.
- Any new Supabase table has a matching RLS policy in the same change —
  see `supabase-security`.

## Correctness

- `npm run typecheck` and `npm run lint` both pass.
- If `lib/ai/schema.ts` changed, re-check `checkBusinessRules` still
  catches the cases listed in the `testing` skill — overlaps, overloaded
  days, empty days.
- If a page changed, it was actually viewed (not just diffed) at mobile
  and desktop widths — see `web-design-guidelines`.

## Security pass (for anything touching auth, API routes, or the database)

Route the change through whichever of `auth-security`, `api-security`,
`supabase-security`, `database-security`, or `ai-security` applies before
approving it — don't rely on general instincts for these; each skill
lists the specific failure modes to check for in this codebase.

## Scope discipline

Check any new feature against the project plan's explicit "not building
yet" list (bookings, payments, social, voice, offline, native mobile). A
change that quietly starts building toward one of these is worth flagging
even if it's well-written.
