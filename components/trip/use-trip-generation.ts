"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cacheTrip } from "@/lib/trip-store";
import { stashLockedTrip } from "@/lib/pending-trip";
import type { Trip, TripPreview, TripRequest } from "@/types/trip";

// Generates a trip and routes to whatever comes next — the finished
// itinerary, or the paywall.
//
// The traveler always sees the AI Thinking trace first (the caller renders
// it while `status === "generating"`); only when the trip is actually
// built does the server decide whether they get it or a preview of it.
// See app/api/trips/generate/route.ts for that split.
export function useTripGeneration() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "generating" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function generate(request: TripRequest) {
    setStatus("generating");
    setError(null);

    try {
      const res = await fetch("/api/trips/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload?.error ?? "Trip generation failed");
      }

      // Built, but not paid for: hold the preview and send them to the
      // paywall. The itinerary itself never came down the wire.
      if (payload.locked) {
        stashLockedTrip({
          tripId: payload.id as string,
          preview: payload.preview as TripPreview,
        });
        router.push("/unlock");
        return;
      }

      const id: string = payload.id ?? "local";
      cacheTrip(id, payload.trip as Trip);
      router.push(`/trip/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  return { status, error, generate };
}
