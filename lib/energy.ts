import { walkingLegs } from "@/lib/trip-rules";
import type { ItineraryItem, Pace, TravelerProfile, Trip, TripDay, WalkingTolerance } from "@/types/trip";

// Energy + Pace Intelligence: how tiring a stop, a day and a trip are.
//
// Deterministic and explainable on purpose (see `travel-domain`): effort
// is arithmetic over the itinerary we already have — duration, the walk
// to reach a stop, and what kind of stop it is — never a number the model
// made up. The weights below are heuristics, not measurements, so
// everything built on them is presented as an estimate.

export type EnergyLevel = "light" | "steady" | "heavy";

export interface ItemEnergy {
  item: ItineraryItem;
  /** Effort points for this stop, including the walk to reach it. */
  energy: number;
  walkKm: number;
}

export interface DayEnergy {
  day: number;
  /** Total effort points for the day. */
  score: number;
  /** What this traveler's day can hold before it reads as heavy. */
  capacity: number;
  /** score / capacity, as a percentage. */
  percent: number;
  level: EnergyLevel;
  /** Estimated walking, or null when too few stops have coordinates. */
  walkingKm: number | null;
  items: ItemEnergy[];
}

export interface TripEnergy {
  days: DayEnergy[];
  /** Pacing problems across days, in plain language. */
  issues: string[];
}

/** Being somewhere at all costs something; a meal is mostly sitting. */
const BASE_BY_TYPE: Record<ItineraryItem["type"], number> = {
  activity: 25,
  meal: 10,
  transit: 6,
};

/** Kind of stop, matched against the item's tags. */
const TAG_EFFORT: Record<string, number> = {
  hiking: 25,
  hike: 25,
  trail: 20,
  climb: 25,
  bike: 18,
  cycling: 18,
  nightlife: 15,
  club: 18,
  bar: 10,
  museum: 10,
  gallery: 10,
  landmark: 10,
  tour: 10,
  market: 8,
  viewpoint: 5,
  park: -5,
  garden: -5,
  beach: -8,
  cafe: -8,
  coffee: -8,
  spa: -12,
  relax: -10,
};

const MINUTES_PER_STEP = 30;
const COST_PER_STEP = 5;
const MEAL_COST_PER_STEP = 2;
const COST_PER_WALKED_KM = 10;

/**
 * How much effort a day can hold before it reads as heavy. Calibrated so
 * a balanced traveler's ordinary day — four stops of an hour or two with
 * short walks between them — lands near 100%, and a day built around a
 * long hike or a late night goes over it.
 */
const PACE_CAPACITY: Record<Pace, number> = { relaxed: 170, balanced: 220, packed: 280 };
const WALKING_FACTOR: Record<WalkingTolerance, number> = { low: 0.85, medium: 1, high: 1.15 };

/** Singular/plural and case don't change a tag's meaning. */
function normalizeTag(tag: string): string {
  const t = tag.trim().toLowerCase();
  return t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t;
}

function tagEffort(item: ItineraryItem): number {
  return (item.tags ?? []).reduce((total, tag) => total + (TAG_EFFORT[normalizeTag(tag)] ?? 0), 0);
}

/** Effort for one stop, given how far it was to walk there. */
export function itemEnergy(item: ItineraryItem, walkKm = 0): number {
  const steps = item.durationMinutes / MINUTES_PER_STEP;
  const durationCost = steps * (item.type === "meal" ? MEAL_COST_PER_STEP : COST_PER_STEP);
  const raw = BASE_BY_TYPE[item.type] + tagEffort(item) + durationCost + walkKm * COST_PER_WALKED_KM;
  return Math.max(0, Math.round(raw));
}

/** How much effort this traveler's day can hold before it reads as heavy. */
export function energyCapacity(profile?: TravelerProfile): number {
  const pace = PACE_CAPACITY[profile?.pace ?? "balanced"];
  return Math.round(pace * WALKING_FACTOR[profile?.walkingTolerance ?? "medium"]);
}

export function energyLevel(score: number, capacity: number): EnergyLevel {
  if (score <= capacity * 0.6) return "light";
  if (score <= capacity) return "steady";
  return "heavy";
}

export function dayEnergy(day: TripDay, profile?: TravelerProfile): DayEnergy {
  const legs = walkingLegs(day);
  const byName = new Map(legs.map((leg) => [leg.item, leg.km]));
  const items: ItemEnergy[] = day.items.map((item) => {
    const walkKm = byName.get(item) ?? 0;
    return { item, walkKm, energy: itemEnergy(item, walkKm) };
  });

  const score = items.reduce((total, i) => total + i.energy, 0);
  const capacity = energyCapacity(profile);
  const walkingKm = legs.length ? legs.reduce((total, leg) => total + leg.km, 0) : 0;
  const located = day.items.filter((i) => i.type !== "transit" && i.lat != null && i.lng != null);

  return {
    day: day.day,
    score,
    capacity,
    percent: Math.round((score / capacity) * 100),
    level: energyLevel(score, capacity),
    walkingKm: located.length < 2 ? null : walkingKm,
    items,
  };
}

export function tripEnergy(trip: Pick<Trip, "days" | "profile">): TripEnergy {
  const days = trip.days.map((day) => dayEnergy(day, trip.profile));
  const issues: string[] = [];

  for (let i = 0; i < days.length - 1; i++) {
    if (days[i].level === "heavy" && days[i + 1].level === "heavy") {
      issues.push(`Days ${days[i].day} and ${days[i + 1].day} are both heavy, back to back.`);
    }
  }
  if (days.length > 2 && days.every((d) => d.level === "heavy")) {
    issues.push("Every day of this trip is heavy — there's no room to recover.");
  }

  return { days, issues };
}

const LEVEL_COPY: Record<EnergyLevel, { label: string; hint: string }> = {
  light: { label: "Light day", hint: "An easy day — plenty of room to add more." },
  steady: { label: "Steady day", hint: "A full but comfortable day at your pace." },
  heavy: { label: "Heavy day", hint: "A demanding day — expect to be tired by the evening." },
};

export function describeEnergyLevel(level: EnergyLevel) {
  return LEVEL_COPY[level];
}

/**
 * Per-stop effort, for the activity card. A short meal or a café is easy;
 * an ordinary sight of an hour or two is moderate; only a long or
 * strenuous stop (a hike, a museum marathon, a late night) is demanding.
 */
export function describeItemEffort(energy: number): string {
  if (energy <= 25) return "Easy";
  if (energy <= 55) return "Moderate";
  return "Demanding";
}

/** "1 light · 2 steady · 1 heavy" — the trip's shape at a glance. */
export function summarizePacing(days: DayEnergy[]): string {
  const counts: Record<EnergyLevel, number> = { light: 0, steady: 0, heavy: 0 };
  days.forEach((d) => (counts[d.level] += 1));
  return (["light", "steady", "heavy"] as const)
    .filter((level) => counts[level] > 0)
    .map((level) => `${counts[level]} ${level}`)
    .join(" · ");
}
