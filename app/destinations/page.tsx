import type { Metadata } from "next";
import { DestinationExplorer, type ExplorerEntry } from "@/components/travel/destination-explorer";
import {
  MOODS,
  allDestinations,
  allInterests,
  allRegions,
  moodById,
} from "@/lib/destination-catalog";
import { toDestinationSummary } from "@/lib/destination-summary";
import { getTravelImage } from "@/lib/travel-images";

// Explore — the full catalog with search and filters. The server resolves
// every card's photo once; filtering then happens in the browser against
// data it already has, so typing costs no request.

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Destinations — RoamAI",
  description: "Browse destinations by mood, budget, region and trip length.",
};

export default async function DestinationsPage({
  searchParams,
}: {
  searchParams: { q?: string; mood?: string; region?: string };
}) {
  const destinations = allDestinations();
  const images = await Promise.all(destinations.map((d) => getTravelImage(d.heroImageQuery)));

  const entries: ExplorerEntry[] = destinations.map((destination, index) => ({
    destination: toDestinationSummary(destination),
    image: images[index].images[0] ?? null,
  }));

  const mood = searchParams.mood ? moodById(searchParams.mood) : undefined;

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-10 lg:px-12">
      <header className="max-w-2xl">
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-warm">
          Explore
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-accent sm:text-4xl">
          {mood ? mood.label : "Where do you want to wake up?"}
        </h1>
        <p className="mt-2 text-muted">
          {mood
            ? mood.blurb
            : "Filter by mood, budget, region or how long you have. Pick one and RoamAI plans the days."}
        </p>
      </header>

      <div className="mt-8">
        <DestinationExplorer
          entries={entries}
          moods={MOODS.map((m) => ({ id: m.id, label: m.label }))}
          regions={allRegions()}
          interests={allInterests()}
          initial={{
            q: searchParams.q ?? "",
            mood: mood?.id ?? "",
            region: searchParams.region ?? "",
          }}
        />
      </div>
    </main>
  );
}
