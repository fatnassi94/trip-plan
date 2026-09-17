import { expect, test, type Page } from "@playwright/test";
import { makeTrip } from "../fixtures/trip";
import { MOCK_SUPABASE_URL } from "./support/env";
import { resetBackend, seedUser, submitAuthForm } from "./support/helpers";

// Travel DNA v1: style sliders, crowd tolerance and hard rules reach the
// planner, and a signed-in traveler's DNA is saved and restored next time.
// The AI is a fixture; saving goes through the real API into the mock DB.

const PROFILE_URL =
  "/profile?destination=Lisbon%2C%20Portugal&startDate=2026-10-12&endDate=2026-10-13&travelers=2";

async function captureGeneration(page: Page) {
  const seen: { body?: { profile?: Record<string, unknown> } } = {};
  await page.route("**/api/trips/generate", async (route) => {
    seen.body = route.request().postDataJSON();
    await route.fulfill({ json: { id: null, persisted: false, locked: false, trip: makeTrip() } });
  });
  return seen;
}

test.beforeEach(async ({ request }) => {
  await resetBackend(request);
});

test("a signed-in traveler's Travel DNA and hard rules are saved, used, and restored next time", async ({
  page,
  request,
}) => {
  const user = await seedUser(request, { email: "dna@example.com", password: "correct-horse", plan: "pro" });
  await page.goto(`/unlock?next=${encodeURIComponent(PROFILE_URL)}`);
  await submitAuthForm(page, "login", "dna@example.com", "correct-horse");
  await expect(page.getByRole("heading", { name: "Discovering your travel DNA" })).toBeVisible();
  await expect(page.getByLabel("Save to my account")).toBeChecked();

  await page.getByRole("button", { name: /^Foodie/ }).click();
  await page.getByRole("button", { name: /^Avoid crowds/ }).click();
  await page.getByRole("slider", { name: "Tourist or local" }).fill("5");
  await page.getByLabel("Earliest start").selectOption("10:00");
  await page.getByLabel("Max walking per day").selectOption("5");
  await page.getByRole("group", { name: "Never include" }).getByRole("button", { name: "Museums" }).click();

  const rules = page.getByRole("list", { name: "Your hard rules" });
  await expect(rules).toContainText("Nothing before 10:00");
  await expect(rules).toContainText("At most 5 km walking a day");
  await expect(rules).toContainText("Never: museums");

  const seen = await captureGeneration(page);
  await page.getByRole("button", { name: "Build my trip" }).click();
  await expect(page).toHaveURL(/\/trip\/local$/);

  expect(seen.body?.profile).toMatchObject({
    travelerTypes: ["Foodie"],
    localness: 5,
    crowdTolerance: "low",
    constraints: { earliestStart: "10:00", maxWalkingKmPerDay: 5, avoidTags: ["museum"] },
  });

  await expect
    .poll(async () => {
      const state = await (await request.get(`${MOCK_SUPABASE_URL}/__state`)).json();
      return state.tables.profiles.find((p: { id: string }) => p.id === user.id)?.travel_dna?.profile?.constraints;
    })
    .toEqual({ earliestStart: "10:00", maxWalkingKmPerDay: 5, avoidTags: ["museum"] });

  // Next trip: everything comes back.
  await page.goto(PROFILE_URL);
  await expect(page.getByText("Loaded your saved Travel DNA")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Foodie/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /^Avoid crowds/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("slider", { name: "Tourist or local" })).toHaveValue("5");
  await expect(page.getByLabel("Earliest start")).toHaveValue("10:00");
  await expect(page.getByLabel("Max walking per day")).toHaveValue("5");
  await expect(page.getByRole("list", { name: "Your hard rules" })).toContainText("Never: museums");
});

test("unticking Save keeps the Travel DNA out of the account", async ({ page, request }) => {
  const user = await seedUser(request, { email: "dna@example.com", password: "correct-horse", plan: "pro" });
  await page.goto(`/unlock?next=${encodeURIComponent(PROFILE_URL)}`);
  await submitAuthForm(page, "login", "dna@example.com", "correct-horse");

  await page.getByLabel("Save to my account").uncheck();
  await page.getByRole("button", { name: /^Foodie/ }).click();
  await captureGeneration(page);
  await page.getByRole("button", { name: "Build my trip" }).click();
  await expect(page).toHaveURL(/\/trip\/local$/);

  const state = await (await request.get(`${MOCK_SUPABASE_URL}/__state`)).json();
  expect(state.tables.profiles.find((p: { id: string }) => p.id === user.id)?.travel_dna).toBeUndefined();
});

test("a signed-out traveler is invited to log in, and their rules still reach the planner", async ({ page }) => {
  await page.goto(PROFILE_URL);

  const login = page.getByRole("link", { name: "Log in to keep your Travel DNA for next time" });
  // The link returns here with the trip details intact (space encoding may differ).
  const href = (await login.getAttribute("href"))!;
  const next = new URL(new URL(href, "http://x").searchParams.get("next")!, "http://x");
  expect(href.startsWith("/unlock?next=")).toBe(true);
  expect(next.pathname).toBe("/profile");
  expect(next.searchParams.get("destination")).toBe("Lisbon, Portugal");
  expect(next.searchParams.get("startDate")).toBe("2026-10-12");
  await expect(page.getByText("No hard rules yet")).toBeVisible();

  await page.getByRole("button", { name: /^Foodie/ }).click();
  await page.getByLabel("Latest finish").selectOption("21:00");
  await page.getByLabel("Longest single stop").selectOption("120");

  const seen = await captureGeneration(page);
  await page.getByRole("button", { name: "Build my trip" }).click();
  await expect(page).toHaveURL(/\/trip\/local$/);
  expect(seen.body?.profile?.constraints).toEqual({ latestEnd: "21:00", maxActivityMinutes: 120 });
});
