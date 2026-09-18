import { NextResponse } from "next/server";
import { z } from "zod";
import { searchDestinationCatalog, type MoodId } from "@/lib/destination-catalog";
import { toDestinationSummary } from "@/lib/destination-summary";

// Destination search over the local catalog — no third party involved, so
// it stays fast and works with no API key at all.

const MOODS = [
  "beaches-islands",
  "food-culture",
  "historic-cities",
  "nature-hiking",
  "nightlife",
  "budget-escapes",
  "luxury-relaxation",
] as const;

const QuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  mood: z.enum(MOODS).optional(),
  region: z.string().trim().max(60).optional(),
  budget: z.enum(["budget", "comfort", "premium"]).optional(),
  maxNights: z.coerce.number().int().min(1).max(30).optional(),
  interests: z.string().trim().max(200).optional(),
});

export const revalidate = 3600;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid search", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { interests, mood, ...rest } = parsed.data;
  const destinations = searchDestinationCatalog({
    ...rest,
    mood: mood as MoodId | undefined,
    interests: interests ? interests.split(",").map((i) => i.trim()).filter(Boolean) : undefined,
  }).map(toDestinationSummary);

  return NextResponse.json({ destinations, count: destinations.length });
}
