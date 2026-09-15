import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/server")>()),
  createSessionClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));

import { POST as signup } from "@/app/api/auth/signup/route";
import { POST as selectPlan } from "@/app/api/account/select-plan/route";
import { GET as status } from "@/app/api/account/status/route";
import { createServiceRoleClient, createSessionClient } from "@/lib/supabase/server";
import { argsOf, configureEnv, fakeSupabase, jsonRequest } from "@/tests/unit/helpers/api";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  configureEnv();
});

describe("POST /api/auth/signup", () => {
  function setup(createUserResult: { data: unknown; error: unknown }) {
    const admin = fakeSupabase();
    admin.auth.admin.createUser.mockResolvedValue(createUserResult);
    vi.mocked(createServiceRoleClient).mockReturnValue(admin as never);
    return admin;
  }

  it("returns 503 when sign-up isn't configured", async () => {
    configureEnv({ auth: false, persistence: false });
    const res = await signup(jsonRequest({ email: "a@b.co", password: "12345678" }));
    expect(res.status).toBe(503);
  });

  it.each([
    ["bad email", { email: "not-an-email", password: "12345678" }],
    ["short password", { email: "a@b.co", password: "short" }],
    ["non-JSON", "{"],
  ])("rejects a %s with 400", async (_label, body) => {
    const admin = setup({ data: null, error: null });
    const res = await signup(jsonRequest(body));
    expect(res.status).toBe(400);
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it("creates a pre-confirmed account (no confirmation email)", async () => {
    const admin = setup({ data: { user: { id: "user-1" } }, error: null });
    const res = await signup(jsonRequest({ email: "a@b.co", password: "12345678" }));
    expect(await res.json()).toEqual({ ok: true, userId: "user-1" });
    expect(admin.auth.admin.createUser).toHaveBeenCalledWith({
      email: "a@b.co",
      password: "12345678",
      email_confirm: true,
    });
  });

  it("returns 409 for an email that already has an account", async () => {
    setup({ data: null, error: { status: 422, message: "A user with this email address has already been registered" } });
    const res = await signup(jsonRequest({ email: "a@b.co", password: "12345678" }));
    expect(res.status).toBe(409);
  });
});

describe("POST /api/account/select-plan", () => {
  function setup(user: { id: string } | null, upsert = { data: null, error: null as unknown }) {
    const session = fakeSupabase({ user, tables: { profiles: [upsert] } });
    vi.mocked(createSessionClient).mockReturnValue(session as never);
    return session;
  }

  it("rejects an unknown plan with 400", async () => {
    setup({ id: "user-1" });
    expect((await selectPlan(jsonRequest({ planType: "platinum" }))).status).toBe(400);
  });

  it("returns 401 when signed out", async () => {
    setup(null);
    expect((await selectPlan(jsonRequest({ planType: "pro" }))).status).toBe(401);
  });

  it("activates the plan on the signed-in user's own profile", async () => {
    const session = setup({ id: "user-1" });
    const res = await selectPlan(jsonRequest({ planType: "pro", userId: "someone-else" }));
    expect(await res.json()).toEqual({ ok: true, planType: "pro" });
    expect(argsOf(session.queries.profiles[0], "upsert")[0]).toEqual([
      { id: "user-1", plan_type: "pro", subscription_status: "active" },
      { onConflict: "id" },
    ]);
  });

  it("explains a missing database schema with 503", async () => {
    setup({ id: "user-1" }, { data: null, error: { code: "PGRST205", message: "no table" } });
    const res = await selectPlan(jsonRequest({ planType: "pro" }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/schema\.sql/);
  });
});

describe("GET /api/account/status", () => {
  it("reports auth as unconfigured", async () => {
    configureEnv({ auth: false, persistence: false });
    expect(await (await status()).json()).toEqual({
      loggedIn: false,
      hasActivePlan: false,
      planType: null,
      authConfigured: false,
    });
  });

  it("reports a signed-out visitor", async () => {
    vi.mocked(createSessionClient).mockReturnValue(fakeSupabase({ user: null }) as never);
    expect(await (await status()).json()).toMatchObject({ loggedIn: false, authConfigured: true });
  });

  it("reports a signed-in traveler's active plan", async () => {
    const session = fakeSupabase({
      user: { id: "user-1" },
      tables: { profiles: [{ data: { plan_type: "basic", subscription_status: "active" }, error: null }] },
    });
    vi.mocked(createSessionClient).mockReturnValue(session as never);
    expect(await (await status()).json()).toEqual({
      loggedIn: true,
      hasActivePlan: true,
      planType: "basic",
      authConfigured: true,
    });
  });

  it("fails toward signed-out when Supabase is unreachable", async () => {
    vi.mocked(createSessionClient).mockImplementation(() => {
      throw new Error("network down");
    });
    const res = await status();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ loggedIn: false, hasActivePlan: false });
  });
});
