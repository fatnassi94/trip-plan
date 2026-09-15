"use client";

import { Check, Loader2 } from "lucide-react";
import type { Plan } from "@/lib/plans";

interface PlanCardProps {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
  /** A purchase is already in flight — every card locks so a second
   * click can't start another one. */
  busy?: boolean;
  /** Entrance stagger in milliseconds. */
  delay?: number;
}

// role="radio" in a role="radiogroup" (see the parent's rendering) —
// exactly one plan can be chosen at a time, same reasoning as
// components/profile/budget-selector.tsx's earlier segmented control.
export function PlanCard({ plan, selected, onSelect, busy, delay = 0 }: PlanCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={busy}
      onClick={onSelect}
      style={{ animationDelay: `${delay}ms` }}
      className={`roam-rise relative flex flex-col overflow-hidden rounded-lg p-6 text-left transition-[box-shadow,transform] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed ${
        plan.highlight ? "bg-deep text-paper" : "bg-surface"
      } ${
        selected ? "shadow-float ring-2 ring-sunset" : "shadow-card hover:-translate-y-0.5 hover:shadow-lift"
      } ${busy && !selected ? "opacity-50" : ""}`}
    >
      {plan.highlight ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-sunset/25 blur-3xl"
        />
      ) : null}

      <div className="relative flex items-start justify-between gap-2">
        <div>
          {plan.highlight ? (
            <span className="mb-3 inline-flex rounded-full bg-sunset px-2.5 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-widest text-deep">
              Cheapest
            </span>
          ) : null}
          <p className={`font-display text-xl font-bold ${plan.highlight ? "" : "text-accent"}`}>
            {plan.name}
          </p>
          <p className={`mt-1 text-sm ${plan.highlight ? "text-accent-soft" : "text-muted"}`}>
            {plan.tagline}
          </p>
        </div>
        {selected ? (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sunset text-deep">
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
            )}
          </span>
        ) : null}
      </div>

      <p className={`relative mt-5 font-display text-3xl font-bold tracking-tight ${plan.highlight ? "text-sunset" : "text-accent"}`}>
        {plan.priceLabel}
      </p>
      <p
        className={`relative mt-0.5 font-mono text-[0.65rem] font-bold uppercase tracking-widest ${
          plan.highlight ? "text-accent-soft/80" : "text-muted"
        }`}
      >
        {plan.interval === "one-time" ? "one-time payment" : "per month"}
      </p>

      <ul className={`relative mt-5 flex flex-col gap-2 text-sm ${plan.highlight ? "text-accent-soft" : "text-ink"}`}>
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2">
            <Check
              className={`mt-0.5 h-4 w-4 shrink-0 ${plan.highlight ? "text-sage" : "text-warm"}`}
              strokeWidth={3}
              aria-hidden="true"
            />
            {feature}
          </li>
        ))}
      </ul>
    </button>
  );
}
