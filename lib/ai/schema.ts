import { z } from "zod";

// The gate every model response must pass before it's trusted. See the
// `ai-security` and `database-security` skills: raw LLM output is
// untrusted input, exactly like a form submission from a stranger.

export const ItineraryItemSchema = z.object({
  type: z.enum(["activity", "meal", "transit"]),
  name: z.string().min(1).max(120),
  placeId: z.string().optional(),
  start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "expected HH:MM"),
  durationMinutes: z.number().int().min(5).max(720),
  priceLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  tags: z.array(z.string()).max(6).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  address: z.string().min(1).max(160).optional(),
  // No .min() on purpose: this is a repair-retry pipeline on a free-tier
  // model (see lib/ai/provider.ts), and a stray empty array shouldn't be
  // the difference between a trip that saves and one that doesn't. The UI
  // falls back gracefully when it's missing or short — see ActivityCard.
  suggestions: z.array(z.string().min(1).max(140)).max(4).optional(),
  reason: z.string().min(1).max(280),
});

export const TripDaySchema = z.object({
  day: z.number().int().min(1),
  title: z.string().min(1).max(80),
  items: z.array(ItineraryItemSchema).min(1).max(12),
});

export const TripSchema = z.object({
  destination: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  travelers: z.number().int().min(1).max(20),
  days: z.array(TripDaySchema).min(1).max(30),
});

export type ValidatedTrip = z.infer<typeof TripSchema>;

/** Business rules a schema alone can't express (see project plan §34). */
export function checkBusinessRules(trip: ValidatedTrip): string[] {
  const problems: string[] = [];

  for (const day of trip.days) {
    const withEnd = day.items
      .map((item) => {
        const [h, m] = item.start.split(":").map(Number);
        const startMin = h * 60 + m;
        return { item, startMin, endMin: startMin + item.durationMinutes };
      })
      .sort((a, b) => a.startMin - b.startMin);

    for (let i = 0; i < withEnd.length - 1; i++) {
      if (withEnd[i].endMin > withEnd[i + 1].startMin) {
        problems.push(
          `Day ${day.day}: "${withEnd[i].item.name}" overlaps "${withEnd[i + 1].item.name}"`,
        );
      }
    }

    const totalMinutes = day.items.reduce((sum, i) => sum + i.durationMinutes, 0);
    if (totalMinutes > 14 * 60) {
      problems.push(`Day ${day.day}: overloaded (${Math.round(totalMinutes / 60)}h planned)`);
    }
    if (day.items.length === 0) {
      problems.push(`Day ${day.day}: has no items`);
    }
  }

  return problems;
}

/**
 * Parse + validate a raw model response. Throws with a clear message on
 * failure so the caller can retry/repair rather than silently saving
 * garbage — see lib/ai/provider.ts `generateTrip`.
 */
export function parseTripResponse(raw: unknown): ValidatedTrip {
  const trip = TripSchema.parse(raw);
  const issues = checkBusinessRules(trip);
  if (issues.length > 0) {
    throw new Error(`Trip failed business rules: ${issues.join("; ")}`);
  }
  return trip;
}
