import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/server")>()),
  createSessionClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));

import { POST as claim } from "@/app/api/trips/claim/route";
import { POST as rate } from "@/app/api/trips/rate/route";
import { GET as getTrip } from "@/app/api/trips/[id]/route";
import { createServiceRoleClient, createSessionClient } from "@/lib/supabase/server";
import { argsOf, configureEnv, fakeSupabase, jsonRequest, type QueryResult } from "@/tests/unit/helpers/api";
import { makeTrip } from "@/tests/fixtures/trip";

const TRIP_ID = "7d8f0f5e-2b1c-4c7e-9a51-3f0f6a2d9b10";
const itinerary = makeTrip();

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  configureEnv();
});

describe("POST /api/trips/claim", () => {
  function setup({
    user = { id: "user-1" } as { id: string } | null,
    subscription = "active" as string | null,
    claimed = { data: { id: TRIP_ID, itinerary }, error: null } as QueryResult,
    alreadyOwn = { data: null, error: null } as QueryResult,
  } = {}) {
    const session = fakeSupabase({
      user,
      tables: {
        profiles: [{ data: subscription ? { subscription_status: subscription } : null, error: null }],
        trips: [alreadyOwn],
      },
    });
    const admin = fakeSupabase({ tables: { trips: [claimed] } });
    vi.mocked(createSessionClient).mockReturnValue(session as never);
    vi.mocked(createServiceRoleClient).mockReturnValue(admin as never);
    return { session, admin };
  }

  it("rejects a non-UUID trip id with 400", async () => {
    setup();
    expect((await claim(jsonRequest({ tripId: "trip-1" }))).status).toBe(400);
  });

  it("returns 401 when signed out", async () => {
    setup({ user: null });
    expect((await claim(jsonRequest({ tripId: TRIP_ID }))).status).toBe(401);
  });

  it("returns 402 without an active plan and never touches the trip", async () => {
    const { admin } = setup({ subscription: null });
    expect((await claim(jsonRequest({ tripId: TRIP_ID }))).status).toBe(402);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("claims an ownerless trip for the signed-in traveler, exactly once", async () => {
    const { admin } = setup();
    const res = await claim(jsonRequest({ tripId: TRIP_ID }));
    expect(await res.json()).toEqual({ id: TRIP_ID, trip: itinerary });

    const query = admin.queries.trips[0];
    expect(argsOf(query, "update")).toEqual([[{ user_id: "user-1" }]]);
    expect(argsOf(query, "is")).toEqual([["user_id", null]]);
  });

  it("lets a retry succeed when the trip is already the traveler's own", async () => {
    setup({ claimed: { data: null, error: null }, alreadyOwn: { data: { id: TRIP_ID, itinerary }, error: null } });
    const res = await claim(jsonRequest({ tripId: TRIP_ID }));
    expect(res.status).toBe(200);
    expect((await res.json()).trip).toEqual(itinerary);
  });

  it("returns 404 for a trip that is someone else's or doesn't exist", async () => {
    setup({ claimed: { data: null, error: null } });
    expect((await claim(jsonRequest({ tripId: TRIP_ID }))).status).toBe(404);
  });
});

describe("POST /api/trips/rate", () => {
  function setup(user: { id: string } | null, result: QueryResult = { data: { id: TRIP_ID }, error: null }) {
    const session = fakeSupabase({ user, tables: { trips: [result] } });
    vi.mocked(createSessionClient).mockReturnValue(session as never);
    return session;
  }

  it.each([
    ["rating above 5", { tripId: TRIP_ID, rating: 6 }],
    ["fractional rating", { tripId: TRIP_ID, rating: 4.5 }],
    ["comment over 500 chars", { tripId: TRIP_ID, rating: 4, comment: "x".repeat(501) }],
  ])("rejects a %s with 400", async (_label, body) => {
    setup({ id: "user-1" });
    expect((await rate(jsonRequest(body))).status).toBe(400);
  });

  it("returns 401 when signed out", async () => {
    setup(null);
    expect((await rate(jsonRequest({ tripId: TRIP_ID, rating: 5 }))).status).toBe(401);
  });

  it("saves the rating on the traveler's own trip", async () => {
    const session = setup({ id: "user-1" });
    const res = await rate(jsonRequest({ tripId: TRIP_ID, rating: 5 }));
    expect(await res.json()).toEqual({ ok: true });
    const query = session.queries.trips[0];
    expect(argsOf(query, "update")).toEqual([[{ rating: 5, rating_comment: null }]]);
    expect(argsOf(query, "eq")).toContainEqual(["user_id", "user-1"]);
  });

  it("returns 404 when no trip of theirs matched", async () => {
    setup({ id: "user-1" }, { data: null, error: null });
    expect((await rate(jsonRequest({ tripId: TRIP_ID, rating: 5 }))).status).toBe(404);
  });
});

describe("GET /api/trips/[id]", () => {
  const call = () => getTrip(new Request(`http://localhost/api/trips/${TRIP_ID}`), { params: { id: TRIP_ID } });

  it("returns 401 when signed out", async () => {
    vi.mocked(createSessionClient).mockReturnValue(fakeSupabase({ user: null }) as never);
    expect((await call()).status).toBe(401);
  });

  it("returns the itinerary scoped to the signed-in owner", async () => {
    const session = fakeSupabase({ user: { id: "user-1" }, tables: { trips: [{ data: { itinerary }, error: null }] } });
    vi.mocked(createSessionClient).mockReturnValue(session as never);
    const res = await call();
    expect(await res.json()).toEqual({ trip: itinerary });
    expect(argsOf(session.queries.trips[0], "eq")).toContainEqual(["user_id", "user-1"]);
  });

  it("returns 404 when the trip isn't theirs", async () => {
    vi.mocked(createSessionClient).mockReturnValue(fakeSupabase({ user: { id: "user-1" } }) as never);
    expect((await call()).status).toBe(404);
  });
});
