"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { BudgetSelector, type BudgetOption } from "@/components/profile/budget-selector";
import { AiThinking } from "@/components/trip/ai-thinking";
import { useTripGeneration } from "@/components/trip/use-trip-generation";
import type { BudgetTier, Pace, TripRequest, WalkingTolerance } from "@/types/trip";

// 03 — Travel Profile. A Client Component because every control here is
// interactive: selections have to be held in state and sent to
// /api/trips/generate. (This was a Server Component with plain <button>s
// in the first scaffold, which is why nothing selected when clicked.)

const TRAVELER_TYPES = [
  "Explorer",
  "Foodie",
  "Culture lover",
  "Nature",
  "Relaxed",
  "Photographer",
  "Shopper",
  "Nightlife",
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

const PACES: { value: Pace; label: string }[] = [
  { value: "relaxed", label: "Relaxed" },
  { value: "balanced", label: "Balanced" },
  { value: "packed", label: "Packed" },
];

const WALKING: { value: WalkingTolerance; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

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
  const [dislikes, setDislikes] = useState("");

  const { status, error, generate } = useTripGeneration();

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

  async function handleGenerate() {
    const request: TripRequest = {
      destination,
      startDate,
      endDate,
      travelers,
      profile: {
        travelerTypes,
        budgetTier,
        pace,
        walkingTolerance,
        foodPreferences: foodPreferences.map((f) => f.toLowerCase()),
        dislikes: dislikes
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean),
      },
    };

    // No pre-flight paywall check: the trip gets built first so the
    // traveler watches it happen, and /api/trips/generate decides at the
    // end whether to hand over the itinerary or just a preview plus a
    // redirect to /unlock. useTripGeneration routes either outcome.
    await generate(request);
  }

  if (status === "generating") {
    return <AiThinking destination={destination} />;
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">
        Let&apos;s get to know how you travel
      </p>
      <h1 className="mt-3 font-display text-3xl font-semibold">
        What kind of traveler are you?
      </h1>
      <p className="mt-3 text-sm text-muted">
        {destination} · {startDate} → {endDate} · {travelers}{" "}
        {travelers === 1 ? "traveler" : "travelers"}
      </p>

      {/* Near the top, right under the destination/dates line: budget
          shapes almost every downstream recommendation (see
          buildTripUserPrompt), so it comes before the multi-select
          preference chips rather than after them. */}
      <Section label="Budget">
        <BudgetSelector options={BUDGET_TIERS} value={budgetTier} onChange={setBudgetTier} />
      </Section>

      <Section label="Pick any that fit" count={travelerTypes.length}>
        <div className="flex flex-wrap gap-2">
          {TRAVELER_TYPES.map((type) => (
            <Chip
              key={type}
              label={type}
              selected={travelerTypes.includes(type)}
              onClick={() => toggle(setTravelerTypes, type)}
            />
          ))}
        </div>
      </Section>

      <Section label="Pace">
        <div className="flex flex-wrap gap-2">
          {PACES.map((p) => (
            <Chip
              key={p.value}
              label={p.label}
              selected={pace === p.value}
              onClick={() => setPace(p.value)}
            />
          ))}
        </div>
      </Section>

      <Section label="How much walking?">
        <div className="flex flex-wrap gap-2">
          {WALKING.map((w) => (
            <Chip
              key={w.value}
              label={w.label}
              selected={walkingTolerance === w.value}
              onClick={() => setWalkingTolerance(w.value)}
            />
          ))}
        </div>
      </Section>

      <Section label="Food" count={foodPreferences.length}>
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

      <Section label="Anything you'd rather avoid?">
        <input
          value={dislikes}
          onChange={(e) => setDislikes(e.target.value)}
          placeholder="crowds, seafood, early mornings"
          className="w-full rounded-md border border-border bg-transparent px-4 py-3 text-sm outline-none focus:border-accent"
        />
      </Section>

      {error ? (
        <p className="mt-8 rounded-md border border-warm bg-warm-soft px-4 py-3 text-sm text-warm">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={travelerTypes.length === 0}
        className="group mt-10 inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-6 py-3 font-medium text-paper transition-[opacity,transform] duration-200 ease-out hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 sm:w-auto"
      >
        Build my trip
        <ArrowRight
          aria-hidden="true"
          className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 group-disabled:translate-x-0"
        />
      </button>
      {travelerTypes.length === 0 ? (
        <p className="mt-3 text-xs text-muted">
          Pick at least one traveler type so the AI has something to work with.
        </p>
      ) : null}
    </main>
  );
}

function Section({
  label,
  count,
  children,
}: {
  label: string;
  /** Number of selections, shown beside the label for multi-select groups. */
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="flex items-baseline gap-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted">
          {label}
        </h2>
        {count ? (
          <span className="font-mono text-xs text-accent">{count} selected</span>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

// The selected state has to land instantly and read from across the room:
// a colour swap alone was too quiet to feel like a response to the tap.
// Now selection also changes the chip's *shape* (a checkmark slides in)
// and gives tactile press feedback, and the transition is short enough
// that the chip is fully filled before a finger lifts.
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
      className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        selected
          ? "border-accent bg-accent font-medium text-paper shadow-sm"
          : "border-border hover:border-accent hover:text-accent"
      }`}
    >
      <Check
        aria-hidden="true"
        strokeWidth={3}
        className={`-ml-1 h-3.5 w-3.5 transition-all duration-150 ease-out ${
          selected ? "w-3.5 opacity-100" : "w-0 opacity-0"
        }`}
      />
      {label}
    </button>
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
