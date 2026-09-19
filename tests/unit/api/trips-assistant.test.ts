import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/provider", () => ({ reviseTripDay: vi.fn() }));
vi.mock("@/lib/supabase/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/server")>()),
  createSessionClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));

import { POST } from "@/app/api/trips/assistant/route";
import { reviseTripDay } from "@/lib/ai/provider";
import { AIProviderError } from "@/lib/ai/errors";
import { assistantRateLimiter } from "@/lib/rate-limit";
import { createSessionClient } from "@/lib/supabase/server";
import { argsOf, configureEnv, fakeSupabase, jsonRequest } from "@/tests/unit/helpers/api";
import { makeRainyDay, RAIN_CHANGES, RAIN_REPLY } from "@/tests/fixtures/assistant";
import { makeTrip } from "@/tests/fixtures/trip";

const TRIP_ID = "7d8f0f5e-2b1c-4c7e-9a51-3f0f6a2d9b10";
const trip = makeTrip();
const ask = (body: object) => POST(jsonRequest({ tripId: TRIP_ID, day: 1, message: "It's raining", ...body }));

function signedIn({ user = { id: "user-1" } as { id: string } | null, itinerary = trip as unknown } = {}) {
  const session = fakeSupabase({
    user,
    tables: { trips: [{ data: itinerary ? { itinerary } : null, error: null }] },
  });
  vi.mocked(createSessionClient).mockReturnValue(session as never);
  return session;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  configureEnv();
  assistantRateLimiter.reset();
  vi.mocked(reviseTripDay).mockResolvedValue({ reply: RAIN_REPLY, day: makeRainyDay() } as never);
});

describe("POST /api/trips/assistant", () => {
  it.each([
    ["non-JSON", "not json"],
    ["empty message", { tripId: TRIP_ID, day: 1, message: "   " }],
    ["message over 500 chars", { tripId: TRIP_ID, day: 1, message: "x".repeat(501) }],
    ["day 0", { tripId: TRIP_ID, day: 0, message: "Rain" }],
    ["non-UUID trip id", { tripId: "trip-1", day: 1, message: "Rain" }],
  ])("rejects a %s with 400 and never calls the AI", async (_label, body) => {
    signedIn();
    expect((await POST(jsonRequest(body))).status).toBe(400);
    expect(reviseTripDay).not.toHaveBeenCalled();
  });

  it("returns 503 when no AI key is configured", async () => {
    configureEnv({ ai: false });
    signedIn();
    expect((await ask({})).status).toBe(503);
  });

  describe("with accounts configured", () => {
    it("returns 401 when signed out", async () => {
      signedIn({ user: null });
      expect((await ask({})).status).toBe(401);
      expect(reviseTripDay).not.toHaveBeenCalled();
    });

    it("requires a saved trip id", async () => {
      signedIn();
      const res = await POST(jsonRequest({ trip, day: 1, message: "Rain" }));
      expect(res.status).toBe(400);
      expect(reviseTripDay).not.toHaveBeenCalled();
    });

    it("returns 404 for a trip the traveler doesn't own (including unpaid ones)", async () => {
      const session = signedIn({ itinerary: null });
      expect((await ask({})).status).toBe(404);
      expect(argsOf(session.queries.trips[0], "eq")).toContainEqual(["user_id", "user-1"]);
      expect(reviseTripDay).not.toHaveBeenCalled();
    });

    it("revises the stored itinerary and ignores any trip sent by the browser", async () => {
      signedIn();
      const tampered = makeTrip({ destination: "Somewhere Else" });
      const res = await ask({ trip: tampered, anotherOption: true });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ reply: RAIN_REPLY, day: makeRainyDay(), changes: RAIN_CHANGES });
      // The effort of the day before and after the change, so "I'm tired"
      // can be checked rather than taken on trust.
      expect(body.energy.before).toMatchObject({
        score: expect.any(Number),
        percent: expect.any(Number),
        level: expect.stringMatching(/light|steady|heavy/),
      });
      expect(body.energy.after.score).toBeLessThan(body.energy.before.score);
      expect(body.energy.before).not.toHaveProperty("items");
      expect(reviseTripDay).toHaveBeenCalledWith({
        trip,
        dayNumber: 1,
        message: "It's raining",
        anotherOption: true,
      });
    });

    it("returns 400 for a day the trip doesn't have", async () => {
      signedIn();
      expect((await ask({ day: 5 })).status).toBe(400);
      expect(reviseTripDay).not.toHaveBeenCalled();
    });

    it("returns a generic 502 when the AI fails, without leaking the internal error", async () => {
      signedIn();
      vi.mocked(reviseTripDay).mockRejectedValue(new Error("GEMINI_API_KEY quota exceeded for project 1234"));
      const res = await ask({});
      expect(res.status).toBe(502);
      expect(JSON.stringify(await res.json())).not.toMatch(/quota|GEMINI|1234/);
    });

    it("doesn't tell the traveler to rephrase when the service was simply busy", async () => {
      signedIn();
      vi.mocked(reviseTripDay).mockRejectedValue(new AIProviderError("overloaded", "high demand"));
      const res = await ask({});
      expect(res.status).toBe(503);
      expect(res.headers.get("Retry-After")).toBe("30");
      expect((await res.json()).error).not.toMatch(/rephras/i);
    });

    it("rate limits a traveler after 12 requests, with Retry-After", async () => {
      for (let i = 0; i < 12; i++) {
        signedIn();
        expect((await ask({})).status).toBe(200);
      }
      signedIn();
      const res = await ask({});
      expect(res.status).toBe(429);
      expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
      expect(reviseTripDay).toHaveBeenCalledTimes(12);
    });
  });

  describe("demo mode (no Supabase)", () => {
    beforeEach(() => configureEnv({ auth: false, persistence: false }));

    it("requires the trip from the browser", async () => {
      expect((await POST(jsonRequest({ day: 1, message: "Rain" }))).status).toBe(400);
    });

    it("validates the browser's trip like model output before using it", async () => {
      const broken = makeTrip();
      broken.days[0].items[0].reason = "";
      expect((await POST(jsonRequest({ trip: broken, day: 1, message: "Rain" }))).status).toBe(400);
      expect(reviseTripDay).not.toHaveBeenCalled();
    });

    it("revises the trip the browser sent", async () => {
      const res = await POST(jsonRequest({ trip, day: 1, message: "It's raining" }));
      expect(await res.json()).toMatchObject({ reply: RAIN_REPLY, changes: RAIN_CHANGES });
      expect(vi.mocked(reviseTripDay).mock.calls[0][0].trip).toEqual(trip);
    });
  });
});
