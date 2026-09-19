"use client";

import Link from "next/link";
import { Check, Fingerprint, ShieldCheck, Sparkles } from "lucide-react";
import { RouteArt } from "@/components/brand/route-art";
import type { TravelDnaReadout } from "@/lib/dna-questions";

// The Travel DNA read-out: archetype, the route-art plate, the live
// profile bars, the hard rules, and the save-to-account control.
//
// Lifted out of app/profile/page.tsx when that screen became a one-
// question-at-a-time interview. It now sits at the end of the chat as the
// thing the traveler confirms before RoamAI starts building.

export type AccountState = "checking" | "unavailable" | "signed-out" | "signed-in";

export function TravelDnaCard({
  dna,
  destination,
  interests,
  rules,
  account,
  restored,
  saveToAccount,
  onSaveToAccountChange,
  loginHref,
}: {
  dna: TravelDnaReadout;
  destination: string;
  interests: number;
  rules: string[];
  account: AccountState;
  restored: boolean;
  saveToAccount: boolean;
  onSaveToAccountChange: (value: boolean) => void;
  loginHref: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg bg-surface p-6 shadow-lift">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-warm-soft/70 blur-2xl"
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-warm">
            Generated archetype
          </p>
          {/* Keyed on the title so each change replays the entrance —
              the card visibly reacts to every choice. */}
          <h2
            key={dna.title}
            className="roam-rise mt-1 font-display text-2xl font-bold tracking-tight text-accent"
            aria-live="polite"
          >
            {dna.title}
          </h2>
        </div>
        <span className="rounded-md bg-accent-soft p-2 text-accent">
          <Fingerprint className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>

      {restored ? (
        <p className="relative mt-3 inline-flex items-center gap-1.5 rounded-full bg-deep px-3 py-1 font-display text-xs font-semibold text-sage">
          <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
          Loaded your saved Travel DNA
        </p>
      ) : null}

      <div className="relative mt-4 h-32 overflow-hidden rounded-md bg-gradient-to-br from-deep via-accent to-warm">
        <RouteArt className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-deep/80 to-transparent px-3 pb-3 pt-8 text-paper">
          <span className="flex min-w-0 items-center gap-1.5 font-display text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-sunset" aria-hidden="true" />
            <span className="truncate">Built for {destination}</span>
          </span>
          <span className="shrink-0 rounded-full bg-paper/20 px-2 py-0.5 font-mono text-[0.65rem] font-bold backdrop-blur-md">
            {interests} {interests === 1 ? "interest" : "interests"}
          </span>
        </div>
      </div>

      <p className="relative mt-4 rounded bg-accent-soft/60 p-4 text-sm leading-relaxed text-ink">
        {dna.summary}
      </p>

      <div className="relative mt-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-muted">
            Profile settings
          </p>
          <p className="font-display text-[0.7rem] font-semibold text-accent">Updates live</p>
        </div>
        {dna.metrics.map((m) => (
          <div key={m.label}>
            <div className="flex justify-between text-xs">
              <span className="text-ink">{m.label}</span>
              <span className="font-display font-bold text-accent">{m.caption}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-accent-soft">
              <div
                className={`h-full rounded-full ${m.color} transition-[width] duration-500 ease-out`}
                style={{ width: `${m.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="relative mt-5 rounded-md border border-border p-4">
        <p className="flex items-center gap-1.5 font-mono text-[0.65rem] font-bold uppercase tracking-widest text-accent">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Hard rules
        </p>
        {rules.length ? (
          <ul aria-label="Your hard rules" className="mt-2 space-y-1.5 text-sm text-ink">
            {rules.map((rule) => (
              <li key={rule} className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" strokeWidth={3} aria-hidden="true" />
                {rule}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">No hard rules yet — RoamAI will use its judgment.</p>
        )}
      </div>

      <div className="relative mt-5 border-t border-border pt-4 text-xs">
        {account === "signed-in" ? (
          <label className="flex cursor-pointer items-center gap-2.5 text-ink">
            <input
              type="checkbox"
              checked={saveToAccount}
              onChange={(e) => onSaveToAccountChange(e.target.checked)}
              className="h-4 w-4 accent-[hsl(var(--accent))]"
            />
            <span className="font-display text-sm font-semibold">Save to my account</span>
          </label>
        ) : account === "signed-out" ? (
          <Link
            href={loginHref}
            className="font-display text-sm font-semibold text-accent underline underline-offset-4 hover:text-warm"
          >
            Log in to keep your Travel DNA for next time
          </Link>
        ) : (
          <p className="flex items-center gap-2 text-muted">
            <span className="h-2 w-2 shrink-0 rounded-full bg-sage" aria-hidden="true" />
            Your {destination} itinerary is built from this profile.
          </p>
        )}
      </div>
    </div>
  );
}
