import { expect, test, type Page } from "@playwright/test";
import { makeTrip } from "../fixtures/trip";
import { resetBackend } from "./support/helpers";

// 09 — Map. The real MapLibre pipeline (style → worker → route line →
// pins) running against a blank local style, so these tests need no
// internet. Regression suite for "the map never shows any pins": the
// worker used to be loaded cross-origin and died before it started.

const trip = makeTrip(); // day 1: 3 mapped stops, day 2: 1

test.use({ contextOptions: { reducedMotion: "reduce" } });

test.beforeEach(async ({ page, request }) => {
  await resetBackend(request);
  await page.addInitScript((t) => {
    sessionStorage.setItem("roamai:trip:local", JSON.stringify(t));
  }, trip);
});

const pins = (scope: ReturnType<Page["getByRole"]> | Page) => scope.getByRole("button", { name: /^Stop \d+$/ });

async function expectMapReady(scope: ReturnType<Page["getByRole"]> | Page) {
  const state = scope.locator("[data-map-state]");
  await expect(state).toHaveAttribute("data-map-state", "ready", { timeout: 20_000 });
  // The route line only counts once the worker has processed it.
  await expect(state).toHaveAttribute("data-route", "drawn", { timeout: 20_000 });
}

test("the day map draws a numbered pin for every mapped stop, with its worker served from this site", async ({
  page,
}) => {
  const workerRequests: string[] = [];
  const thirdPartyScripts: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("maplibre-gl-worker")) workerRequests.push(request.url());
    if (request.url().includes("unpkg.com")) thirdPartyScripts.push(request.url());
  });

  await page.goto("/trip/local");
  const map = page.getByRole("region", { name: "Day 1 route map" });

  await expectMapReady(map);
  await expect(pins(map)).toHaveCount(3);
  await expect(map).toContainText("3 of 3 stops on the map");
  expect(workerRequests).toHaveLength(1);
  expect(workerRequests[0]).toMatch(/^http:\/\/localhost:3100\/vendor\/maplibre-gl\/[\d.]+\/maplibre-gl-worker\.mjs$/);
  expect(thirdPartyScripts).toEqual([]);
});

test("the timeline and the map stay in sync, and switching days redraws the map", async ({ page }) => {
  await page.goto("/trip/local");
  const map = page.getByRole("region", { name: "Day 1 route map" });
  await expectMapReady(map);

  await map.getByRole("button", { name: "Stop 3", exact: true }).click();
  await expect(page.getByRole("button", { name: "Show stop 3 on the map" })).toHaveAttribute("aria-pressed", "true");
  await expect(map.getByRole("button", { name: "Stop 3", exact: true })).toHaveClass(/roam-marker-active/);

  await page.getByRole("button", { name: "Show stop 2 on the map" }).click();
  await expect(map.getByRole("button", { name: "Stop 2", exact: true })).toHaveClass(/roam-marker-active/);
  await expect(map.getByRole("button", { name: "Stop 3", exact: true })).not.toHaveClass(/roam-marker-active/);

  await page.getByRole("tab", { name: /Day 2/ }).click();
  const day2 = page.getByRole("region", { name: "Day 2 route map" });
  await expectMapReady(day2);
  await expect(pins(day2)).toHaveCount(1);
});

test("the whole-trip map plots every stop and highlights the one picked from the list", async ({ page }) => {
  await page.goto("/trip/local/map");
  await expectMapReady(page);
  await expect(pins(page.getByRole("application"))).toHaveCount(4);

  await page.getByRole("button", { name: /Mosteiro dos Jerónimos/ }).click();
  await expect(page.getByRole("button", { name: "Stop 4", exact: true })).toHaveClass(/roam-marker-active/);
});

test("a map that can't load says so, and Try again brings it back", async ({ page }) => {
  await page.route("**/map-style.json", (route) => route.abort());
  await page.goto("/trip/local");
  const map = page.getByRole("region", { name: "Day 1 route map" });

  await expect(map.getByRole("alert")).toContainText("The map couldn't load");
  await expect(pins(map)).toHaveCount(0);

  await page.unroute("**/map-style.json");
  await map.getByRole("button", { name: "Try again" }).click();

  await expectMapReady(map);
  await expect(pins(map)).toHaveCount(3);
  await expect(map.getByRole("alert")).toHaveCount(0);
});
