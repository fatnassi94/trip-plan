import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/providers/gemini", () => ({
  geminiProvider: { name: "gemini", generateJSON: vi.fn() },
}));

import { generateTrip } from "@/lib/ai/provider";
import { geminiProvider } from "@/lib/ai/providers/gemini";
import { makeTrip, makeTripRequest } from "@/tests/fixtures/trip";

const generateJSON = vi.mocked(geminiProvider.generateJSON);

beforeEach(() => {
  vi.stubEnv("AI_PROVIDER", "gemini");
});

describe("generateTrip", () => {
  it("returns the model's trip when it validates first time", async () => {
    generateJSON.mockResolvedValue(makeTrip());
    await expect(generateTrip(makeTripRequest())).resolves.toEqual(makeTrip());
    expect(generateJSON).toHaveBeenCalledTimes(1);
  });

  it("retries once, telling the model what was wrong", async () => {
    const overlapping = makeTrip();
    overlapping.days[0].items[1].start = "10:00";
    generateJSON.mockResolvedValueOnce(overlapping).mockResolvedValueOnce(makeTrip());

    await expect(generateTrip(makeTripRequest())).resolves.toEqual(makeTrip());
    expect(generateJSON).toHaveBeenCalledTimes(2);
    expect(generateJSON.mock.calls[1][0].system).toMatch(/previous response was invalid.*overlaps/);
  });

  it("never returns unvalidated output when the retry also fails", async () => {
    generateJSON.mockResolvedValue({ prose: "Lisbon is lovely in October." });
    await expect(generateTrip(makeTripRequest())).rejects.toThrow();
    expect(generateJSON).toHaveBeenCalledTimes(2);
  });

  it("repairs a trip that breaks the traveler's hard rules", async () => {
    const request = makeTripRequest({
      profile: { ...makeTripRequest().profile, constraints: { earliestStart: "10:00" } },
    });
    const later = makeTrip();
    later.days[0].items[0].start = "10:00"; // castle now 10:00–11:30, clear of lunch
    generateJSON.mockResolvedValueOnce(makeTrip()).mockResolvedValueOnce(later);

    await expect(generateTrip(request)).resolves.toEqual(later);
    expect(generateJSON.mock.calls[1][0].system).toMatch(/before the 10:00 earliest start/);
  });

  it("refuses an unknown provider", async () => {
    vi.stubEnv("AI_PROVIDER", "mystery-model");
    await expect(generateTrip(makeTripRequest())).rejects.toThrow(/Unknown AI_PROVIDER/);
  });
});
