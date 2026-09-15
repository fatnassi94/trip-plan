import Link from "next/link";
import { ArrowRight, CalendarDays, Crown, Plus, Users } from "lucide-react";
import { createSessionClient } from "@/lib/supabase/server";
import { isAuthConfigured } from "@/lib/supabase/config";
import { findPlan, type PlanId } from "@/lib/plans";
import { formatTripRange } from "@/lib/date";
import { RouteArt } from "@/components/brand/route-art";
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

// The user's own account page ("My Trips"): current plan + past trips with
// satisfaction ratings. NOT the same route as /profile, which is the
// per-trip "what kind of traveler are you" step in the golden path — the
// naming collision with a conventional "user profile" page is deliberate
// to avoid, so this lives at /account instead. A Server Component: it
// only reads data, no interactivity beyond the rating widget (its own
// client island, components/account/trip-rating.tsx).
export default async function AccountPage() {
  if (!isAuthConfigured()) {
    return (
      <EmptyState
        title="My trips"
        body="Sign-in isn't configured for this deployment yet."
      />
    );
  }

  const supabase = createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <EmptyState
        title="Your trips live here"
        body="Log in to see your plan, reopen past itineraries, and rate how they went."
        cta={{ href: "/unlock", label: "Log in or sign up" }}
      />
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
  const displayName = (user.user_metadata?.full_name as string | undefined) || user.email || "Traveler";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-10 lg:px-12">
      <header className="roam-rise flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent font-display text-xl font-bold text-paper shadow-card ring-4 ring-accent-soft">
            {initial}
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-warm">
              My trips
            </p>
            <h1 className="truncate font-display text-3xl font-bold tracking-tight text-accent">
              {displayName}
            </h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-muted">
              {user.email}
              <LogoutButton />
            </p>
          </div>
        </div>
        <Link
          href="/create-trip"
          className="inline-flex items-center gap-2 self-start rounded bg-accent px-5 py-3 font-display text-sm font-semibold text-paper shadow-card transition-transform hover:bg-deep active:scale-[0.98] md:self-auto"
        >
          <Plus className="h-4 w-4 text-sunset" aria-hidden="true" />
          Plan a new trip
        </Link>
      </header>

      <section
        aria-label="Current plan"
        className={`relative isolate mt-8 overflow-hidden rounded-lg p-6 shadow-card ${
          isActive ? "bg-deep text-paper" : "bg-surface"
        }`}
      >
        {isActive ? (
          <div
            aria-hidden="true"
            className="absolute -right-16 -top-16 -z-10 h-56 w-56 rounded-full bg-sunset/25 blur-3xl"
          />
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded ${
                isActive ? "bg-paper/15 text-sunset" : "bg-accent-soft text-muted"
              }`}
            >
              <Crown className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p
                className={`font-mono text-[0.65rem] font-bold uppercase tracking-widest ${
                  isActive ? "text-warm-soft" : "text-muted"
                }`}
              >
                Current plan
              </p>
              {isActive ? (
                <p className="font-display text-xl font-bold">
                  {plan.name} · <span className="text-sunset">{plan.priceLabel}</span>
                </p>
              ) : (
                <p className="font-display text-lg font-semibold text-accent">No active plan</p>
              )}
            </div>
          </div>
          {!isActive ? (
            <Link
              href="/unlock"
              className="inline-flex items-center gap-1.5 rounded bg-accent-soft px-4 py-2 font-display text-sm font-semibold text-accent transition-colors hover:bg-accent hover:text-paper"
            >
              Choose a plan
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </section>

      <div className="mt-12 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl font-bold tracking-tight text-accent">Past trips</h2>
        {trips?.length ? (
          <span className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-muted">
            {trips.length} {trips.length === 1 ? "trip" : "trips"}
          </span>
        ) : null}
      </div>

      {!trips || trips.length === 0 ? (
        <div className="mt-4 rounded-lg bg-surface p-8 text-center shadow-card">
          <p className="text-sm text-muted">No trips yet.</p>
          <Link
            href="/create-trip"
            className="mt-4 inline-flex items-center gap-2 font-display text-sm font-semibold text-accent underline underline-offset-4 hover:text-warm"
          >
            Plan your first one
          </Link>
        </div>
      ) : (
        <ul className="mt-4 grid gap-5 md:grid-cols-2">
          {trips.map((trip) => (
            <li key={trip.id} className="overflow-hidden rounded-lg bg-surface shadow-card transition-shadow hover:shadow-lift">
              <Link
                href={`/trip/${trip.id}`}
                className="group relative isolate block h-32 overflow-hidden bg-gradient-to-br from-deep via-accent to-warm px-5 pb-4 pt-12 text-paper"
              >
                <RouteArt className="absolute inset-0 -z-10 h-full w-full opacity-60" />
                <span className="flex items-end justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-display text-xl font-bold">
                      {trip.destination}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-accent-soft">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatTripRange(trip.start_date, trip.end_date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" aria-hidden="true" />
                        {trip.travelers}
                      </span>
                    </span>
                  </span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper/15 backdrop-blur-md transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">Open trip</span>
                  </span>
                </span>
              </Link>
              <div className="px-5 pb-5">
                <TripRating
                  tripId={trip.id}
                  initialRating={trip.rating}
                  initialComment={trip.rating_comment}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <main className="mx-auto max-w-xl px-5 py-20">
      <div className="roam-rise relative isolate overflow-hidden rounded-xl bg-deep p-8 text-paper shadow-float">
        <RouteArt className="absolute inset-0 -z-10 h-full w-full opacity-60" />
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-warm-soft">
          My trips
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm text-accent-soft">{body}</p>
        {cta ? (
          <Link
            href={cta.href}
            className="mt-8 inline-flex items-center gap-2 rounded bg-sunset px-6 py-3 font-display font-semibold text-deep shadow-card transition-colors hover:bg-warm hover:text-paper"
          >
            {cta.label}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </main>
  );
}
