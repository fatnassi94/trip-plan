"use client";

import type { Trip } from "@/types/trip";

// Client-side cache for a generated trip, so the app is fully usable with
// ONLY a Gemini key — no Supabase project required to see a real
// itinerary end to end. Once Supabase is configured, generated trips also
// get a database id and this becomes just a fast local cache.
//
// sessionStorage (not localStorage) on purpose: a trip in progress is
// per-tab scratch state, and clearing it on tab close is the behaviour we
// want while there's no account to attach it to.

const PREFIX = "roamai:trip";

export function cacheTrip(id: string, trip: Trip): void {
  try {
    sessionStorage.setItem(`${PREFIX}:${id}`, JSON.stringify(trip));
    sessionStorage.setItem(`${PREFIX}:last`, id);
  } catch {
    // Private mode / storage disabled — the trip just won't survive a
    // reload. Never let a storage failure break the render path.
  }
}

export function readCachedTrip(id: string): Trip | null {
  try {
    const raw = sessionStorage.getItem(`${PREFIX}:${id}`);
    return raw ? (JSON.parse(raw) as Trip) : null;
  } catch {
    return null;
  }
}

export function readLastTripId(): string | null {
  try {
    return sessionStorage.getItem(`${PREFIX}:last`);
  } catch {
    return null;
  }
}
