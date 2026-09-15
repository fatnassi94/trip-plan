"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, MapPin, Minus, Plus, Users } from "lucide-react";
import { diffInDays } from "@/lib/date";
import { PlannerActionBar } from "@/components/trip/planner-action-bar";
import { DestinationAutocomplete } from "./destination-autocomplete";
import { DateRangePicker, type DateRange, toISODate } from "./date-range-picker";

// 02 — Create Trip's interactive shell. Lifted into its own client
// component (rather than making the whole page a client component) so
// the destination autocomplete and date range picker can share one
// validity check for the submit button — see vercel-react-best-practices
// on keeping "use client" as narrow as the interactivity requires.
//
// Still a plain GET <form action="/profile">: each control just needs a
// named field with the right value at submit time, so this stays a native
// form submission rather than a client-side useRouter().push. The submit
// button lives in the sticky action bar, which is still inside the form.

const MAX_TRAVELERS = 20;

function isoDaysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export function CreateTripForm({ initialDestination }: { initialDestination?: string }) {
  const [destination, setDestination] = useState(initialDestination ?? "Paris, France");
  const [range, setRange] = useState<DateRange>({
    start: isoDaysFromNow(30),
    end: isoDaysFromNow(34),
  });
  const [travelers, setTravelers] = useState(2);

  const canSubmit = destination.trim().length > 0 && !!range.start && !!range.end;
  const nights = range.start && range.end ? diffInDays(range.start, range.end) : null;

  function clampTravelers(n: number) {
    return Math.min(MAX_TRAVELERS, Math.max(1, Math.round(n) || 1));
  }

  return (
    <form className="flex flex-col gap-8" action="/profile" method="get">
      <label className="block">
        <FieldLabel icon={MapPin} step="01">
          Destination
        </FieldLabel>
        <div className="mt-3">
          <DestinationAutocomplete
            name="destination"
            defaultValue={destination}
            required
            onSelect={setDestination}
          />
        </div>
      </label>

      <div>
        <FieldLabel icon={CalendarDays} step="02">
          Dates
        </FieldLabel>
        <div className="mt-3">
          <DateRangePicker value={range} onChange={setRange} />
        </div>
        {/* The picker manages its own UI state; these are what the native
            GET submission actually reads for the query string. */}
        <input type="hidden" name="startDate" value={range.start ? toISODate(range.start) : ""} />
        <input type="hidden" name="endDate" value={range.end ? toISODate(range.end) : ""} />
      </div>

      <div>
        <FieldLabel icon={Users} step="03" id="travelers-label">
          Who is traveling?
        </FieldLabel>
        <div className="mt-3 flex items-center gap-4">
          <div className="flex items-center rounded border border-border bg-surface">
            <button
              type="button"
              aria-label="Remove a traveler"
              disabled={travelers <= 1}
              onClick={() => setTravelers((t) => clampTravelers(t - 1))}
              className="flex h-12 w-12 items-center justify-center rounded-l text-accent transition-colors hover:bg-accent-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <input
              type="number"
              name="travelers"
              aria-labelledby="travelers-label"
              min={1}
              max={MAX_TRAVELERS}
              value={travelers}
              onChange={(e) => setTravelers(clampTravelers(Number(e.target.value)))}
              className="h-12 w-14 border-x border-border bg-transparent text-center font-display text-lg font-bold text-accent outline-none [appearance:textfield] focus:bg-accent-soft/40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button
              type="button"
              aria-label="Add a traveler"
              disabled={travelers >= MAX_TRAVELERS}
              onClick={() => setTravelers((t) => clampTravelers(t + 1))}
              className="flex h-12 w-12 items-center justify-center rounded-r text-accent transition-colors hover:bg-accent-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <span className="text-sm text-muted">
            {travelers === 1 ? "Solo trip" : `${travelers} travelers`}
          </span>
        </div>
      </div>

      <PlannerActionBar
        start={
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded px-3 py-2 font-display text-sm font-semibold text-muted transition-colors hover:bg-accent-soft hover:text-accent"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Back to Explore</span>
          </Link>
        }
        end={
          <>
            <span className="hidden text-right sm:block" aria-live="polite">
              <span className="block font-mono text-[0.6rem] font-bold uppercase tracking-widest text-muted">
                {canSubmit ? "Your trip" : "Almost there"}
              </span>
              <span className="block font-display text-sm font-bold text-accent">
                {canSubmit && nights !== null
                  ? `${nights} ${nights === 1 ? "night" : "nights"} · ${travelers} ${travelers === 1 ? "traveler" : "travelers"}`
                  : "Pick a destination and both dates"}
              </span>
            </span>
            <button
              type="submit"
              disabled={!canSubmit}
              className="group inline-flex items-center gap-2 rounded bg-accent px-5 py-3 font-display text-sm font-semibold text-paper shadow-card transition-transform hover:bg-deep active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
            >
              {/* One text node wrapper: as separate flex items, the gap would
                  double the space before "to". */}
              <span>
                Continue<span className="hidden sm:inline"> to Travel DNA</span>
              </span>
              <ArrowRight
                className="h-4 w-4 text-sunset transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </button>
          </>
        }
      />
    </form>
  );
}

function FieldLabel({
  icon: Icon,
  step,
  id,
  children,
}: {
  icon: typeof MapPin;
  step: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded bg-accent-soft text-warm">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span>
        <span className="block font-mono text-[0.6rem] font-bold uppercase tracking-widest text-muted">
          {step}
        </span>
        <span id={id} className="block font-display text-base font-semibold text-accent">
          {children}
        </span>
      </span>
    </span>
  );
}
