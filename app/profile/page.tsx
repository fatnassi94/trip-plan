"use client";

import { Suspense, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Coffee,
  Compass,
  Fingerprint,
  Landmark,
  Music,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trees,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { BudgetSelector, type BudgetOption } from "@/components/profile/budget-selector";
import { ScaleSlider } from "@/components/profile/scale-slider";
import { RouteArt } from "@/components/brand/route-art";
import { AiThinking } from "@/components/trip/ai-thinking";
import { PlannerActionBar } from "@/components/trip/planner-action-bar";
import { PlannerProgress } from "@/components/trip/planner-progress";
import { useTripGeneration } from "@/components/trip/use-trip-generation";
import { formatTripRange } from "@/lib/date";
import {
  AVOID_OPTIONS,
  DISCOVERY_LABELS,
  LOCALNESS_LABELS,
  describeConstraints,
  normalizeConstraints,
} from "@/lib/travel-dna";
import type {
  BudgetTier,
  CrowdTolerance,
  HardConstraints,
  Pace,
  TravelerProfile,
  TripRequest,
  WalkingTolerance,
} from "@/types/trip";

// 03 — Travel Profile ("Travel DNA"). A Client Component because every
// control here is interactive: selections are held in state and sent to
// /api/trips/generate. Signed-in travelers get their saved Travel DNA
// restored and (by default) saved again, via /api/account/travel-dna.
// Once generation starts this same route renders the AI Thinking trace
// (step 3 of the planner) in place.

// `value` is what the API and the AI prompt receive — keep these strings
// stable. `hint` is display copy only.
const TRAVELER_TYPES: { value: string; hint: string; icon: LucideIcon }[] = [
  { value: "Explorer", hint: "Wandering off the map", icon: Compass },
  { value: "Foodie", hint: "Markets, bistros, tastings", icon: UtensilsCrossed },
  { value: "Culture lover", hint: "Museums & architecture", icon: Landmark },
  { value: "Nature", hint: "Parks, trails, fresh air", icon: Trees },
  { value: "Relaxed", hint: "Terraces & slow afternoons", icon: Coffee },
  { value: "Photographer", hint: "Viewpoints & golden hour", icon: Camera },
  { value: "Shopper", hint: "Boutiques & makers", icon: ShoppingBag },
  { value: "Nightlife", hint: "Bars, music, late nights", icon: Music },
];

const FOOD_PREFERENCES = [
  "Local",
  "Street food",
  "Fine dining",
  "Vegetarian",
  "Vegan",
  "Halal",
];

// Naming matches the BudgetTier type ("budget" | "comfort" | "premium")
// used everywhere else in the app (types/trip.ts, the AI prompt, the
// generated trip's own priceLevel banding) — "Luxury" would read fine in
// isolation but would be a label with no matching value anywhere else.
const BUDGET_TIERS: readonly BudgetOption<BudgetTier>[] = [
  {
    value: "budget",
    label: "Budget",
    hint: "€",
    description: "Hostels and budget stays, street food and local eats, public transport.",
  },
  {
    value: "comfort",
    label: "Comfort",
    hint: "€€",
    description: "3-4 star hotels, a mix of local spots and well-known highlights.",
  },
  {
    value: "premium",
    label: "Premium",
    hint: "€€€",
    description: "Top-rated hotels, fine dining, and private transport where it helps.",
  },
];

// Stop counts match the pace rule in lib/ai/prompts.ts — keep them in sync.
const PACES: { value: Pace; label: string; hint: string }[] = [
  { value: "relaxed", label: "Relaxed", hint: "3–4 stops a day, time to linger" },
  { value: "balanced", label: "Balanced", hint: "A steady mix of sights and breaks" },
  { value: "packed", label: "Packed", hint: "6–8 stops a day, see it all" },
];

const WALKING: { value: WalkingTolerance; label: string; hint: string }[] = [
  { value: "low", label: "Low", hint: "Short hops between stops" },
  { value: "medium", label: "Medium", hint: "Happy to walk between nearby spots" },
  { value: "high", label: "High", hint: "Walk all day, the city on foot" },
];

const CROWDS: { value: CrowdTolerance; label: string; hint: string }[] = [
  { value: "low", label: "Avoid crowds", hint: "Quiet spots and off-peak times" },
  { value: "medium", label: "Some is fine", hint: "Busy places at the right time" },
  { value: "high", label: "Crowds are fine", hint: "Popular icons at any hour" },
];

const NO_LIMIT = { value: "", label: "No limit" };
const START_OPTIONS = [NO_LIMIT, ...["07:00", "08:00", "09:00", "10:00", "11:00"].map((t) => ({ value: t, label: `Not before ${t}` }))];
const END_OPTIONS = [NO_LIMIT, ...["18:00", "19:00", "20:00", "21:00", "22:00", "23:00"].map((t) => ({ value: t, label: `Done by ${t}` }))];
const WALK_OPTIONS = [NO_LIMIT, ...[3, 5, 8, 12].map((km) => ({ value: String(km), label: `Up to ${km} km` }))];
const STOP_OPTIONS = [NO_LIMIT, ...[2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `Up to ${n} stops` }))];
const DURATION_OPTIONS = [
  NO_LIMIT,
  { value: "60", label: "Up to 1h" },
  { value: "90", label: "Up to 1h 30m" },
  { value: "120", label: "Up to 2h" },
  { value: "180", label: "Up to 3h" },
];

type AccountState = "checking" | "unavailable" | "signed-out" | "signed-in";

function ProfileForm() {
  const params = useSearchParams();

  const destination = params.get("destination")?.trim() || "Paris, France";
  const startDate = params.get("startDate") || defaultDate(30);
  const endDate = params.get("endDate") || defaultDate(34);
  const travelers = Number(params.get("travelers") || 2);

  const [travelerTypes, setTravelerTypes] = useState<string[]>([]);
  const [foodPreferences, setFoodPreferences] = useState<string[]>([]);
  const [budgetTier, setBudgetTier] = useState<BudgetTier>("comfort");
  const [pace, setPace] = useState<Pace>("balanced");
  const [walkingTolerance, setWalkingTolerance] = useState<WalkingTolerance>("medium");
  const [crowdTolerance, setCrowdTolerance] = useState<CrowdTolerance>("medium");
  const [localness, setLocalness] = useState(3);
  const [discovery, setDiscovery] = useState(3);
  const [dislikes, setDislikes] = useState("");
  const [constraints, setConstraints] = useState<HardConstraints>({});

  const [account, setAccount] = useState<AccountState>("checking");
  const [restored, setRestored] = useState(false);
  const [saveToAccount, setSaveToAccount] = useState(true);
  // Any interaction before the saved Travel DNA arrives wins over it.
  const touched = useRef(false);

  const { status, error, generate } = useTripGeneration();

  useEffect(() => {
    let cancelled = false;

    fetch("/api/account/travel-dna")
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (cancelled) return;
        if (!payload?.configured) return setAccount("unavailable");
        if (!payload.loggedIn) return setAccount("signed-out");
        setAccount("signed-in");

        const saved = payload.profile as TravelerProfile | null;
        if (!saved || touched.current) return;
        setTravelerTypes(saved.travelerTypes);
        setFoodPreferences(
          saved.foodPreferences.map(
            (food) => FOOD_PREFERENCES.find((f) => f.toLowerCase() === food) ?? food,
          ),
        );
        setBudgetTier(saved.budgetTier);
        setPace(saved.pace);
        setWalkingTolerance(saved.walkingTolerance);
        setCrowdTolerance(saved.crowdTolerance ?? "medium");
        setLocalness(saved.localness ?? 3);
        setDiscovery(saved.discovery ?? 3);
        setDislikes(saved.dislikes.join(", "));
        setConstraints(saved.constraints ?? {});
        setRestored(true);
      })
      .catch(() => {
        if (!cancelled) setAccount("unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Functional update, not `list.includes(...)` off the render closure:
  // two taps landing in the same React batch (an easy double-tap on a
  // phone) would both read the *same* stale array, so the second write
  // would silently throw away the first selection.
  function toggle(
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    value: string,
  ) {
    setList((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  function setRule<K extends keyof HardConstraints>(key: K, value: HardConstraints[K]) {
    setConstraints((prev) => ({ ...prev, [key]: value }));
  }

  function toggleAvoid(tag: string) {
    setConstraints((prev) => {
      const current = prev.avoidTags ?? [];
      return {
        ...prev,
        avoidTags: current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
      };
    });
  }

  const profile: TravelerProfile = {
    travelerTypes,
    budgetTier,
    pace,
    walkingTolerance,
    foodPreferences: foodPreferences.map((f) => f.toLowerCase()),
    dislikes: dislikes
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean),
    localness,
    discovery,
    crowdTolerance,
    constraints: normalizeConstraints(constraints),
  };

  const request: TripRequest = { destination, startDate, endDate, travelers, profile };

  async function handleGenerate() {
    if (account === "signed-in" && saveToAccount) {
      // Fire-and-forget: saving the profile must never hold up, or break,
      // building the trip.
      void fetch("/api/account/travel-dna", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      }).catch(() => {});
    }
    // No pre-flight paywall check: the trip gets built first so the
    // traveler watches it happen, and /api/trips/generate decides at the
    // end whether to hand over the itinerary or just a preview plus a
    // redirect to /unlock. useTripGeneration routes either outcome.
    await generate(request);
  }

  if (status === "generating") {
    return <AiThinking request={request} />;
  }

  const dna = describeTravelDna(profile);
  const canGenerate = travelerTypes.length > 0;
  const stepOneHref = `/create-trip?destination=${encodeURIComponent(destination)}`;
  const selfHref = `/profile?${params.toString()}`;

  return (
    <main
      className="mx-auto max-w-[1440px] px-5 pb-32 lg:px-12"
      onPointerDownCapture={() => (touched.current = true)}
      onKeyDownCapture={() => (touched.current = true)}
    >
      <PlannerProgress
        current={2}
        title="Discovering your travel DNA"
        subtitle={
          <>
            {destination} · {formatTripRange(startDate, endDate)} · {travelers}{" "}
            {travelers === 1 ? "traveler" : "travelers"}
          </>
        }
        hrefs={{ 1: stepOneHref }}
      />

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-7">
          <section className="relative overflow-hidden rounded-lg bg-surface p-6 shadow-card">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-bl-full bg-gradient-to-bl from-warm-soft/70 to-transparent"
            />
            <div className="relative flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-deep text-sunset shadow-card">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="flex items-center gap-2 font-mono text-[0.65rem] font-bold uppercase tracking-widest text-warm">
                  RoamAI
                  <span className="roam-pulse h-1.5 w-1.5 rounded-full bg-sage" aria-hidden="true" />
                </p>
                <p className="mt-1 font-display text-lg font-semibold text-accent">
                  Let&apos;s get to know how you actually travel.
                </p>
                <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
                  No generic tour-bus stops. Your answers decide how many places fit in a day,
                  where you eat, and what gets left out.
                </p>
              </div>
            </div>
          </section>

          <Section
            n="01"
            eyebrow="Personas"
            title="What kind of traveler are you?"
            badge={canGenerate ? `${travelerTypes.length} selected` : "Pick at least 1"}
            badgeTone={canGenerate ? "accent" : "warm"}
          >
            <div className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 sm:grid-cols-3">
              {TRAVELER_TYPES.map((type) => (
                <PersonaCard
                  key={type.value}
                  label={type.value}
                  hint={type.hint}
                  icon={type.icon}
                  selected={travelerTypes.includes(type.value)}
                  onClick={() => toggle(setTravelerTypes, type.value)}
                />
              ))}
            </div>
          </Section>

          {/* Budget shapes almost every downstream recommendation (see
              buildTripUserPrompt), so it comes right after who you are. */}
          <Section n="02" eyebrow="Budget" title="How do you like to spend?">
            <BudgetSelector options={BUDGET_TIERS} value={budgetTier} onChange={setBudgetTier} />
          </Section>

          <Section n="03" eyebrow="Rhythm" title="Pace, footwork and crowds">
            <OptionGroup label="Daily pace" options={PACES} value={pace} onChange={setPace} />
            <div className="mt-5">
              <OptionGroup
                label="How much walking?"
                options={WALKING}
                value={walkingTolerance}
                onChange={setWalkingTolerance}
              />
            </div>
            <div className="mt-5">
              <OptionGroup label="Crowds" options={CROWDS} value={crowdTolerance} onChange={setCrowdTolerance} />
            </div>
          </Section>

          <Section n="04" eyebrow="Style" title="Classic or off the beaten path?">
            <div className="flex flex-col gap-6">
              <ScaleSlider
                label="Tourist or local"
                value={localness}
                onChange={setLocalness}
                labels={LOCALNESS_LABELS}
                left="Tourist classics"
                right="Like a local"
              />
              <ScaleSlider
                label="Famous or hidden"
                value={discovery}
                onChange={setDiscovery}
                labels={DISCOVERY_LABELS}
                left="Famous icons"
                right="Hidden gems"
              />
            </div>
          </Section>

          <Section
            n="05"
            eyebrow="Food"
            title="What do you like to eat?"
            badge={foodPreferences.length ? `${foodPreferences.length} selected` : "Optional"}
          >
            <div className="flex flex-wrap gap-2">
              {FOOD_PREFERENCES.map((food) => (
                <Chip
                  key={food}
                  label={food}
                  selected={foodPreferences.includes(food)}
                  onClick={() => toggle(setFoodPreferences, food)}
                />
              ))}
            </div>
          </Section>

          <Section n="06" eyebrow="Preferences" title="Anything you'd rather skip?" badge="Flexible">
            <input
              value={dislikes}
              onChange={(e) => setDislikes(e.target.value)}
              aria-label="Things you'd rather skip, separated by commas"
              placeholder="crowds, seafood, early mornings"
              maxLength={300}
              className="w-full rounded border border-border bg-surface px-4 py-3 text-sm outline-none transition-shadow placeholder:text-muted/60 focus:border-accent focus:ring-4 focus:ring-accent/10"
            />
            <p className="mt-2 text-xs text-muted">
              Separate with commas. RoamAI avoids these, but may bend them when there&apos;s no
              good alternative — use the rules below for anything that&apos;s a hard no.
            </p>
          </Section>

          <Section n="07" eyebrow="Rules" title="Rules RoamAI never breaks" badge="Hard rules" badgeTone="accent">
            <div className="grid gap-3 sm:grid-cols-2">
              <RuleSelect
                label="Earliest start"
                hint="Nothing is scheduled before this."
                value={constraints.earliestStart ?? ""}
                options={START_OPTIONS}
                onChange={(v) => setRule("earliestStart", v || undefined)}
              />
              <RuleSelect
                label="Latest finish"
                hint="Every stop has ended by this."
                value={constraints.latestEnd ?? ""}
                options={END_OPTIONS}
                onChange={(v) => setRule("latestEnd", v || undefined)}
              />
              <RuleSelect
                label="Max walking per day"
                hint="Estimated from the distance between stops."
                value={constraints.maxWalkingKmPerDay ? String(constraints.maxWalkingKmPerDay) : ""}
                options={WALK_OPTIONS}
                onChange={(v) => setRule("maxWalkingKmPerDay", v ? Number(v) : undefined)}
              />
              <RuleSelect
                label="Max stops per day"
                hint="Meals and activities; travel legs don't count."
                value={constraints.maxStopsPerDay ? String(constraints.maxStopsPerDay) : ""}
                options={STOP_OPTIONS}
                onChange={(v) => setRule("maxStopsPerDay", v ? Number(v) : undefined)}
              />
              <RuleSelect
                label="Longest single stop"
                hint="No museum marathons unless you say so."
                value={constraints.maxActivityMinutes ? String(constraints.maxActivityMinutes) : ""}
                options={DURATION_OPTIONS}
                onChange={(v) => setRule("maxActivityMinutes", v ? Number(v) : undefined)}
              />
            </div>
            <div role="group" aria-label="Never include" className="mt-5">
              <p className="font-display text-sm font-semibold text-ink">Never include</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {AVOID_OPTIONS.map((option) => (
                  <Chip
                    key={option.tag}
                    label={option.label}
                    selected={constraints.avoidTags?.includes(option.tag) ?? false}
                    onClick={() => toggleAvoid(option.tag)}
                  />
                ))}
              </div>
            </div>
          </Section>

          <section className="relative flex items-start gap-3.5 overflow-hidden rounded-lg bg-gradient-to-br from-accent-soft/70 via-surface to-warm-soft/40 p-5 shadow-card">
            <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-warm" />
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-warm shadow-card">
              <Fingerprint className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-accent">
                Why RoamAI asks
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Most itinerary tools cram every sight into one long day. Your pace sets how
                many stops each day holds, and your rules are checked in code on every plan
                and every change — a trip that breaks one never reaches you.
              </p>
            </div>
          </section>
        </div>

        {/* Capped to the space between the header and the action bar, so the
            rules and the save toggle at the bottom are always reachable. */}
        <aside className="lg:sticky lg:top-24 lg:col-span-5 lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto lg:rounded-lg">
          <TravelDnaCard
            dna={dna}
            destination={destination}
            interests={travelerTypes.length}
            rules={describeConstraints(profile.constraints)}
            account={account}
            restored={restored}
            saveToAccount={saveToAccount}
            onSaveToAccountChange={setSaveToAccount}
            loginHref={`/unlock?next=${encodeURIComponent(selfHref)}`}
          />
        </aside>
      </div>

      {error ? (
        <p
          role="alert"
          className="fixed inset-x-5 bottom-24 z-30 mx-auto max-w-xl rounded-md border border-warm bg-warm-soft px-4 py-3 text-sm text-warm shadow-lift"
        >
          {error}
        </p>
      ) : null}

      <PlannerActionBar
        start={
          <Link
            href={stepOneHref}
            className="inline-flex items-center gap-1.5 rounded px-3 py-2 font-display text-sm font-semibold text-muted transition-colors hover:bg-accent-soft hover:text-accent"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Back to destination</span>
          </Link>
        }
        end={
          <>
            <span className="hidden text-right md:block" aria-live="polite">
              <span className="block font-mono text-[0.6rem] font-bold uppercase tracking-widest text-muted">
                {canGenerate ? "Your travel DNA" : "One more thing"}
              </span>
              <span className="block font-display text-sm font-bold text-accent">
                {canGenerate ? dna.title : "Pick a traveler type to continue"}
              </span>
            </span>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="group inline-flex items-center gap-2 rounded bg-accent px-5 py-3 font-display text-sm font-semibold text-paper shadow-card transition-transform hover:bg-deep active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
            >
              Build my trip
              <ArrowRight
                aria-hidden="true"
                className="h-4 w-4 text-sunset transition-transform duration-300 group-hover:translate-x-1 group-disabled:translate-x-0"
              />
            </button>
          </>
        }
      />
    </main>
  );
}

function Section({
  n,
  eyebrow,
  title,
  badge,
  badgeTone = "muted",
  children,
}: {
  n: string;
  eyebrow: string;
  title: string;
  badge?: string;
  badgeTone?: "muted" | "accent" | "warm";
  children: React.ReactNode;
}) {
  const tone =
    badgeTone === "accent"
      ? "bg-accent text-paper"
      : badgeTone === "warm"
        ? "bg-warm-soft text-warm"
        : "bg-accent-soft text-muted";
  return (
    <section className="rounded-lg bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-muted">
            {n} / {eyebrow}
          </p>
          <h2 className="mt-0.5 font-display text-lg font-semibold text-accent">{title}</h2>
        </div>
        {badge ? (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[0.65rem] font-bold transition-colors ${tone}`}
          >
            {badge}
          </span>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

// Selection changes shape as well as colour (indicator bar, filled icon
// tile, checkmark) and gives press feedback, so a tap reads instantly.
function PersonaCard({
  label,
  hint,
  icon: Icon,
  selected,
  onClick,
}: {
  label: string;
  hint: string;
  icon: LucideIcon;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`group relative flex items-start gap-3 overflow-hidden rounded-md bg-surface p-3.5 text-left ring-1 transition-[box-shadow,transform] duration-150 ease-out active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        selected ? "shadow-lift ring-accent/40" : "shadow-card ring-border hover:shadow-lift"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 transition-colors ${selected ? "bg-warm" : "bg-transparent"}`}
      />
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded transition-colors ${
          selected ? "bg-accent text-sunset" : "bg-accent-soft text-muted group-hover:text-accent"
        }`}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 pr-3">
        <span className="block font-display text-sm font-semibold text-accent">{label}</span>
        <span className="block text-xs leading-snug text-muted">{hint}</span>
      </span>
      <Check
        aria-hidden="true"
        strokeWidth={3}
        className={`absolute right-2.5 top-2.5 h-3.5 w-3.5 text-warm transition-[opacity,transform] duration-150 ${
          selected ? "scale-100 opacity-100" : "scale-50 opacity-0"
        }`}
      />
    </button>
  );
}

function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; hint: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label}>
      <p className="font-display text-sm font-semibold text-ink">{label}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`rounded-md px-3.5 py-3 text-left transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                selected
                  ? "bg-accent text-paper shadow-lift"
                  : "bg-accent-soft/50 text-ink hover:bg-accent-soft"
              }`}
            >
              <span className="flex items-center justify-between gap-2 font-display text-sm font-semibold">
                {option.label}
                {selected ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-sunset" aria-hidden="true" />
                ) : null}
              </span>
              <span className={`mt-0.5 block text-xs ${selected ? "text-accent-soft/90" : "text-muted"}`}>
                {option.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RuleSelect({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  const set = value !== "";
  return (
    <div className={`flex flex-col gap-1.5 rounded-md p-3 transition-colors ${set ? "bg-accent-soft" : "bg-accent-soft/40"}`}>
      <label htmlFor={id} className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink">
        {set ? <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden="true" /> : null}
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={`${id}-hint`}
        className="rounded border border-border bg-surface px-3 py-2 font-display text-sm font-semibold text-accent outline-none transition-shadow focus:border-accent focus:ring-4 focus:ring-accent/10"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span id={`${id}-hint`} className="text-xs text-muted">
        {hint}
      </span>
    </div>
  );
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-display text-sm transition-[background-color,color,box-shadow,transform] duration-150 ease-out active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        selected
          ? "bg-accent font-semibold text-paper shadow-card"
          : "bg-accent-soft/60 text-ink hover:bg-accent-soft hover:text-accent"
      }`}
    >
      <Check
        aria-hidden="true"
        strokeWidth={3}
        className={`-ml-1 h-3.5 transition-all duration-150 ease-out ${
          selected ? "w-3.5 text-sunset opacity-100" : "w-0 opacity-0"
        }`}
      />
      {label}
    </button>
  );
}

// The live Travel DNA card from the design system. Every value on it is
// read straight from the selections on this page — no invented "match"
// percentages — so it reflects exactly what the planner will receive.
const ARCHETYPES: Record<string, string> = {
  Explorer: "Explorer",
  Foodie: "Epicurean",
  "Culture lover": "Culture Seeker",
  Nature: "Nature Wanderer",
  Relaxed: "Slow Traveler",
  Photographer: "Light Chaser",
  Shopper: "Market Browser",
  Nightlife: "Night Owl",
};
const PACE_WORD: Record<Pace, string> = {
  relaxed: "Unhurried",
  balanced: "Curious",
  packed: "Energetic",
};
const LEVEL: Record<string, number> = {
  budget: 33,
  comfort: 66,
  premium: 100,
  relaxed: 33,
  balanced: 66,
  packed: 100,
  low: 33,
  medium: 66,
  high: 100,
};

function capitalize(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function describeTravelDna(p: TravelerProfile) {
  const primary = p.travelerTypes[0];
  const localness = p.localness ?? 3;
  const discovery = p.discovery ?? 3;
  const title = primary
    ? `The ${PACE_WORD[p.pace]} ${ARCHETYPES[primary] ?? primary}`
    : "Your travel DNA";
  const food = p.foodPreferences.length
    ? ` and a taste for ${p.foodPreferences.join(", ")} food`
    : "";
  const summary = primary
    ? `You travel for ${p.travelerTypes.map((t) => t.toLowerCase()).join(", ")}, at a ${p.pace} pace on a ${p.budgetTier} budget, with ${p.walkingTolerance} walking${food}. Style: ${LOCALNESS_LABELS[localness - 1].toLowerCase()}, ${DISCOVERY_LABELS[discovery - 1].toLowerCase()}.`
    : "Pick at least one traveler type and your profile takes shape here.";
  const metrics = [
    { label: "Budget", value: LEVEL[p.budgetTier], caption: capitalize(p.budgetTier), color: "bg-warm" },
    { label: "Pace", value: LEVEL[p.pace], caption: capitalize(p.pace), color: "bg-accent" },
    { label: "Walking", value: LEVEL[p.walkingTolerance], caption: capitalize(p.walkingTolerance), color: "bg-sage" },
    { label: "Local feel", value: localness * 20, caption: LOCALNESS_LABELS[localness - 1], color: "bg-deep" },
    { label: "Hidden gems", value: discovery * 20, caption: DISCOVERY_LABELS[discovery - 1], color: "bg-warm" },
    {
      label: "Interests",
      value: Math.round((p.travelerTypes.length / TRAVELER_TYPES.length) * 100),
      caption: `${p.travelerTypes.length} of ${TRAVELER_TYPES.length}`,
      color: "bg-sunset",
    },
  ];
  return { title, summary, metrics };
}

function TravelDnaCard({
  dna,
  destination,
  interests,
  rules,
  account,
  restored,
  saveToAccount,
  onSaveToAccountChange,
  loginHref,
}: {
  dna: ReturnType<typeof describeTravelDna>;
  destination: string;
  interests: number;
  rules: string[];
  account: AccountState;
  restored: boolean;
  saveToAccount: boolean;
  onSaveToAccountChange: (value: boolean) => void;
  loginHref: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg bg-surface p-6 shadow-lift">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-warm-soft/70 blur-2xl"
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-warm">
            Generated archetype
          </p>
          {/* Keyed on the title so each change replays the entrance —
              the card visibly reacts to every choice. */}
          <h2
            key={dna.title}
            className="roam-rise mt-1 font-display text-2xl font-bold tracking-tight text-accent"
            aria-live="polite"
          >
            {dna.title}
          </h2>
        </div>
        <span className="rounded-md bg-accent-soft p-2 text-accent">
          <Fingerprint className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>

      {restored ? (
        <p className="relative mt-3 inline-flex items-center gap-1.5 rounded-full bg-deep px-3 py-1 font-display text-xs font-semibold text-sage">
          <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
          Loaded your saved Travel DNA
        </p>
      ) : null}

      <div className="relative mt-4 h-32 overflow-hidden rounded-md bg-gradient-to-br from-deep via-accent to-warm">
        <RouteArt className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-deep/80 to-transparent px-3 pb-3 pt-8 text-paper">
          <span className="flex min-w-0 items-center gap-1.5 font-display text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-sunset" aria-hidden="true" />
            <span className="truncate">Built for {destination}</span>
          </span>
          <span className="shrink-0 rounded-full bg-paper/20 px-2 py-0.5 font-mono text-[0.65rem] font-bold backdrop-blur-md">
            {interests} {interests === 1 ? "interest" : "interests"}
          </span>
        </div>
      </div>

      <p className="relative mt-4 rounded bg-accent-soft/60 p-4 text-sm leading-relaxed text-ink">
        {dna.summary}
      </p>

      <div className="relative mt-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-muted">
            Profile settings
          </p>
          <p className="font-display text-[0.7rem] font-semibold text-accent">Updates live</p>
        </div>
        {dna.metrics.map((m) => (
          <div key={m.label}>
            <div className="flex justify-between text-xs">
              <span className="text-ink">{m.label}</span>
              <span className="font-display font-bold text-accent">{m.caption}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-accent-soft">
              <div
                className={`h-full rounded-full ${m.color} transition-[width] duration-500 ease-out`}
                style={{ width: `${m.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="relative mt-5 rounded-md border border-border p-4">
        <p className="flex items-center gap-1.5 font-mono text-[0.65rem] font-bold uppercase tracking-widest text-accent">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Hard rules
        </p>
        {rules.length ? (
          <ul aria-label="Your hard rules" className="mt-2 space-y-1.5 text-sm text-ink">
            {rules.map((rule) => (
              <li key={rule} className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" strokeWidth={3} aria-hidden="true" />
                {rule}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">No hard rules yet — RoamAI will use its judgment.</p>
        )}
      </div>

      <div className="relative mt-5 border-t border-border pt-4 text-xs">
        {account === "signed-in" ? (
          <label className="flex cursor-pointer items-center gap-2.5 text-ink">
            <input
              type="checkbox"
              checked={saveToAccount}
              onChange={(e) => onSaveToAccountChange(e.target.checked)}
              className="h-4 w-4 accent-[hsl(var(--accent))]"
            />
            <span className="font-display text-sm font-semibold">Save to my account</span>
          </label>
        ) : account === "signed-out" ? (
          <Link
            href={loginHref}
            className="font-display text-sm font-semibold text-accent underline underline-offset-4 hover:text-warm"
          >
            Log in to keep your Travel DNA for next time
          </Link>
        ) : (
          <p className="flex items-center gap-2 text-muted">
            <span className="h-2 w-2 shrink-0 rounded-full bg-sage" aria-hidden="true" />
            Your {destination} itinerary is built from this profile.
          </p>
        )}
      </div>
    </div>
  );
}

function defaultDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={<main className="mx-auto max-w-xl px-6 py-20 text-muted">Loading…</main>}
    >
      <ProfileForm />
    </Suspense>
  );
}
