"use client";

import { useState } from "react";
import { Check, Star } from "lucide-react";

interface TripRatingProps {
  tripId: string;
  initialRating: number | null;
  initialComment: string | null;
}

// 1-5 star rating + optional comment for a past trip. role="radiogroup"
// of role="radio" stars, same accessible pattern as
// components/plans/plan-card.tsx and the earlier budget segmented
// control — one value, clearly announced, keyboard-usable via Tab +
// clicking (stars aren't ordered left-to-right in a way arrow keys would
// add much over Tab, so no custom arrow-key handling here).
export function TripRating({ tripId, initialRating, initialComment }: TripRatingProps) {
  const [rating, setRating] = useState(initialRating ?? 0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState(initialComment ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const displayRating = hovered || rating;
  const dirty =
    rating !== (initialRating ?? 0) || comment.trim() !== (initialComment ?? "").trim();

  async function save() {
    setStatus("saving");
    try {
      const res = await fetch("/api/trips/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, rating, comment: comment.trim() || undefined }),
      });
      if (!res.ok) throw new Error();
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-muted">
          How did it go?
        </p>
        <div
          role="radiogroup"
          aria-label="Rate this trip out of 5 stars"
          className="flex gap-0.5"
          onMouseLeave={() => setHovered(0)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onMouseEnter={() => setHovered(n)}
              onClick={() => {
                setRating(n);
                setStatus("idle");
              }}
              className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Star
                className={`h-5 w-5 transition-colors ${
                  displayRating >= n ? "fill-sunset text-sunset" : "text-border"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={comment}
        onChange={(e) => {
          setComment(e.target.value);
          setStatus("idle");
        }}
        aria-label="Note about this trip"
        placeholder="Add a note about this trip (optional)"
        rows={2}
        maxLength={500}
        className="mt-3 w-full rounded border border-border bg-surface px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted/60 focus:border-accent focus:ring-4 focus:ring-accent/10"
      />

      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={rating === 0 || status === "saving" || !dirty}
          className="rounded bg-accent-soft px-4 py-2 font-display text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-paper disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-accent-soft disabled:hover:text-accent"
        >
          {status === "saving" ? "Saving…" : "Save rating"}
        </button>
        {status === "saved" ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent" role="status">
            <Check className="h-3.5 w-3.5 text-sage" strokeWidth={3} aria-hidden="true" />
            Saved
          </span>
        ) : status === "error" ? (
          <span className="text-xs text-warm" role="alert">
            Couldn&apos;t save — try again.
          </span>
        ) : null}
      </div>
    </div>
  );
}
