"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { PLANS, type PlanId } from "@/lib/plans";
import { PlanCard } from "@/components/plans/plan-card";
import { AuthForm } from "@/components/auth/auth-form";
import { LogoutButton } from "@/components/auth/logout-button";
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
      <main className="mx-auto max-w-2xl px-6 py-20">
        <p className="text-sm text-muted" role="status" aria-live="polite">
          {phase === "checking" ? "Loading…" : "Opening your trip…"}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">
        {preview ? "Your trip is ready" : "Almost there"}
      </p>
      <h1 className="mt-3 font-display text-3xl font-semibold text-balance">
        {phase === "unauthenticated"
          ? preview
            ? "Create an account to unlock your personalized trip plan."
            : "Log in or create an account to see your profile."
          : "Choose a plan to unlock your personalized trip plan."}
      </h1>

      {/* The trip they just watched get built — proof it's real, with
          nothing in it they could actually travel on. Shown in both
          phases: it's the reason they're here. */}
      {preview ? (
        <section className="mt-8 rounded-lg border border-border bg-accent-soft/25 p-5">
          <p className="font-display text-xl font-semibold">{preview.destination}</p>
          <p className="mt-1 text-sm text-muted">
            {preview.startDate} → {preview.endDate} · {preview.dayCount}{" "}
            {preview.dayCount === 1 ? "day" : "days"} · {preview.totalStops} stops ·{" "}
            {preview.travelers} {preview.travelers === 1 ? "traveler" : "travelers"}
          </p>

          <ol className="mt-5 flex flex-col gap-2">
            {preview.dayTitles.map((title, i) => (
              <li key={`${title}-${i}`} className="flex items-baseline gap-3 text-sm">
                <span className="font-mono text-xs text-accent">Day {i + 1}</span>
                <span className="flex-1">{title}</span>
              </li>
            ))}
          </ol>

          <p className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Times, places, maps and the reason behind every pick unlock below.
          </p>
        </section>
      ) : null}

      {phase === "unauthenticated" && !preview ? (
        <p className="mt-4 text-sm text-muted">
          No trip in progress.{" "}
          <Link href="/create-trip" className="text-accent underline underline-offset-4">
            Plan one
          </Link>
          .
        </p>
      ) : null}

      {/* ── Step 4: unauthenticated sees auth ONLY. No pricing. ── */}
      {phase === "unauthenticated" ? (
        <div className="mt-10">
          <AuthForm onAuthenticated={handleAuthenticated} />
        </div>
      ) : (
        /* ── Step 5: signed in, so now (and only now) the plans. ── */
        <>
          <h2 className="mt-10 font-mono text-xs uppercase tracking-widest text-muted">
            Choose a plan
          </h2>
          <div
            role="radiogroup"
            aria-label="Choose a plan"
            aria-busy={phase === "working"}
            className="mt-4 grid gap-4 sm:grid-cols-3"
          >
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                selected={pendingPlan === plan.id}
                busy={phase === "working"}
                onSelect={() => handleSelectPlan(plan.id)}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted" role="status" aria-live="polite">
              {phase === "working"
                ? "Processing your purchase…"
                : "Choosing a plan completes your purchase and unlocks your trip."}
            </p>
            {/* Signed in as the wrong account shouldn't be a dead end. */}
            <LogoutButton className="text-xs" />
          </div>
        </>
      )}

      {error ? (
        <p className="mt-4 rounded-md border border-warm bg-warm-soft px-4 py-3 text-sm text-warm">
          {error}
        </p>
      ) : null}
    </main>
  );
}
