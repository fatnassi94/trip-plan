import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { makeRainyDay, RAIN_CHANGES, RAIN_REPLY } from "../fixtures/assistant";
import { makeTrip } from "../fixtures/trip";
import { MOCK_SUPABASE_URL } from "./support/env";
import { resetBackend, seedRows, seedUser, submitAuthForm } from "./support/helpers";

// 10 — AI Assistant ("Edit via ✨ Chat") on a trip saved to an account.
// The model's answer is a fixture at the browser boundary; applying it
// goes through the real PATCH /api/trips/[id] into the mock database, so
// these tests prove the server-side gate, not just the UI.

const trip = makeTrip();
const TRIP_ID = "7d8f0f5e-2b1c-4c7e-9a51-3f0f6a2d9b10";

async function openSavedTrip(page: Page, request: APIRequestContext) {
  const user = await seedUser(request, { email: "traveler@example.com", password: "correct-horse", plan: "pro" });
  await seedRows(request, "trips", [
    {
      id: TRIP_ID,
      user_id: user.id,
      destination: trip.destination,
      start_date: trip.startDate,
      end_date: trip.endDate,
      travelers: trip.travelers,
      itinerary: trip,
    },
  ]);
  await page.goto(`/unlock?next=/trip/${TRIP_ID}`);
  await submitAuthForm(page, "login", "traveler@example.com", "correct-horse");
  await expect(page).toHaveURL(new RegExp(`/trip/${TRIP_ID}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Lisbon, Portugal" })).toBeVisible();
}

async function storedStopNames(request: APIRequestContext): Promise<string[]> {
  const state = await (await request.get(`${MOCK_SUPABASE_URL}/__state`)).json();
  return state.tables.trips[0].itinerary.days[0].items.map((item: { name: string }) => item.name);
}

test.beforeEach(async ({ request }) => {
  await resetBackend(request);
});

test("asks the assistant to rework a rainy day, applies it, and the trip is saved", async ({ page, request }) => {
  await openSavedTrip(page, request);
  let sent: unknown;
  await page.route("**/api/trips/assistant", async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ json: { reply: RAIN_REPLY, day: makeRainyDay(), changes: RAIN_CHANGES } });
  });

  const assistant = page.getByRole("region", { name: "RoamAI Assistant" });
  await expect(assistant).toContainText("Editing Day 1 · Alfama & Miradouros");
  await assistant.getByRole("button", { name: "It's raining" }).click();
  await assistant.getByRole("button", { name: "Send" }).click();

  await expect(assistant.getByText(RAIN_REPLY)).toBeVisible();
  await expect(assistant.getByRole("list", { name: "Proposed changes" })).toContainText("Add Museu Nacional do Azulejo");
  expect(sent).toMatchObject({ tripId: TRIP_ID, day: 1 });
  expect(sent).not.toHaveProperty("trip");

  // A suggestion is only a suggestion until it's applied.
  await expect(page.getByRole("heading", { name: "Museu Nacional do Azulejo" })).toHaveCount(0);
  expect(await storedStopNames(request)).not.toContain("Museu Nacional do Azulejo");

  await assistant.getByRole("button", { name: "Apply to Day 1" }).click();

  await expect(assistant.getByText("Applied to Day 1")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Museu Nacional do Azulejo" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Taberna da Rua das Flores" })).toHaveCount(0);
  expect(await storedStopNames(request)).toEqual(["Castelo de São Jorge", "Museu Nacional do Azulejo"]);

  // A fresh load with no tab cache comes from the database — still edited.
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await expect(page.getByRole("heading", { name: "Museu Nacional do Azulejo" })).toBeVisible();
});

test("a suggestion that breaks the schedule is refused by the server and nothing changes", async ({
  page,
  request,
}) => {
  await openSavedTrip(page, request);
  const overlapping = makeRainyDay();
  overlapping.items[1].start = "10:00"; // clashes with the castle, 09:30–11:00
  await page.route("**/api/trips/assistant", (route) =>
    route.fulfill({ json: { reply: RAIN_REPLY, day: overlapping, changes: RAIN_CHANGES } }),
  );

  const assistant = page.getByRole("region", { name: "RoamAI Assistant" });
  await assistant.getByRole("textbox", { name: "Ask RoamAI to change Day 1" }).fill("It's raining");
  await assistant.getByRole("textbox", { name: "Ask RoamAI to change Day 1" }).press("Enter");
  await assistant.getByRole("button", { name: "Apply to Day 1" }).click();

  await expect(assistant.getByRole("alert")).toContainText("schedule");
  await expect(page.getByRole("heading", { name: "Taberna da Rua das Flores" })).toBeVisible();
  expect(await storedStopNames(request)).toEqual([
    "Castelo de São Jorge",
    "Taberna da Rua das Flores",
    "Miradouro de Santa Luzia",
  ]);
});

test("the assistant follows the selected day", async ({ page, request }) => {
  await openSavedTrip(page, request);
  await page.getByRole("tab", { name: /Day 2/ }).click();
  await expect(page.getByRole("region", { name: "RoamAI Assistant" })).toContainText(
    "Editing Day 2 · Belém by the River",
  );
});
