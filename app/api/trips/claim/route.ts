import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient, createSessionClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isAuthConfigured } from "@/lib/supabase/config";

// The other half of the paywall. app/api/trips/generate parks a finished
// itinerary with user_id NULL and returns only a preview; this route
// hands the real thing over, exactly once, to a signed-in traveler with
// an active plan — and stamps them as its owner on the way out so it
// shows up in their history on /account.
//
// The trip's own UUID is the claim ticket. That's sound: it's a random
// v4 (122 bits), it's only ever been sent to the browser that generated
// it, and the row it points at is unreadable through the anon key while
// user_id is NULL (RLS denies it). The `is("user_id", null)` filter below
// is what makes claiming single-use — a second attempt matches no row.

const BodySchema = z.object({ tripId: z.string().uuid() });

export async function POST(req: Request) {
  if (!isAuthConfigured() || !isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not available on this deployment." }, { status: 503 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid trip id" }, { status: 400 });
  }

  const sessionClient = createSessionClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: profile } = await sessionClient
    .from("profiles")
    .select("subscription_status")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.subscription_status !== "active") {
    return NextResponse.json({ error: "An active plan is required." }, { status: 402 });
  }

  // Service role: the row is deliberately invisible to this user's own
  // anon-key session until the moment it becomes theirs, so the update
  // that makes it theirs can't be done as them.
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("trips")
    .update({ user_id: user.id })
    .eq("id", parsed.data.tripId)
    .is("user_id", null)
    .select("id, itinerary")
    .maybeSingle();

  if (error) {
    console.error("Trip claim failed", error);
    return NextResponse.json({ error: "Couldn't unlock this trip" }, { status: 500 });
  }

  if (!data) {
    // Either the id is wrong, or somebody already claimed it. If it's
    // already this user's own trip, that's a retry — let it succeed
    // rather than stranding them behind a 404 on a trip they paid for.
    const { data: own } = await sessionClient
      .from("trips")
      .select("id, itinerary")
      .eq("id", parsed.data.tripId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (own) {
      return NextResponse.json({ id: own.id, trip: own.itinerary });
    }
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  return NextResponse.json({ id: data.id, trip: data.itinerary });
}
