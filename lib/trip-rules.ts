import { addMinutes, toMinutes } from "@/lib/itinerary";
import type { HardConstraints, ItineraryItem, TripDay } from "@/types/trip";

// The Trip Rules Engine: checks an itinerary against the traveler's hard
// constraints in plain code, independently of any AI call. It gates model
// output (lib/ai/schema.ts → repair retry) and saved edits
// (PATCH /api/trips/[id]), so a rule the traveler set can't be broken by a
// prompt, a model mistake, or a hand-crafted request.

export interface RuleViolation {
  rule: keyof HardConstraints;
  day: number;
  message: string;
}

/**
 * Streets aren't straight lines: straight-line distance is scaled by this
 * typical urban detour factor. Walking figures are always estimates.
 */
export const WALKING_DETOUR_FACTOR = 1.3;

/**
 * Nobody walks between stops this far apart — a leg longer than this is
 * assumed to be covered by transport, even when the itinerary doesn't say
 * so, rather than inflating walking totals with a 20 km "stroll".
 */
export const MAX_WALKED_LEG_KM = 5;

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two points, in km. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function byStart(items: ItineraryItem[]): ItineraryItem[] {
  return [...items].sort((a, b) => (toMinutes(a.start) ?? 0) - (toMinutes(b.start) ?? 0));
}

export interface WalkingLeg {
  item: ItineraryItem;
  /** Estimated km walked to reach this stop (0 for the first, or when unknown). */
  km: number;
}

/**
 * The walking legs of a day, in start order: for each non-transit stop,
 * how far it is from the previous one. A transit item between two stops
 * means that leg wasn't walked, and a stop without coordinates breaks the
 * chain rather than guessing.
 */
export function walkingLegs(day: TripDay): WalkingLeg[] {
  const legs: WalkingLeg[] = [];
  let previous: ItineraryItem | null = null;

  for (const item of byStart(day.items)) {
    if (item.type === "transit") {
      previous = null;
      continue;
    }
    const placed = item.lat != null && item.lng != null;
    const from = previous?.lat != null && previous.lng != null ? previous : null;
    const km =
      placed && from
        ? distanceKm(
            { lat: from.lat as number, lng: from.lng as number },
            { lat: item.lat as number, lng: item.lng as number },
          ) * WALKING_DETOUR_FACTOR
        : 0;
    legs.push({ item, km: km > MAX_WALKED_LEG_KM ? 0 : km });
    if (placed) previous = item;
  }

  return legs;
}

/**
 * Estimated walking for a day, in km. Returns null when fewer than two
 * stops can be placed — "unknown", not zero.
 */
export function estimateWalkingKm(day: TripDay): number | null {
  const located = day.items.filter((i) => i.type !== "transit" && i.lat != null && i.lng != null);
  if (located.length < 2) return null;
  return walkingLegs(day).reduce((total, leg) => total + leg.km, 0);
}

/** "museums" and "museum" are the same rule. */
function normalizeTag(tag: string): string {
  const t = tag.trim().toLowerCase();
  return t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t;
}

export function checkConstraints(day: TripDay, constraints: HardConstraints = {}): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const push = (rule: keyof HardConstraints, message: string) =>
    violations.push({ rule, day: day.day, message: `Day ${day.day}: ${message}` });

  const stops = day.items.filter((item) => item.type !== "transit");
  const earliest = constraints.earliestStart ? toMinutes(constraints.earliestStart) : null;
  const latest = constraints.latestEnd ? toMinutes(constraints.latestEnd) : null;
  const avoid = new Set((constraints.avoidTags ?? []).map(normalizeTag));

  for (const item of day.items) {
    const start = toMinutes(item.start);
    if (start == null) continue;
    const end = start + item.durationMinutes;

    if (earliest != null && start < earliest) {
      push("earliestStart", `"${item.name}" starts at ${item.start}, before the ${constraints.earliestStart} earliest start`);
    }
    if (latest != null && end > latest) {
      push(
        "latestEnd",
        `"${item.name}" ends at ${addMinutes(item.start, item.durationMinutes)}, after the ${constraints.latestEnd} latest end`,
      );
    }
    if (item.type === "transit") continue;
    if (constraints.maxActivityMinutes && item.durationMinutes > constraints.maxActivityMinutes) {
      push(
        "maxActivityMinutes",
        `"${item.name}" lasts ${item.durationMinutes} min, over the ${constraints.maxActivityMinutes} min limit`,
      );
    }
    const blocked = (item.tags ?? []).find((tag) => avoid.has(normalizeTag(tag)));
    if (blocked) {
      push("avoidTags", `"${item.name}" is tagged "${blocked}", which you asked never to include`);
    }
  }

  if (constraints.maxStopsPerDay && stops.length > constraints.maxStopsPerDay) {
    push("maxStopsPerDay", `${stops.length} stops, over the limit of ${constraints.maxStopsPerDay}`);
  }

  if (constraints.maxWalkingKmPerDay) {
    const km = estimateWalkingKm(day);
    if (km != null && km > constraints.maxWalkingKmPerDay) {
      push(
        "maxWalkingKmPerDay",
        `about ${km.toFixed(1)} km of walking (estimated), over the ${constraints.maxWalkingKmPerDay} km limit`,
      );
    }
  }

  return violations;
}

export function checkTripConstraints(
  trip: { days: TripDay[] },
  constraints?: HardConstraints,
): RuleViolation[] {
  if (!constraints) return [];
  return trip.days.flatMap((day) => checkConstraints(day, constraints));
}
