import {
  DISCOVERY_LABELS,
  LOCALNESS_LABELS,
} from "./travel-dna";
import type {
  BudgetTier,
  CrowdTolerance,
  Pace,
  TravelerProfile,
  WalkingTolerance,
} from "@/types/trip";

// The Travel DNA interview, as data.
//
// This used to be seven stacked form sections on one page — every control
// visible at once, which read as homework rather than a conversation. The
// screen now asks one question at a time, so the script lives here: a
// component that renders questions can't quietly change what is asked, and
// the order, the wording and which steps are skippable are all testable
// without rendering anything.
//
// `value` strings are sent to the API and into the AI prompt. Keep them
// stable; `label` and `hint` are display copy and safe to reword.

export type QuestionId =
  | "personas"
  | "budget"
  | "pace"
  | "walking"
  | "crowds"
  | "localness"
  | "discovery"
  | "food"
  | "dislikes"
  | "rules";

export interface Choice {
  value: string;
  label: string;
  hint?: string;
}

interface BaseQuestion {
  id: QuestionId;
  /** What RoamAI says, in its own voice. */
  prompt: string;
  /** The smaller line under it — why the answer matters. */
  aside?: string;
  /** Optional questions can be passed over with "Skip". */
  optional?: boolean;
}

export type Question = BaseQuestion &
  (
    | { kind: "single"; choices: readonly Choice[] }
    | { kind: "multi"; choices: readonly Choice[]; minimum: number }
    | { kind: "text"; placeholder: string }
    | { kind: "rules" }
  );

export const TRAVELER_TYPES: readonly Choice[] = [
  { value: "Explorer", label: "Explorer", hint: "Wandering off the map" },
  { value: "Foodie", label: "Foodie", hint: "Markets, bistros, tastings" },
  { value: "Culture lover", label: "Culture lover", hint: "Museums & architecture" },
  { value: "Nature", label: "Nature", hint: "Parks, trails, fresh air" },
  { value: "Relaxed", label: "Relaxed", hint: "Terraces & slow afternoons" },
  { value: "Photographer", label: "Photographer", hint: "Viewpoints & golden hour" },
  { value: "Shopper", label: "Shopper", hint: "Boutiques & makers" },
  { value: "Nightlife", label: "Nightlife", hint: "Bars, music, late nights" },
];

export const FOOD_PREFERENCES: readonly Choice[] = [
  { value: "Local", label: "Local" },
  { value: "Street food", label: "Street food" },
  { value: "Fine dining", label: "Fine dining" },
  { value: "Vegetarian", label: "Vegetarian" },
  { value: "Vegan", label: "Vegan" },
  { value: "Halal", label: "Halal" },
];

// Naming matches the BudgetTier type used everywhere else (types/trip.ts,
// the AI prompt, the generated trip's priceLevel banding) — "Luxury" would
// read fine here but would be a label with no matching value anywhere.
export const BUDGET_TIERS: readonly Choice[] = [
  { value: "budget", label: "Budget", hint: "€ · hostels, street food, public transport" },
  { value: "comfort", label: "Comfort", hint: "€€ · 3–4 star hotels, local spots and highlights" },
  { value: "premium", label: "Premium", hint: "€€€ · top hotels, fine dining, private transport" },
];

// Stop counts match the pace rule in lib/ai/prompts.ts — keep them in sync.
export const PACES: readonly Choice[] = [
  { value: "relaxed", label: "Relaxed", hint: "3–4 stops a day, time to linger" },
  { value: "balanced", label: "Balanced", hint: "A steady mix of sights and breaks" },
  { value: "packed", label: "Packed", hint: "6–8 stops a day, see it all" },
];

export const WALKING: readonly Choice[] = [
  { value: "low", label: "Not much", hint: "Short hops between stops" },
  { value: "medium", label: "A fair bit", hint: "Happy to walk between nearby spots" },
  { value: "high", label: "All day", hint: "The city on foot" },
];

export const CROWDS: readonly Choice[] = [
  { value: "low", label: "Avoid crowds", hint: "Quiet spots and off-peak times" },
  { value: "medium", label: "Some is fine", hint: "Busy places at the right time" },
  { value: "high", label: "Crowds are fine", hint: "Popular icons at any hour" },
];

/** The two 1–5 sliders, re-cut as choices you can tap once. */
const scaleChoices = (labels: readonly string[]): readonly Choice[] =>
  labels.map((label, i) => ({ value: String(i + 1), label }));

export const LOCALNESS_CHOICES = scaleChoices(LOCALNESS_LABELS);
export const DISCOVERY_CHOICES = scaleChoices(DISCOVERY_LABELS);

export const QUESTIONS: readonly Question[] = [
  {
    id: "personas",
    kind: "multi",
    minimum: 1,
    prompt: "What kind of traveler are you?",
    aside: "Pick as many as fit — this decides what goes in your days.",
    choices: TRAVELER_TYPES,
  },
  {
    id: "budget",
    kind: "single",
    prompt: "How do you like to spend?",
    aside: "Sets the hotels, the restaurants and how you get around.",
    choices: BUDGET_TIERS,
  },
  {
    id: "pace",
    kind: "single",
    prompt: "What's your rhythm on a trip?",
    aside: "This is how many stops fit in a day.",
    choices: PACES,
  },
  {
    id: "walking",
    kind: "single",
    prompt: "How much walking suits you?",
    aside: "Stops get grouped so you're not crossing the city twice.",
    choices: WALKING,
  },
  {
    id: "crowds",
    kind: "single",
    prompt: "And how do you feel about crowds?",
    choices: CROWDS,
  },
  {
    id: "localness",
    kind: "single",
    prompt: "Tourist classics, or like a local?",
    choices: LOCALNESS_CHOICES,
  },
  {
    id: "discovery",
    kind: "single",
    prompt: "Famous icons, or hidden gems?",
    choices: DISCOVERY_CHOICES,
  },
  {
    id: "food",
    kind: "multi",
    minimum: 0,
    optional: true,
    prompt: "What do you like to eat?",
    aside: "Skip this and I'll pick what the city is known for.",
    choices: FOOD_PREFERENCES,
  },
  {
    id: "dislikes",
    kind: "text",
    optional: true,
    prompt: "Anything you'd rather skip?",
    aside: "I'll avoid these where I can. For a hard no, use the next question.",
    placeholder: "crowds, seafood, early mornings",
  },
  {
    id: "rules",
    kind: "rules",
    optional: true,
    prompt: "Any rules I should never break?",
    aside: "These are checked in code on every plan and every edit, not just suggested.",
  },
];

export const QUESTION_COUNT = QUESTIONS.length;

/** Questions whose answer the traveler must give before a trip can be built. */
export function unansweredRequired(profile: TravelerProfile): QuestionId[] {
  return profile.travelerTypes.length > 0 ? [] : ["personas"];
}

// ── The Travel DNA read-out ────────────────────────────────────────────

const ARCHETYPES: Record<string, string> = {
  Explorer: "Wanderer",
  Foodie: "Epicurean",
  "Culture lover": "Aesthete",
  Nature: "Naturalist",
  Relaxed: "Slow Traveler",
  Photographer: "Documentarian",
  Shopper: "Collector",
  Nightlife: "Night Owl",
};

const PACE_WORD: Record<Pace, string> = {
  relaxed: "Unhurried",
  balanced: "Balanced",
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

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface TravelDnaReadout {
  title: string;
  summary: string;
  metrics: { label: string; value: number; caption: string; color: string }[];
}

export function describeTravelDna(p: TravelerProfile): TravelDnaReadout {
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

  return {
    title,
    summary,
    metrics: [
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
    ],
  };
}

/** The traveler's own answer, echoed back in the transcript. */
export function answerSummary(question: Question, profile: TravelerProfile): string {
  const labelFor = (choices: readonly Choice[], value: string) =>
    choices.find((c) => c.value === value)?.label ?? value;

  switch (question.id) {
    case "personas":
      return profile.travelerTypes.join(", ") || "—";
    case "budget":
      return labelFor(BUDGET_TIERS, profile.budgetTier);
    case "pace":
      return labelFor(PACES, profile.pace);
    case "walking":
      return labelFor(WALKING, profile.walkingTolerance);
    case "crowds":
      return labelFor(CROWDS, profile.crowdTolerance ?? "medium");
    case "localness":
      return LOCALNESS_LABELS[(profile.localness ?? 3) - 1];
    case "discovery":
      return DISCOVERY_LABELS[(profile.discovery ?? 3) - 1];
    case "food":
      return profile.foodPreferences.length
        ? profile.foodPreferences.map(capitalize).join(", ")
        : "Anything good";
    case "dislikes":
      return profile.dislikes.length ? profile.dislikes.join(", ") : "Nothing in particular";
    case "rules": {
      const c = profile.constraints ?? {};
      const count = Object.values(c).filter(
        (v) => v !== undefined && (!Array.isArray(v) || v.length > 0),
      ).length;
      return count > 0 ? `${count} rule${count === 1 ? "" : "s"} set` : "Use your judgement";
    }
  }
}

export type { BudgetTier, CrowdTolerance, Pace, WalkingTolerance };
