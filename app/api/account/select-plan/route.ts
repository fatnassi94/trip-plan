import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionClient } from "@/lib/supabase/server";
import { isAuthConfigured } from "@/lib/supabase/config";

// Attaches a plan to the CURRENTLY AUTHENTICATED user — called right
// after AuthForm establishes a session (see app/unlock/page.tsx). The
// user is derived from the session cookie, never from the request body
// (see `auth-security`: "Never trust a userId field sent in a request
// body").
//
// No real payment provider exists yet (see lib/plans.ts) — this is the
// mock purchase: selecting a plan immediately marks the subscription
// active. Swap the upsert below for a real checkout webhook handler
// later; nothing that reads plan_type/subscription_status needs to change.

const BodySchema = z.object({ planType: z.enum(["single", "basic", "pro"]) });

export async function POST(req: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json({ error: "Auth isn't configured for this deployment." }, { status: 503 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const supabase = createSessionClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Session client, not service-role: RLS's "profiles: owner read/write"
  // policy (`with check (auth.uid() = id)`) already allows a user to
  // upsert their own row — no reason to reach for a higher-privilege
  // client for a write this narrowly scoped (see `database-security`).
  const { error } = await supabase
    .from("profiles")
    .upsert(
      { id: user.id, plan_type: parsed.data.planType, subscription_status: "active" },
      { onConflict: "id" },
    );

  if (error) {
    console.error("Failed to attach plan", error);

    // PGRST205 = PostgREST can't find the table. That means supabase/schema.sql
    // was never run against this project, which is a setup problem the
    // person clicking the button can actually act on — a generic
    // "couldn't save your plan" hides the one fact that would fix it.
    if (error.code === "PGRST205") {
      return NextResponse.json(
        {
          error:
            "The database isn't set up yet — run supabase/schema.sql in the Supabase SQL editor, then try again.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: `Couldn't save your plan: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, planType: parsed.data.planType });
}
