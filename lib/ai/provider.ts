import type { Trip, TripRequest } from "@/types/trip";
import { parseDayRevision, parseTripResponse, type DayRevision, type ValidatedTrip } from "./schema";
import {
  ASSISTANT_SYSTEM_PROMPT,
  TRIP_SYSTEM_PROMPT,
  buildAssistantUserPrompt,
  buildTripUserPrompt,
} from "./prompts";
import { geminiProvider } from "./providers/gemini";
import { isAIProviderError } from "./errors";

// The one rule this file exists to enforce: nothing else in the codebase
// calls an AI SDK directly. Routes and components call `generateTrip()`
// (build a trip) or `reviseTripDay()` (the assistant's edit of one day);
// swapping Gemini for Claude, OpenAI, or a local model later means adding
// one file in providers/ and changing PROVIDERS below — not touching any
// UI or API route. See project plan §20 and §36.

export interface AIProvider {
  name: string;
  /** Returns the model's raw parsed JSON — not yet schema-validated. */
  generateJSON(args: { system: string; user: string }): Promise<unknown>;
}

const PROVIDERS: Record<string, AIProvider> = {
  gemini: geminiProvider,
};

function getProvider(): AIProvider {
  const key = process.env.AI_PROVIDER ?? "gemini";
  const provider = PROVIDERS[key];
  if (!provider) {
    throw new Error(
      `Unknown AI_PROVIDER "${key}". Available: ${Object.keys(PROVIDERS).join(", ")}`,
    );
  }
  return provider;
}

/**
 * prompt -> model -> validation -> one repair retry on failure. Shared by
 * every AI entry point so they can't drift apart on the one guarantee
 * that matters: unvalidated output is never returned.
 */
async function generateValidated<T>(
  system: string,
  user: string,
  parse: (raw: unknown) => T,
): Promise<T> {
  const provider = getProvider();

  const attempt = async (extraInstruction?: string) => {
    const raw = await provider.generateJSON({
      system: extraInstruction ? `${system}\n\n${extraInstruction}` : system,
      user,
    });
    return parse(raw);
  };

  try {
    return await attempt();
  } catch (firstError) {
    // A service failure is not the model getting the JSON wrong. Sending
    // the prompt again with "your previous response was invalid: 503
    // UNAVAILABLE" cannot help, doubles the latency, and on a small free
    // tier burns the daily quota twice as fast. The adapter has already
    // done its own retries and model fallbacks by this point, so stop.
    if (isAIProviderError(firstError)) throw firstError;

    // One repair pass: tell the model exactly what it got wrong. If this
    // also fails, surface the error — never fall back to unvalidated output.
    const message = firstError instanceof Error ? firstError.message : String(firstError);
    return await attempt(
      `Your previous response was invalid: ${message}. Return corrected JSON only.`,
    );
  }
}

/** Turns a trip request into a validated trip that respects the traveler's hard constraints. */
export async function generateTrip(request: TripRequest): Promise<ValidatedTrip> {
  const constraints = request.profile.constraints;
  return generateValidated(TRIP_SYSTEM_PROMPT, buildTripUserPrompt(request), (raw) =>
    parseTripResponse(raw, constraints),
  );
}

/**
 * 10 — AI Assistant. Revises one day of an existing trip in response to
 * the traveler's message ("it's raining", "I'm tired"), returning a
 * complete replacement day that has passed the same schema and business
 * rules as a generated trip, plus a short reply. Saves nothing.
 */
export async function reviseTripDay({
  trip,
  dayNumber,
  message,
  anotherOption = false,
}: {
  trip: Trip;
  dayNumber: number;
  message: string;
  anotherOption?: boolean;
}): Promise<DayRevision> {
  if (!trip.days.some((d) => d.day === dayNumber)) {
    throw new Error(`This trip has no day ${dayNumber}`);
  }
  return generateValidated(
    ASSISTANT_SYSTEM_PROMPT,
    buildAssistantUserPrompt({ trip, dayNumber, message, anotherOption }),
    (raw) => parseDayRevision(raw, dayNumber, trip.profile?.constraints),
  );
}
