import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit inside the window, then blocks with a retry time", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(limiter.check("a", 0)).toEqual({ ok: true, remaining: 1, retryAfterMs: 0 });
    expect(limiter.check("a", 100)).toEqual({ ok: true, remaining: 0, retryAfterMs: 0 });
    expect(limiter.check("a", 400)).toEqual({ ok: false, remaining: 0, retryAfterMs: 600 });
  });

  it("counts each key separately", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(limiter.check("a", 0).ok).toBe(true);
    expect(limiter.check("b", 0).ok).toBe(true);
    expect(limiter.check("a", 1).ok).toBe(false);
  });

  it("lets requests through again once old ones leave the window", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(limiter.check("a", 0).ok).toBe(true);
    expect(limiter.check("a", 999).ok).toBe(false);
    expect(limiter.check("a", 1000).ok).toBe(true);
  });

  it("blocked attempts don't extend the wait", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    limiter.check("a", 0);
    limiter.check("a", 500);
    expect(limiter.check("a", 1000).ok).toBe(true);
  });

  it("reset clears every count", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    limiter.check("a", 0);
    limiter.reset();
    expect(limiter.check("a", 1).ok).toBe(true);
  });
});
