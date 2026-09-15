import Link from "next/link";
import { Check } from "lucide-react";

// The golden path's progress header, shared by every planning step:
// Destination (/create-trip) → Travel DNA (/profile) → Building (AI
// Thinking) → Itinerary (/trip/[id]). One component so the step names,
// numbering and percentages can never drift apart between screens.
//
// A Server-Component-safe presentational piece: no state, no effects.
// Completed steps become links only when the page passes an href that
// carries the traveler's answers back (e.g. step 1 with ?destination=).

export const PLANNER_STEPS = [
  { label: "Destination", hint: "Where & when" },
  { label: "Travel DNA", hint: "How you travel" },
  { label: "Building", hint: "Your trip takes shape" },
  { label: "Itinerary", hint: "Day by day" },
] as const;

export type PlannerStep = 1 | 2 | 3 | 4;

export function PlannerProgress({
  current,
  title,
  subtitle,
  hrefs = {},
  status,
}: {
  current: PlannerStep;
  title: string;
  subtitle?: React.ReactNode;
  /** Links for completed steps, so a traveler can go back without losing answers. */
  hrefs?: Partial<Record<PlannerStep, string>>;
  /** Short live-status line for the pill, e.g. "Planning in progress". */
  status?: string;
}) {
  const percent = Math.round((current / PLANNER_STEPS.length) * 100);
  const step = PLANNER_STEPS[current - 1];

  return (
    <header className="pb-6 pt-8 lg:pt-10">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="roam-rise min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-mono text-[0.65rem] font-bold uppercase tracking-widest text-muted">
            <span className="text-warm">Trip planner</span>
            <span aria-hidden="true">/</span>
            <span className="text-accent">
              Step {current} of {PLANNER_STEPS.length} · {step.label}
            </span>
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-accent text-balance sm:text-4xl">
            {title}
          </h1>
          {subtitle ? <p className="mt-2 text-muted">{subtitle}</p> : null}
        </div>

        <div
          className="roam-rise flex shrink-0 items-center gap-3 self-start rounded-full bg-surface px-4 py-2 shadow-card md:self-auto"
          style={{ animationDelay: "120ms" }}
        >
          <span className="flex items-center gap-1.5 font-display text-xs font-semibold text-muted">
            <span className="roam-pulse h-2 w-2 rounded-full bg-sage" aria-hidden="true" />
            {status ?? step.hint}
          </span>
          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-accent-soft" aria-hidden="true">
            <span
              className="roam-grow block h-full rounded-full bg-warm"
              style={{ width: `${percent}%` }}
            />
          </span>
          <span className="font-display text-xs font-bold text-accent">{percent}%</span>
        </div>
      </div>

      <nav aria-label="Trip planning progress" className="mt-6">
        <ol className="grid grid-cols-4 gap-2 sm:gap-3">
          {PLANNER_STEPS.map((s, i) => {
            const n = (i + 1) as PlannerStep;
            const state = n < current ? "done" : n === current ? "current" : "upcoming";
            const href = state === "done" ? hrefs[n] : undefined;

            const inner = (
              <>
                <span
                  aria-hidden="true"
                  className="block h-1 overflow-hidden rounded-full bg-accent-soft"
                >
                  <span
                    className={`roam-grow block h-full rounded-full ${
                      state === "done" ? "w-full bg-accent" : state === "current" ? "w-1/2 bg-sunset" : "w-0"
                    }`}
                    style={{ animationDelay: `${i * 120}ms` }}
                  />
                </span>
                <span className="mt-2.5 flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-display text-[0.7rem] font-bold transition-colors ${
                      state === "done"
                        ? "bg-accent text-paper"
                        : state === "current"
                          ? "bg-sunset text-paper ring-4 ring-sunset/20"
                          : "bg-accent-soft text-muted"
                    }`}
                  >
                    {state === "done" ? (
                      <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                    ) : (
                      n
                    )}
                  </span>
                  <span className="hidden min-w-0 sm:block">
                    <span
                      className={`block truncate font-display text-sm font-semibold ${
                        state === "upcoming" ? "text-muted" : "text-accent"
                      }`}
                    >
                      {s.label}
                    </span>
                    <span className="block truncate text-xs text-muted">{s.hint}</span>
                  </span>
                </span>
                <span className="sr-only">
                  {s.label}
                  {state === "done" ? " (completed)" : state === "current" ? " (current step)" : ""}
                </span>
              </>
            );

            return (
              <li key={s.label} aria-current={state === "current" ? "step" : undefined}>
                {href ? (
                  <Link
                    href={href}
                    className="block rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent [&:hover_.font-display]:text-warm"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div>{inner}</div>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </header>
  );
}
