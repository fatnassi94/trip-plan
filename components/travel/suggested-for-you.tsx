"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import type { DestinationSummary } from "@/lib/destination-summary";

// "Suggested for you" — reads the traveler's saved Travel DNA
// (/api/account/travel-dna) and ranks the catalog against it. A client
// component because the answer depends on who is signed in.
//
// Signed out, or nothing saved yet, it shows the clearly-labelled
// starting set below rather than pretending to personalise.

const MOCK_STARTER_PICKS = {
  reason: "Popular with first-time travelers",
  slugs: ["tunis", "rome", "istanbul"],
};

interface TravelDnaResponse {
  loggedIn?: boolean;
  profile?: {
    travelerTypes?: string[];
    foodPreferences?: string[];
    localness?: number;
    discovery?: number;
  } | null;
}

/** Interests → catalog tags, so a persona actually matches a destination. */
const INTEREST_TAGS: Record<string, string[]> = {
  Foodie: ["food", "cafes", "bazaar", "souks"],
  "Culture lover": ["history", "art", "museums", "mosaics", "ruins", "temples", "architecture"],
  Explorer: ["medina", "village", "crafts", "ferries"],
  Nature: ["rice terraces", "surf", "beaches", "coastal", "gardens"],
  Relaxed: ["cafes", "wellness", "views", "coastal"],
  Photographer: ["views", "photography", "neon", "piazzas"],
  Shopper: ["souks", "bazaar", "crafts", "design"],
  Nightlife: ["neon", "nightlife", "piazzas"],
};

function rank(destinations: DestinationSummary[], interests: string[]): DestinationSummary[] {
  const wanted = new Set(interests.flatMap((i) => INTEREST_TAGS[i] ?? [i.toLowerCase()]));
  return [...destinations]
    .map((destination) => ({
      destination,
      score: destination.tags.filter((tag) => wanted.has(tag.toLowerCase())).length,
    }))
    .sort((a, b) => b.score - a.score)
    .filter((entry, index) => entry.score > 0 || index < 3)
    .slice(0, 3)
    .map((entry) => entry.destination);
}

export function SuggestedForYou({ destinations }: { destinations: DestinationSummary[] }) {
  const [picks, setPicks] = useState<DestinationSummary[] | null>(null);
  const [reason, setReason] = useState(MOCK_STARTER_PICKS.reason);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/account/travel-dna")
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: TravelDnaResponse | null) => {
        if (cancelled) return;
        const interests = payload?.profile?.travelerTypes ?? [];
        if (interests.length > 0) {
          setReason(`Because your Travel DNA says ${interests.slice(0, 2).join(" and ").toLowerCase()}`);
          setPicks(rank(destinations, interests));
          return;
        }
        setPicks(destinations.filter((d) => MOCK_STARTER_PICKS.slugs.includes(d.slug)).slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) {
          setPicks(destinations.filter((d) => MOCK_STARTER_PICKS.slugs.includes(d.slug)).slice(0, 3));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [destinations]);

  return (
    <section aria-labelledby="suggested-heading" className="rounded-lg bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded bg-deep text-sunset">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 id="suggested-heading" className="font-display text-lg font-bold text-accent">
              Suggested for you
            </h2>
            <p className="text-xs text-muted" aria-live="polite">
              {picks ? reason : "Checking your Travel DNA…"}
            </p>
          </div>
        </div>
        <Link
          href="/profile"
          className="inline-flex items-center gap-1.5 rounded bg-accent-soft px-3 py-2 font-display text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-paper"
        >
          Tune your Travel DNA
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-3">
        {(picks ?? [null, null, null]).map((destination, index) =>
          destination ? (
            <li key={destination.slug}>
              <Link
                href={`/destinations/${destination.slug}`}
                className="flex h-full flex-col gap-1 rounded-md bg-accent-soft/50 p-3 transition-colors hover:bg-accent-soft"
              >
                <span className="font-display text-sm font-semibold text-accent">{destination.name}</span>
                <span className="text-xs text-muted">{destination.country}</span>
                <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                  {destination.shortDescription}
                </span>
              </Link>
            </li>
          ) : (
            <li key={index} aria-hidden="true" className="h-24 animate-pulse rounded-md bg-accent-soft/60" />
          ),
        )}
      </ul>
    </section>
  );
}
