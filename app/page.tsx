import Link from "next/link";
import { ArrowRight, Compass, Route, Sparkles } from "lucide-react";
import { HeroBackdrop } from "@/components/landing/hero-backdrop";
import { RotatingWord } from "@/components/landing/rotating-word";
import { Reveal } from "@/components/motion/reveal";

// 01 — Landing. One screen, one pitch, one CTA into the golden path
// (Create Trip → Profile → AI Thinking → Trip Overview). See the
// `frontend-design` and `web-design-guidelines` skills before touching
// layout/type/spacing here.
//
// A Server Component: the motion is CSS plus three small client islands
// (<AmbientVideo>, <RotatingWord>, <Reveal>), so nothing here ships a
// framework's worth of JavaScript to animate a gradient.

const DESTINATIONS = [
  "Kyoto",
  "Lisbon",
  "Marrakech",
  "Reykjavík",
  "Mexico City",
  "Hanoi",
  "Sevilla",
  "Tbilisi",
];

const STEPS = [
  {
    icon: Compass,
    label: "01",
    title: "Tell it how you travel",
    body: "Eight taps: the kind of traveler you are, your budget, your pace, how far you'll walk, what you'd rather avoid. No signup wall, no forty-field form.",
  },
  {
    icon: Sparkles,
    label: "02",
    title: "Watch it think",
    body: "You see the reasoning happen — reading your style, exploring the city, choosing places that fit, ordering the route so you're not crossing town twice.",
  },
  {
    icon: Route,
    label: "03",
    title: "Keep it with you",
    body: "A real itinerary you can open hour by hour, change by chat, and lean on once you've actually landed. Not a PDF you'll never reopen.",
  },
];

export default function LandingPage() {
  return (
    <main>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative isolate flex min-h-[100svh] flex-col justify-center overflow-hidden px-6 py-24">
        <HeroBackdrop />

        <div className="mx-auto w-full max-w-3xl">
          <p
            className="roam-rise font-mono text-xs uppercase tracking-[0.2em] text-accent"
            style={{ animationDelay: "80ms" }}
          >
            RoamAI
          </p>

          <h1
            className="roam-rise mt-6 font-display text-[2.75rem] font-semibold leading-[1.05] text-balance sm:text-6xl"
            style={{ animationDelay: "200ms" }}
          >
            Your trip to{" "}
            <span className="block">
              <RotatingWord words={DESTINATIONS} suffix="." />
            </span>
            Built around how <span className="italic">you</span> travel.
          </h1>

          <p
            className="roam-rise mt-8 max-w-xl text-lg leading-relaxed text-ink/80"
            style={{ animationDelay: "340ms" }}
          >
            Tell us where you&apos;re going, when you&apos;re going, and what you
            love. We&apos;ll build a trip around you — then stay with you once
            you land.
          </p>

          <div
            className="roam-rise mt-10 flex flex-col gap-4 sm:flex-row sm:items-center"
            style={{ animationDelay: "460ms" }}
          >
            <Link
              href="/create-trip"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-7 py-4 font-medium text-paper transition-transform duration-300 hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-fit"
            >
              Plan my trip
              <ArrowRight
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>

            <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted">
              <span
                className="roam-pulse inline-block h-1.5 w-1.5 rounded-full bg-accent"
                aria-hidden="true"
              />
              Free · no account needed
            </p>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-24 sm:py-32">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold text-balance sm:text-4xl">
            Three steps, and it knows you.
          </h2>
        </Reveal>

        <ul className="mt-16 grid gap-12 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((step, i) => (
            <Reveal as="li" key={step.label} delay={i * 120}>
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
                {step.label}
              </span>
              <step.icon
                className="mt-6 h-6 w-6 text-accent"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <h3 className="mt-4 font-display text-xl font-semibold">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink/75">{step.body}</p>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* ── The "why this" proof ─────────────────────────────────────── */}
      <section className="border-y border-border bg-accent-soft/40 px-6 py-24 sm:py-32">
        <div className="mx-auto grid max-w-5xl gap-16 sm:grid-cols-2 sm:items-center">
          <Reveal>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
              The difference
            </p>
            <h2 className="mt-5 font-display text-3xl font-semibold text-balance sm:text-4xl">
              Every pick explains itself.
            </h2>
            <p className="mt-6 max-w-md leading-relaxed text-ink/80">
              Most planners hand you a list. RoamAI tells you why each place
              earned its slot in your day — naming the preference and the
              constraint it was matched against. If the reason doesn&apos;t fit
              you, say so in chat and the day rebuilds.
            </p>
          </Reveal>

          <Reveal delay={140}>
            <article className="rounded-lg border border-border bg-paper p-6 shadow-sm transition-transform duration-500 hover:-translate-y-1 sm:p-8">
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-mono text-xs text-muted">12:30 · 90 min</span>
                <span className="font-mono text-xs text-muted">€€</span>
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold">
                Lunch at Osteria da Fortunata
              </h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {["local-food", "pasta", "trastevere"].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-border px-3 py-1 font-mono text-[0.7rem] text-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <p className="mt-6 border-t border-border pt-5 text-sm leading-relaxed">
                <span className="font-mono text-xs uppercase tracking-widest text-accent">
                  Why I chose this for you
                </span>
                <br />
                <span className="mt-2 inline-block text-ink/80">
                  You said Foodie and comfort budget, and you&apos;re walking from
                  the Pantheon at noon — this is handmade Roman pasta eight
                  minutes from where your morning ends, not across the river.
                </span>
              </p>
            </article>
          </Reveal>
        </div>
      </section>

      {/* ── Destination marquee ──────────────────────────────────────── */}
      <section className="overflow-hidden py-20" aria-hidden="true">
        <div className="roam-marquee flex w-max gap-10 whitespace-nowrap">
          {[...DESTINATIONS, ...DESTINATIONS].map((city, i) => (
            <span
              key={`${city}-${i}`}
              className="font-display text-4xl font-semibold text-ink/15 sm:text-6xl"
            >
              {city}
              <span className="px-10 text-accent/30">✦</span>
            </span>
          ))}
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────────────── */}
      <section className="px-6 pb-32">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold text-balance sm:text-4xl">
            Where are you going?
          </h2>
          <p className="mx-auto mt-5 max-w-md leading-relaxed text-ink/75">
            Two minutes from here to a full itinerary that actually sounds like
            your kind of trip.
          </p>
          <Link
            href="/create-trip"
            className="group mt-10 inline-flex items-center justify-center gap-2 rounded-md bg-accent px-7 py-4 font-medium text-paper transition-transform duration-300 hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Plan my trip
            <ArrowRight
              className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Link>
        </Reveal>
      </section>
    </main>
  );
}
