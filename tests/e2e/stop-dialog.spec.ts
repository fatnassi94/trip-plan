import { expect, test } from "@playwright/test";
import { makeTrip } from "../fixtures/trip";
import { resetBackend } from "./support/helpers";

// The stop dialog: map and photos open OVER the itinerary instead of in a
// new browser tab. TRAVEL_IMAGES_MODE=off in the e2e build, so the Photos
// tab exercises the no-photography path — what a fresh clone sees too.

const trip = makeTrip();

test.beforeEach(async ({ page, request }) => {
  await resetBackend(request);
  await page.addInitScript((t) => {
    sessionStorage.setItem("roamai:trip:local", JSON.stringify(t));
  }, trip);
});

async function openDetails(page: import("@playwright/test").Page) {
  await page.goto("/trip/local/day/1");
  await page.getByRole("button", { name: "More details" }).first().click();
}

test("the map opens in a dialog over the day, and closing leaves the day where it was", async ({
  page,
}) => {
  await openDetails(page);

  await page.getByRole("button", { name: "View on map" }).first().click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // The real MapLibre pipeline, inside the modal.
  await expect(dialog.locator("[data-map-state]")).toHaveAttribute("data-map-state", "ready", {
    timeout: 20_000,
  });
  // Still on the day page underneath — no navigation happened.
  await expect(page).toHaveURL(/\/trip\/local\/day\/1$/);

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "What to do here" }).first()).toBeVisible();
});

test("the Photos button opens the dialog on the Photos tab", async ({ page }) => {
  // No Unsplash key in the e2e env, so the provider returns nothing and the
  // panel states that — the same path a fresh clone sees.
  await openDetails(page);

  await page.getByRole("button", { name: "Photos" }).first().click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("tab", { name: "Photos" })).toHaveAttribute("aria-selected", "true");
  await expect(dialog.getByText(/No photography for this stop yet/i)).toBeVisible();
});

test("the dialog closes on Escape and can be reopened on the other tab", async ({ page }) => {
  await openDetails(page);

  await page.getByRole("button", { name: "Photos" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  // Re-opening lands on the button that was pressed, not the last tab used.
  await page.getByRole("button", { name: "View on map" }).first().click();
  await expect(page.getByRole("dialog").getByRole("tab", { name: "Map" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("nothing in the day detail opens a new tab for maps any more", async ({ page }) => {
  await openDetails(page);

  // Directions is the one deliberate external link; the old OSM iframe and
  // the pano link are gone.
  await expect(page.locator('iframe[src*="openstreetmap.org"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open in OpenStreetMap" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Directions/ }).first()).toHaveAttribute(
    "target",
    "_blank",
  );
});
