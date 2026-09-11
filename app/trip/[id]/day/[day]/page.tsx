"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { readCachedTrip } from "@/lib/trip-store";
import type { ItineraryItem, Trip } from "@/types/trip";

// 08 — Day Detail. Every activity is a card carrying its "Why I chose
// this for you" line — see the travel-domain skill: an item without a
// specific reason is a bug, not a styling choice.
export default function DayDetailPage() {
  const params = useParams<{ id: string; day: string }>();
  const id = params?.id ?? "local";
  const dayNumber = Number(params?.day ?? 1);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setTrip(readCachedTrip(id));
    setLoaded(true);
  }, [id]);

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
            <ActivityCard item={item} />
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

function ActivityCard({ item }: { item: ItineraryItem }) {
  const end = addMinutes(item.start, item.durationMinutes);

  return (
    <article className="rounded-lg border border-border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-medium">{item.name}</h2>
        <span className="font-mono text-xs tabular-nums text-muted">
          {item.start} – {end}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="font-mono uppercase tracking-wide">{item.type}</span>
        {item.priceLevel ? <span>{"€".repeat(item.priceLevel)}</span> : null}
        {item.tags?.map((tag) => (
          <span key={tag} className="rounded-full bg-accent-soft px-2 py-1 text-accent">
            {tag}
          </span>
        ))}
      </div>

      {/* The line that makes the AI feel like it knows you. Required on
          every item — see types/trip.ts and the travel-domain skill. */}
      <p className="mt-4 rounded-md bg-accent-soft px-4 py-3 text-sm leading-relaxed text-accent">
        <span className="font-medium">Why I chose this for you — </span>
        {item.reason}
      </p>
    </article>
  );
}

function addMinutes(start: string, minutes: number): string {
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}
