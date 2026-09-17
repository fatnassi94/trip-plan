import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/provider", () => ({ generateTrip: vi.fn() }));
vi.mock("@/lib/supabase/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/server")>()),
  createSessionClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));

import { POST } from "@/app/api/trips/generate/route";
import { generateTrip } from "@/lib/ai/provider";
import { createServiceRoleClient, createSessionClient } from "@/lib/supabase/server";
import { argsOf, configureEnv, fakeSupabase, jsonRequest, type QueryResult } from "@/tests/unit/helpers/api";
import { makeTrip, makeTripRequest } from "@/tests/fixtures/trip";

const request = makeTripRequest();
const trip = makeTrip();
const savedTrip = { ...trip, profile: request.profile };

function setup({
  user = null,
  subscription = null,
  insert = { data: { id: "trip-123" }, error: null },
}: {
  user?: { id: string } | null;
  subscription?: string | null;
  insert?: QueryResult;
} = {}) {
  const session = fakeSupabase({
    user,
    tables: { profiles: [{ data: subscription ? { subscription_status: subscription } : null, error: null }] },
  });
  const admin = fakeSupabase({ tables: { trips: [insert] } });
  vi.mocked(createSessionClient).mockReturnValue(session as never);
  vi.mocked(createServiceRoleClient).mockReturnValue(admin as never);
  vi.mocked(generateTrip).mockResolvedValue(trip as never);
  return { session, admin };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  configureEnv();
});

describe("POST /api/trips/generate", () => {
  it.each([
    ["non-JSON", "not json"],
    ["missing profile", { destination: "Lisbon" }],
    ["zero travelers", { ...request, travelers: 0 }],
    ["unknown pace", { ...request, profile: { ...request.profile, pace: "sprint" } }],
  ])("rejects a %s body with 400 and never calls the AI", async (_label, body) => {
    setup();
    const res = await POST(jsonRequest(body));
    expect(res.status).toBe(400);
    expect(generateTrip).not.toHaveBeenCalled();
  });

  it.each([
    ["latest end before earliest start", { earliestStart: "18:00", latestEnd: "09:00" }],
    ["zero walking limit", { maxWalkingKmPerDay: 0 }],
    ["malformed time", { earliestStart: "9am" }],
  ])("rejects hard constraints with a %s", async (_label, constraints) => {
    setup();
    const res = await POST(jsonRequest({ ...request, profile: { ...request.profile, constraints } }));
    expect(res.status).toBe(400);
    expect(generateTrip).not.toHaveBeenCalled();
  });

  it("saves the traveler's Travel DNA with the trip, never the model's version of it", async () => {
    const profile = { ...request.profile, localness: 5, constraints: { earliestStart: "09:00" } };
    const { admin } = setup({ user: { id: "user-1" }, subscription: "active" });
    vi.mocked(generateTrip).mockResolvedValue({ ...trip, profile: { ...profile, constraints: {} } } as never);

    await POST(jsonRequest({ ...request, profile }));

    expect(generateTrip).toHaveBeenCalledWith({ ...request, profile });
    expect(argsOf(admin.queries.trips[0], "insert")[0][0]).toMatchObject({
      itinerary: { profile: { constraints: { earliestStart: "09:00" } } },
    });
  });

  it("returns 503 when no AI key is configured", async () => {
    configureEnv({ ai: false });
    setup();
    const res = await POST(jsonRequest(request));
    expect(res.status).toBe(503);
    expect(generateTrip).not.toHaveBeenCalled();
  });

  it("returns the full trip, unsaved, when Supabase isn't configured", async () => {
    configureEnv({ auth: false, persistence: false });
    setup();
    const res = await POST(jsonRequest(request));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: null, persisted: false, locked: false, trip: savedTrip });
    expect(generateTrip).toHaveBeenCalledWith(request);
  });

  it("locks an anonymous traveler's trip: parks it ownerless and returns only a preview", async () => {
    const { admin } = setup();
    const res = await POST(jsonRequest(request));
    const body = await res.json();

    expect(body).toEqual({
      id: "trip-123",
      persisted: true,
      locked: true,
      preview: {
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
        travelers: trip.travelers,
        dayCount: 2,
        totalStops: 4,
        dayTitles: ["Alfama & Miradouros", "Belém by the River"],
      },
    });
    expect(body).not.toHaveProperty("trip");
    expect(argsOf(admin.queries.trips[0], "insert")[0][0]).toMatchObject({ user_id: null });
  });

  it("also locks a signed-in traveler with no active plan", async () => {
    const { admin } = setup({ user: { id: "user-1" }, subscription: null });
    const body = await (await POST(jsonRequest(request))).json();
    expect(body.locked).toBe(true);
    expect(argsOf(admin.queries.trips[0], "insert")[0][0]).toMatchObject({ user_id: null });
  });

  it("gives a traveler with an active plan the full trip, saved as theirs", async () => {
    const { admin } = setup({ user: { id: "user-1" }, subscription: "active" });
    const body = await (await POST(jsonRequest(request))).json();
    expect(body).toEqual({ id: "trip-123", persisted: true, locked: false, trip: savedTrip });
    expect(argsOf(admin.queries.trips[0], "insert")[0][0]).toMatchObject({ user_id: "user-1" });
  });

  it("returns 502 when the AI can't build a valid trip, and saves nothing", async () => {
    const { admin } = setup();
    vi.mocked(generateTrip).mockRejectedValue(new Error("Trip failed business rules"));
    const res = await POST(jsonRequest(request));
    expect(res.status).toBe(502);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("hands back the full trip when saving fails, since there is nowhere to park it", async () => {
    setup({ insert: { data: null, error: { message: "database unavailable" } } });
    const body = await (await POST(jsonRequest(request))).json();
    expect(body).toEqual({ id: null, persisted: false, locked: false, trip: savedTrip });
  });
});
