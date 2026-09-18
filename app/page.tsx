import Link from "next/link";
import { ArrowRight, Check, Compass, MapPin, Search, Sparkles } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { Carousel } from "@/components/travel/carousel";
import { DestinationCard } from "@/components/travel/destination-card";
import { GuideCard } from "@/components/travel/guide-card";
import { MoodCard } from "@/components/travel/mood-card";
import { SuggestedForYou } from "@/components/travel/suggested-for-you";
import { TravelImage } from "@/components/travel/travel-image";
import {
  MOODS,
  allGuides,
  destinationsByMood,
  featuredDestinations,
} from "@/lib/destination-catalog";
import { toDestinationSummary } from "@/lib/destination-summary";
import { getTravelImage, travelImagesMode } from "@/lib/travel-images";

// 01 — Landing, now a visual discovery home. A Server Component: every
// photo is resolved here (and cached in lib/travel-images), so the browser
// downloads images rather than image-fetching JavaScript. The destination
// bar is still a plain GET form into /create-trip — the first step of the
// planning flow costs no client JS.
//
// Content rule for this page: say only what the product does today. No
// invented reviews, ratings or testimonials.

export const revalidate = 3600;

const QUICK_MOODS = ["Beach", "Food", "Culture", "Weekend", "Nature", "Budget"];

const PIPELINE = [
  { title: "Reads your travel style", detail: "Budget, pace, walking and food preferences" },
  { title: "Picks places that fit", detail: "Each stop matched against your profile" },
  { title: "Orders the route", detail: "Nearby stops grouped so you don't cross town twice" },
  { title: "Checks the plan", detail: "No overlapping times, no overloaded days" },
];

export default async function LandingPage() {
  const featured = featuredDestinations(6);
  const guides = allGuides();
  // Rotates daily so the home page doesn't look identical every visit.
  const heroDestination = featured[new Date().getUTCDate() % featured.length];

  const [heroImage, destinationImages, moodImages, guideImages] = await Promise.all([
    getTravelImage(heroDestination.heroImageQuery, { orientation: "landscape" }),
    Promise.all(featured.map((d) => getTravelImage(d.heroImageQuery))),
    Promise.all(MOODS.map((m) => getTravelImage(m.imageQuery, { orientation: "squarish" }))),
    Promise.all(guides.map((g) => getTravelImage(g.imageQuery))),
  ]);

  const summaries = featured.map(toDestinationSummary);

  return (
    <main>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative isolate">
        <TravelImage
          image={heroImage.images[0]}
          label={`${heroDestination.name}, ${heroDestination.country}`}
          sizes="100vw"
          priority
          showCredit
          plainPlaceholder
          className="min-h-[560px] w-full lg:min-h-[640px]"
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-b from-deep/85 via-deep/70 to-deep/90"
          />
        </TravelImage>

        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto w-full max-w-[1440px] px-5 py-10 text-paper lg:px-12">
            <p className="roam-rise inline-flex items-center gap-2 rounded-full bg-paper/15 px-3.5 py-1.5 backdrop-blur-md">
              <span className="roam-pulse h-2 w-2 rounded-full bg-sunset" aria-hidden="true" />
              <span className="font-mono text-[0.65rem] font-bold uppercase tracking-widest">
                Your AI travel companion
              </span>
            </p>

            <h1
              className="roam-rise mt-5 max-w-3xl font-display text-[2.5rem] font-bold leading-[1.05] tracking-tight text-balance sm:text-6xl"
              style={{ animationDelay: "100ms" }}
            >
              Find the trip worth taking, then have it planned around you.
            </h1>

            <p
              className="roam-rise mt-5 max-w-xl text-lg leading-relaxed text-accent-soft"
              style={{ animationDelay: "200ms" }}
            >
              Browse destinations, guides and moods — then let RoamAI turn the one you love into a
              day-by-day trip built around your pace, budget and walking limits.
            </p>

            {/* Unchanged contract: a GET form straight into /create-trip. */}
            <form
              action="/create-trip"
              method="get"
              className="roam-rise mt-8 flex max-w-2xl flex-col gap-2 rounded-lg bg-surface/95 p-2 shadow-float backdrop-blur-md sm:flex-row"
              style={{ animationDelay: "300ms" }}
            >
              <label className="flex min-w-0 flex-1 items-center gap-2.5 rounded bg-accent-soft/60 px-4 py-3">
                <Search className="h-5 w-5 shrink-0 text-warm" aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-mono text-[0.6rem] font-bold uppercase tracking-widest text-muted">
                    Where to next?
                  </span>
                  <input
                    name="destination"
                    type="text"
                    required
                    maxLength={120}
                    placeholder="Tunis, Tokyo, Amalfi Coast…"
                    className="w-full bg-transparent font-display text-base font-semibold text-accent outline-none placeholder:font-normal placeholder:text-muted/70"
                  />
                </span>
              </label>
              <button
                type="submit"
                className="group flex min-h-[52px] items-center justify-center gap-2 rounded bg-accent px-6 font-display font-semibold text-paper transition-transform hover:bg-deep active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Craft my trip
                <ArrowRight
                  className="h-4 w-4 text-sunset transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </button>
            </form>

            <div
              className="roam-rise mt-5 flex flex-wrap items-center gap-2"
              style={{ animationDelay: "400ms" }}
            >
              <span className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-accent-soft/80">
                Browse
              </span>
              {QUICK_MOODS.map((mood) => (
                <Link
                  key={mood}
                  href={`/destinations?q=${encodeURIComponent(mood.toLowerCase())}`}
                  className="rounded-full bg-paper/15 px-3 py-1.5 font-display text-sm text-paper backdrop-blur-md transition-colors hover:bg-paper hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
                >
                  {mood}
                </Link>
              ))}
            </div>

            <p
              className="roam-rise mt-6 flex items-center gap-2 text-sm text-accent-soft/90"
              style={{ animationDelay: "500ms" }}
            >
              <MapPin className="h-4 w-4 text-sunset" aria-hidden="true" />
              Today&apos;s view: {heroDestination.name}, {heroDestination.country}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-5 lg:px-12">
        {/* ── Trending ───────────────────────────────────────────────── */}
        <section className="py-14" aria-labelledby="trending-heading">
          <Reveal className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-warm">
                Trending now
              </p>
              <h2
                id="trending-heading"
                className="mt-1 font-display text-3xl font-bold tracking-tight text-accent"
              >
                Destinations worth the flight
              </h2>
            </div>
            <Link
              href="/destinations"
              className="inline-flex items-center gap-1.5 rounded bg-surface px-4 py-2.5 font-display text-sm font-semibold text-accent shadow-card transition-colors hover:bg-accent-soft"
            >
              Explore all
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Reveal>

          <Carousel label="Trending destinations">
            {summaries.map((destination, index) => (
              <DestinationCard
                key={destination.slug}
                destination={destination}
                image={destinationImages[index].images[0]}
                className="h-full"
              />
            ))}
          </Carousel>
        </section>

        {/* ── Moods ──────────────────────────────────────────────────── */}
        <section className="pb-14" aria-labelledby="moods-heading">
          <Reveal className="mb-6">
            <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-warm">
              Browse by mood
            </p>
            <h2
              id="moods-heading"
              className="mt-1 font-display text-3xl font-bold tracking-tight text-accent"
            >
              What kind of trip are you after?
            </h2>
          </Reveal>

          <Reveal className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {MOODS.map((mood, index) => (
              <MoodCard
                key={mood.id}
                mood={mood}
                image={moodImages[index].images[0]}
                count={destinationsByMood(mood.id).length}
              />
            ))}
          </Reveal>
        </section>

        {/* ── Suggested ──────────────────────────────────────────────── */}
        <section className="pb-14">
          <Reveal>
            <SuggestedForYou destinations={summaries} />
          </Reveal>
        </section>

        {/* ── Guides ─────────────────────────────────────────────────── */}
        <section className="pb-14" aria-labelledby="guides-heading">
          <Reveal className="mb-6">
            <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-warm">
              Curated guides
            </p>
            <h2
              id="guides-heading"
              className="mt-1 font-display text-3xl font-bold tracking-tight text-accent"
            >
              Start from someone else&apos;s route
            </h2>
          </Reveal>

          <Reveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {guides.map((guide, index) => (
              <GuideCard key={guide.slug} guide={guide} image={guideImages[index].images[0]} />
            ))}
          </Reveal>
        </section>

        {/* ── How it plans ───────────────────────────────────────────── */}
        <section className="pb-14" aria-labelledby="pipeline-heading">
          <Reveal className="overflow-hidden rounded-xl bg-accent-soft/60 p-6 lg:p-10">
            <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-accent">
              How it plans
            </p>
            <h2
              id="pipeline-heading"
              className="mt-1 max-w-xl font-display text-2xl font-bold tracking-tight text-accent sm:text-3xl"
            >
              Every itinerary goes through the same four steps.
            </h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PIPELINE.map((step, index) => (
                <li key={step.title} className="rounded-lg bg-surface p-4 shadow-card">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent font-display text-xs font-bold text-paper">
                    {index + 1}
                  </span>
                  <span className="mt-3 block font-display text-sm font-bold text-accent">
                    {step.title}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted">{step.detail}</span>
                </li>
              ))}
            </ol>
          </Reveal>
        </section>

        {/* ── Closing ────────────────────────────────────────────────── */}
        <section className="pb-16">
          <Reveal className="relative isolate overflow-hidden rounded-xl bg-deep px-6 py-12 text-paper shadow-float lg:px-12">
            <div
              aria-hidden="true"
              className="roam-blob-a absolute -bottom-20 -right-20 -z-10 h-80 w-80 rounded-full bg-sunset/25 blur-3xl"
            />
            <p className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-widest text-warm-soft">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Ready to explore?
            </p>
            <h2 className="mt-4 max-w-2xl font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Pick a place you like. RoamAI does the day-by-day.
            </h2>
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-accent-soft">
              {["A reason behind every pick", "Day-by-day route maps", "Free to start planning"].map(
                (badge) => (
                  <li key={badge} className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-sage" strokeWidth={3} aria-hidden="true" />
                    {badge}
                  </li>
                ),
              )}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/create-trip"
                className="group inline-flex items-center gap-2 rounded bg-sunset px-6 py-3.5 font-display font-semibold text-deep shadow-card transition-transform hover:bg-warm hover:text-paper active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
              >
                Plan your first trip
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
              <Link
                href="/destinations"
                className="inline-flex items-center gap-2 rounded bg-paper/10 px-6 py-3.5 font-display font-semibold text-paper backdrop-blur-md transition-colors hover:bg-paper/20"
              >
                <Compass className="h-4 w-4" aria-hidden="true" />
                Browse destinations
              </Link>
            </div>
          </Reveal>
        </section>

        {travelImagesMode() === "off" && process.env.NODE_ENV !== "production" ? (
          <p className="pb-8 text-center font-mono text-[0.65rem] uppercase tracking-widest text-muted">
            Dev note: destination photography is disabled (TRAVEL_IMAGES_MODE=off)
          </p>
        ) : null}
      </div>
    </main>
  );
}
