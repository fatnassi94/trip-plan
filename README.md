# RoamAI

An AI that knows how you travel, builds your trip, and travels with you.
This is the Sprint 0 scaffold from the project plan: Next.js + TypeScript +
Tailwind, a provider-agnostic AI layer defaulting to Gemini's free tier,
and a Supabase schema — enough to build the golden path (Landing → Create
Trip → Profile → AI Thinking → Trip Overview → Day Detail).

## Get running (takes about 10 minutes, $0)

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Get a free Gemini API key** — no credit card required.
   Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey),
   create a key, and note it. Gemini's `-flash` models are free of charge
   for API use; Google may use free-tier traffic to improve their models,
   so don't send real user data through it yet.

3. **Fill in your environment file**
   ```bash
   cp .env.example .env.local
   # then paste in your Gemini key
   ```

4. **Run it**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 and walk the golden path: Plan my trip →
   destination/dates → traveler profile → Build my trip.

5. **Supabase is optional.** With only a Gemini key the app already
   generates and renders real itineraries (cached in the browser session).
   Add Supabase when you want trips to survive a reload and belong to
   accounts: create a free project at [supabase.com](https://supabase.com),
   run `supabase/schema.sql` in its SQL editor, then add the URL and keys
   from Project Settings → API to `.env.local`.

## Project layout

```
app/                 Next.js App Router pages — one per step of the golden path
  create-trip/       destination, dates, travelers
  profile/           traveler identity + preferences
  trip/[id]/         trip overview
  trip/[id]/day/[d]/ day detail
  api/trips/generate route.ts — the ONLY place that calls the AI provider
lib/ai/
  provider.ts        generateTrip() — swap models by editing this file only
  providers/gemini.ts   the free-tier implementation
  schema.ts          zod validation + business rules for AI output
  scoring.ts         the personalization scoring engine (project plan §37)
  prompts.ts         system/user prompt builders
lib/supabase/        browser client (anon key) + server client (service role)
types/trip.ts        canonical Trip / TripDay / ItineraryItem shapes
supabase/schema.sql  tables + row-level security policies
.claude/             CLAUDE.md + project skills — see below
```

## Switching AI providers later

Nothing outside `lib/ai/` should ever import an AI SDK directly. To add a
second provider (Claude, OpenAI, a local model): create
`lib/ai/providers/<name>.ts` implementing the `AIProvider` interface from
`provider.ts`, register it in the `PROVIDERS` map, and set `AI_PROVIDER` in
`.env.local`. Nothing else in the app changes.

## Working on this with Claude Code (in your editor)

**In Cursor or VS Code:** install the Claude Code extension — search
"Claude Code" in the Extensions view, or use the direct link
(`cursor:extension/anthropic.claude-code` for Cursor). Sign in with your
Claude subscription; no API key needed. Open this folder and prompt in the
panel.

**In any terminal** (including your editor's built-in one):

```bash
curl -fsSL https://claude.ai/install.sh | bash   # once
cd roamai && claude
```

Either way, `.claude/CLAUDE.md` loads automatically and the skills under
`.claude/skills/` come with it — nothing to install. Type `/` to see them,
invoke one directly (`/frontend-design`, `/shadcn`, `/auth-security`), or
just describe the task and Claude pulls in whichever matches.

## Explicitly not in this scaffold yet

Auth (Supabase Auth wiring), the AI Thinking screen's live trace, the map
view, and edit-via-chat are all Sprint 1–3 work per the roadmap — this
scaffold gets you to a working `generateTrip()` call and a page for every
stop on the golden path, nothing more.
