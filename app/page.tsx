import Link from "next/link";
import {
  ArrowRight,
  Check,
  Compass,
  Fingerprint,
  Map,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { Reveal } from "@/components/motion/reveal";

// 01 — Landing, in the Editorial Voyage design. A Server Component: the
// destination bar is a plain GET form into /create-trip, so the pitch and
// the first step of the golden path cost no client JavaScript.
//
// Content rule for this page: say only what the product does today. The
// design mockup carried testimonials, ratings and "7 agents" claims that
// nothing here backs up, so they are left out rather than invented.

const SUGGESTIONS = [
  { label: "Kyoto tea walks", destination: "Kyoto, Japan" },
  { label: "Lisbon food & tiles", destination: "Lisbon, Portugal" },
  { label: "Marrakech medina", destination: "Marrakech, Morocco" },
];

const PIPELINE = [
  { title: "Reads your travel style", detail: "Budget, pace, walking and food preferences" },
  { title: "Picks places that fit", detail: "Each stop matched against your profile" },
  { title: "Orders the route", detail: "Nearby stops grouped so you don't cross town twice" },
  { title: "Checks the plan", detail: "No overlapping times, no overloaded days" },
];

const PILLARS = [
  {
    icon: Fingerprint,
    tag: "Pillar 01",
    title: "Learns your travel DNA",
    body: "Pick the kind of traveler you are, set your budget, pace and walking comfort, and tell it what you'd rather avoid. Every trip is built from that profile.",
  },
  {
    icon: Map,
    tag: "Pillar 02",
    title: "Plans you can check",
    body: "A real day-by-day itinerary with times, addresses, route maps and a specific reason behind every stop. Nothing is saved until it passes schedule checks.",
  },
  {
    icon: MessageCircle,
    tag: "Pillar 03",
    title: "Stays with you",
    body: "Once the trip starts, ask for changes when it rains or you're tired, and the day adapts. This companion is the next feature being built.",
    soon: true,
  },
];

const FLOW = [
  {
    n: "01",
    title: "Share your style",
    body: "Destination, dates and a few taps about how you like to travel.",
  },
  {
    n: "02",
    title: "Watch it build",
    body: "See each planning step as your itinerary comes together.",
  },
  {
    n: "03",
    title: "Explore your days",
    body: "Open each day hour by hour, with the route mapped and every pick explained.",
  },
];

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-[1440px] px-5 lg:px-12">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative isolate pb-16 pt-12 text-center lg:pt-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-[420px] w-[min(1000px,100%)] -translate-x-1/2 rounded-full bg-gradient-to-b from-accent-soft via-warm-soft/40 to-transparent blur-3xl"
        />

        <p className="roam-rise inline-flex items-center gap-2 rounded-full bg-surface px-3.5 py-1.5 shadow-card">
          <span className="roam-pulse h-2 w-2 rounded-full bg-sunset" aria-hidden="true" />
          <span className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-accent">
            Your AI travel companion
          </span>
        </p>

        <h1
          className="roam-rise mx-auto mt-6 max-w-4xl font-display text-[2.4rem] font-bold leading-[1.1] tracking-tight text-deep text-balance sm:text-6xl"
          style={{ animationDelay: "120ms" }}
        >
          An AI that knows you, builds your trip, then travels{" "}
          <span className="font-medium italic text-warm">with you.</span>
        </h1>

        <p
          className="roam-rise mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted"
          style={{ animationDelay: "240ms" }}
        >
          Not another generic itinerary generator. RoamAI learns how you actually travel —
          your pace, appetite, budget and curiosity — and plans every day around it.
        </p>

        {/* Destination bar */}
        <div
          className="roam-rise mx-auto mt-10 max-w-3xl rounded-lg bg-surface p-2 text-left shadow-float"
          style={{ animationDelay: "360ms" }}
        >
          <form action="/create-trip" method="get" className="grid gap-2 md:grid-cols-12">
            <label className="flex items-center gap-3 rounded bg-accent-soft/60 px-4 py-3 md:col-span-9">
              <Compass className="h-5 w-5 shrink-0 text-warm" aria-hidden="true" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-mono text-[0.6rem] font-bold uppercase tracking-widest text-muted">
                  Where to next?
                </span>
                <input
                  name="destination"
                  type="text"
                  required
                  maxLength={120}
                  placeholder="Paris, Tokyo, Amalfi Coast…"
                  className="w-full bg-transparent font-display text-base font-semibold text-accent outline-none placeholder:font-normal placeholder:text-muted/70"
                />
              </span>
            </label>
            <button
              type="submit"
              className="group flex min-h-[52px] items-center justify-center gap-2 rounded bg-accent px-5 font-display font-semibold text-paper shadow-card transition-transform hover:bg-deep active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:col-span-3"
            >
              Craft my trip
              <ArrowRight
                className="h-4 w-4 text-sunset transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </button>
          </form>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pb-1 pt-2.5 text-xs text-muted">
            <span className="font-display font-semibold text-accent">Try:</span>
            {SUGGESTIONS.map((s) => (
              <Link
                key={s.destination}
                href={`/create-trip?destination=${encodeURIComponent(s.destination)}`}
                className="underline decoration-dotted underline-offset-4 transition-colors hover:text-warm"
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>

        <ul
          className="roam-rise mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-display text-sm text-muted"
          style={{ animationDelay: "480ms" }}
        >
          {["A reason behind every pick", "Day-by-day route maps", "Free to start planning"].map(
            (badge) => (
              <li key={badge} className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-sage" strokeWidth={3} aria-hidden="true" />
                {badge}
              </li>
            ),
          )}
        </ul>
      </section>

      {/* ── How a trip gets built ────────────────────────────────────── */}
      <section className="py-12">
        <Reveal className="mb-6">
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-warm">
            How it plans
          </p>
          <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight text-accent">
            Behind the curtain of your itinerary
          </h2>
        </Reveal>

        <div className="grid items-start gap-5 lg:grid-cols-12">
          <Reveal className="rounded-lg bg-surface p-6 shadow-card lg:col-span-5">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded bg-accent text-sunset">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="font-display text-lg font-semibold text-accent">
                The planning pipeline
              </span>
            </div>
            <p className="mt-3 text-sm text-muted">
              Every itinerary goes through the same steps, and you watch them happen while
              your trip is built.
            </p>
            <ol className="relative mt-5 space-y-4">
              <span
                aria-hidden="true"
                className="absolute bottom-3 left-3.5 top-3 w-0.5 bg-accent-soft"
              />
              {PIPELINE.map((step) => (
                <li key={step.title} className="relative flex items-start gap-3">
                  <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sage/25 text-accent">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-display text-sm font-semibold text-accent">
                      {step.title}
                    </span>
                    <span className="block text-sm text-muted">{step.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Reveal>

          <Reveal delay={120} className="lg:col-span-7">
            <article className="overflow-hidden rounded-lg bg-surface shadow-card">
              <div className="relative bg-gradient-to-br from-deep via-accent to-warm px-6 pb-6 pt-16 text-paper">
                <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-warm-soft">
                  Example · Day 2 · 12:30 · Rome
                </p>
                <h3 className="mt-1 font-display text-2xl font-bold">
                  Lunch at Osteria da Fortunata
                </h3>
              </div>
              <div className="p-6">
                <div className="rounded border-l-[3px] border-sunset bg-gradient-to-br from-accent-soft/60 to-warm-soft/30 p-4">
                  <p className="flex items-center gap-2 font-display text-sm font-bold text-accent">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    Why RoamAI chose this for you
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">
                    You picked Foodie with a comfort budget, and your morning ends at the
                    Pantheon — this is handmade Roman pasta eight minutes away, not across the
                    river.
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["€€ · 90 min", "local-food", "pasta", "Trastevere"].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-accent-soft px-3 py-1 font-mono text-[0.7rem] font-semibold text-accent"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          </Reveal>
        </div>
      </section>

      {/* ── Pillars ──────────────────────────────────────────────────── */}
      <section className="py-16">
        <Reveal className="mx-auto mb-10 max-w-2xl text-center">
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-warm">
            Built for real travelers
          </p>
          <h2 className="mt-1 font-display text-3xl font-bold tracking-tight text-accent text-balance sm:text-4xl">
            A system built for how trips actually unfold.
          </h2>
        </Reveal>
        <ul className="grid gap-5 md:grid-cols-3">
          {PILLARS.map((pillar, i) => (
            <Reveal
              as="li"
              key={pillar.title}
              delay={i * 100}
              className="flex flex-col rounded-lg bg-surface p-6 shadow-card transition-shadow hover:shadow-lift"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-md bg-accent text-sunset">
                <pillar.icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="mt-5 flex items-center gap-2">
                <span className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-warm">
                  {pillar.tag}
                </span>
                {pillar.soon ? (
                  <span className="rounded-full bg-warm-soft px-2 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-widest text-warm">
                    Coming next
                  </span>
                ) : null}
              </span>
              <h3 className="mt-1 font-display text-xl font-bold text-accent">{pillar.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{pillar.body}</p>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* ── Journey flow ─────────────────────────────────────────────── */}
      <section className="rounded-lg bg-accent-soft/60 px-6 py-12 lg:px-12">
        <Reveal className="max-w-xl">
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-accent">
            The journey flow
          </p>
          <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight text-accent">
            From a destination to your whole trip, in minutes.
          </h2>
        </Reveal>
        <ol className="mt-8 grid gap-8 md:grid-cols-3">
          {FLOW.map((step, i) => (
            <Reveal as="li" key={step.n} delay={i * 100}>
              <span className="font-display text-5xl font-bold text-accent/15">{step.n}</span>
              <h3 className="mt-1 font-display text-lg font-bold text-accent">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* ── Closing banner ───────────────────────────────────────────── */}
      <section className="py-16">
        <Reveal className="relative isolate overflow-hidden rounded-lg bg-deep px-6 py-12 text-paper shadow-float lg:px-12">
          <div
            aria-hidden="true"
            className="absolute -bottom-20 -right-20 -z-10 h-80 w-80 rounded-full bg-sunset/25 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute -left-20 -top-20 -z-10 h-80 w-80 rounded-full bg-sage/15 blur-3xl"
          />
          <p className="inline-flex rounded-full bg-accent px-3 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-widest text-warm-soft">
            Ready to explore?
          </p>
          <h2 className="mt-4 max-w-2xl font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Your next trip starts with one destination.
          </h2>
          <p className="mt-3 max-w-xl text-accent-soft/90">
            Personalized day-by-day itineraries, mapped routes, and a reason behind every stop.
          </p>
          <Link
            href="/create-trip"
            className="group mt-8 inline-flex items-center gap-2 rounded bg-sunset px-6 py-3.5 font-display font-semibold text-deep shadow-card transition-transform hover:bg-warm hover:text-paper active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
          >
            Plan your first trip
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </Reveal>
      </section>
    </main>
  );
}
