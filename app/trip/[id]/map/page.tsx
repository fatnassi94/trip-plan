"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, MapPin, Route } from "lucide-react";
import { useTrip } from "@/components/trip/use-trip";
import { formatTripRange } from "@/lib/date";
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
    return (
      <main className="mx-auto max-w-[1440px] px-5 py-8 lg:px-12" aria-busy="true">
        <div className="h-10 w-64 animate-pulse rounded bg-accent-soft" />
        <div className="mt-6 h-[60vh] animate-pulse rounded-lg bg-accent-soft/60" />
        <p className="sr-only">Loading…</p>
      </main>
    );
  }

  if (!trip) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-accent">No trip loaded</h1>
        <p className="mt-3 text-sm text-muted">
          This trip isn&apos;t in this tab&apos;s session. Generate a new one, or open it again
          from your account.
        </p>
        <Link
          href="/create-trip"
          className="mt-8 inline-flex items-center gap-2 rounded bg-accent px-6 py-3 font-display font-semibold text-paper shadow-card hover:bg-deep"
        >
          Plan a trip
          <ArrowRight className="h-4 w-4 text-sunset" aria-hidden="true" />
        </Link>
      </main>
    );
  }

  const skipped = totalItems - stops.length;

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-8 lg:px-12">
      <Link
        href={`/trip/${id}`}
        className="inline-flex items-center gap-1.5 rounded font-display text-sm font-semibold text-accent transition-colors hover:text-warm"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {trip.destination}
      </Link>

      <div className="roam-rise mt-3 flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-warm">
            Whole-trip map · {formatTripRange(trip.startDate, trip.endDate)}
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-accent sm:text-4xl">
            Every stop, in order
          </h1>
          <p className="mt-2 text-sm text-muted">
            {stops.length} of {totalItems} stops across {trip.days.length}{" "}
            {trip.days.length === 1 ? "day" : "days"} are plotted.
            {skipped > 0
              ? ` ${skipped} ${skipped === 1 ? "stop doesn't" : "stops don't"} have exact coordinates.`
              : ""}
          </p>
        </div>
      </div>

      {stops.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-2 rounded-lg bg-surface p-10 text-center text-sm text-muted shadow-card">
          <MapPin className="h-6 w-6" aria-hidden="true" />
          None of this trip&apos;s stops have map coordinates yet.
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
          <ol className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto rounded-lg bg-surface p-2 shadow-card lg:order-1">
            {stops.map((stop, i) => {
              const newDay = i === 0 || stops[i - 1].day !== stop.day;
              const selected = selectedKey === stop.key;
              return (
                <li key={stop.key}>
                  {newDay ? (
                    <p className="px-2 pb-1 pt-2 font-mono text-[0.6rem] font-bold uppercase tracking-widest text-warm">
                      Day {stop.day}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setSelectedKey(stop.key)}
                    aria-current={selected ? "true" : undefined}
                    className={`flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                      selected ? "bg-accent text-paper" : "hover:bg-accent-soft/60"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold ${
                        selected ? "bg-sunset text-paper" : "bg-accent text-paper"
                      }`}
                    >
                      {stop.label}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate font-display text-sm font-semibold ${
                          selected ? "text-paper" : "text-accent"
                        }`}
                      >
                        {stop.item.name}
                      </span>
                      <span
                        className={`mt-0.5 block text-xs tabular-nums ${
                          selected ? "text-accent-soft" : "text-muted"
                        }`}
                      >
                        {stop.item.start} · {stop.item.type}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="relative h-[60vh] min-h-[420px] overflow-hidden rounded-lg bg-surface shadow-lift lg:sticky lg:top-24 lg:order-2 lg:h-[calc(100vh-8rem)]">
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
            <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-md bg-surface/95 px-3 py-2 shadow-card backdrop-blur-md">
              <Route className="h-4 w-4 text-warm" aria-hidden="true" />
              <span className="font-display text-xs font-bold text-accent">
                {trip.destination} · {stops.length} stops
              </span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
