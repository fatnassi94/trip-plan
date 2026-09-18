// In-memory sliding-window rate limiter for routes that spend AI quota
// (see the `api-security` and `ai-security` skills: an unthrottled AI
// endpoint is a denial-of-quota vector on a free tier).
//
// Scope, stated plainly: counts live in one server instance's memory. On
// serverless hosting each warm instance keeps its own counts, so this caps
// abuse per instance rather than enforcing an exact global quota — right
// for MVP traffic. Move to a Supabase- or Redis-backed counter before real
// launch; callers only use check(), so nothing else needs to change.

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** How long until the oldest counted request leaves the window. */
  retryAfterMs: number;
}

export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, number[]>();

  return {
    check(key: string, now = Date.now()): RateLimitResult {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

      if (recent.length >= limit) {
        hits.set(key, recent);
        return { ok: false, remaining: 0, retryAfterMs: windowMs - (now - recent[0]) };
      }

      recent.push(now);
      hits.set(key, recent);

      // Keep memory bounded: drop keys whose every hit has aged out.
      if (hits.size > 10_000) {
        for (const [k, times] of hits) {
          if (times.every((t) => now - t >= windowMs)) hits.delete(k);
        }
      }

      return { ok: true, remaining: limit - recent.length, retryAfterMs: 0 };
    },
    reset() {
      hits.clear();
    },
  };
}

/** AI Assistant edits: 12 requests per traveler (or IP) per 10 minutes. */
export const assistantRateLimiter = createRateLimiter({ limit: 12, windowMs: 10 * 60 * 1000 });

/**
 * Destination photography: Unsplash's free tier allows 50 requests an
 * hour for the whole app, so one browser may not burn them all. Generous
 * enough for a gallery, tight enough to stop a script.
 */
export const imageRateLimiter = createRateLimiter({ limit: 60, windowMs: 60 * 1000 });
