import Link from "next/link";
import { createSessionClient } from "@/lib/supabase/server";
import { isAuthConfigured } from "@/lib/supabase/config";
import { findPlan, type PlanId } from "@/lib/plans";
import { TripRating } from "@/components/account/trip-rating";
import { LogoutButton } from "@/components/auth/logout-button";

// Every visitor's own plan and trips — this page must run per-request,
// never be prerendered to static HTML. Without this, Next.js statically
// optimizes it: the isAuthConfigured() early return below never touches
// cookies() when no Supabase anon key is set in the BUILD environment, so
// the build would bake in one "sign-in isn't configured" snapshot and
// serve it to every visitor forever, even after real credentials are set
// at runtime. Same failure mode as app/api/account/status/route.ts.
export const dynamic = "force-dynamic";

// The user's own account page: current plan + past trips with
// satisfaction ratings. NOT the same route as /profile, which is the
// per-trip "what kind of traveler are you" step in the golden path — the
// naming collision with a conventional "user profile" page is deliberate
// to avoid, so this lives at /account instead. A Server Component: it
// only reads data, no interactivity beyond the rating widget (its own
// client island, components/account/trip-rating.tsx).
export default async function AccountPage() {
  if (!isAuthConfigured()) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20">
        <h1 className="font-display text-2xl font-semibold">Account</h1>
        <p className="mt-3 text-sm text-muted">
          Sign-in isn&apos;t configured for this deployment yet.
        </p>
      </main>
    );
  }

  const supabase = createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20">
        <h1 className="font-display text-2xl font-semibold">Account</h1>
        <p className="mt-3 text-sm text-muted">Log in to see your plan and past trips.</p>
        <Link
          href="/unlock"
          className="mt-8 inline-flex rounded-md bg-accent px-6 py-3 font-medium text-paper hover:opacity-90"
        >
          Log in or sign up
        </Link>
      </main>
    );
  }

  const [{ data: profile }, { data: trips }] = await Promise.all([
    supabase
      .from("profiles")
      .select("plan_type, subscription_status")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("trips")
      .select("id, destination, start_date, end_date, travelers, rating, rating_comment, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const plan = findPlan(profile?.plan_type as PlanId | null | undefined);
  const isActive = profile?.subscription_status === "active" && plan;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">Account</p>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">
            {(user.user_metadata?.full_name as string | undefined) || user.email}
          </h1>
          <p className="mt-2 text-sm text-muted">{user.email}</p>
        </div>
        <LogoutButton className="mt-2" />
      </div>

      <section className="mt-8 rounded-lg border border-border p-5">
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted">Current plan</h2>
        {isActive ? (
          <p className="mt-2 font-display text-xl font-medium">
            {plan.name} · <span className="font-mono text-base text-accent">{plan.priceLabel}</span>
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-ink/75">No active plan.</p>
            <Link
              href="/unlock"
              className="mt-3 inline-flex text-sm text-accent underline underline-offset-4"
            >
              Choose a plan
            </Link>
          </>
        )}
      </section>

      <h2 className="mt-12 font-mono text-xs uppercase tracking-widest text-muted">Past trips</h2>
      {!trips || trips.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          No trips yet.{" "}
          <Link href="/create-trip" className="text-accent underline underline-offset-4">
            Plan one
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {trips.map((trip) => (
            <li key={trip.id} className="rounded-lg border border-border p-5">
              <Link
                href={`/trip/${trip.id}`}
                className="font-display text-lg font-medium hover:text-accent"
              >
                {trip.destination}
              </Link>
              <p className="mt-1 text-sm text-muted">
                {trip.start_date} → {trip.end_date} · {trip.travelers}{" "}
                {trip.travelers === 1 ? "traveler" : "travelers"}
              </p>
              <TripRating
                tripId={trip.id}
                initialRating={trip.rating}
                initialComment={trip.rating_comment}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
