import type { TripRequest } from "@/types/trip";
import { parseTripResponse, type ValidatedTrip } from "./schema";
import { TRIP_SYSTEM_PROMPT, buildTripUserPrompt } from "./prompts";
import { geminiProvider } from "./providers/gemini";

// The one rule this file exists to enforce: nothing else in the codebase
// calls an AI SDK directly. Routes and components call `generateTrip()`;
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
 * The full pipeline for turning a trip request into a validated trip:
 * prompt -> model -> schema validation -> one repair retry on failure.
 * This is intentionally the ONLY exported way to talk to an AI provider.
 */
export async function generateTrip(request: TripRequest): Promise<ValidatedTrip> {
  const provider = getProvider();
  const system = TRIP_SYSTEM_PROMPT;
  const user = buildTripUserPrompt(request);

  const attempt = async (extraInstruction?: string) => {
    const raw = await provider.generateJSON({
      system: extraInstruction ? `${system}\n\n${extraInstruction}` : system,
      user,
    });
    return parseTripResponse(raw);
  };

  try {
    return await attempt();
  } catch (firstError) {
    // One repair pass: tell the model exactly what it got wrong. If this
    // also fails, surface the error — never fall back to saving
    // unvalidated output.
    const message = firstError instanceof Error ? firstError.message : String(firstError);
    return await attempt(
      `Your previous response was invalid: ${message}. Return corrected JSON only.`,
    );
  }
}
