import { NextResponse } from "next/server";
import { z } from "zod";
import { reviseTripDay } from "@/lib/ai/provider";
import { TripSchema, type ValidatedTrip } from "@/lib/ai/schema";
import { diffDay } from "@/lib/itinerary";
import { assistantRateLimiter } from "@/lib/rate-limit";
import { createSessionClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isAuthConfigured } from "@/lib/supabase/config";

// 10 — AI Assistant ("Edit via ✨ Chat"). The traveler asks for a change to
// one day; this route returns a validated revision of that day, a short
// reply, and a server-computed diff. It never saves anything — applying a
// revision is a separate PATCH /api/trips/[id], which re-validates the
// whole trip before writing. Browser -> this route -> lib/ai, never the
// browser to the provider (see `ai-security`).
//
// Where the trip comes from matters:
//   accounts configured -> loaded from the database for the signed-in
//                          owner; any trip in the body is ignored, so a
//                          traveler can only edit (and spend AI quota on)
//                          trips they actually own — which also keeps
//                          unpaid, unclaimed trips out of reach
//   demo mode (no Supabase) -> the trip from the browser's tab cache,
//                          validated like model output

const RequestSchema = z.object({
  tripId: z.string().uuid().optional(),
  trip: TripSchema.optional(),
  day: z.number().int().min(1).max(30),
  message: z.string().trim().min(1).max(500),
  anotherOption: z.boolean().optional(),
});

export const maxDuration = 60;

export async function POST(req: Request) {
  const parsed = RequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid assistant request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "The assistant isn't available on this deployment yet." },
      { status: 503 },
    );
  }

  const { tripId, day, message, anotherOption } = parsed.data;
  let trip: ValidatedTrip;
  let rateKey: string;

  if (isAuthConfigured() && isSupabaseConfigured()) {
    const supabase = createSessionClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in to use the assistant." }, { status: 401 });
    }
    if (!tripId) {
      return NextResponse.json(
        { error: "Open a trip saved to your account to use the assistant." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("trips")
      .select("itinerary")
      .eq("id", tripId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const stored = TripSchema.safeParse(data.itinerary);
    if (!stored.success) {
      console.error("Stored itinerary failed validation", tripId, stored.error.flatten());
      return NextResponse.json({ error: "This trip can't be edited right now." }, { status: 500 });
    }
    trip = stored.data;
    rateKey = `user:${user.id}`;
  } else {
    if (!parsed.data.trip) {
      return NextResponse.json({ error: "A trip is required." }, { status: 400 });
    }
    trip = parsed.data.trip;
    rateKey = `ip:${clientIp(req)}`;
  }

  const current = trip.days.find((d) => d.day === day);
  if (!current) {
    return NextResponse.json({ error: `This trip has no day ${day}.` }, { status: 400 });
  }

  const limit = assistantRateLimiter.check(rateKey);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "That's a lot of changes in a short time — try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  try {
    const revision = await reviseTripDay({ trip, dayNumber: day, message, anotherOption });
    return NextResponse.json({
      reply: revision.reply,
      day: revision.day,
      changes: diffDay(current, revision.day),
    });
  } catch (err) {
    console.error("Assistant revision failed", err);
    return NextResponse.json(
      { error: "The assistant couldn't come up with a change that fits your day. Try rephrasing." },
      { status: 502 },
    );
  }
}

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
