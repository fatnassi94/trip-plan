import { NextResponse } from "next/server";
import { z } from "zod";
import { parseTripResponse, TripDaySchema, TripSchema } from "@/lib/ai/schema";
import { replaceDay } from "@/lib/itinerary";
import { createSessionClient } from "@/lib/supabase/server";
import { isAuthConfigured } from "@/lib/supabase/config";

// Lets app/trip/[id]/page.tsx (and the day-detail page) resolve a trip
// that isn't in this tab's sessionStorage cache — e.g. opened from
// app/account's past-trips list in a fresh session. RLS ("trips: owner
// read/write") is the actual security boundary here; the session client
// just acts as whoever's cookie sent the request.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!isAuthConfigured()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("trips")
    .select("itinerary")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  return NextResponse.json({ trip: data.itinerary });
}

const PatchSchema = z.object({ day: TripDaySchema });

// Applies an AI Assistant change (components/trip/trip-assistant.tsx):
// replaces one day of the owner's saved itinerary. The day in the body is
// treated exactly like model output — it could have been hand-crafted —
// so the WHOLE resulting trip is re-validated (schema + business rules)
// before anything is written. Nothing here trusts that the assistant
// route already checked it.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isAuthConfigured()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid day", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("trips")
    .select("itinerary")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const stored = TripSchema.safeParse(data.itinerary);
  if (!stored.success) {
    console.error("Stored itinerary failed validation", params.id, stored.error.flatten());
    return NextResponse.json({ error: "This trip can't be edited right now." }, { status: 500 });
  }

  const dayNumber = parsed.data.day.day;
  if (!stored.data.days.some((d) => d.day === dayNumber)) {
    return NextResponse.json({ error: `This trip has no day ${dayNumber}.` }, { status: 400 });
  }

  let next;
  try {
    next = parseTripResponse(replaceDay(stored.data, parsed.data.day));
  } catch (err) {
    return NextResponse.json(
      {
        error: "These changes break the schedule rules, so they weren't saved.",
        details: err instanceof Error ? err.message : undefined,
      },
      { status: 422 },
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("trips")
    .update({ itinerary: next })
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (updateError) {
    console.error("Failed to save trip edit", updateError);
    return NextResponse.json({ error: "Couldn't save your changes." }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  return NextResponse.json({ trip: next });
}
