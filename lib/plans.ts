// The plan catalog behind /unlock. No real payment provider is wired up
// yet (see the project plan's "payments" out-of-scope note — this feature
// is the explicit exception to it) — selecting a plan is a mock purchase
// that immediately marks the subscription active (see
// app/api/account/select-plan/route.ts). Swap the "mock purchase" part
// for a real checkout later without touching anything that reads
// `PlanId`/`plan_type` elsewhere in the app.

export type PlanId = "single" | "basic" | "pro";
export type SubscriptionStatus = "none" | "active";

export interface Plan {
  id: PlanId;
  name: string;
  priceLabel: string;
  /** "one-time" plans are a single purchase, not a recurring subscription. */
  interval: "one-time" | "month";
  tagline: string;
  features: string[];
  /** Draws the eye to the entry-level option on /unlock. */
  highlight?: boolean;
}

export const PLANS: readonly Plan[] = [
  {
    id: "single",
    name: "Single trip",
    priceLabel: "$8",
    interval: "one-time",
    tagline: "Pay once, no subscription",
    features: ["This trip, unlocked in full", "Day-by-day itinerary", "Maps and photos of every stop"],
    highlight: true,
  },
  {
    id: "basic",
    name: "Basic",
    priceLabel: "$15/mo",
    interval: "month",
    tagline: "For the occasional traveler",
    features: ["Unlimited AI-generated itineraries", "Day-by-day planning", "Email support"],
  },
  {
    id: "pro",
    name: "Pro",
    priceLabel: "$35/mo",
    interval: "month",
    tagline: "For frequent travelers",
    features: [
      "Everything in Basic",
      "Priority itinerary regeneration",
      "Trip history & ratings",
      "Priority support",
    ],
  },
];

export function findPlan(id: string | null | undefined): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}
