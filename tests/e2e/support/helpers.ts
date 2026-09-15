import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { MOCK_SUPABASE_URL } from "./env";

export async function resetBackend(request: APIRequestContext) {
  await request.post(`${MOCK_SUPABASE_URL}/__reset`);
}

export async function seedUser(
  request: APIRequestContext,
  user: { email: string; password: string; plan?: "single" | "basic" | "pro" },
) {
  const res = await request.post(`${MOCK_SUPABASE_URL}/__seed/user`, {
    data: {
      email: user.email,
      password: user.password,
      profile: user.plan ? { plan_type: user.plan, subscription_status: "active" } : undefined,
    },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; email: string };
}

export async function seedRows(request: APIRequestContext, table: string, rows: object[]) {
  const res = await request.post(`${MOCK_SUPABASE_URL}/__seed/${table}`, { data: rows });
  expect(res.ok()).toBe(true);
}

/** Fills and submits AuthForm (components/auth/auth-form.tsx). */
export async function submitAuthForm(
  page: Page,
  mode: "signup" | "login",
  email: string,
  password: string,
) {
  if (mode === "login") await page.getByRole("tab", { name: "Log in" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: mode === "login" ? "Log in" : "Create account" }).click();
}

/** The header's account avatar — the "profile" button travelers click. */
export function accountButton(page: Page) {
  return page.getByRole("banner").getByRole("link", { name: "My account" });
}

export function signedOutAccountHeading(page: Page) {
  return page.getByRole("heading", { name: "Your trips live here" });
}
