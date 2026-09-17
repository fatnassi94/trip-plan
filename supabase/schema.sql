-- RoamAI — Sprint 0 schema. Run in the Supabase SQL editor for a free
-- project (supabase.com). Extend as Phase 2/3 features land; see
-- `supabase-security` and `database-security` skills before adding a
-- table that touches user data.

create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  traveler_types text[] not null default '{}',
  budget_tier text not null default 'comfort' check (budget_tier in ('budget', 'comfort', 'premium')),
  pace text not null default 'balanced' check (pace in ('relaxed', 'balanced', 'packed')),
  walking_tolerance text not null default 'medium' check (walking_tolerance in ('low', 'medium', 'high')),
  food_preferences text[] not null default '{}',
  dislikes text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  destination text not null,
  start_date date not null,
  end_date date not null,
  travelers int not null default 1,
  -- Full generated itinerary as structured JSON (see types/trip.ts) — not
  -- prose. This is what makes "edit my trip via chat" possible: the AI
  -- patches a JSON tree, it doesn't rewrite paragraphs.
  itinerary jsonb not null,
  created_at timestamptz not null default now()
);

-- Subscription plan/status, added to the existing `profiles` table rather
-- than a new one: one row per user already exists for travel preferences,
-- and plan state is just more per-user account state, not a separate
-- concept that needs its own table + RLS policy to duplicate.
--
-- `subscription_status` defaults to 'none' so a freshly-created profile
-- row (see app/api/account/select-plan/route.ts, which upserts this row
-- on first plan selection) never silently reads as "active" before a
-- plan is actually chosen.
--
-- Constraints are dropped/re-added rather than declared inline so this
-- whole file stays re-runnable — plan_type gained 'single' (the one-off
-- purchase in lib/plans.ts) after the first version shipped.
alter table profiles add column if not exists plan_type text;
alter table profiles drop constraint if exists profiles_plan_type_check;
alter table profiles add constraint profiles_plan_type_check
  check (plan_type in ('single', 'basic', 'pro'));

alter table profiles add column if not exists subscription_status text
  not null default 'none';
alter table profiles drop constraint if exists profiles_subscription_status_check;
alter table profiles add constraint profiles_subscription_status_check
  check (subscription_status in ('none', 'active'));

-- Trip satisfaction rating (see app/account/page.tsx / app/api/trips/rate).
-- No new RLS needed: the existing "trips: owner read/write" policy below
-- already covers these columns along with the rest of the row.
alter table trips add column if not exists rating smallint;
alter table trips drop constraint if exists trips_rating_check;
alter table trips add constraint trips_rating_check check (rating between 1 and 5);
alter table trips add column if not exists rating_comment text;

create table if not exists ai_conversations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references ai_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

-- Row Level Security: every table a user can reach is scoped to their own
-- rows by default.
--
-- trips.user_id stays nullable even now that auth + a paid-plan gate
-- exist (app/unlock, app/api/trips/generate): the generate route still
-- falls back to an anonymous/demo path whenever Supabase auth itself
-- isn't configured (no NEXT_PUBLIC_SUPABASE_ANON_KEY set — see
-- lib/supabase/config.ts), matching the project's existing "runs end to
-- end on the Gemini key alone" promise. Once auth is *always* configured
-- for a given deployment, tighten this to `not null` — see `auth-security`.
alter table profiles enable row level security;
alter table trips enable row level security;
alter table ai_conversations enable row level security;
alter table ai_messages enable row level security;

-- Dropped first so the whole file can be re-run without erroring on an
-- already-existing policy (Postgres has no `create policy if not exists`).
drop policy if exists "profiles: owner read/write" on profiles;
create policy "profiles: owner read/write" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Note this denies rows where user_id is null to EVERY logged-in user —
-- which is exactly right: an unclaimed trip (generated but not yet paid
-- for, see app/api/trips/claim/route.ts) must not be readable by anyone
-- through the anon key. The claim route reaches it with the service-role
-- client, which bypasses RLS, and stamps an owner onto it.
drop policy if exists "trips: owner read/write" on trips;
create policy "trips: owner read/write" on trips
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "ai_conversations: owner via trip" on ai_conversations;
create policy "ai_conversations: owner via trip" on ai_conversations
  for all using (
    exists (select 1 from trips where trips.id = ai_conversations.trip_id and trips.user_id = auth.uid())
  );

drop policy if exists "ai_messages: owner via conversation" on ai_messages;
create policy "ai_messages: owner via conversation" on ai_messages
  for all using (
    exists (
      select 1 from ai_conversations
      join trips on trips.id = ai_conversations.trip_id
      where ai_conversations.id = ai_messages.conversation_id and trips.user_id = auth.uid()
    )
  );

-- Travel DNA (lib/travel-dna.ts, app/api/account/travel-dna): the
-- traveler's saved profile — interests, pace, budget, walking, crowds,
-- style sliders and hard constraints — as versioned JSON
-- ({ version, profile, updatedAt }), so the model can grow without a
-- migration per field. Validated in code on every read and write. The
-- older per-field columns above (traveler_types, pace, ...) are unused.
-- No new RLS needed: "profiles: owner read/write" already covers it.
alter table profiles add column if not exists travel_dna jsonb;
