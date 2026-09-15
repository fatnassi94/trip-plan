import { Check } from "lucide-react";
import { CreateTripForm } from "@/components/create-trip/create-trip-form";
import { RouteArt } from "@/components/brand/route-art";
import { PlannerProgress } from "@/components/trip/planner-progress";

// 02 — Create Trip. Destination, dates, travelers — nothing else on this
// screen. Preferences live on /profile, one step later, so this stays fast.
// The page stays a Server Component; the interactive parts live in
// <CreateTripForm>. A destination typed into the landing page's bar
// arrives as ?destination= and pre-fills the form.

const NEXT_QUESTIONS = [
  "What kind of traveler you are",
  "Your budget",
  "Your pace and how much you like to walk",
  "Food you love, and anything to avoid",
];

export default function CreateTripPage({
  searchParams,
}: {
  searchParams: { destination?: string | string[] };
}) {
  const raw = searchParams.destination;
  const initialDestination =
    typeof raw === "string" && raw.trim() ? raw.trim().slice(0, 120) : undefined;

  return (
    <main className="mx-auto max-w-[1440px] px-5 pb-32 lg:px-12">
      <PlannerProgress
        current={1}
        title="Where are you going?"
        subtitle="Pick a destination and your dates. Your travel style comes next."
      />

      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* No entrance animation on this wrapper: the form's action bar is
            position:fixed, and a transform on any ancestor would pin it
            inside this card for the length of the animation. */}
        <section className="rounded-lg bg-surface p-6 shadow-card sm:p-8 lg:col-span-7">
          <CreateTripForm initialDestination={initialDestination} />
        </section>

        <aside
          className="roam-rise relative isolate overflow-hidden rounded-lg bg-deep p-6 text-paper shadow-lift sm:p-8 lg:sticky lg:top-24 lg:col-span-5"
          style={{ animationDelay: "200ms" }}
        >
          <RouteArt className="absolute inset-0 -z-10 h-full w-full opacity-70" />
          <div
            aria-hidden="true"
            className="absolute -right-16 -top-16 -z-10 h-56 w-56 rounded-full bg-sunset/25 blur-3xl"
          />
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-warm-soft">
            Up next · Step 2
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">Your travel DNA</h2>
          <p className="mt-2 text-sm leading-relaxed text-accent-soft/90">
            A few quick taps about how you travel. Every stop in your itinerary is picked
            against these answers:
          </p>
          <ul className="mt-5 space-y-2.5">
            {NEXT_QUESTIONS.map((q) => (
              <li key={q} className="flex items-center gap-2.5 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-paper/15 text-sage">
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                </span>
                {q}
              </li>
            ))}
          </ul>
          <p className="mt-6 rounded border-l-[3px] border-sunset bg-paper/10 p-3 text-xs leading-relaxed text-accent-soft/90 backdrop-blur-sm">
            Your dates set how many days get planned. Each day gets its own timeline and
            route map.
          </p>
        </aside>
      </div>
    </main>
  );
}
