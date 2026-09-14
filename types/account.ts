// Account-side shapes — distinct from types/trip.ts, which covers the
// AI's own output. These describe rows read back from Supabase
// (supabase/schema.sql), not anything the model generates.

import type { PlanId, SubscriptionStatus } from "@/lib/plans";

export interface AccountStatus {
  loggedIn: boolean;
  hasActivePlan: boolean;
  planType: PlanId | null;
  /** False when Supabase auth itself isn't configured for this deployment
   * (see lib/supabase/config.ts) — distinct from "logged out", since the
   * UI needs to tell those two apart (show a setup notice vs. a login form). */
  authConfigured: boolean;
}

export interface AccountProfile {
  planType: PlanId | null;
  subscriptionStatus: SubscriptionStatus;
}

/** A trip as stored in Supabase, read back for the account page — not the
 * full AI-generated itinerary (see types/trip.ts Trip), just the summary
 * row plus whatever satisfaction rating the traveler has left. */
export interface PastTrip {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  createdAt: string;
  rating: number | null;
  ratingComment: string | null;
}
