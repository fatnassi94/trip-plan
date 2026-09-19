import { describe, expect, it } from "vitest";
import { AIProviderError, aiErrorResponse, isAIProviderError, isRetryable } from "@/lib/ai/errors";
import { classifyGeminiError, modelChain } from "@/lib/ai/providers/gemini";

// The real shapes, copied from a dev-server log. Google puts the useful
// part in a JSON string on `message` and the code on `status`.
const overloaded = Object.assign(
  new Error(
    '{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}',
  ),
  { status: 503 },
);

const exhausted = Object.assign(
  new Error(
    '{"error":{"code":429,"message":"You exceeded your current quota.","status":"RESOURCE_EXHAUSTED","details":[{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"33.47216065s"}]}}',
  ),
  { status: 429 },
);

describe("classifyGeminiError", () => {
  it("reads a 503 as a temporary overload worth retrying", () => {
    const err = classifyGeminiError(overloaded, "gemini-2.5-flash");
    expect(err.kind).toBe("overloaded");
    expect(err.model).toBe("gemini-2.5-flash");
    expect(isRetryable(err)).toBe(true);
  });

  it("reads a 429 as quota, and keeps the provider's own retry delay", () => {
    const err = classifyGeminiError(exhausted, "gemini-3.5-flash");
    expect(err.kind).toBe("quota");
    expect(err.retryAfterMs).toBe(33472);
    // Retrying the same prompt against an exhausted model is pure waste.
    expect(isRetryable(err)).toBe(false);
  });

  it("separates a rejected key from an unknown model", () => {
    expect(classifyGeminiError(Object.assign(new Error("nope"), { status: 403 }), "m").kind).toBe("auth");
    expect(classifyGeminiError(Object.assign(new Error("nope"), { status: 404 }), "m").kind).toBe(
      "bad_request",
    );
  });

  it("names a dropped connection as a network failure, and retries it", () => {
    // Seen live: the request never reaches Google, so there is no HTTP
    // status to read. Logging these as "unknown" sends whoever reads the
    // logs hunting for a bug that isn't in this codebase.
    const err = classifyGeminiError(new Error("socket hang up"), "m");
    expect(err.kind).toBe("network");
    expect(isRetryable(err)).toBe(true);
    expect(isAIProviderError(err)).toBe(true);
  });

  it("reads a network failure off the error's cause as well as its message", () => {
    const err = classifyGeminiError(
      Object.assign(new Error("fetch failed"), { cause: { code: "ECONNRESET" } }),
      "m",
    );
    expect(err.kind).toBe("network");
  });

  it("does not mistake a real HTTP failure for a network one", () => {
    // A 400 carrying the word "timeout" is still the provider answering.
    const err = classifyGeminiError(Object.assign(new Error("request timeout"), { status: 400 }), "m");
    expect(err.kind).toBe("bad_request");
    expect(isRetryable(err)).toBe(false);
  });

  it("still has an honest fallback for something it cannot place", () => {
    const err = classifyGeminiError(new Error("something odd happened"), "m");
    expect(err.kind).toBe("unknown");
    expect(err.message).toBe("something odd happened");
  });
});

describe("modelChain", () => {
  it("puts the configured model first and dedupes the fallbacks", () => {
    process.env.GEMINI_MODEL = "gemini-3.5-flash";
    process.env.GEMINI_FALLBACK_MODELS = "gemini-2.5-flash, gemini-3.5-flash ,";
    expect(modelChain()).toEqual(["gemini-3.5-flash", "gemini-2.5-flash"]);
  });

  it("can be reduced to a single model", () => {
    process.env.GEMINI_MODEL = "gemini-2.5-flash";
    process.env.GEMINI_FALLBACK_MODELS = "";
    expect(modelChain()).toEqual(["gemini-2.5-flash"]);
  });
});

describe("aiErrorResponse", () => {
  it("reports an overloaded service as 503, not as bad model output", () => {
    const res = aiErrorResponse(new AIProviderError("overloaded", "busy"), "fallback");
    expect(res.status).toBe(503);
    expect(res.error).toMatch(/busy right now/i);
    expect(res.retryAfterSeconds).toBe(30);
  });

  it("reports exhausted quota as 429 and says how long to wait", () => {
    const res = aiErrorResponse(
      new AIProviderError("quota", "spent", { retryAfterMs: 33472 }),
      "fallback",
    );
    expect(res.status).toBe(429);
    expect(res.error).toMatch(/usage limit.*34 seconds/i);
    expect(res.retryAfterSeconds).toBe(34);
  });

  it("tells the traveler the service was unreachable, not that their trip was bad", () => {
    const res = aiErrorResponse(new AIProviderError("network", "fetch failed"), "fallback");
    expect(res.status).toBe(503);
    expect(res.error).toMatch(/couldn't reach/i);
  });

  it("points a rejected key at the env var rather than blaming the traveler", () => {
    const res = aiErrorResponse(new AIProviderError("auth", "bad key"), "fallback");
    expect(res.status).toBe(503);
    expect(res.error).toMatch(/GEMINI_API_KEY/);
  });

  it("keeps the caller's message for a genuine validation failure", () => {
    const res = aiErrorResponse(new Error("day 2 overlaps"), "The AI could not build a valid trip.");
    expect(res).toEqual({ status: 502, error: "The AI could not build a valid trip." });
  });

  it("never leaks the provider's raw message to the browser", () => {
    const raw = classifyGeminiError(exhausted, "gemini-3.5-flash");
    expect(aiErrorResponse(raw, "fallback").error).not.toMatch(/quota|gemini-3\.5/i);
  });
});
