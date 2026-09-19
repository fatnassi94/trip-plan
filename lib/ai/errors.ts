// Provider-agnostic failure types for lib/ai.
//
// The distinction that matters everywhere downstream: did the *model*
// return something we couldn't use (retry with a repair instruction), or
// did the *service* refuse to answer at all (retrying the prompt is
// pointless and costs quota)? `AIProviderError` is always the second kind.
// Provider adapters translate their SDK's errors into it; provider.ts and
// the API routes branch on `kind` and never on an SDK-specific shape.

export type AIFailureKind =
  /** Model is temporarily overloaded (503 UNAVAILABLE) — worth retrying. */
  | "overloaded"
  /** Never reached the provider: DNS, reset socket, timeout — worth retrying. */
  | "network"
  /** Rate or daily quota exhausted (429 RESOURCE_EXHAUSTED). */
  | "quota"
  /** Key missing, invalid or lacking permission (401/403). */
  | "auth"
  /** Model name unknown or request rejected (400/404) — retrying won't help. */
  | "bad_request"
  | "unknown";

export class AIProviderError extends Error {
  readonly kind: AIFailureKind;
  /** Provider's own advice on when to come back, when it gave one. */
  readonly retryAfterMs: number;
  readonly status?: number;
  readonly model?: string;

  constructor(
    kind: AIFailureKind,
    message: string,
    options: { retryAfterMs?: number; status?: number; model?: string; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AIProviderError";
    this.kind = kind;
    this.retryAfterMs = options.retryAfterMs ?? 0;
    this.status = options.status;
    this.model = options.model;
  }
}

export function isAIProviderError(err: unknown): err is AIProviderError {
  return err instanceof AIProviderError;
}

/** Transient enough that the same prompt, sent again, may well succeed. */
export function isRetryable(err: AIProviderError): boolean {
  return err.kind === "overloaded" || err.kind === "network";
}

export interface AIErrorResponse {
  status: number;
  /** Safe to show a traveler: no model names, no stack traces, no keys. */
  error: string;
  retryAfterSeconds?: number;
}

/**
 * One place deciding what the browser is told when AI work fails, so
 * /api/trips/generate and /api/trips/assistant can't drift apart. A
 * provider failure is never reported as "the AI couldn't build a valid
 * trip" — that sends the traveler off rephrasing a prompt that was fine.
 */
export function aiErrorResponse(err: unknown, fallbackMessage: string): AIErrorResponse {
  if (!isAIProviderError(err)) {
    return { status: 502, error: fallbackMessage };
  }

  const retryAfterSeconds = err.retryAfterMs > 0 ? Math.ceil(err.retryAfterMs / 1000) : undefined;

  switch (err.kind) {
    case "overloaded":
      return {
        status: 503,
        error: "The AI service is busy right now. Give it a minute and try again.",
        retryAfterSeconds: retryAfterSeconds ?? 30,
      };
    case "quota":
      return {
        status: 429,
        error: retryAfterSeconds
          ? `The AI key has hit its usage limit. Try again in about ${formatWait(retryAfterSeconds)}.`
          : "The AI key has hit its usage limit for now. Try again later, or raise the quota on the key.",
        retryAfterSeconds,
      };
    case "network":
      return {
        status: 503,
        error: "Couldn't reach the AI service. Check your connection and try again.",
        retryAfterSeconds: 15,
      };
    case "auth":
      return {
        status: 503,
        error: "The AI key was rejected. Check GEMINI_API_KEY in .env.local.",
      };
    case "bad_request":
      return {
        status: 503,
        error: "The AI request was rejected — check GEMINI_MODEL names in .env.local.",
      };
    default:
      return { status: 502, error: fallbackMessage };
  }
}

function formatWait(seconds: number): string {
  if (seconds < 90) return `${seconds} seconds`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `${Math.round(minutes / 60)} hours`;
}
