"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, Clock, MapPin, UtensilsCrossed } from "lucide-react";
import { RouteArt } from "@/components/brand/route-art";
import { ActivityCard } from "@/components/trip/activity-card";
import { useTrip } from "@/components/trip/use-trip";
import { formatTripDay } from "@/lib/date";
import { formatDuration, summarizeDay } from "@/lib/itinerary";

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
    return (
      <main className="mx-auto max-w-3xl px-5 py-8" aria-busy="true">
        <div className="h-48 animate-pulse rounded-xl bg-accent-soft" />
        <div className="mt-6 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg bg-accent-soft/60" />
          ))}
        </div>
        <p className="sr-only">Loading…</p>
      </main>
    );
  }

  const day = trip?.days.find((d) => d.day === dayNumber);

  if (!trip || !day) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-accent">Day not found</h1>
        <Link
          href={`/trip/${id}`}
          className="mt-6 inline-flex items-center gap-2 rounded bg-accent px-5 py-2.5 font-display text-sm font-semibold text-paper hover:bg-deep"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to the trip
        </Link>
      </main>
    );
  }

  const summary = summarizeDay(day);
  const dayDate = formatTripDay(trip.startDate, day.day);
  const prev = trip.days.find((d) => d.day === day.day - 1);
  const next = trip.days.find((d) => d.day === day.day + 1);

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <Link
        href={`/trip/${id}`}
        className="inline-flex items-center gap-1.5 rounded font-display text-sm font-semibold text-accent transition-colors hover:text-warm"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {trip.destination}
      </Link>

      <header className="roam-rise relative isolate mt-4 overflow-hidden rounded-xl bg-gradient-to-br from-deep via-accent to-warm px-6 py-8 text-paper shadow-float">
        <RouteArt className="absolute inset-0 -z-10 h-full w-full opacity-50" />
        <p className="flex flex-wrap items-center gap-2 font-mono text-[0.65rem] font-bold uppercase tracking-widest text-warm-soft">
          <span>
            Day {day.day} of {trip.days.length}
          </span>
          {dayDate ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" aria-hidden="true" />
                {dayDate}
              </span>
            </>
          ) : null}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          {day.title}
        </h1>
        <ul className="mt-5 flex flex-wrap gap-2 text-xs">
          <HeaderPill icon={MapPin}>
            {summary.stops} {summary.stops === 1 ? "stop" : "stops"}
          </HeaderPill>
          {summary.firstStart && summary.lastEnd ? (
            <HeaderPill icon={Clock}>
              {summary.firstStart}–{summary.lastEnd} · {formatDuration(summary.plannedMinutes)} planned
            </HeaderPill>
          ) : null}
          {summary.meals ? (
            <HeaderPill icon={UtensilsCrossed}>
              {summary.meals} {summary.meals === 1 ? "meal" : "meals"}
            </HeaderPill>
          ) : null}
        </ul>
      </header>

      <ol className="relative mt-8 flex flex-col gap-4 pl-1">
        <span
          aria-hidden="true"
          className="absolute bottom-6 left-[1.05rem] top-6 w-0.5 bg-gradient-to-b from-accent/30 via-accent-soft to-sunset/40"
        />
        {day.items.map((item, i) => (
          <li
            key={`${item.name}-${i}`}
            className="roam-rise relative flex items-start gap-3"
            style={{ animationDelay: `${Math.min(i, 6) * 80}ms` }}
          >
            <span className="z-10 mt-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent font-display text-sm font-bold text-paper shadow-card ring-4 ring-paper">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <ActivityCard item={item} destination={trip.destination} />
            </div>
          </li>
        ))}
      </ol>

      <nav aria-label="Other days" className="mt-10 grid gap-3 sm:grid-cols-2">
        {prev ? (
          <DayNavCard href={`/trip/${id}/day/${prev.day}`} direction="prev" day={prev.day} title={prev.title} />
        ) : (
          <span className="hidden sm:block" />
        )}
        {next ? (
          <DayNavCard href={`/trip/${id}/day/${next.day}`} direction="next" day={next.day} title={next.title} />
        ) : (
          <Link
            href={`/trip/${id}/map`}
            className="group flex items-center justify-end gap-3 rounded-lg bg-deep p-4 text-right text-paper shadow-card transition-shadow hover:shadow-lift"
          >
            <span>
              <span className="block font-mono text-[0.6rem] font-bold uppercase tracking-widest text-warm-soft">
                Last day
              </span>
              <span className="block font-display text-sm font-semibold">See the whole-trip map</span>
            </span>
            <ArrowRight className="h-4 w-4 text-sunset transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        )}
      </nav>
    </main>
  );
}

function HeaderPill({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full bg-paper/15 px-3 py-1.5 font-display font-semibold backdrop-blur-md">
      <Icon className="h-3.5 w-3.5 text-sunset" aria-hidden="true" />
      {children}
    </li>
  );
}

function DayNavCard({
  href,
  direction,
  day,
  title,
}: {
  href: string;
  direction: "prev" | "next";
  day: number;
  title: string;
}) {
  const isNext = direction === "next";
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-lg bg-surface p-4 shadow-card transition-shadow hover:shadow-lift ${
        isNext ? "justify-end text-right" : ""
      }`}
    >
      {!isNext ? (
        <ArrowLeft className="h-4 w-4 text-warm transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
      ) : null}
      <span className="min-w-0">
        <span className="block font-mono text-[0.6rem] font-bold uppercase tracking-widest text-muted">
          {isNext ? "Next" : "Previous"} · Day {day}
        </span>
        <span className="block truncate font-display text-sm font-semibold text-accent">{title}</span>
      </span>
      {isNext ? (
        <ArrowRight className="h-4 w-4 text-warm transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      ) : null}
    </Link>
  );
}
