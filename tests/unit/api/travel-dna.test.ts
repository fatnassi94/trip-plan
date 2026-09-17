import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/server")>()),
  createSessionClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));

import { GET, PUT } from "@/app/api/account/travel-dna/route";
import { createSessionClient } from "@/lib/supabase/server";
import { argsOf, configureEnv, fakeSupabase, type QueryResult } from "@/tests/unit/helpers/api";
import { makeTripRequest } from "@/tests/fixtures/trip";

const profile = {
  ...makeTripRequest().profile,
  localness: 4,
  constraints: { earliestStart: "09:00", avoidTags: ["museum"] },
};

const put = (body: unknown) =>
  PUT(
    new Request("http://localhost/api/account/travel-dna", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

function session(user: { id: string } | null, profiles: QueryResult = { data: null, error: null }) {
  const client = fakeSupabase({ user, tables: { profiles: [profiles] } });
  vi.mocked(createSessionClient).mockReturnValue(client as never);
  return client;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  configureEnv();
});

describe("GET /api/account/travel-dna", () => {
  it("reports when accounts aren't configured", async () => {
    configureEnv({ auth: false, persistence: false });
    expect(await (await GET()).json()).toEqual({ configured: false, loggedIn: false, profile: null, updatedAt: null });
  });

  it("reports a signed-out visitor", async () => {
    session(null);
    expect(await (await GET()).json()).toMatchObject({ configured: true, loggedIn: false, profile: null });
  });

  it("returns nothing saved yet for a new traveler", async () => {
    session({ id: "user-1" });
    expect(await (await GET()).json()).toEqual({ configured: true, loggedIn: true, profile: null, updatedAt: null });
  });

  it("returns the signed-in traveler's saved Travel DNA, from their own row", async () => {
    const client = session(
      { id: "user-1" },
      { data: { travel_dna: { version: 1, profile, updatedAt: "2026-09-17T10:00:00.000Z" } }, error: null },
    );
    expect(await (await GET()).json()).toEqual({
      configured: true,
      loggedIn: true,
      profile,
      updatedAt: "2026-09-17T10:00:00.000Z",
    });
    expect(argsOf(client.queries.profiles[0], "eq")).toEqual([["id", "user-1"]]);
  });

  it("treats a malformed saved value as nothing saved", async () => {
    session({ id: "user-1" }, { data: { travel_dna: { version: 1, profile: { pace: "sprint" } } }, error: null });
    expect(await (await GET()).json()).toMatchObject({ loggedIn: true, profile: null });
  });
});

describe("PUT /api/account/travel-dna", () => {
  it("returns 401 when signed out", async () => {
    session(null);
    expect((await put({ profile })).status).toBe(401);
  });

  it("rejects an invalid profile with 400", async () => {
    const client = session({ id: "user-1" });
    expect((await put({ profile: { ...profile, localness: 9 } })).status).toBe(400);
    expect((await put({ profile: { ...profile, constraints: { earliestStart: "20:00", latestEnd: "08:00" } } })).status).toBe(400);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("saves a versioned Travel DNA on the signed-in traveler's own row", async () => {
    const client = session({ id: "user-1" });
    const res = await put({ profile, userId: "someone-else" });

    expect(res.status).toBe(200);
    const [[row, options]] = argsOf(client.queries.profiles[0], "upsert") as [[Record<string, unknown>, unknown]];
    expect(row).toEqual({
      id: "user-1",
      travel_dna: { version: 1, profile, updatedAt: expect.any(String) },
    });
    expect(options).toEqual({ onConflict: "id" });
    expect((await res.json()).updatedAt).toBe((row.travel_dna as { updatedAt: string }).updatedAt);
  });

  it("explains a database that hasn't been migrated yet", async () => {
    session({ id: "user-1" }, { data: null, error: { code: "PGRST204", message: "column travel_dna not found" } });
    const res = await put({ profile });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/schema\.sql/);
  });
});
