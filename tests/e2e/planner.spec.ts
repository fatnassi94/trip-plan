import { expect, test, type Page } from "@playwright/test";
import { makeTrip } from "../fixtures/trip";
import { resetBackend } from "./support/helpers";

// The golden path, Landing → Create Trip → Travel DNA → AI Thinking →
// Trip Overview → Day Detail → Map. The AI is replaced by a fixture at the
// browser boundary; everything else is the real app.

const trip = makeTrip();
const PROFILE_URL =
  "/profile?destination=Lisbon%2C%20Portugal&startDate=2026-10-12&endDate=2026-10-13&travelers=2";

/** Answers the browser's /api/trips/generate call, after a visible pause. */
async function answerGeneration(
  page: Page,
  response: { status?: number; body: unknown },
  seen: { body?: unknown } = {},
) {
  await page.route("**/api/trips/generate", async (route) => {
    seen.body = route.request().postDataJSON();
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.fulfill({ status: response.status ?? 200, json: response.body });
  });
  return seen;
}

test.beforeEach(async ({ request }) => {
  await resetBackend(request);
});

test("plans a trip from the landing page through to the whole-trip map", async ({ page }) => {
  const seen = await answerGeneration(page, { body: { id: null, persisted: false, locked: false, trip } });
  const progress = page.getByRole("navigation", { name: "Trip planning progress" });
  const currentStep = progress.locator('[aria-current="step"]');

  await page.goto("/");
  await page.locator('form[action="/create-trip"] input[name="destination"]').fill("Lisbon, Portugal");
  await page.getByRole("button", { name: "Craft my trip" }).click();

  // Step 1 — Destination
  await expect(page.getByRole("heading", { name: "Where are you going?" })).toBeVisible();
  await expect(currentStep).toContainText("Destination");
  await expect(page.getByRole("combobox")).toHaveValue("Lisbon, Portugal");
  await page.getByRole("button", { name: "Add a traveler" }).click();
  await expect(page.getByRole("spinbutton")).toHaveValue("3");
  await page.getByRole("button", { name: "Continue to Travel DNA" }).click();

  // Step 2 — Travel DNA
  await expect(page.getByRole("heading", { name: "Discovering your travel DNA" })).toBeVisible();
  await expect(currentStep).toContainText("Travel DNA");
  const build = page.getByRole("button", { name: "Build my trip" });
  await expect(build).toBeDisabled();
  await page.getByRole("button", { name: /^Foodie/ }).click();
  await page.getByRole("button", { name: /^Packed/ }).click();
  await page.getByRole("button", { name: "Local", exact: true }).click();
  await expect(page.getByRole("heading", { name: "The Energetic Epicurean" })).toBeVisible();
  await build.click();

  // Step 3 — AI Thinking
  await expect(page.getByRole("heading", { name: /Assembling your Lisbon, Portugal journey/ })).toBeVisible();
  await expect(currentStep).toContainText("Building");
  await expect(page.getByText("Trip brief")).toBeVisible();

  // What the planner was actually asked for
  expect(seen.body).toMatchObject({
    destination: "Lisbon, Portugal",
    travelers: 3,
    profile: { travelerTypes: ["Foodie"], pace: "packed", foodPreferences: ["local"] },
  });

  // Step 4 — Itinerary
  await expect(page).toHaveURL(/\/trip\/local$/);
  await expect(page.getByRole("heading", { level: 1, name: "Lisbon, Portugal" })).toBeVisible();
  await expect(page.getByText(trip.days[0].items[0].reason)).toBeVisible();
  // Energy + pace intelligence: how tiring the day is, and the trip's shape.
  await expect(page.getByText(/^(Light|Steady|Heavy) day/)).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: /light|steady|heavy/ })).toBeVisible();

  await page.getByRole("tab", { name: /Day 2/ }).click();
  await expect(page.getByRole("heading", { name: "Mosteiro dos Jerónimos" })).toBeVisible();
  await page.getByRole("link", { name: "Day detail" }).click();

  // Day detail
  await expect(page).toHaveURL(/\/trip\/local\/day\/2$/);
  await expect(page.getByRole("heading", { level: 1, name: "Belém by the River" })).toBeVisible();
  await page.getByRole("button", { name: "More details" }).click();
  await expect(page.getByRole("heading", { name: "What to do here" })).toBeVisible();
  await page.getByRole("link", { name: /whole-trip map/i }).click();

  // Map
  await expect(page).toHaveURL(/\/trip\/local\/map$/);
  await expect(page.getByRole("heading", { name: "Every stop, in order" })).toBeVisible();
  await expect(page.locator("main ol > li")).toHaveCount(4);
});

test("an AI failure shows the error and keeps the traveler's answers for a retry", async ({ page }) => {
  await answerGeneration(page, {
    status: 502,
    body: { error: "The AI could not build a valid trip. Try again." },
  });

  await page.goto(PROFILE_URL);
  await page.getByRole("button", { name: /^Foodie/ }).click();
  await page.getByRole("button", { name: "Build my trip" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toContainText("could not build a valid trip");
  await expect(page.getByRole("button", { name: /^Foodie/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Build my trip" })).toBeEnabled();
});

test("the progress header links back to the destination step without losing it", async ({ page }) => {
  await page.goto(PROFILE_URL);
  await page
    .getByRole("navigation", { name: "Trip planning progress" })
    .getByRole("link", { name: /Destination/ })
    .click();

  await expect(page).toHaveURL(/\/create-trip\?destination=Lisbon/);
  await expect(page.getByRole("combobox")).toHaveValue("Lisbon, Portugal");
});

test("a trip that isn't in this tab shows a friendly empty state", async ({ page }) => {
  await page.goto("/trip/local");
  await expect(page.getByRole("heading", { name: "No trip loaded" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Plan a trip" })).toHaveAttribute("href", "/create-trip");
});
