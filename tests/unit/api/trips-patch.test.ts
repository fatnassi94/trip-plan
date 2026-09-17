import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/server")>()),
  createSessionClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));

import { PATCH } from "@/app/api/trips/[id]/route";
import { replaceDay } from "@/lib/itinerary";
import { createSessionClient } from "@/lib/supabase/server";
import { argsOf, configureEnv, fakeSupabase, type QueryResult } from "@/tests/unit/helpers/api";
import { makeRainyDay } from "@/tests/fixtures/assistant";
import { makeTrip, makeTripRequest } from "@/tests/fixtures/trip";

const TRIP_ID = "7d8f0f5e-2b1c-4c7e-9a51-3f0f6a2d9b10";
const trip = makeTrip();

const patch = (body: unknown) =>
  PATCH(
    new Request(`http://localhost/api/trips/${TRIP_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: { id: TRIP_ID } },
  );

function setup({
  user = { id: "user-1" } as { id: string } | null,
  stored = { data: { itinerary: trip }, error: null } as QueryResult,
  update = { data: { id: TRIP_ID }, error: null } as QueryResult,
} = {}) {
  const session = fakeSupabase({ user, tables: { trips: [stored, update] } });
  vi.mocked(createSessionClient).mockReturnValue(session as never);
  return session;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  configureEnv();
});

describe("PATCH /api/trips/[id] (apply an assistant change)", () => {
  it("returns 401 when signed out", async () => {
    setup({ user: null });
    expect((await patch({ day: makeRainyDay() })).status).toBe(401);
  });

  it("rejects a malformed day with 400", async () => {
    setup();
    expect((await patch({ day: { day: 1, title: "x", items: [] } })).status).toBe(400);
    expect((await patch("{")).status).toBe(400);
  });

  it("returns 404 for a trip the traveler doesn't own", async () => {
    setup({ stored: { data: null, error: null } });
    expect((await patch({ day: makeRainyDay() })).status).toBe(404);
  });

  it("returns 400 for a day number the trip doesn't have", async () => {
    const session = setup();
    expect((await patch({ day: { ...makeRainyDay(), day: 7 } })).status).toBe(400);
    expect(session.queries.trips).toHaveLength(1);
  });

  it("refuses a day that breaks the schedule rules and saves nothing", async () => {
    const session = setup();
    const overlapping = makeRainyDay();
    overlapping.items[1].start = "10:00";

    const res = await patch({ day: overlapping });

    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/schedule/i);
    expect(session.queries.trips).toHaveLength(1); // the read, no update
  });

  it("refuses a day that breaks the traveler's own hard rules", async () => {
    const withRules = { ...trip, profile: { ...makeTripRequest().profile, constraints: { maxActivityMinutes: 100 } } };
    const session = setup({ stored: { data: { itinerary: withRules }, error: null } });

    const res = await patch({ day: makeRainyDay() }); // adds a 120-minute museum visit

    expect(res.status).toBe(422);
    expect((await res.json()).details).toMatch(/lasts 120 min, over the 100 min limit/);
    expect(session.queries.trips).toHaveLength(1);
  });

  it("saves the whole re-validated itinerary on the owner's row", async () => {
    const session = setup();
    const res = await patch({ day: makeRainyDay() });

    const expected = replaceDay(trip, makeRainyDay());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ trip: expected });

    const update = session.queries.trips[1];
    expect(argsOf(update, "update")).toEqual([[{ itinerary: expected }]]);
    expect(argsOf(update, "eq")).toEqual([
      ["id", TRIP_ID],
      ["user_id", "user-1"],
    ]);
  });
});
