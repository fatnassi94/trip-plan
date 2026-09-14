import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionClient } from "@/lib/supabase/server";
import { isAuthConfigured } from "@/lib/supabase/config";

// Saves a satisfaction rating + optional comment for one of the user's
// own past trips (app/account/page.tsx → components/account/trip-rating.tsx).

const BodySchema = z.object({
  tripId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json({ error: "Auth isn't configured for this deployment." }, { status: 503 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
  }

  const supabase = createSessionClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // RLS's "trips: owner read/write" policy already scopes this update to
  // rows where user_id = auth.uid() — the .eq("user_id", ...) below is
  // belt-and-suspenders for a clearer 404 than a silently-matched-zero-rows
  // update would give, not the actual security boundary.
  const { data, error } = await supabase
    .from("trips")
    .update({ rating: parsed.data.rating, rating_comment: parsed.data.comment ?? null })
    .eq("id", parsed.data.tripId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Failed to save trip rating", error);
    return NextResponse.json({ error: "Couldn't save rating" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
