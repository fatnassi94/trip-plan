import { expect, test, type Page } from "@playwright/test";
import { makeTrip } from "../fixtures/trip";
import { accountButton, resetBackend, seedRows, seedUser, submitAuthForm } from "./support/helpers";

// The paid-plan gate: a trip is built for everyone, but an unpaid
// traveler only gets a preview until they sign in and choose a plan.
// The generate call is answered by a fixture; the parked itinerary lives
// in the mock database exactly as app/api/trips/generate would leave it.

const trip = makeTrip();
const TRIP_ID = "7d8f0f5e-2b1c-4c7e-9a51-3f0f6a2d9b10";
const PROFILE_URL =
  "/profile?destination=Lisbon%2C%20Portugal&startDate=2026-10-12&endDate=2026-10-13&travelers=2";

async function buildLockedTrip(page: Page, request: Parameters<typeof seedRows>[0]) {
  await seedRows(request, "trips", [
    {
      id: TRIP_ID,
      user_id: null,
      destination: trip.destination,
      start_date: trip.startDate,
      end_date: trip.endDate,
      travelers: trip.travelers,
      itinerary: trip,
    },
  ]);
  await page.route("**/api/trips/generate", (route) =>
    route.fulfill({
      json: {
        id: TRIP_ID,
        persisted: true,
        locked: true,
        preview: {
          destination: trip.destination,
          startDate: trip.startDate,
          endDate: trip.endDate,
          travelers: trip.travelers,
          dayCount: trip.days.length,
          totalStops: 4,
          dayTitles: trip.days.map((d) => d.title),
        },
      },
    }),
  );

  await page.goto(PROFILE_URL);
  await page.getByRole("button", { name: /^Foodie/ }).click();
  await page.getByRole("button", { name: "Build my trip" }).click();
  await expect(page).toHaveURL(/\/unlock$/);
}

test.beforeEach(async ({ request }) => {
  await resetBackend(request);
});

test("a new traveler signs up, picks a plan, and unlocks the trip they watched being built", async ({
  page,
  request,
}) => {
  await buildLockedTrip(page, request);

  await expect(
    page.getByRole("heading", { name: "Create an account to unlock your personalized trip plan." }),
  ).toBeVisible();
  await expect(page.getByText("Belém by the River")).toBeVisible();
  // No pricing is ever shown before sign-in.
  await expect(page.getByRole("radiogroup", { name: "Choose a plan" })).toHaveCount(0);

  await submitAuthForm(page, "signup", "buyer@example.com", "long-enough-password");
  const plans = page.getByRole("radiogroup", { name: "Choose a plan" });
  await expect(plans).toBeVisible();

  // Signed in but unpaid: the itinerary itself is still unreadable.
  expect((await page.request.get(`/api/trips/${TRIP_ID}`)).status()).toBe(404);

  await plans.getByRole("radio", { name: /Single trip/ }).click();

  await expect(page).toHaveURL(new RegExp(`/trip/${TRIP_ID}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Lisbon, Portugal" })).toBeVisible();
  await expect(page.getByText(trip.days[0].items[0].reason)).toBeVisible();

  // It's theirs now, and on their account.
  await accountButton(page).click();
  await expect(page.getByRole("heading", { name: "buyer@example.com" })).toBeVisible();
  await expect(page.getByText("Single trip ·")).toBeVisible();
  await expect(page.getByRole("link", { name: /Lisbon, Portugal/ })).toBeVisible();
});

test("a returning traveler with a plan gets the trip straight after logging in", async ({ page, request }) => {
  await seedUser(request, { email: "member@example.com", password: "correct-horse", plan: "pro" });
  await buildLockedTrip(page, request);

  await submitAuthForm(page, "login", "member@example.com", "correct-horse");

  await expect(page).toHaveURL(new RegExp(`/trip/${TRIP_ID}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Lisbon, Portugal" })).toBeVisible();
});

test("an unsafe ?next= target is ignored after signing in", async ({ page, request }) => {
  await seedUser(request, { email: "member@example.com", password: "correct-horse", plan: "pro" });

  await page.goto("/unlock?next=https://evil.example/phish");
  await submitAuthForm(page, "login", "member@example.com", "correct-horse");

  await expect(page).toHaveURL(/localhost:3100\/account$/);
});
