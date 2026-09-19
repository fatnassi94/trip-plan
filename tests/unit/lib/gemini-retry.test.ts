import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The behaviour that keeps the app alive on a small free tier: ride out a
// temporary overload, and move to the next model when one is spent.
const generateContent = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

const apiError = (status: number, googleStatus: string) =>
  Object.assign(new Error(`{"error":{"code":${status},"message":"nope","status":"${googleStatus}"}}`), {
    status,
  });

const ok = { text: '{"ok":true}' };

async function callProvider() {
  const { geminiProvider } = await import("@/lib/ai/providers/gemini");
  const promise = geminiProvider.generateJSON({ system: "s", user: "u" });
  // Claim the rejection now: without this, a failure that lands while we
  // are advancing timers is reported as an unhandled rejection.
  promise.catch(() => {});
  // Backoff sleeps are real timers; don't make the suite wait them out.
  await vi.runAllTimersAsync();
  return promise;
}

beforeEach(async () => {
  vi.resetModules();
  generateContent.mockReset();
  vi.useFakeTimers();
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("GEMINI_MODEL", "primary-model");
  vi.stubEnv("GEMINI_FALLBACK_MODELS", "backup-model");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the Gemini adapter under load", () => {
  it("retries the same model through a temporary overload", async () => {
    generateContent
      .mockRejectedValueOnce(apiError(503, "UNAVAILABLE"))
      .mockRejectedValueOnce(apiError(503, "UNAVAILABLE"))
      .mockResolvedValueOnce(ok);

    await expect(callProvider()).resolves.toEqual({ ok: true });
    expect(generateContent).toHaveBeenCalledTimes(3);
    expect(generateContent.mock.calls.every((c) => c[0].model === "primary-model")).toBe(true);
  });

  it("rides out a dropped connection on the same model", async () => {
    // What actually happened on a flaky network: no HTTP status at all.
    generateContent
      .mockRejectedValueOnce(Object.assign(new Error("fetch failed"), { cause: { code: "ECONNRESET" } }))
      .mockResolvedValueOnce(ok);

    await expect(callProvider()).resolves.toEqual({ ok: true });
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(generateContent.mock.calls[1][0].model).toBe("primary-model");
  });

  it("falls through to the next model when the first is out of quota", async () => {
    generateContent.mockRejectedValueOnce(apiError(429, "RESOURCE_EXHAUSTED")).mockResolvedValueOnce(ok);

    await expect(callProvider()).resolves.toEqual({ ok: true });
    // One try on the spent model, then straight to the backup.
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(generateContent.mock.calls[1][0].model).toBe("backup-model");
  });

  it("surfaces the preferred model's reason when every model fails", async () => {
    generateContent.mockRejectedValue(apiError(429, "RESOURCE_EXHAUSTED"));

    await expect(callProvider()).rejects.toMatchObject({
      name: "AIProviderError",
      kind: "quota",
      model: "primary-model",
    });
  });

  it("gives up immediately on a rejected key instead of burning the chain", async () => {
    generateContent.mockRejectedValue(apiError(403, "PERMISSION_DENIED"));

    await expect(callProvider()).rejects.toMatchObject({ kind: "auth" });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("does not retry the model for writing bad JSON — that is provider.ts's repair pass", async () => {
    generateContent.mockResolvedValue({ text: "Lisbon is lovely." });

    await expect(callProvider()).rejects.toThrow(/not valid JSON/);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("refuses to call anything without a key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(callProvider()).rejects.toMatchObject({ kind: "auth" });
    expect(generateContent).not.toHaveBeenCalled();
  });
});
