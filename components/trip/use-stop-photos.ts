"use client";

import { useEffect, useState } from "react";
import type { TravelImage } from "@/lib/travel-images/types";

// Photography for one stop, fetched through our own API route so the
// Unsplash key stays on the server (see app/api/travel-images/route.ts).
//
// Two queries, not one. "Castelo de São Jorge, Lisbon" finds the actual
// landmark; a neighbourhood tapas bar finds nothing, and falling back to
// the city keeps the panel full of the right place rather than empty. If
// both come back empty the dialog says so — no stock photo of somewhere
// else standing in for a stop the traveler is about to walk to.

export type StopPhotosStatus = "loading" | "ready" | "empty" | "failed";

interface StopPhotos {
  images: TravelImage[];
  status: StopPhotosStatus;
  /** True when these are photos of the city, not of the stop itself. */
  broadened: boolean;
}

async function search(query: string, count: number, signal: AbortSignal): Promise<TravelImage[]> {
  const res = await fetch(
    `/api/travel-images?query=${encodeURIComponent(query)}&count=${count}`,
    { signal },
  );
  if (!res.ok) throw new Error(`Image search failed: ${res.status}`);
  const body = (await res.json()) as { images?: TravelImage[] };
  return body.images ?? [];
}

export function useStopPhotos(
  stopName: string,
  destination: string,
  { enabled = true, count = 6 }: { enabled?: boolean; count?: number } = {},
): StopPhotos {
  const [state, setState] = useState<StopPhotos>({
    images: [],
    status: "loading",
    broadened: false,
  });

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();

    (async () => {
      setState({ images: [], status: "loading", broadened: false });
      try {
        const exact = await search(`${stopName}, ${destination}`, count, controller.signal);
        if (exact.length > 0) {
          setState({ images: exact, status: "ready", broadened: false });
          return;
        }

        const city = await search(destination, count, controller.signal);
        setState({
          images: city,
          status: city.length > 0 ? "ready" : "empty",
          broadened: city.length > 0,
        });
      } catch (err) {
        // An aborted fetch is this effect being cleaned up, not a failure.
        if (controller.signal.aborted) return;
        console.error("Stop photos failed", err);
        setState({ images: [], status: "failed", broadened: false });
      }
    })();

    return () => controller.abort();
  }, [stopName, destination, enabled, count]);

  return state;
}
