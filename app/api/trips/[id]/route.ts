import { NextResponse } from "next/server";
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
