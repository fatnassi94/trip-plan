"use client";

import { useEffect, useState } from "react";
import { readCachedTrip, cacheTrip } from "@/lib/trip-store";
import type { Trip } from "@/types/trip";

// Shared by app/trip/[id]/page.tsx and app/trip/[id]/day/[day]/page.tsx:
// try the session cache first (works with zero backend config, per
// lib/trip-store.ts), and fall back to /api/trips/[id] — the DB fetch
// those pages' own comments long anticipated "once auth + Supabase are
// wired up." Lets a trip opened from app/account's past-trips list
// resolve even when this tab never generated it itself.
export function useTrip(id: string) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);

    const cached = readCachedTrip(id);
    if (cached) {
      setTrip(cached);
      setLoaded(true);
      return;
    }

    // "local" is the id stamped on anonymous/no-Supabase-configured trips
    // (see app/api/trips/generate/route.ts) — it's never a real row, so
    // don't bother making a request that can only 404.
    if (id === "local") {
      setTrip(null);
      setLoaded(true);
      return;
    }

    fetch(`/api/trips/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (cancelled || !payload?.trip) return;
        setTrip(payload.trip as Trip);
        cacheTrip(id, payload.trip as Trip);
      })
      .catch(() => {
        // Not logged in, trip not found, or Supabase unreachable — all
        // just mean "nothing to show", handled by the pages' existing
        // "trip not found" states.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return { trip, loaded };
}
