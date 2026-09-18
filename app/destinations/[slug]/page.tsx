import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Compass,
  MapPin,
  Sparkles,
  Utensils,
  Wallet,
} from "lucide-react";
import { DestinationCard } from "@/components/travel/destination-card";
import { TravelImage } from "@/components/travel/travel-image";
import {
  allDestinations,
  destinationBySlug,
  formatDailyBudget,
  relatedDestinations,
} from "@/lib/destination-catalog";
import { toDestinationSummary } from "@/lib/destination-summary";
import { getTravelImage, getTravelImages } from "@/lib/travel-images";

// Destination detail — the page the whole discovery experience points at.
// A Server Component: the hero, the gallery and the related cards all
// resolve their photos here, cached by lib/travel-images.

export const revalidate = 3600;

export function generateStaticParams() {
  return allDestinations().map((destination) => ({ slug: destination.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const destination = destinationBySlug(params.slug);
  if (!destination) return { title: "Destination not found — RoamAI" };
  return {
    title: `${destination.name}, ${destination.country} — RoamAI`,
    description: destination.shortDescription,
  };
}

export default async function DestinationPage({ params }: { params: { slug: string } }) {
  const destination = destinationBySlug(params.slug);
  if (!destination) notFound();

  const related = relatedDestinations(destination.slug);

  const [hero, gallery, relatedImages] = await Promise.all([
    getTravelImage(destination.heroImageQuery, { orientation: "landscape" }),
    getTravelImages(destination.galleryImageQueries[0] ?? destination.heroImageQuery, { count: 4 }),
    Promise.all(related.map((d) => getTravelImage(d.heroImageQuery))),
  ]);

  const planHref = `/create-trip?destination=${encodeURIComponent(`${destination.name}, ${destination.country}`)}`;

  return (
    <main>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative isolate">
        <TravelImage
          image={hero.images[0]}
          label={`${destination.name}, ${destination.country}`}
          sizes="100vw"
          priority
          showCredit
          plainPlaceholder
          className="min-h-[420px] w-full lg:min-h-[520px]"
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-deep/95 via-deep/55 to-deep/40"
          />
        </TravelImage>

        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-[1200px] px-5 pb-8 text-paper lg:px-8">
            <Link
              href="/destinations"
              className="inline-flex items-center gap-1.5 font-display text-sm font-semibold text-accent-soft transition-colors hover:text-paper"
            >
              <Compass className="h-4 w-4" aria-hidden="true" />
              All destinations
            </Link>
            <p className="mt-3 font-mono text-[0.65rem] font-bold uppercase tracking-widest text-warm-soft">
              {destination.region} · {destination.cityOrRegion}
            </p>
            <h1 className="mt-1 font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              {destination.name}, {destination.country}
            </h1>
            <p className="mt-3 max-w-2xl text-lg leading-relaxed text-accent-soft">
              {destination.shortDescription}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1200px] px-5 py-10 lg:px-8">
        {/* ── Facts + CTAs ───────────────────────────────────────────── */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <dl className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact icon={CalendarDays} label="Best time" value={destination.bestTimeToVisit.split(",")[0]} />
            <Fact icon={Clock} label="Stay" value={destination.tripDurationSuggestion} />
            <Fact icon={Wallet} label="Daily budget" value={formatDailyBudget(destination)} />
            <Fact icon={MapPin} label="Good for" value={destination.bestFor[0]} />
          </dl>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href={planHref}
              className="inline-flex items-center gap-2 rounded bg-accent px-5 py-3 font-display text-sm font-semibold text-paper shadow-card transition-colors hover:bg-deep"
            >
              Add to my trip
              <ArrowRight className="h-4 w-4 text-sunset" aria-hidden="true" />
            </Link>
            <Link
              href={planHref}
              className="inline-flex items-center gap-2 rounded bg-surface px-5 py-3 font-display text-sm font-semibold text-accent shadow-card transition-colors hover:bg-accent-soft"
            >
              <Sparkles className="h-4 w-4 text-warm" aria-hidden="true" />
              Ask RoamAI to plan this
            </Link>
          </div>
        </div>

        {/* ── Why go + gallery ───────────────────────────────────────── */}
        <div className="mt-10 grid gap-8 lg:grid-cols-12">
          <section className="lg:col-span-7" aria-labelledby="why-go">
            <h2 id="why-go" className="font-display text-2xl font-bold tracking-tight text-accent">
              Why go
            </h2>
            <p className="mt-3 text-base leading-relaxed text-muted">{destination.whyGo}</p>

            <h3 className="mt-8 font-display text-lg font-bold text-accent">Where to base yourself</h3>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {destination.neighborhoods.map((area) => (
                <li key={area.name} className="rounded-md bg-surface p-3 shadow-card">
                  <span className="block font-display text-sm font-semibold text-accent">{area.name}</span>
                  <span className="mt-0.5 block text-sm text-muted">{area.note}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="lg:col-span-5" aria-labelledby="gallery-heading">
            <h2 id="gallery-heading" className="font-display text-2xl font-bold tracking-tight text-accent">
              In pictures
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {destination.galleryImageQueries.slice(0, 4).map((query, index) => (
                <TravelImage
                  key={query}
                  image={gallery.images[index]}
                  label={query}
                  sizes="(max-width: 1024px) 45vw, 22vw"
                  showCredit
                  className="aspect-square w-full rounded-md"
                />
              ))}
            </div>
            {gallery.images.length === 0 ? (
              <p className="mt-2 text-xs text-muted">
                Photography appears here once an image provider is configured.
              </p>
            ) : null}
          </section>
        </div>

        {/* ── Things to do + food ────────────────────────────────────── */}
        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          <section aria-labelledby="do-heading">
            <h2 id="do-heading" className="font-display text-2xl font-bold tracking-tight text-accent">
              Things to do
            </h2>
            <ul className="mt-3 space-y-2">
              {destination.thingsToDo.map((thing) => (
                <li key={thing} className="flex gap-2.5 rounded-md bg-surface p-3 text-sm text-ink shadow-card">
                  <Compass className="mt-0.5 h-4 w-4 shrink-0 text-warm" aria-hidden="true" />
                  {thing}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="food-heading">
            <h2 id="food-heading" className="font-display text-2xl font-bold tracking-tight text-accent">
              Eat this
            </h2>
            <ul className="mt-3 space-y-2">
              {destination.localFood.map((dish) => (
                <li key={dish.name} className="flex gap-2.5 rounded-md bg-surface p-3 shadow-card">
                  <Utensils className="mt-0.5 h-4 w-4 shrink-0 text-warm" aria-hidden="true" />
                  <span>
                    <span className="block font-display text-sm font-semibold text-accent">{dish.name}</span>
                    <span className="block text-sm text-muted">{dish.note}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ── Sample itinerary ───────────────────────────────────────── */}
        <section className="mt-12" aria-labelledby="itinerary-heading">
          <h2 id="itinerary-heading" className="font-display text-2xl font-bold tracking-tight text-accent">
            A sample {destination.sampleItinerary.length}-day shape
          </h2>
          <p className="mt-2 text-sm text-muted">
            A starting point, not your plan — RoamAI rebuilds this around your pace, budget and rules.
          </p>
          <ol className="mt-4 grid gap-3 md:grid-cols-3">
            {destination.sampleItinerary.map((day) => (
              <li key={day.day} className="rounded-lg bg-surface p-4 shadow-card">
                <span className="font-mono text-[0.6rem] font-bold uppercase tracking-widest text-warm">
                  Day {day.day}
                </span>
                <span className="mt-1 block font-display text-base font-bold text-accent">{day.title}</span>
                <ul className="mt-2 space-y-1.5">
                  {day.stops.map((stop) => (
                    <li key={stop} className="flex gap-2 text-sm text-muted">
                      <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sunset" />
                      {stop}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Practical ──────────────────────────────────────────────── */}
        <section className="mt-12 grid gap-6 rounded-xl bg-accent-soft/60 p-6 lg:grid-cols-2 lg:p-8">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight text-accent">Know before you go</h2>
            <ul className="mt-3 space-y-2">
              {destination.travelTips.map((tip) => (
                <li key={tip} className="flex gap-2 text-sm text-ink">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
          <dl className="space-y-3 self-start rounded-lg bg-surface p-5 shadow-card">
            <div>
              <dt className="font-mono text-[0.6rem] font-bold uppercase tracking-widest text-muted">
                Best time to visit
              </dt>
              <dd className="mt-0.5 text-sm text-ink">{destination.bestTimeToVisit}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.6rem] font-bold uppercase tracking-widest text-muted">
                Daily budget (per person)
              </dt>
              <dd className="mt-0.5 text-sm text-ink">
                €{destination.estimatedDailyBudget.budget} budget · €{destination.estimatedDailyBudget.comfort}{" "}
                comfort · €{destination.estimatedDailyBudget.premium} premium
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[0.6rem] font-bold uppercase tracking-widest text-muted">
                Coordinates
              </dt>
              <dd className="mt-0.5 font-mono text-sm tabular-nums text-ink">
                {destination.latitude.toFixed(4)}, {destination.longitude.toFixed(4)}
              </dd>
            </div>
          </dl>
        </section>

        {/* ── Related ────────────────────────────────────────────────── */}
        <section className="mt-12" aria-labelledby="related-heading">
          <h2 id="related-heading" className="font-display text-2xl font-bold tracking-tight text-accent">
            If you like {destination.name}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((other, index) => (
              <DestinationCard
                key={other.slug}
                destination={toDestinationSummary(other)}
                image={relatedImages[index].images[0]}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md bg-surface p-3 shadow-card">
      <dt className="flex items-center gap-1.5 font-mono text-[0.6rem] font-bold uppercase tracking-widest text-muted">
        <Icon className="h-3 w-3 text-warm" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1 font-display text-sm font-semibold text-accent">{value}</dd>
    </div>
  );
}
