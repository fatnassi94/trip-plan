import { NextResponse } from "next/server";
import { z } from "zod";
import { generateTrip } from "@/lib/ai/provider";
import { aiErrorResponse } from "@/lib/ai/errors";
import { TravelerProfileSchema } from "@/lib/travel-dna";
import { createServiceRoleClient, createSessionClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isAuthConfigured } from "@/lib/supabase/config";
import type { TripPreview } from "@/types/trip";

// The only place in the app that talks to the AI provider — see
// `lib/ai/provider.ts`. Browser -> this route -> AI provider, never
// Browser -> AI provider directly (see `ai-security` skill).
//
// THE PAID-PLAN GATE. Anyone may call this and the trip is always
// generated — the traveler watches the "AI Thinking" trace first and only
// then meets the paywall, which is the flow the product wants. What
// changes with payment is what comes BACK:
//
//   active plan  -> { trip }        the full itinerary
//   no plan      -> { locked, id, preview }   day titles and counts only
//
// The full itinerary is written to the trips table with user_id NULL and
// never sent to an unpaid browser; app/api/trips/claim/route.ts hands it
// over once a plan is attached. Returning everything and hiding it in the
// UI would leave the whole product sitting in the network tab, so the
// split happens here on the server or not at all.
//
// Two deliberate escape hatches, both matching the project's existing
// "graceful when unconfigured" stance:
//   - auth not configured (no anon key)      -> never locked
//   - persistence not configured (no service -> never locked, because
//     role key)                                 there is nowhere to park
//                                               the itinerary while the
//                                               traveler pays
//
// Cost note: generating before payment means unpaid visitors spend Gemini
// quota. That's the accepted price of showing the trace first; if free
// -tier quota ever becomes the binding constraint, rate limit this route
// per IP (see `api-security`) rather than moving the gate back in front.

const RequestSchema = z.object({
  destination: z.string().min(1).max(120),
  startDate: z.string(),
  endDate: z.string(),
  travelers: z.number().int().min(1).max(20),
  profile: TravelerProfileSchema,
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

  // Who is asking, and have they paid? Derived from the session cookie,
  // never from the request body (see `auth-security`). Neither answer
  // stops generation — they decide what gets returned at the end.
  let userId: string | null = null;
  let hasActivePlan = false;

  if (isAuthConfigured()) {
    const sessionClient = createSessionClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (user) {
      userId = user.id;
      const { data: profile } = await sessionClient
        .from("profiles")
        .select("subscription_status")
        .eq("id", user.id)
        .maybeSingle();
      hasActivePlan = profile?.subscription_status === "active";
    }
  }

  // Nowhere to park an unpaid itinerary means no way to withhold it, so
  // don't pretend to: hand it over as before.
  const canLock = isAuthConfigured() && isSupabaseConfigured();
  const shouldLock = canLock && !hasActivePlan;

  let trip;
  try {
    // The profile snapshot is attached here, after validation — never
    // taken from model output — so later edits (the AI Assistant, PATCH
    // /api/trips/[id]) are held to the same hard constraints.
    trip = { ...(await generateTrip(parsed.data)), profile: parsed.data.profile };
  } catch (err) {
    console.error("Trip generation failed", err);
    // "Busy", "out of quota" and "the model wrote nonsense" are three
    // different problems and send the traveler somewhere different.
    const { status, error, retryAfterSeconds } = aiErrorResponse(
      err,
      "The AI could not build a valid trip. Try again.",
    );
    return NextResponse.json(
      { error },
      {
        status,
        headers: retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : undefined,
      },
    );
  }

  // Persistence is optional: with only a Gemini key the app still works
  // end to end (the client caches the trip for the session). Supabase
  // just adds durable, shareable trips on top.
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ id: null, persisted: false, locked: false, trip });
  }

  let tripId: string | null = null;
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("trips")
      .insert({
        // NULL while unpaid — app/api/trips/claim stamps the owner on.
        // RLS ("trips: owner read/write") denies every anon-key read of a
        // NULL-owner row, so parking it here exposes it to nobody.
        user_id: hasActivePlan ? userId : null,
        destination: trip.destination,
        start_date: trip.startDate,
        end_date: trip.endDate,
        travelers: trip.travelers,
        itinerary: trip,
      })
      .select("id")
      .single();

    if (error) throw error;
    tripId = data.id as string;
  } catch (err) {
    // A storage failure shouldn't cost the user the trip we just paid
    // quota to generate — hand it back unsaved and log the reason. This
    // also means we can't lock it (nowhere to park it), so it goes back
    // in full rather than leaving the traveler with an unclaimable stub.
    console.error("Trip generated but not saved", err);
    return NextResponse.json({ id: null, persisted: false, locked: false, trip });
  }

  if (shouldLock) {
    const preview: TripPreview = {
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      travelers: trip.travelers,
      dayCount: trip.days.length,
      totalStops: trip.days.reduce((sum, day) => sum + day.items.length, 0),
      dayTitles: trip.days.map((day) => day.title),
    };
    // Note what is NOT in this response: `trip`. That's the point.
    return NextResponse.json({ id: tripId, persisted: true, locked: true, preview });
  }

  return NextResponse.json({ id: tripId, persisted: true, locked: false, trip });
}
