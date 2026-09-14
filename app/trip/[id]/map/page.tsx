"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTrip } from "@/components/trip/use-trip";
import type { ItineraryItem } from "@/types/trip";

// MapLibre touches `window` at import time, which breaks Next's server
// render of this "use client" page's initial HTML — the standard fix is
// loading it only in the browser. See components/trip/route-map.tsx for
// why the tile source itself needs no API key.
const RouteMap = dynamic(
  () => import("@/components/trip/route-map").then((m) => m.RouteMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[280px] items-center justify-center text-sm text-muted">
        Loading map…
      </div>
    ),
  },
);

interface Stop {
  key: string;
  label: number;
  day: number;
  item: ItineraryItem;
}

// 09 — Map. Every stop across the whole trip, numbered on the left and
// plotted + connected on the right — the plan's "timeline ↔ route".
// Reads from the same cache-then-database source as every other trip
// page (components/trip/use-trip.ts), so this works whether the trip was
// just generated in this tab or opened later from /account.
export default function TripMapPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "local";
  const { trip, loaded } = useTrip(id);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const { stops, totalItems } = useMemo(() => {
    if (!trip) return { stops: [] as Stop[], totalItems: 0 };
    let label = 0;
    let total = 0;
    const out: Stop[] = [];
    for (const day of trip.days) {
      for (const item of day.items) {
        total += 1;
        if (item.lat == null || item.lng == null) continue;
        label += 1;
        out.push({ key: `${day.day}-${label}`, label, day: day.day, item });
      }
    }
    return { stops: out, totalItems: total };
  }, [trip]);

  if (!loaded) {
    return <main className="mx-auto max-w-2xl px-6 py-20 text-muted">Loading…</main>;
  }

  if (!trip) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <h1 className="font-display text-2xl font-semibold">No trip loaded</h1>
        <p className="mt-3 text-sm text-muted">
          This trip isn&apos;t in this tab&apos;s session. Generate a new one, or open it again
          from your account.
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

  const skipped = totalItems - stops.length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <Link
        href={`/trip/${id}`}
        className="font-mono text-xs uppercase tracking-widest text-accent"
      >
        ← {trip.destination}
      </Link>
      <h1 className="mt-3 font-display text-3xl font-semibold">Map</h1>
      <p className="mt-2 text-sm text-muted">
        Every stop across your {trip.days.length}-day trip, in order.
        {skipped > 0
          ? ` ${skipped} ${skipped === 1 ? "stop doesn't" : "stops don't"} have exact coordinates and ${skipped === 1 ? "isn't" : "aren't"} plotted.`
          : ""}
      </p>

      {stops.length === 0 ? (
        <p className="mt-10 text-sm text-muted">
          None of this trip&apos;s stops have map coordinates yet.
        </p>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
          <ol className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto pr-1 lg:order-1">
            {stops.map((stop) => (
              <li key={stop.key}>
                <button
                  type="button"
                  onClick={() => setSelectedKey(stop.key)}
                  aria-current={selectedKey === stop.key ? "true" : undefined}
                  className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    selectedKey === stop.key
                      ? "border-accent bg-accent-soft/50"
                      : "border-border hover:border-accent"
                  }`}
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-xs text-paper">
                    {stop.label}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{stop.item.name}</span>
                    <span className="mt-0.5 block font-mono text-xs text-muted">
                      Day {stop.day} · {stop.item.start}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>

          <div className="h-[60vh] min-h-[420px] overflow-hidden rounded-lg border border-border lg:sticky lg:top-16 lg:order-2 lg:h-[calc(100vh-8rem)]">
            <RouteMap
              stops={stops.map((s) => ({
                key: s.key,
                lat: s.item.lat as number,
                lng: s.item.lng as number,
                label: s.label,
              }))}
              selectedKey={selectedKey}
              onSelectStop={setSelectedKey}
            />
          </div>
        </div>
      )}
    </main>
  );
}
