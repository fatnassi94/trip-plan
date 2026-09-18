import { expect, test } from "@playwright/test";

// The visual discovery experience: home → explore → destination → planner.
// The e2e build runs with TRAVEL_IMAGES_MODE=off, so every image box shows
// the designed placeholder — which is exactly the no-API-key path, and
// keeps browser tests off third-party networks.

test("the home page opens on a visual hero and keeps the planner entry point", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith("http://localhost:3100") && !url.startsWith("http://127.0.0.1:54329")) {
      external.push(url);
    }
  });

  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: /Find the trip worth taking/ }),
  ).toBeVisible();
  await expect(page.locator('form[action="/create-trip"] input[name="destination"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Craft my trip" })).toBeVisible();

  // Every image box renders something, with no photos configured.
  const boxes = page.locator("[data-image-state]");
  expect(await boxes.count()).toBeGreaterThan(10);
  expect(await page.locator('[data-image-state="placeholder"]').count()).toBeGreaterThan(10);
  expect(external).toEqual([]);
});

test("the home page shows trending destinations, moods and guides", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Destinations worth the flight" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Trending destinations" }).getByRole("link")).toHaveCount(6);

  await expect(page.getByRole("heading", { name: "What kind of trip are you after?" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Beaches & islands/ })).toBeVisible();

  await expect(page.getByRole("heading", { name: "Start from someone else's route" })).toBeVisible();
  await expect(page.getByRole("link", { name: /48 hours in Tunis/ })).toBeVisible();

  // Personalised strip resolves for a signed-out visitor too.
  await expect(page.getByRole("heading", { name: "Suggested for you" })).toBeVisible();
  await expect(page.getByText("Popular with first-time travelers")).toBeVisible();
});

test("a mood leads to the explorer, filtered", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Beaches & islands/ }).click();

  await expect(page).toHaveURL(/\/destinations\?mood=beaches-islands$/);
  await expect(page.getByRole("heading", { level: 1, name: "Beaches & islands" })).toBeVisible();
  await expect(page.getByLabel("Mood")).toHaveValue("beaches-islands");
  await expect(page.getByRole("status")).toContainText("destination");
});

test("the explorer searches and filters without leaving the page", async ({ page }) => {
  await page.goto("/destinations");
  const results = page.getByRole("status");
  await expect(results).toContainText("8 destinations");

  await page.getByRole("searchbox").fill("tokyo");
  await expect(results).toContainText("1 destination");

  // Search covers descriptions too: both Tunisian entries mention Tunis.
  await page.getByRole("searchbox").fill("tunis");
  await expect(results).toContainText("2 destinations");

  await page.getByRole("searchbox").fill("");
  await page.getByLabel("Region").selectOption("North Africa");
  await expect(results).toContainText("3 destinations");

  await page.getByRole("searchbox").fill("atlantis");
  await expect(page.getByText("Nothing matches those filters")).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(results).toContainText("8 destinations");
});

test("a destination page carries the guide content and both planning calls to action", async ({ page }) => {
  await page.goto("/destinations");
  await page.getByRole("link", { name: /Tunis/ }).first().click();

  await expect(page).toHaveURL(/\/destinations\/tunis$/);
  await expect(page.getByRole("heading", { level: 1, name: "Tunis, Tunisia" })).toBeVisible();

  for (const heading of ["Why go", "In pictures", "Things to do", "Eat this", "Know before you go"]) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: /A sample \d-day shape/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "If you like Tunis" })).toBeVisible();

  const planHref = "/create-trip?destination=Tunis%2C%20Tunisia";
  await expect(page.getByRole("link", { name: "Add to my trip" })).toHaveAttribute("href", planHref);
  await expect(page.getByRole("link", { name: "Ask RoamAI to plan this" })).toHaveAttribute("href", planHref);
});

test("a destination page hands the planner its destination", async ({ page }) => {
  await page.goto("/destinations/sidi-bou-said");
  await page.getByRole("link", { name: "Add to my trip" }).click();

  await expect(page).toHaveURL(/\/create-trip\?destination=/);
  await expect(page.getByRole("combobox")).toHaveValue("Sidi Bou Said, Tunisia");
});

test("an unknown destination 404s instead of rendering an empty page", async ({ page }) => {
  const response = await page.goto("/destinations/atlantis");
  expect(response?.status()).toBe(404);
});

test("the destination search API answers without any third-party call", async ({ request }) => {
  const res = await request.get("/api/destinations/search?q=tokyo");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.count).toBe(1);
  expect(body.destinations[0]).toMatchObject({ slug: "tokyo", country: "Japan" });
});
