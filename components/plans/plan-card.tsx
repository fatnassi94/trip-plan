"use client";

import { Check } from "lucide-react";
import type { Plan } from "@/lib/plans";

interface PlanCardProps {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
  /** A purchase is already in flight — every card locks so a second
   * click can't start another one. */
  busy?: boolean;
}

// role="radio" in a role="radiogroup" (see the parent's rendering) —
// exactly one plan can be chosen at a time, same reasoning as
// components/profile/budget-selector.tsx's earlier segmented control.
export function PlanCard({ plan, selected, onSelect, busy }: PlanCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={busy}
      onClick={onSelect}
      className={`flex flex-col rounded-lg border p-5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed ${
        selected
          ? "border-accent bg-accent-soft/40 ring-1 ring-accent"
          : "border-border hover:border-accent"
      } ${busy && !selected ? "opacity-50" : ""}`}
    >
      {plan.highlight ? (
        <span className="mb-3 w-fit rounded-full bg-accent px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-widest text-paper">
          Cheapest
        </span>
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-xl font-semibold">{plan.name}</p>
          <p className="mt-1 text-sm text-muted">{plan.tagline}</p>
        </div>
        {selected ? (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-paper">
            <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
          </span>
        ) : null}
      </div>

      <p className="mt-4 font-mono text-2xl text-accent">{plan.priceLabel}</p>
      <p className="mt-0.5 font-mono text-[0.7rem] uppercase tracking-widest text-muted">
        {plan.interval === "one-time" ? "one-time payment" : "per month"}
      </p>

      <ul className="mt-4 flex flex-col gap-1.5 text-sm text-ink/75">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2">
            <span className="text-accent" aria-hidden="true">
              ·
            </span>
            {feature}
          </li>
        ))}
      </ul>
    </button>
  );
}
