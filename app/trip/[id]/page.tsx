"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Columns2,
  List,
  Map as MapIcon,
  MapPin,
  Plus,
  Route,
  ShieldCheck,
  Users,
} from "lucide-react";
import { RouteArt } from "@/components/brand/route-art";
import { ActivityCard } from "@/components/trip/activity-card";
import { TripAssistant } from "@/components/trip/trip-assistant";
import { useTrip } from "@/components/trip/use-trip";
import { formatTripDay, formatTripRange } from "@/lib/date";
import { formatDuration, isMapped, summarizeDay } from "@/lib/itinerary";
import { cacheTrip } from "@/lib/trip-store";
import { estimateWalkingKm } from "@/lib/trip-rules";
import type { Trip } from "@/types/trip";

// MapLibre touches `window` at import, so it only loads in the browser.
const RouteMap = dynamic(
  () => import("@/components/trip/route-map").then((m) => m.RouteMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted">
        Loading map…
      </div>
    ),
  },
);

type View = "split" | "itinerary" | "map";

// 06 — Trip Overview, in the design system's split layout: a hero with the
// trip's real totals, day tabs, the selected day's timeline, that day's
// route on a live map, and the AI Assistant (10 — "Edit via ✨ Chat") for
// changing the day in place. Data comes from this tab's cache or the
// database — see components/trip/use-trip.ts.
export default function TripOverviewPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "local";
  const { trip: loadedTrip, loaded } = useTrip(id);
  // Changes applied through the assistant, layered over what was loaded.
  const [edited, setEdited] = useState<Trip | null>(null);
  // Bumped on every applied change so the timeline and map re-mount and
  // visibly redraw the new day.
  const [revision, setRevision] = useState(0);
  const [dayNumber, setDayNumber] = useState(1);
  const [view, setView] = useState<View>("split");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const trip = edited ?? loadedTrip;
  const day = trip?.days.find((d) => d.day === dayNumber) ?? trip?.days[0];

  // Map labels use the stop's position in the day, so pin "3" on the map
  // is always stop 3 in the timeline, even when an earlier stop has no
  // coordinates and isn't plotted.
  const stops = useMemo(() => {
    if (!day) return [];
    return day.items.flatMap((item, i) =>
      item.lat != null && item.lng != null
        ? [{ key: `${day.day}-${i}`, lat: item.lat, lng: item.lng, label: i + 1 }]
        : [],
    );
  }, [day]);

  if (!loaded) {
    return (
      <main className="mx-auto max-w-[1440px] px-5 py-8 lg:px-12" aria-busy="true">
        <div className="h-56 animate-pulse rounded-xl bg-accent-soft" />
        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-lg bg-accent-soft/60" />
            ))}
          </div>
          <div className="hidden h-[520px] animate-pulse rounded-lg bg-accent-soft/60 lg:col-span-5 lg:block" />
        </div>
        <p className="sr-only">Loading your trip…</p>
      </main>
    );
  }

  if (!trip || !day) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-20 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
          <MapPin className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 font-display text-2xl font-bold text-accent">No trip loaded</h1>
        <p className="mt-3 text-sm text-muted">
          This trip isn&apos;t available here. Open it from My Trips, or plan a new one.
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

  const allItems = trip.days.flatMap((d) => d.items);
  const summary = summarizeDay(day);
  const dayDate = formatTripDay(trip.startDate, day.day);
  const walkingKm = estimateWalkingKm(day);

  function handleApplied(next: Trip) {
    setEdited(next);
    cacheTrip(id, next);
    setSelectedKey(null);
    setRevision((r) => r + 1);
  }

  const mapPanel = (className: string) => (
    <section
      aria-label={`Day ${day.day} route map`}
      className={`relative overflow-hidden rounded-lg bg-surface shadow-lift ${className}`}
    >
      {stops.length > 0 ? (
        <>
          <RouteMap
            key={`${day.day}-${view}-${revision}`}
            stops={stops}
            selectedKey={selectedKey}
            onSelectStop={setSelectedKey}
          />
          <div className="pointer-events-none absolute left-3 top-3 flex max-w-[calc(100%-5rem)] items-center gap-2.5 rounded-md bg-surface/95 px-3 py-2 shadow-card backdrop-blur-md">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-accent-soft text-accent">
              <Route className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-xs font-bold text-accent">
                Day {day.day} route
              </span>
              <span className="block text-[0.7rem] text-muted">
                {summary.mapped} of {summary.stops} stops on the map
              </span>
            </span>
          </div>
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted">
          <MapPin className="h-6 w-6" aria-hidden="true" />
          No stops on this day have map coordinates.
        </div>
      )}
    </section>
  );

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-8 lg:px-12">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="roam-rise relative isolate overflow-hidden rounded-xl bg-gradient-to-br from-deep via-accent to-warm px-6 py-8 text-paper shadow-float sm:px-10 sm:py-10">
        <RouteArt className="absolute inset-0 -z-10 h-full w-full opacity-60" />
        <div
          aria-hidden="true"
          className="roam-blob-a absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-sunset/30 blur-3xl"
        />
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-paper/15 px-2.5 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-widest backdrop-blur-md">
                Your itinerary
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-deep/60 px-2.5 py-1 font-mono text-[0.65rem] font-bold text-sage backdrop-blur-md">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                Schedule checked
              </span>
            </div>
            <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              {trip.destination}
            </h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-accent-soft">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-sunset" aria-hidden="true" />
                {formatTripRange(trip.startDate, trip.endDate)}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-sunset" aria-hidden="true" />
                {trip.travelers} {trip.travelers === 1 ? "traveler" : "travelers"}
              </span>
            </p>
          </div>

          <dl className="grid shrink-0 grid-cols-3 gap-2 sm:gap-3">
            <HeroStat label="Days" value={trip.days.length} />
            <HeroStat label="Stops" value={allItems.length} />
            <HeroStat label="Mapped" value={allItems.filter(isMapped).length} />
          </dl>
        </div>
      </section>

      {/* ── Day tabs + view switch ───────────────────────────────────── */}
      <div className="mt-6 flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div role="tablist" aria-label="Days" className="flex gap-2 overflow-x-auto pb-1">
          {trip.days.map((d) => {
            const active = d.day === day.day;
            return (
              <button
                key={d.day}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setDayNumber(d.day);
                  setSelectedKey(null);
                }}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded px-3.5 py-2 font-display text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  active
                    ? "bg-accent font-semibold text-paper shadow-card"
                    : "bg-surface text-muted shadow-card hover:bg-accent-soft hover:text-ink"
                }`}
              >
                Day {d.day} · {d.title}
                {active ? <span className="h-1.5 w-1.5 rounded-full bg-sunset" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 self-start rounded-md bg-accent-soft p-1 md:self-auto">
          {(
            [
              { value: "split", label: "Split", icon: Columns2 },
              { value: "itinerary", label: "Itinerary", icon: List },
              { value: "map", label: "Map", icon: MapIcon },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={view === option.value}
              onClick={() => setView(option.value)}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 font-display text-xs transition-colors ${
                view === option.value
                  ? "bg-surface font-semibold text-accent shadow-card"
                  : "text-muted hover:text-ink"
              }`}
            >
              <option.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid items-start gap-6 pb-4 lg:grid-cols-12">
        {view !== "map" ? (
          <section className={view === "itinerary" ? "lg:col-span-8" : "lg:col-span-7"}>
            <div className="flex flex-col justify-between gap-3 rounded-lg bg-surface p-4 shadow-card sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-accent font-display text-lg font-bold text-paper">
                  {String(day.day).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-[0.6rem] font-bold uppercase tracking-widest text-warm">
                    {dayDate ?? `Day ${day.day}`}
                  </p>
                  <p className="truncate font-display font-semibold text-accent">{day.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    <span>
                      {summary.stops} {summary.stops === 1 ? "stop" : "stops"}
                    </span>
                    {summary.firstStart && summary.lastEnd ? (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {summary.firstStart}–{summary.lastEnd}
                      </span>
                    ) : null}
                    <span>{formatDuration(summary.plannedMinutes)} planned</span>
                    {walkingKm != null ? (
                      <span title="Estimated from the distance between stops">
                        ~{walkingKm.toFixed(1)} km walking (est.)
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
              <Link
                href={`/trip/${id}/day/${day.day}`}
                className="inline-flex shrink-0 items-center gap-1.5 self-start rounded bg-accent-soft px-3 py-2 font-display text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-paper sm:self-auto"
              >
                Day detail
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>

            <ol key={`${day.day}-${revision}`} className="relative mt-5 flex flex-col gap-4 pl-1">
              <span
                aria-hidden="true"
                className="absolute bottom-6 left-[1.05rem] top-6 w-0.5 bg-gradient-to-b from-accent/30 via-accent-soft to-sunset/40"
              />
              {day.items.map((item, i) => {
                const key = `${day.day}-${i}`;
                const plotted = isMapped(item);
                const selected = selectedKey === key;
                return (
                  <li
                    key={key}
                    className="roam-rise relative flex items-start gap-3"
                    style={{ animationDelay: `${Math.min(i, 6) * 80}ms` }}
                  >
                    {plotted ? (
                      <button
                        type="button"
                        onClick={() => setSelectedKey(key)}
                        aria-label={`Show stop ${i + 1} on the map`}
                        aria-pressed={selected}
                        className={`z-10 mt-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold shadow-card ring-4 ring-paper transition-[background-color,transform] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                          selected ? "scale-110 bg-sunset text-paper" : "bg-accent text-paper hover:bg-deep"
                        }`}
                      >
                        {i + 1}
                      </button>
                    ) : (
                      <span className="z-10 mt-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-sm font-bold text-muted ring-4 ring-paper">
                        {i + 1}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <ActivityCard item={item} destination={trip.destination} />
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : (
          mapPanel("h-[70vh] lg:col-span-8")
        )}

        {/* Map (split view) + assistant share one sticky column sized to
            the viewport, so the chat input never scrolls out of reach. */}
        <aside
          className={`flex flex-col gap-6 lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)] ${
            view === "split" ? "lg:col-span-5" : "lg:col-span-4"
          }`}
        >
          {view === "split" ? mapPanel("h-[340px] shrink-0 lg:h-[40%]") : null}
          <TripAssistant
            tripId={id}
            trip={trip}
            dayNumber={day.day}
            onApplied={handleApplied}
            className="lg:flex-1"
          />
        </aside>
      </div>

      <div className="mt-8 flex flex-wrap gap-3 border-t border-border pt-6">
        <Link
          href={`/trip/${id}/map`}
          className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2.5 font-display text-sm font-semibold text-paper shadow-card transition-colors hover:bg-deep"
        >
          <MapIcon className="h-4 w-4 text-sunset" aria-hidden="true" />
          Whole-trip map
        </Link>
        <Link
          href="/create-trip"
          className="inline-flex items-center gap-2 rounded bg-surface px-4 py-2.5 font-display text-sm font-semibold text-accent shadow-card transition-colors hover:bg-accent-soft"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Plan another trip
        </Link>
        <Link
          href="/account"
          className="inline-flex items-center rounded px-4 py-2.5 font-display text-sm font-semibold text-muted transition-colors hover:text-accent"
        >
          My trips
        </Link>
      </div>
    </main>
  );
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[5.5rem] rounded-md bg-paper/10 px-4 py-3 ring-1 ring-paper/15 backdrop-blur-md">
      <dt className="font-mono text-[0.6rem] font-bold uppercase tracking-widest text-accent-soft/80">
        {label}
      </dt>
      <dd className="mt-0.5 font-display text-2xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}
