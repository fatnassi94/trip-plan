"use client";

import { useRef } from "react";

// A slider, not a segmented control: feedback from testing was that three
// side-by-side buttons didn't read as something you *set* — it looked
// like three separate choices rather than one value you drag along a
// scale. A native <input type="range"> fixes that by construction: it's
// unambiguously an input (a handle you can drag or type-to-focus-and-
// arrow), and it comes with keyboard support (arrow keys, Home/End,
// Page Up/Down), touch dragging, and screen-reader value announcements
// for free — a hand-rolled slider would have to reimplement all of that.
//
// The underlying value is still one of the app's existing budget tiers
// (see types/trip.ts BudgetTier) — this only changes how you set it, not
// what gets sent to the AI or saved with the trip.

export interface BudgetOption<T extends string> {
  value: T;
  label: string;
  hint: string;
  /** A short, qualitative line shown under the slider for the active tier.
   * Deliberately not a €/day number — actual costs swing too widely by
   * destination for a fixed range to be honest across the whole app. */
  description: string;
}

interface BudgetSelectorProps<T extends string> {
  options: readonly BudgetOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
}

export function BudgetSelector<T extends string>({
  options,
  value,
  onChange,
  label = "Budget",
}: BudgetSelectorProps<T>) {
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const selected = options[selectedIndex];
  const percent = options.length > 1 ? (selectedIndex / (options.length - 1)) * 100 : 0;

  const sliderRef = useRef<HTMLInputElement>(null);

  return (
    <div className="w-full max-w-sm">
      <input
        ref={sliderRef}
        type="range"
        role="slider"
        min={0}
        max={options.length - 1}
        step={1}
        value={selectedIndex}
        aria-label={label}
        aria-valuetext={`${selected.label} (${selected.hint})`}
        onChange={(e) => onChange(options[Number(e.target.value)].value)}
        className="roam-slider w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        style={{
          background: `linear-gradient(to right, hsl(var(--accent)) ${percent}%, hsl(var(--line)) ${percent}%)`,
        }}
      />

      {/* Tick labels double as click targets — clicking one jumps the
          slider straight to that tier, same as dragging the handle to it. */}
      <div className="mt-2 flex justify-between">
        {options.map((option, i) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              onChange(option.value);
              // A mouse click focuses this button by default (outside
              // Safari), which would strand a following arrow-key/Home/
              // End press on a button that doesn't handle it. The slider
              // is the one control meant to hold keyboard focus here.
              sliderRef.current?.focus();
            }}
            aria-hidden="true"
            tabIndex={-1}
            className={`flex flex-col items-center gap-0.5 text-xs transition-colors ${
              i === selectedIndex ? "font-medium text-accent" : "text-muted hover:text-accent"
            }`}
          >
            {option.label}
            <span className="font-mono text-[0.7rem] opacity-70">{option.hint}</span>
          </button>
        ))}
      </div>

      <p aria-live="polite" className="mt-3 text-sm text-ink/75">
        {selected.description}
      </p>
    </div>
  );
}
