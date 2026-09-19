"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Fingerprint } from "lucide-react";
import { DnaChat } from "@/components/profile/dna-chat";
import { TravelDnaCard, type AccountState } from "@/components/profile/travel-dna-card";
import { AiThinking } from "@/components/trip/ai-thinking";
import { PlannerActionBar } from "@/components/trip/planner-action-bar";
import { PlannerProgress } from "@/components/trip/planner-progress";
import { useTripGeneration } from "@/components/trip/use-trip-generation";
import { formatTripRange } from "@/lib/date";
import { describeTravelDna } from "@/lib/dna-questions";
import { describeConstraints, normalizeConstraints } from "@/lib/travel-dna";
import type { TravelerProfile, TripRequest } from "@/types/trip";

// 03 — Travel Profile ("Travel DNA"). A Client Component because every
// control here is interactive: answers are held in state and sent to
// /api/trips/generate. Signed-in travelers get their saved Travel DNA
// restored and (by default) saved again, via /api/account/travel-dna.
// Once generation starts this same route renders the AI Thinking trace
// (step 3 of the planner) in place.
//
// This screen used to show all seven groups of controls at once. It asks
// one question at a time now — see components/profile/dna-chat.tsx for the
// interaction and lib/dna-questions.ts for the script. The profile shape
// this produces is unchanged, so the API, the prompt and the validation
// below it never knew the difference.

const DEFAULT_PROFILE: TravelerProfile = {
  travelerTypes: [],
  budgetTier: "comfort",
  pace: "balanced",
  walkingTolerance: "medium",
  foodPreferences: [],
  dislikes: [],
  localness: 3,
  discovery: 3,
  crowdTolerance: "medium",
  constraints: {},
};

function ProfileForm() {
  const params = useSearchParams();

  const destination = params.get("destination")?.trim() || "Paris, France";
  const startDate = params.get("startDate") || defaultDate(30);
  const endDate = params.get("endDate") || defaultDate(34);
  const travelers = Number(params.get("travelers") || 2);

  const [draft, setDraft] = useState<TravelerProfile>(DEFAULT_PROFILE);
  const [account, setAccount] = useState<AccountState>("checking");
  const [restored, setRestored] = useState(false);
  const [saveToAccount, setSaveToAccount] = useState(true);
  // Any interaction before the saved Travel DNA arrives wins over it.
  const touched = useRef(false);

  const { status, error, generate } = useTripGeneration();

  useEffect(() => {
    let cancelled = false;

    fetch("/api/account/travel-dna")
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (cancelled) return;
        if (!payload?.configured) return setAccount("unavailable");
        if (!payload.loggedIn) return setAccount("signed-out");
        setAccount("signed-in");

        const saved = payload.profile as TravelerProfile | null;
        if (!saved || touched.current) return;
        setDraft({ ...DEFAULT_PROFILE, ...saved });
        setRestored(true);
      })
      .catch(() => {
        if (!cancelled) setAccount("unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Functional update, never a merge off the render closure: two taps
  // landing in the same React batch (an easy double-tap on a phone) would
  // both read the *same* stale profile, so the second write would silently
  // throw away the first answer.
  function patch(next: Partial<TravelerProfile>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  const profile: TravelerProfile = {
    ...draft,
    foodPreferences: draft.foodPreferences.map((f) => f.toLowerCase()),
    constraints: normalizeConstraints(draft.constraints ?? {}),
  };

  const request: TripRequest = { destination, startDate, endDate, travelers, profile };

  async function handleGenerate() {
    if (account === "signed-in" && saveToAccount) {
      // Fire-and-forget: saving the profile must never hold up, or break,
      // building the trip.
      void fetch("/api/account/travel-dna", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      }).catch(() => {});
    }
    // No pre-flight paywall check: the trip gets built first so the
    // traveler watches it happen, and /api/trips/generate decides at the
    // end whether to hand over the itinerary or just a preview plus a
    // redirect to /unlock. useTripGeneration routes either outcome.
    await generate(request);
  }

  if (status === "generating") {
    return <AiThinking request={request} />;
  }

  const dna = describeTravelDna(profile);
  const canGenerate = profile.travelerTypes.length > 0;
  const stepOneHref = `/create-trip?destination=${encodeURIComponent(destination)}`;
  const selfHref = `/profile?${params.toString()}`;

  return (
    <main
      className="mx-auto max-w-[1440px] px-5 pb-32 lg:px-12"
      onPointerDownCapture={() => (touched.current = true)}
      onKeyDownCapture={() => (touched.current = true)}
    >
      <PlannerProgress
        current={2}
        title="Discovering your travel DNA"
        subtitle={
          <>
            {destination} · {formatTripRange(startDate, endDate)} · {travelers}{" "}
            {travelers === 1 ? "traveler" : "travelers"}
          </>
        }
        hrefs={{ 1: stepOneHref }}
      />

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <DnaChat
            profile={draft}
            onChange={patch}
            startAtEnd={restored}
            finale={
              <section className="roam-rise rounded-lg bg-surface p-6 shadow-card">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-deep text-sunset shadow-card">
                  <Fingerprint className="h-4 w-4" aria-hidden="true" />
                </span>
                <h2 className="mt-3 font-display text-xl font-bold tracking-tight text-accent sm:text-2xl">
                  That&apos;s your Travel DNA.
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  {canGenerate
                    ? "Every day RoamAI builds is checked against it — your pace decides how many stops fit, and your hard rules are enforced in code, not just suggested."
                    : "Go back one step and pick at least one traveler type — it's the answer everything else is built around."}
                </p>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className="group mt-5 inline-flex items-center gap-2 rounded bg-accent px-5 py-3 font-display text-sm font-semibold text-paper shadow-card transition-transform hover:bg-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
                >
                  Build my trip
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 text-sunset transition-transform duration-300 group-hover:translate-x-1"
                  />
                </button>
              </section>
            }
          />
        </div>

        {/* Capped to the space between the header and the action bar, so the
            rules and the save toggle at the bottom are always reachable. */}
        <aside className="lg:sticky lg:top-24 lg:col-span-5 lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto lg:rounded-lg">
          <TravelDnaCard
            dna={dna}
            destination={destination}
            interests={profile.travelerTypes.length}
            rules={describeConstraints(profile.constraints)}
            account={account}
            restored={restored}
            saveToAccount={saveToAccount}
            onSaveToAccountChange={setSaveToAccount}
            loginHref={`/unlock?next=${encodeURIComponent(selfHref)}`}
          />
        </aside>
      </div>

      {error ? (
        <p
          role="alert"
          className="fixed inset-x-5 bottom-24 z-30 mx-auto max-w-xl rounded-md border border-warm bg-warm-soft px-4 py-3 text-sm text-warm shadow-lift"
        >
          {error}
        </p>
      ) : null}

      <PlannerActionBar
        start={
          <Link
            href={stepOneHref}
            className="inline-flex items-center gap-1.5 rounded px-3 py-2 font-display text-sm font-semibold text-muted transition-colors hover:bg-accent-soft hover:text-accent"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Back to destination</span>
          </Link>
        }
        end={
          <>
            <span className="hidden text-right md:block" aria-live="polite">
              <span className="block font-mono text-[0.6rem] font-bold uppercase tracking-widest text-muted">
                {canGenerate ? "Your travel DNA" : "One more thing"}
              </span>
              <span className="block font-display text-sm font-bold text-accent">
                {canGenerate ? dna.title : "Pick a traveler type to continue"}
              </span>
            </span>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="group inline-flex items-center gap-2 rounded bg-accent px-5 py-3 font-display text-sm font-semibold text-paper shadow-card transition-transform hover:bg-deep active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
            >
              Build my trip
              <ArrowRight
                aria-hidden="true"
                className="h-4 w-4 text-sunset transition-transform duration-300 group-hover:translate-x-1 group-disabled:translate-x-0"
              />
            </button>
          </>
        }
      />
    </main>
  );
}

function defaultDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={<main className="mx-auto max-w-xl px-6 py-20 text-muted">Loading…</main>}
    >
      <ProfileForm />
    </Suspense>
  );
}
