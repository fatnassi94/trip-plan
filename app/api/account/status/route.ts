import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { isAuthConfigured } from "@/lib/supabase/config";
import type { AccountStatus } from "@/types/account";

// This is a parameterless GET handler, which Next.js will otherwise try
// to statically optimize at build time — meaning it would execute this
// route ONCE during `next build`, bake in whatever it returned then
// (with isAuthConfigured() false in a build environment with no
// NEXT_PUBLIC_SUPABASE_ANON_KEY set, that's an early return that never
// touches cookies()), and serve that single cached response to every
// visitor forever. This route's entire purpose is "read THIS request's
// session", so it must never be cached.
export const dynamic = "force-dynamic";

// The single source of truth for "does this visitor need to go through
// /unlock" — called from app/profile/page.tsx before generating, and
// usable anywhere else that needs the same answer. Deliberately a GET
// endpoint rather than a client-side Supabase query directly from
// ProfileForm: it's the same check the server-side enforcement in
// app/api/trips/generate/route.ts makes, so there's exactly one
// definition of "has an active plan" instead of two that could drift.
export async function GET() {
  if (!isAuthConfigured()) {
    const body: AccountStatus = {
      loggedIn: false,
      hasActivePlan: false,
      planType: null,
      authConfigured: false,
    };
    return NextResponse.json(body);
  }

  try {
    const supabase = createSessionClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const body: AccountStatus = {
        loggedIn: false,
        hasActivePlan: false,
        planType: null,
        authConfigured: true,
      };
      return NextResponse.json(body);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("plan_type, subscription_status")
      .eq("id", user.id)
      .maybeSingle();

    const body: AccountStatus = {
      loggedIn: true,
      hasActivePlan: profile?.subscription_status === "active" && !!profile?.plan_type,
      planType: (profile?.plan_type as AccountStatus["planType"]) ?? null,
      authConfigured: true,
    };
    return NextResponse.json(body);
  } catch (err) {
    // A misconfigured/unreachable Supabase project shouldn't crash the
    // planning flow — fail toward "needs to unlock" rather than a 500,
    // same reasoning as the generate route's own enforcement below.
    console.error("Account status check failed", err);
    const body: AccountStatus = {
      loggedIn: false,
      hasActivePlan: false,
      planType: null,
      authConfigured: true,
    };
    return NextResponse.json(body);
  }
}
