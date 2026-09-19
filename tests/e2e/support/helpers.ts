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

// ── The Travel DNA interview ───────────────────────────────────────────
//
// Step 2 of the planner asks one question at a time (see
// components/profile/dna-chat.tsx), so a test that wants a filled-in
// profile has to walk the conversation rather than set a dozen controls.
// Single-answer questions advance themselves; the rest need Next or Skip.

/** Which question is on screen, or null at the finale. */
export async function currentDnaQuestion(page: Page): Promise<string | null> {
  const card = page.locator("[id^='dna-q-']").first();
  if ((await card.count()) === 0) return null;
  return ((await card.getAttribute("id")) ?? "").replace("dna-q-", "");
}

export async function expectDnaQuestion(page: Page, id: string) {
  // RoamAI types its questions out, and the answer controls only appear
  // once it has finished — so wait for the controls, not just the text.
  await expect(page.locator(`#dna-q-${id}`)).toBeVisible();
  await expect(dnaCard(page, id).getByRole("button").first()).toBeVisible();
}

/** The card for one question — scopes clicks away from the transcript. */
export function dnaCard(page: Page, questionId: string) {
  return page.locator(`[data-dna-card="${questionId}"]`);
}

/** Tap a choice and wait for the question it belongs to to give way. */
export async function answerDna(page: Page, questionId: string, choice: string | RegExp) {
  await expectDnaQuestion(page, questionId);
  await dnaCard(page, questionId).getByRole("button", { name: choice }).first().click();
  await expect(page.locator(`#dna-q-${questionId}`)).toBeHidden();
}

/** Advance past a multi-answer or optional question. */
export async function nextDnaQuestion(page: Page, questionId: string) {
  await expectDnaQuestion(page, questionId);
  await page.getByRole("button", { name: /^(Next|Skip)$/ }).click();
  await expect(page.locator(`#dna-q-${questionId}`)).toBeHidden();
}

/** The fastest legal path from the first question to the Build step. */
export async function walkDnaToFinale(page: Page, persona: RegExp = /^Foodie/) {
  await expectDnaQuestion(page, "personas");
  await page.getByRole("button", { name: persona }).click();
  await nextDnaQuestion(page, "personas");
  await answerDna(page, "budget", /^Comfort/);
  await answerDna(page, "pace", /^Balanced/);
  await answerDna(page, "walking", /A fair bit/);
  await answerDna(page, "crowds", /Some is fine/);
  await answerDna(page, "localness", /^Balanced/);
  await answerDna(page, "discovery", /Mix of both/);
  await nextDnaQuestion(page, "food");
  await nextDnaQuestion(page, "dislikes");
  await nextDnaQuestion(page, "rules");
}

/**
 * Jump back to an answered question from the transcript. The pill's
 * accessible name carries the prompt, so a fragment of it is enough.
 */
export async function editDnaAnswer(page: Page, promptFragment: string) {
  await page
    .getByRole("button", { name: new RegExp(`Change your answer to .*${promptFragment}`, "i") })
    .click();
}
