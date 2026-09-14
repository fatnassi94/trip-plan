"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTrip } from "@/components/trip/use-trip";

// 06 — Trip Overview. Reads the trip the generator just produced, from
// this tab's cache or (once logged in) the database — see
// components/trip/use-trip.ts.
export default function TripOverviewPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "local";
  const { trip, loaded } = useTrip(id);

  if (!loaded) {
    return <main className="mx-auto max-w-2xl px-6 py-20 text-muted">Loading…</main>;
  }

  if (!trip) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <h1 className="font-display text-2xl font-semibold">No trip loaded</h1>
        <p className="mt-3 text-sm text-muted">
          This trip isn&apos;t in this tab&apos;s session. Generate a new one to see it here.
        </p>
        <Link
          href="/create-trip"
          className="mt-8 inline-flex rounded-md bg-accent px-6 py-3 font-medium text-paper hover:opacity-90"
        >
          Plan a trip
        </Link>
      </main>
    );
  }

  const totalStops = trip.days.reduce((sum, day) => sum + day.items.length, 0);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">
        {trip.startDate} → {trip.endDate}
      </p>
      <h1 className="mt-3 font-display text-4xl font-semibold">{trip.destination}</h1>
      <p className="mt-3 text-sm text-muted">
        {trip.days.length} {trip.days.length === 1 ? "day" : "days"} · {trip.travelers}{" "}
        {trip.travelers === 1 ? "traveler" : "travelers"} · {totalStops} stops
      </p>

      <h2 className="mt-12 font-mono text-xs uppercase tracking-widest text-muted">
        Your days
      </h2>
      <ol className="mt-4 flex flex-col gap-3">
        {trip.days.map((day) => (
          <li key={day.day}>
            <Link
              href={`/trip/${id}/day/${day.day}`}
              className="flex items-baseline gap-4 rounded-lg border border-border p-5 transition-colors hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span className="font-mono text-xs text-accent">Day {day.day}</span>
              <span className="flex-1">
                <span className="block font-display text-lg font-medium">{day.title}</span>
                <span className="mt-1 block text-sm text-muted">
                  {day.items.length} stops · starts {day.items[0]?.start ?? "—"}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex gap-6 text-sm">
        <Link href="/create-trip" className="text-accent underline underline-offset-4">
          Plan another trip
        </Link>
        <Link href="/account" className="text-muted underline underline-offset-4 hover:text-accent">
          My account
        </Link>
      </div>
    </main>
  );
}
