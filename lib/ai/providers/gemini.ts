import { GoogleGenAI } from "@google/genai";
import type { AIProvider } from "../provider";
import { AIProviderError, isRetryable, type AIFailureKind } from "../errors";

// Default, $0 provider: Gemini's *-flash models are free of charge for API
// use (see https://ai.google.dev/gemini-api/docs/pricing) — no credit card
// required, get a key at https://aistudio.google.com/apikey. The tradeoff:
// Google may use free-tier traffic to improve their models, so this is
// fine for a hobby MVP but shouldn't carry real user PII long-term.
//
// Free tiers are small and per-model (Google's own 429 quotes the number:
// gemini-3.5-flash allows 20 requests a day). So this adapter does two
// things beyond calling the SDK:
//
//   1. Retries an overloaded model (503 UNAVAILABLE) with backoff, because
//      that is a temporary spike and the same prompt usually lands.
//   2. Falls through to the next model when one is exhausted or unusable,
//      so a spent daily quota on the preferred model doesn't take the
//      whole app down. Set GEMINI_FALLBACK_MODELS="" to turn that off.
//
// Everything it throws is an AIProviderError, so nothing above this file
// has to know what a Google ApiError looks like.
//
// If the SDK's method names have moved by the time you read this, check
// https://ai.google.dev/gemini-api/docs — this package (@google/genai)
// ships fast and its surface does shift between minor versions.

// Verified callable on a new (2026) API key. Model availability is not
// the same as the models list: gemini-2.5-flash is still *listed* but
// 404s for new keys ("no longer available to new users"), so a fallback
// chain is only as good as the last time someone actually called it.
const DEFAULT_MODEL = "gemini-3.6-flash";
const DEFAULT_FALLBACK_MODELS = "gemini-3.5-flash-lite,gemini-3.5-flash";

/** Tries per model before moving on: one spike is common, three is a real outage. */
const ATTEMPTS_PER_MODEL = 3;
/** Never sit on a request longer than this waiting to retry. */
const MAX_BACKOFF_MS = 6000;

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new AIProviderError(
      "auth",
      "GEMINI_API_KEY is not set — copy .env.example to .env.local and add one.",
    );
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

/** Preferred model first, then fallbacks, deduped and blank-free. */
export function modelChain(): string[] {
  const primary = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS ?? DEFAULT_FALLBACK_MODELS)
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  return [...new Set([primary, ...fallbacks])];
}

/**
 * Turns whatever the SDK threw into something the rest of the app can
 * reason about. Google puts the useful part in a JSON string on `message`,
 * so read the HTTP status first and the body only as a refinement.
 */
export function classifyGeminiError(err: unknown, model: string): AIProviderError {
  if (err instanceof AIProviderError) return err;

  const raw = err as { status?: unknown; message?: unknown } | null;
  const status = typeof raw?.status === "number" ? raw.status : undefined;
  const message = typeof raw?.message === "string" ? raw.message : String(err);
  const body = parseErrorBody(message);
  const googleStatus = body?.status;

  let kind: AIFailureKind = "unknown";
  if (status === undefined && looksLikeNetworkFailure(err, message)) kind = "network";
  else if (status === 503 || googleStatus === "UNAVAILABLE") kind = "overloaded";
  else if (status === 429 || googleStatus === "RESOURCE_EXHAUSTED") kind = "quota";
  else if (status === 401 || status === 403) kind = "auth";
  else if (status === 400 || status === 404) kind = "bad_request";
  else if (status === 500 || status === 502 || status === 504) kind = "overloaded";

  return new AIProviderError(kind, body?.message ?? message, {
    status,
    model,
    retryAfterMs: body?.retryAfterMs ?? 0,
    cause: err,
  });
}

/**
 * Never got an answer at all: a dropped socket, a DNS miss, a timeout.
 * Worth retrying, and worth naming — "unknown" in the logs sends whoever
 * reads them looking for a bug that isn't in this codebase.
 */
function looksLikeNetworkFailure(err: unknown, message: string): boolean {
  const codes = ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "EPIPE"];
  const phrases = ["fetch failed", "socket hang up", "network error", "terminated", "timeout"];
  const code = (err as { code?: unknown } | null)?.code;
  const cause = (err as { cause?: { code?: unknown; message?: unknown } } | null)?.cause;
  const haystack = [message, String(cause?.message ?? "")].join(" ").toLowerCase();

  if (typeof code === "string" && codes.includes(code)) return true;
  if (typeof cause?.code === "string" && codes.includes(cause.code)) return true;
  if ((err as { name?: unknown } | null)?.name === "AbortError") return true;
  return phrases.some((phrase) => haystack.includes(phrase));
}

interface ParsedErrorBody {
  message?: string;
  status?: string;
  retryAfterMs?: number;
}

function parseErrorBody(message: string): ParsedErrorBody | null {
  const start = message.indexOf("{");
  if (start === -1) return null;
  try {
    const parsed = JSON.parse(message.slice(start)) as {
      error?: { message?: string; status?: string; details?: unknown[] };
    };
    const error = parsed.error;
    if (!error) return null;

    let retryAfterMs = 0;
    for (const detail of error.details ?? []) {
      const delay = (detail as { retryDelay?: unknown })?.retryDelay;
      if (typeof delay === "string") {
        const seconds = Number.parseFloat(delay);
        if (Number.isFinite(seconds)) retryAfterMs = Math.round(seconds * 1000);
      }
    }
    return { message: error.message, status: error.status, retryAfterMs };
  } catch {
    return null;
  }
}

function backoffMs(attempt: number, advisedMs: number): number {
  // Honour the provider's own advice when it's short enough to wait out,
  // otherwise exponential with jitter so parallel requests don't sync up.
  const base = advisedMs > 0 ? advisedMs : 500 * 2 ** (attempt - 1);
  return Math.min(base + Math.random() * 250, MAX_BACKOFF_MS);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const geminiProvider: AIProvider = {
  name: "gemini",

  async generateJSON({ system, user }) {
    const ai = getClient();
    const models = modelChain();
    // Surfaced if everything fails: the preferred model's own reason is
    // the one worth showing, not a fallback's.
    let firstError: AIProviderError | null = null;

    for (const model of models) {
      for (let attempt = 1; attempt <= ATTEMPTS_PER_MODEL; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: user,
            config: {
              systemInstruction: system,
              responseMimeType: "application/json",
              temperature: 0.6,
            },
          });

          const text = response.text;
          if (!text) throw new Error("Gemini returned an empty response.");

          try {
            return JSON.parse(text);
          } catch {
            // The model's own output, not a service failure: let the
            // repair pass in provider.ts deal with it.
            throw new Error(`Gemini response was not valid JSON: ${text.slice(0, 200)}`);
          }
        } catch (err) {
          if (err instanceof Error && err.message.startsWith("Gemini response was not valid JSON")) {
            throw err;
          }
          if (err instanceof Error && err.message === "Gemini returned an empty response.") {
            throw err;
          }

          const failure = classifyGeminiError(err, model);
          firstError ??= failure;

          if (failure.kind === "auth") throw failure;

          if (isRetryable(failure) && attempt < ATTEMPTS_PER_MODEL) {
            console.warn(
              `Gemini ${model} ${failure.kind} (attempt ${attempt}/${ATTEMPTS_PER_MODEL}); retrying.`,
            );
            await sleep(backoffMs(attempt, failure.retryAfterMs));
            continue;
          }

          // Out of attempts, or a failure no retry can fix (quota, bad
          // model name): give the next model in the chain a turn.
          console.warn(`Gemini ${model} failed (${failure.kind}); trying the next model.`);
          break;
        }
      }
    }

    throw firstError ?? new AIProviderError("unknown", "Gemini could not be reached.");
  },
};
