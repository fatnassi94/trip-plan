import { NextResponse } from "next/server";
import { z } from "zod";
import { generateTrip } from "@/lib/ai/provider";
import { createServiceRoleClient, isSupabaseConfigured } from "@/lib/supabase/server";

// The only place in the app that talks to the AI provider — see
// `lib/ai/provider.ts`. Browser -> this route -> AI provider, never
// Browser -> AI provider directly (see `ai-security` skill).

const RequestSchema = z.object({
  destination: z.string().min(1).max(120),
  startDate: z.string(),
  endDate: z.string(),
  travelers: z.number().int().min(1).max(20),
  profile: z.object({
    travelerTypes: z.array(z.string()).max(8),
    budgetTier: z.enum(["budget", "comfort", "premium"]),
    pace: z.enum(["relaxed", "balanced", "packed"]),
    walkingTolerance: z.enum(["low", "medium", "high"]),
    foodPreferences: z.array(z.string()).max(10),
    dislikes: z.array(z.string()).max(10),
  }),
});

// Trip generation on the free tier can take a while; give it room.
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid trip request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      {
        error:
          "No AI key configured. Copy .env.example to .env.local and set GEMINI_API_KEY (free at aistudio.google.com/apikey).",
      },
      { status: 503 },
    );
  }

  let trip;
  try {
    trip = await generateTrip(parsed.data);
  } catch (err) {
    console.error("Trip generation failed", err);
    return NextResponse.json(
      { error: "The AI could not build a valid trip. Try again." },
      { status: 502 },
    );
  }

  // Persistence is optional: with only a Gemini key the app still works
  // end to end (the client caches the trip for the session). Supabase
  // just adds durable, shareable trips on top.
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ id: null, persisted: false, trip });
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("trips")
      .insert({
        destination: trip.destination,
        start_date: trip.startDate,
        end_date: trip.endDate,
        travelers: trip.travelers,
        itinerary: trip,
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({ id: data.id, persisted: true, trip });
  } catch (err) {
    // A storage failure shouldn't cost the user the trip we just paid
    // quota to generate — hand it back unsaved and log the reason.
    console.error("Trip generated but not saved", err);
    return NextResponse.json({ id: null, persisted: false, trip });
  }
}
