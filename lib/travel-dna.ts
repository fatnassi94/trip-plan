import { z } from "zod";
import type { HardConstraints } from "@/types/trip";

// Travel DNA — the traveler model every trip is planned from (see
// types/trip.ts TravelerProfile). This file owns its validation, the
// wording used to describe it, and the stored shape in
// profiles.travel_dna. The rules that enforce the hard constraints live
// in lib/trip-rules.ts, independent of any AI call.

const HHMM = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "expected HH:MM");

const Tag = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .transform((tag) => tag.toLowerCase());

export const HardConstraintsSchema = z
  .object({
    earliestStart: HHMM.optional(),
    latestEnd: HHMM.optional(),
    maxWalkingKmPerDay: z.number().min(0.5).max(50).optional(),
    maxStopsPerDay: z.number().int().min(1).max(12).optional(),
    maxActivityMinutes: z.number().int().min(15).max(720).optional(),
    avoidTags: z.array(Tag).max(10).optional(),
  })
  .refine((c) => !c.earliestStart || !c.latestEnd || c.earliestStart < c.latestEnd, {
    message: "earliestStart must be before latestEnd",
    path: ["latestEnd"],
  });

const Level = z.enum(["low", "medium", "high"]);
const Scale = z.number().int().min(1).max(5);

export const TravelerProfileSchema = z.object({
  travelerTypes: z.array(z.string().max(40)).max(8),
  budgetTier: z.enum(["budget", "comfort", "premium"]),
  pace: z.enum(["relaxed", "balanced", "packed"]),
  walkingTolerance: Level,
  foodPreferences: z.array(z.string().max(40)).max(10),
  dislikes: z.array(z.string().max(80)).max(10),
  localness: Scale.optional(),
  discovery: Scale.optional(),
  crowdTolerance: Level.optional(),
  constraints: HardConstraintsSchema.optional(),
});

/** What profiles.travel_dna holds. Versioned so the shape can grow. */
export const StoredTravelDnaSchema = z.object({
  version: z.literal(1),
  profile: TravelerProfileSchema,
  updatedAt: z.string(),
});

export type StoredTravelDna = z.infer<typeof StoredTravelDnaSchema>;

export const LOCALNESS_LABELS = [
  "Tourist classics",
  "Mostly classics",
  "Balanced",
  "Mostly local",
  "Like a local",
] as const;

export const DISCOVERY_LABELS = [
  "Famous icons",
  "Mostly famous",
  "Mix of both",
  "Mostly hidden",
  "Hidden gems",
] as const;

/** Category tags a traveler can rule out entirely (HardConstraints.avoidTags). */
export const AVOID_OPTIONS = [
  { tag: "museum", label: "Museums" },
  { tag: "nightlife", label: "Nightlife" },
  { tag: "shopping", label: "Shopping" },
  { tag: "hiking", label: "Hiking" },
  { tag: "beach", label: "Beaches" },
  { tag: "religious-site", label: "Religious sites" },
] as const;

/** Drops unset limits so "no limit" is always simply absent. */
export function normalizeConstraints(constraints: HardConstraints = {}): HardConstraints {
  const out: HardConstraints = {};
  if (constraints.earliestStart) out.earliestStart = constraints.earliestStart;
  if (constraints.latestEnd) out.latestEnd = constraints.latestEnd;
  if (constraints.maxWalkingKmPerDay) out.maxWalkingKmPerDay = constraints.maxWalkingKmPerDay;
  if (constraints.maxStopsPerDay) out.maxStopsPerDay = constraints.maxStopsPerDay;
  if (constraints.maxActivityMinutes) out.maxActivityMinutes = constraints.maxActivityMinutes;
  if (constraints.avoidTags?.length) out.avoidTags = [...constraints.avoidTags];
  return out;
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** One plain-language line per hard rule, for cards and briefs. */
export function describeConstraints(constraints: HardConstraints = {}): string[] {
  const lines: string[] = [];
  if (constraints.earliestStart) lines.push(`Nothing before ${constraints.earliestStart}`);
  if (constraints.latestEnd) lines.push(`Done by ${constraints.latestEnd}`);
  if (constraints.maxWalkingKmPerDay) lines.push(`At most ${constraints.maxWalkingKmPerDay} km walking a day`);
  if (constraints.maxStopsPerDay) {
    lines.push(`At most ${constraints.maxStopsPerDay} ${constraints.maxStopsPerDay === 1 ? "stop" : "stops"} a day`);
  }
  if (constraints.maxActivityMinutes) {
    lines.push(`No single stop over ${formatMinutes(constraints.maxActivityMinutes)}`);
  }
  if (constraints.avoidTags?.length) {
    const labels = constraints.avoidTags.map(
      (tag) => AVOID_OPTIONS.find((o) => o.tag === tag)?.label.toLowerCase() ?? tag,
    );
    lines.push(`Never: ${labels.join(", ")}`);
  }
  return lines;
}
