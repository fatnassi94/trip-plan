"use client";

import { useEffect, useState } from "react";
import {
  Brain,
  CalendarDays,
  Check,
  Loader2,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { RouteArt } from "@/components/brand/route-art";
import { PlannerActionBar } from "@/components/trip/planner-action-bar";
import { PlannerProgress } from "@/components/trip/planner-progress";
import { formatTripRange } from "@/lib/date";
import type { TripRequest } from "@/types/trip";

// 04 — AI Thinking, step 3 of the planner. A card per planning step with
// completed / active / queued states, an overall gauge, and the brief the
// planner is working from. The step trace advances on its own timer while
// the real request runs in useTripGeneration, so its copy describes what
// the planner works through — never fabricated live metrics. The brief
// and the elapsed clock, by contrast, are real.
const STEPS = [
  { icon: Brain, title: "Reading your travel style", detail: "Budget, pace, walking comfort and food preferences" },
  { icon: Search, title: "Exploring the destination", detail: "Neighborhoods, landmarks and places to eat" },
  { icon: Target, title: "Choosing places that fit you", detail: "Matching each candidate against your profile" },
  { icon: CalendarDays, title: "Building your days", detail: "Mornings, lunches, afternoons and evenings" },
  { icon: Route, title: "Ordering the route", detail: "Keeping stops close so you're not crossing town twice" },
  { icon: ShieldCheck, title: "Checking the plan", detail: "No overlapping times, no overloaded days" },
  { icon: Sparkles, title: "Explaining every pick", detail: "A specific reason behind each stop" },
];

export function AiThinking({ request }: { request: TripRequest }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const ticker = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }, 4000);
    const started = Date.now();
    const clock = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => {
      clearInterval(ticker);
      clearInterval(clock);
    };
  }, []);

  // Never shows 100% — the gauge only completes when the real trip arrives.
  const progress = Math.min(95, Math.round(((stepIndex + 0.5) / STEPS.length) * 100));
  const circumference = 2 * Math.PI * 20;
  const { destination, profile } = request;

  return (
    <main className="mx-auto max-w-[1440px] px-5 pb-32 lg:px-12">
      <PlannerProgress
        current={3}
        title={`Assembling your ${destination} journey…`}
        subtitle={
          <>
            {formatTripRange(request.startDate, request.endDate)} · {request.travelers}{" "}
            {request.travelers === 1 ? "traveler" : "travelers"} · Tailored to your travel DNA
          </>
        }
        status="Planning in progress"
      />

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <section className="lg:col-span-8" aria-labelledby="trace-heading">
          <div className="flex flex-col gap-4 rounded-lg bg-surface p-4 shadow-card sm:flex-row sm:items-center">
            <div className="relative h-14 w-14 shrink-0">
              <svg viewBox="0 0 48 48" className="h-14 w-14 -rotate-90" aria-hidden="true">
                <circle cx="24" cy="24" r="20" fill="none" stroke="hsl(var(--accent-soft))" strokeWidth="4" />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="hsl(var(--warm))"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - progress / 100)}
                  className="transition-[stroke-dashoffset] duration-700"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-display text-sm font-bold text-accent">
                {progress}%
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 font-mono text-[0.6rem] font-bold uppercase tracking-widest text-muted">
                <span id="trace-heading">Planning trace</span>
                <span className="text-accent">
                  Step {stepIndex + 1} of {STEPS.length}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-accent-soft">
                <div
                  className="roam-shimmer h-full rounded-full bg-warm transition-[width] duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-sunset" aria-hidden="true" />
                {STEPS[stepIndex].title}…
              </p>
            </div>
          </div>

          <ol className="mt-4 space-y-3" aria-live="polite">
            {STEPS.map((step, i) => {
              const state = i < stepIndex ? "done" : i === stepIndex ? "active" : "queued";
              return (
                <li
                  key={step.title}
                  className={`relative flex items-start gap-4 overflow-hidden rounded-lg p-4 transition-all duration-500 ${
                    state === "queued" ? "bg-accent-soft/40" : "bg-surface shadow-card"
                  } ${state === "active" ? "shadow-lift" : ""}`}
                >
                  {state === "active" ? (
                    <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-sunset" />
                  ) : null}
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded transition-colors duration-500 ${
                      state === "active"
                        ? "bg-sunset text-paper shadow-card"
                        : state === "done"
                          ? "bg-accent-soft text-accent"
                          : "bg-accent-soft/70 text-muted"
                    }`}
                  >
                    <step.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span
                          className={`font-display text-base font-semibold ${
                            state === "queued" ? "text-muted" : "text-accent"
                          }`}
                        >
                          {step.title}
                        </span>
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[0.6rem] font-bold text-muted">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                      </span>
                      {state === "done" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-deep px-2.5 py-0.5 font-mono text-[0.65rem] font-bold text-sage">
                          <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                          Completed
                        </span>
                      ) : state === "active" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-sunset px-2.5 py-0.5 font-mono text-[0.65rem] font-bold text-paper">
                          <span className="roam-pulse h-1.5 w-1.5 rounded-full bg-paper" aria-hidden="true" />
                          In progress
                        </span>
                      ) : (
                        <span className="rounded-full bg-accent-soft px-2.5 py-0.5 font-mono text-[0.65rem] font-bold text-muted">
                          Queued
                        </span>
                      )}
                    </div>
                    <p className={`mt-1 text-sm ${state === "queued" ? "text-muted/80" : "text-muted"}`}>
                      {step.detail}
                    </p>
                    {state === "active" ? (
                      <div className="mt-3 h-1 overflow-hidden rounded-full bg-accent-soft">
                        <div className="roam-shimmer h-full w-2/3 rounded-full bg-sunset/60" />
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* The brief: exactly what was sent to the planner, so the wait is
            visibly about *this* traveler's trip. */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:col-span-4">
          <div className="overflow-hidden rounded-lg bg-surface shadow-lift">
            <div className="relative h-32 bg-gradient-to-br from-deep via-accent to-warm">
              <RouteArt className="absolute inset-0 h-full w-full" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-deep/85 to-transparent px-4 pb-3 pt-8 text-paper">
                <p className="font-mono text-[0.6rem] font-bold uppercase tracking-widest text-warm-soft">
                  Trip brief
                </p>
                <p className="truncate font-display text-lg font-bold">{destination}</p>
              </div>
            </div>
            <div className="p-4">
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <BriefItem icon={CalendarDays} label="Dates" value={formatTripRange(request.startDate, request.endDate)} wide />
                <BriefItem icon={Users} label="Travelers" value={String(request.travelers)} />
                <BriefItem label="Budget" value={capitalize(profile.budgetTier)} />
                <BriefItem label="Pace" value={capitalize(profile.pace)} />
                <BriefItem label="Walking" value={capitalize(profile.walkingTolerance)} />
              </dl>
              <TagRow label="Traveler type" tags={profile.travelerTypes} />
              <TagRow label="Food" tags={profile.foodPreferences.map(capitalize)} />
              <TagRow label="Avoiding" tags={profile.dislikes} tone="warm" />
            </div>
          </div>

          <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-accent-soft/70 via-surface to-warm-soft/40 p-4 shadow-card">
            <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-warm" />
            <p className="flex items-center gap-2 font-display text-sm font-bold text-accent">
              <Sparkles className="h-4 w-4 text-sunset" aria-hidden="true" />
              Why this takes a minute
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Nothing reaches you until it passes checks: no overlapping times, and every stop
              has to carry a specific reason tied to your profile.
            </p>
          </div>
        </aside>
      </div>

      <PlannerActionBar
        start={
          <>
            <span className="relative flex h-3 w-3 shrink-0" aria-hidden="true">
              <span className="absolute inset-0 animate-ping rounded-full bg-sunset/60" />
              <span className="relative h-3 w-3 rounded-full bg-sunset" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-sm font-bold text-accent">
                Compiling your day-by-day schedule…
              </span>
              <span className="hidden text-xs text-muted sm:block">
                This can take up to a minute. Keep this tab open.
              </span>
            </span>
          </>
        }
        end={
          <span className="text-right">
            <span className="block font-mono text-[0.6rem] font-bold uppercase tracking-widest text-muted">
              Elapsed
            </span>
            <span className="block font-display text-sm font-bold tabular-nums text-accent" role="timer">
              {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
            </span>
          </span>
        }
      />
    </main>
  );
}

function capitalize(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function BriefItem({
  icon: Icon,
  label,
  value,
  wide,
}: {
  icon?: typeof Users;
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={`rounded bg-accent-soft/50 px-3 py-2 ${wide ? "col-span-2" : ""}`}>
      <dt className="flex items-center gap-1 font-mono text-[0.6rem] font-bold uppercase tracking-widest text-muted">
        {Icon ? <Icon className="h-3 w-3" aria-hidden="true" /> : null}
        {label}
      </dt>
      <dd className="mt-0.5 font-display text-sm font-semibold text-accent">{value}</dd>
    </div>
  );
}

function TagRow({
  label,
  tags,
  tone = "accent",
}: {
  label: string;
  tags: string[];
  tone?: "accent" | "warm";
}) {
  if (tags.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="font-mono text-[0.6rem] font-bold uppercase tracking-widest text-muted">{label}</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <li
            key={tag}
            className={`rounded-full px-2.5 py-1 font-display text-[0.7rem] font-semibold ${
              tone === "warm" ? "bg-warm-soft text-warm" : "bg-accent-soft text-accent"
            }`}
          >
            {tag}
          </li>
        ))}
      </ul>
    </div>
  );
}
