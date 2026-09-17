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

/**
 * Estimated walking for a day: the legs between consecutive stops that
 * both have coordinates, times the detour factor. A transit item between
 * two stops means that leg isn't walked. Returns null when fewer than two
 * stops can be placed — "unknown", not zero.
 */
export function estimateWalkingKm(day: TripDay): number | null {
  let previous: ItineraryItem | null = null;
  let legs = 0;
  let km = 0;

  for (const item of byStart(day.items)) {
    if (item.type === "transit") {
      previous = null;
      continue;
    }
    if (item.lat == null || item.lng == null) continue;
    if (previous?.lat != null && previous.lng != null) {
      km += distanceKm({ lat: previous.lat, lng: previous.lng }, { lat: item.lat, lng: item.lng });
      legs += 1;
    }
    previous = item;
  }

  const located = day.items.filter((i) => i.type !== "transit" && i.lat != null && i.lng != null);
  if (located.length < 2) return null;
  return legs === 0 ? 0 : km * WALKING_DETOUR_FACTOR;
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
