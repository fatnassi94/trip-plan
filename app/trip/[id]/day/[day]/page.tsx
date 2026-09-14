"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTrip } from "@/components/trip/use-trip";
import { ActivityCard } from "@/components/trip/activity-card";

// 08 — Day Detail. Every activity is a card carrying its "Why I chose
// this for you" line — see the travel-domain skill: an item without a
// specific reason is a bug, not a styling choice. The card itself lives
// in components/trip/activity-card.tsx (map, 360° view, budget estimate,
// expandable details). Trip data comes from this tab's cache or (once
// logged in) the database — see components/trip/use-trip.ts.
export default function DayDetailPage() {
  const params = useParams<{ id: string; day: string }>();
  const id = params?.id ?? "local";
  const dayNumber = Number(params?.day ?? 1);

  const { trip, loaded } = useTrip(id);

  if (!loaded) {
    return <main className="mx-auto max-w-2xl px-6 py-20 text-muted">Loading…</main>;
  }

  const day = trip?.days.find((d) => d.day === dayNumber);

  if (!trip || !day) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <h1 className="font-display text-2xl font-semibold">Day not found</h1>
        <Link
          href={`/trip/${id}`}
          className="mt-6 inline-flex text-sm text-accent underline underline-offset-4"
        >
          Back to the trip
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href={`/trip/${id}`}
        className="font-mono text-xs uppercase tracking-widest text-accent"
      >
        ← {trip.destination}
      </Link>
      <p className="mt-6 font-mono text-xs uppercase tracking-widest text-muted">
        Day {day.day}
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold">{day.title}</h1>

      <ol className="mt-10 flex flex-col gap-4">
        {day.items.map((item, i) => (
          <li key={`${item.name}-${i}`}>
            <ActivityCard item={item} destination={trip.destination} />
          </li>
        ))}
      </ol>

      <nav className="mt-12 flex justify-between text-sm">
        {day.day > 1 ? (
          <Link
            href={`/trip/${id}/day/${day.day - 1}`}
            className="text-accent underline underline-offset-4"
          >
            ← Day {day.day - 1}
          </Link>
        ) : (
          <span />
        )}
        {day.day < trip.days.length ? (
          <Link
            href={`/trip/${id}/day/${day.day + 1}`}
            className="text-accent underline underline-offset-4"
          >
            Day {day.day + 1} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
