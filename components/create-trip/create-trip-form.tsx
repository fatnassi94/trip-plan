"use client";

import { useState } from "react";
import { DestinationAutocomplete } from "./destination-autocomplete";
import { DateRangePicker, type DateRange, toISODate } from "./date-range-picker";

// 02 — Create Trip's interactive shell. Lifted into its own client
// component (rather than making the whole page a client component) so
// the destination autocomplete and date range picker can share one
// validity check for the submit button — see vercel-react-best-practices
// on keeping "use client" as narrow as the interactivity requires.
//
// Still a plain GET <form action="/profile">: the two new controls each
// still just need a named field with the right value at submit time, so
// this stays a native form submission rather than a client-side
// useRouter().push — no behavior change for how /profile reads its params.

function isoDaysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export function CreateTripForm() {
  const [destination, setDestination] = useState("Paris, France");
  const [range, setRange] = useState<DateRange>({
    start: isoDaysFromNow(30),
    end: isoDaysFromNow(34),
  });

  const canSubmit = destination.trim().length > 0 && !!range.start && !!range.end;

  return (
    <form className="mt-10 flex flex-col gap-6" action="/profile" method="get">
      <label className="flex flex-col gap-2 text-sm">
        Destination
        <DestinationAutocomplete
          name="destination"
          defaultValue={destination}
          required
          onSelect={setDestination}
        />
      </label>

      <div className="flex flex-col gap-2 text-sm">
        <span>Dates</span>
        <DateRangePicker value={range} onChange={setRange} />
        {/* The picker manages its own UI state; these are what the native
            GET submission actually reads for the query string. */}
        <input type="hidden" name="startDate" value={range.start ? toISODate(range.start) : ""} />
        <input type="hidden" name="endDate" value={range.end ? toISODate(range.end) : ""} />
      </div>

      <label className="flex flex-col gap-2 text-sm">
        Who is traveling?
        <input
          type="number"
          name="travelers"
          min={1}
          max={20}
          defaultValue={2}
          className="rounded-md border border-border bg-transparent px-4 py-3 outline-none focus:border-accent"
        />
      </label>

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-4 w-full rounded-md bg-accent px-6 py-3 font-medium text-paper transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
      >
        Continue
      </button>
      {!canSubmit ? (
        <p className="-mt-3 text-xs text-muted">Pick a destination and both dates to continue.</p>
      ) : null}
    </form>
  );
}
