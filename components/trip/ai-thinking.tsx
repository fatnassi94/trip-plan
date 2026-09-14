"use client";

import { useEffect, useState } from "react";

// The "AI Thinking" trace from the project plan — a visible sequence of
// agent steps instead of a bare spinner. Purely presentational: it cycles
// on its own timer while the real request is in flight elsewhere.
//
// Extracted out of app/profile/page.tsx so app/unlock/page.tsx can show
// the exact same trust-building moment after a fresh signup, rather than
// jumping straight from an auth form to a finished itinerary — reused,
// not reinvented, per the request to keep the design language consistent.
const THINKING_STEPS = [
  "Understanding your travel style",
  "Exploring the destination",
  "Choosing places that fit you",
  "Building your itinerary",
  "Optimizing your route",
  "Writing the reason behind each pick",
];

export function AiThinking({ destination }: { destination: string }) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const ticker = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, THINKING_STEPS.length - 1));
    }, 2500);
    return () => clearInterval(ticker);
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-20">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">
        Building your perfect trip
      </p>
      <h1 className="mt-3 font-display text-3xl font-semibold">{destination}</h1>
      <ol className="mt-10 flex flex-col gap-3" aria-live="polite">
        {THINKING_STEPS.map((step, i) => (
          <li
            key={step}
            className={`flex items-center gap-3 text-sm transition-opacity ${
              i <= stepIndex ? "opacity-100" : "opacity-35"
            }`}
          >
            <span className="font-mono text-accent" aria-hidden="true">
              {i < stepIndex ? "✓" : "✦"}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <p className="mt-10 text-sm text-muted">
        This usually takes 10–30 seconds on the free tier.
      </p>
    </main>
  );
}
