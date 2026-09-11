import { GoogleGenAI } from "@google/genai";
import type { AIProvider } from "../provider";

// Default, $0 provider: Gemini's *-flash models are free of charge for API
// use (see https://ai.google.dev/gemini-api/docs/pricing) — no credit card
// required, get a key at https://aistudio.google.com/apikey. The tradeoff:
// Google may use free-tier traffic to improve their models, so this is
// fine for a hobby MVP but shouldn't carry real user PII long-term.
//
// If the SDK's method names have moved by the time you read this, check
// https://ai.google.dev/gemini-api/docs — this package (@google/genai)
// ships fast and its surface does shift between minor versions.

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set — copy .env.example to .env.local and add one.");
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

export const geminiProvider: AIProvider = {
  name: "gemini",

  async generateJSON({ system, user }) {
    const ai = getClient();
    const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

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
    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Gemini response was not valid JSON: ${text.slice(0, 200)}`);
    }
  },
};
