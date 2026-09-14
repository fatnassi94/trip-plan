"use client";

import type { TripPreview } from "@/types/trip";

// Carries a generated-but-unpaid trip across the /unlock detour.
//
// The traveler fills in /profile, watches the AI Thinking trace, and the
// trip really is built — but /api/trips/generate returns only a preview
// plus the id of the row holding the real itinerary. That pair is stashed
// here so /unlock can show them what they're buying ("your 5-day Lisbon
// trip is ready") and then claim it once they've picked a plan and signed
// in.
//
// Only the preview lives in sessionStorage — never the itinerary, which
// stays server-side until app/api/trips/claim hands it over. sessionStorage
// matches lib/trip-store.ts's reasoning: per-tab scratch state.

const KEY = "roamai:locked-trip";

export interface LockedTrip {
  tripId: string;
  preview: TripPreview;
}

export function stashLockedTrip(locked: LockedTrip): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(locked));
  } catch {
    // Private mode / storage disabled — /unlock will fall back to sending
    // the traveler to /create-trip rather than showing a blank paywall.
  }
}

export function readLockedTrip(): LockedTrip | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LockedTrip) : null;
  } catch {
    return null;
  }
}

export function clearLockedTrip(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clean up if storage isn't available in the first place.
  }
}
