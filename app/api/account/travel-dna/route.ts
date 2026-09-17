import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionClient } from "@/lib/supabase/server";
import { isAuthConfigured } from "@/lib/supabase/config";
import { StoredTravelDnaSchema, TravelerProfileSchema, type StoredTravelDna } from "@/lib/travel-dna";

// The signed-in traveler's saved Travel DNA (profiles.travel_dna). The
// user is always taken from the session cookie, never the body, and RLS
// ("profiles: owner read/write") scopes every read and write to their own
// row. Per-request by nature — see app/api/account/status for why this
// must never be statically cached.
export const dynamic = "force-dynamic";

const PutSchema = z.object({ profile: TravelerProfileSchema });

export async function GET() {
  if (!isAuthConfigured()) {
    return NextResponse.json({ configured: false, loggedIn: false, profile: null, updatedAt: null });
  }

  try {
    const supabase = createSessionClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ configured: true, loggedIn: false, profile: null, updatedAt: null });
    }

    const { data } = await supabase
      .from("profiles")
      .select("travel_dna")
      .eq("id", user.id)
      .maybeSingle();

    // A row written by an older or broken client is treated as "nothing
    // saved" rather than handed to the UI unvalidated.
    const stored = StoredTravelDnaSchema.safeParse(data?.travel_dna);
    return NextResponse.json({
      configured: true,
      loggedIn: true,
      profile: stored.success ? stored.data.profile : null,
      updatedAt: stored.success ? stored.data.updatedAt : null,
    });
  } catch (err) {
    console.error("Loading Travel DNA failed", err);
    return NextResponse.json({ configured: true, loggedIn: false, profile: null, updatedAt: null });
  }
}

export async function PUT(req: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json({ error: "Accounts aren't configured for this deployment." }, { status: 503 });
  }

  const parsed = PutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid Travel DNA", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const travelDna: StoredTravelDna = {
    version: 1,
    profile: parsed.data.profile,
    updatedAt: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, travel_dna: travelDna }, { onConflict: "id" });

  if (error) {
    console.error("Saving Travel DNA failed", error);
    // PGRST204 = unknown column, PGRST205 = unknown table: the migration in
    // supabase/schema.sql hasn't been run on this project yet.
    if (error.code === "PGRST204" || error.code === "PGRST205") {
      return NextResponse.json(
        { error: "The database isn't up to date — run supabase/schema.sql, then try again." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Couldn't save your Travel DNA." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updatedAt: travelDna.updatedAt });
}
