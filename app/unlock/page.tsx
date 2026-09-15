"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2, Lock, MapPin, Users } from "lucide-react";
import { PLANS, type PlanId } from "@/lib/plans";
import { formatTripRange } from "@/lib/date";
import { RouteArt } from "@/components/brand/route-art";
import { PlanCard } from "@/components/plans/plan-card";
import { AuthForm } from "@/components/auth/auth-form";
import { LogoutButton } from "@/components/auth/logout-button";
import { PlannerProgress } from "@/components/trip/planner-progress";
import { cacheTrip } from "@/lib/trip-store";
import { readLockedTrip, clearLockedTrip, type LockedTrip } from "@/lib/pending-trip";
import type { AccountStatus } from "@/types/account";
import type { Trip } from "@/types/trip";

// The paywall, as an explicit state machine:
//
//   checking ──► unauthenticated ──(auth succeeds)──► plans ──► working ──► done
//        │                                             ▲
//        └──────────(already signed in)────────────────┘
//
// The ordering rule that drives the whole file: PLANS ARE NEVER RENDERED
// UNTIL AUTH IS RESOLVED. `phase` starts at "checking" and only a
// completed /api/account/status response can move it on, so there is no
// first paint — server-rendered or hydrated — in which a logged-out
// visitor can see pricing. Deriving the screen from one `phase` value
// rather than from several booleans is what makes that guarantee
// checkable by reading the render, instead of something to hope for.
type Phase =
  | "checking" // resolving who this is; render nothing but a placeholder
  | "unauthenticated" // log in / sign up, and nothing else
  | "plans" // signed in, no active plan: choose one
  | "working" // a plan click is in flight, or a trip is being unlocked
  | "done"; // redirecting; keep the screen quiet

export default function UnlockPage() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("checking");
  const [locked, setLocked] = useState<LockedTrip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingPlan, setPendingPlan] = useState<PlanId | null>(null);

  // Trades the trip id for the real itinerary, now that a plan is attached.
  // Returns true when it navigated away.
  const claimAndGo = useCallback(
    async (pending: LockedTrip) => {
      const res = await fetch("/api/trips/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: pending.tripId }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Couldn't unlock your trip");

      clearLockedTrip();
      cacheTrip(pending.tripId, payload.trip as Trip);
      setPhase("done");
      router.push(`/trip/${pending.tripId}`);
    },
    [router],
  );

  // Step 2 of the intended flow: resolve auth before showing anything.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const pending = readLockedTrip();
      if (!cancelled) setLocked(pending);

      let status: AccountStatus | null = null;
      try {
        const res = await fetch("/api/account/status");
        status = (await res.json()) as AccountStatus;
      } catch {
        status = null;
      }
      if (cancelled) return;

      if (!status?.loggedIn) {
        setPhase("unauthenticated");
        return;
      }

      // Signed in already. If they've also already paid, there is nothing
      // to choose here — finish the job they came for instead of showing
      // a pricing table they don't need.
      if (status.hasActivePlan) {
        if (!pending) {
          setPhase("done");
          router.push("/account");
          return;
        }
        setPhase("working");
        try {
          await claimAndGo(pending);
        } catch (err) {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : "Something went wrong");
          setPhase("plans");
        }
        return;
      }

      setPhase("plans");
    })();

    return () => {
      cancelled = true;
    };
  }, [router, claimAndGo]);

  // Called by AuthForm the moment a session cookie exists. Re-reads status
  // rather than assuming "just authenticated" means "no plan": a returning
  // customer who logs in here already has one, and should skip the
  // pricing table entirely.
  async function handleAuthenticated() {
    setError(null);
    setPhase("working");

    try {
      const res = await fetch("/api/account/status");
      const status = (await res.json()) as AccountStatus;
      const pending = readLockedTrip();
      setLocked(pending);

      if (status.hasActivePlan) {
        if (pending) {
          await claimAndGo(pending);
        } else {
          setPhase("done");
          router.push("/account");
        }
        return;
      }

      setPhase("plans");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your account");
      setPhase("plans");
    }
  }

  // A plan card click IS the purchase (mock, see lib/plans.ts).
  async function handleSelectPlan(planId: PlanId) {
    if (phase === "working") return; // one purchase at a time
    setError(null);
    setPendingPlan(planId);
    setPhase("working");

    try {
      const res = await fetch("/api/account/select-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType: planId }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Couldn't save your plan");

      const pending = readLockedTrip();
      if (pending) {
        await claimAndGo(pending);
      } else {
        setPhase("done");
        router.push("/account");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPendingPlan(null);
      setPhase("plans");
    }
  }

  const preview = locked?.preview;

  // ── checking / done: deliberately minimal, and crucially plan-free ──
  if (phase === "checking" || phase === "done") {
    return (
      <main className="mx-auto flex max-w-2xl justify-center px-5 py-24">
        <p
          className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 font-display text-sm font-semibold text-accent shadow-card"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 animate-spin text-sunset" aria-hidden="true" />
          {phase === "checking" ? "Loading…" : "Opening your trip…"}
        </p>
      </main>
    );
  }

  const title =
    phase === "unauthenticated"
      ? preview
        ? "Create an account to unlock your personalized trip plan."
        : "Log in or create an account to see your trips."
      : "Choose a plan to unlock your personalized trip plan.";

  return (
    <main className="mx-auto max-w-[1200px] px-5 pb-12 lg:px-12">
      {/* A trip was just built: this is the last step of the planner, so
          it carries the same progress header as the steps before it. */}
      {preview ? (
        <PlannerProgress current={4} title={title} status="Ready to unlock" />
      ) : (
        <header className="roam-rise pb-6 pt-10">
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-warm">
            Almost there
          </p>
          <h1 className="mt-2 max-w-2xl font-display text-3xl font-bold tracking-tight text-accent text-balance sm:text-4xl">
            {title}
          </h1>
        </header>
      )}

      <div
        className={`grid items-start gap-6 ${
          phase === "unauthenticated" && preview ? "lg:grid-cols-12" : ""
        }`}
      >
        {/* The trip they just watched get built — proof it's real, with
            nothing in it they could actually travel on. Shown in both
            phases: it's the reason they're here. */}
        {preview ? (
          <section
            className={`relative isolate overflow-hidden rounded-xl bg-gradient-to-br from-deep via-accent to-warm p-6 text-paper shadow-float sm:p-8 ${
              phase === "unauthenticated" ? "lg:col-span-7" : ""
            }`}
          >
            <RouteArt className="absolute inset-0 -z-10 h-full w-full opacity-50" />
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-paper/15 px-2.5 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-widest backdrop-blur-md">
                Your trip is ready
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-deep/60 px-2.5 py-1 font-mono text-[0.65rem] font-bold text-warm-soft backdrop-blur-md">
                <Lock className="h-3 w-3" aria-hidden="true" />
                Locked
              </span>
            </div>
            <p className="mt-4 font-display text-3xl font-bold tracking-tight">{preview.destination}</p>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-accent-soft">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-sunset" aria-hidden="true" />
                {formatTripRange(preview.startDate, preview.endDate)}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-sunset" aria-hidden="true" />
                {preview.dayCount} {preview.dayCount === 1 ? "day" : "days"} · {preview.totalStops} stops
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-sunset" aria-hidden="true" />
                {preview.travelers} {preview.travelers === 1 ? "traveler" : "travelers"}
              </span>
            </p>

            <ol className="mt-6 grid gap-2 sm:grid-cols-2">
              {preview.dayTitles.map((dayTitle, i) => (
                <li
                  key={`${dayTitle}-${i}`}
                  className="roam-rise flex items-center gap-3 rounded-md bg-paper/10 px-3 py-2.5 ring-1 ring-paper/10 backdrop-blur-md"
                  style={{ animationDelay: `${Math.min(i, 8) * 70}ms` }}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-paper/15 font-display text-xs font-bold">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 truncate text-sm font-medium">{dayTitle}</span>
                </li>
              ))}
            </ol>

            <p className="mt-6 flex items-center gap-2 border-t border-paper/15 pt-4 text-xs text-accent-soft">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              Times, places, maps and the reason behind every pick unlock below.
            </p>
          </section>
        ) : null}

        {/* ── Step 4: unauthenticated sees auth ONLY. No pricing. ── */}
        {phase === "unauthenticated" ? (
          <div
            className={`rounded-lg bg-surface p-6 shadow-lift sm:p-8 ${
              preview ? "lg:sticky lg:top-24 lg:col-span-5" : "max-w-md"
            }`}
          >
            {!preview ? (
              <p className="mb-5 text-sm text-muted">
                No trip in progress.{" "}
                <Link href="/create-trip" className="font-semibold text-accent underline underline-offset-4 hover:text-warm">
                  Plan one
                </Link>
                .
              </p>
            ) : null}
            <AuthForm onAuthenticated={handleAuthenticated} />
          </div>
        ) : (
          /* ── Step 5: signed in, so now (and only now) the plans. ── */
          <section aria-labelledby="plans-heading">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-warm">
                  Plans
                </p>
                <h2 id="plans-heading" className="mt-1 font-display text-2xl font-bold tracking-tight text-accent">
                  Choose a plan
                </h2>
              </div>
              {/* Signed in as the wrong account shouldn't be a dead end. */}
              <LogoutButton className="text-xs" />
            </div>
            <div
              role="radiogroup"
              aria-label="Choose a plan"
              aria-busy={phase === "working"}
              className="mt-4 grid gap-4 sm:grid-cols-3"
            >
              {PLANS.map((plan, i) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  selected={pendingPlan === plan.id}
                  busy={phase === "working"}
                  onSelect={() => handleSelectPlan(plan.id)}
                  delay={i * 90}
                />
              ))}
            </div>
            <p className="mt-4 flex items-center gap-2 text-xs text-muted" role="status" aria-live="polite">
              {phase === "working" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-sunset" aria-hidden="true" />
              ) : null}
              {phase === "working"
                ? "Processing your purchase…"
                : "Choosing a plan completes your purchase and unlocks your trip."}
            </p>
          </section>
        )}
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-md border border-warm bg-warm-soft px-4 py-3 text-sm text-warm">
          {error}
        </p>
      ) : null}
    </main>
  );
}
