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
-- rows by default. trips.user_id is nullable above only so the MVP can
-- generate anonymous demo trips before auth is wired up — tighten this
-- (make it `not null`) once /login exists. See `auth-security`.
alter table profiles enable row level security;
alter table trips enable row level security;
alter table ai_conversations enable row level security;
alter table ai_messages enable row level security;

create policy "profiles: owner read/write" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "trips: owner read/write" on trips
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "ai_conversations: owner via trip" on ai_conversations
  for all using (
    exists (select 1 from trips where trips.id = ai_conversations.trip_id and trips.user_id = auth.uid())
  );

create policy "ai_messages: owner via conversation" on ai_messages
  for all using (
    exists (
      select 1 from ai_conversations
      join trips on trips.id = ai_conversations.trip_id
      where ai_conversations.id = ai_messages.conversation_id and trips.user_id = auth.uid()
    )
  );
