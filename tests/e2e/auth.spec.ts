import { expect, test } from "@playwright/test";
import {
  accountButton,
  resetBackend,
  seedUser,
  signedOutAccountHeading,
  submitAuthForm,
} from "./support/helpers";

// Regression suite for "I log in, then click my profile and get the login
// screen again". Each test starts signed out on My Trips, because the bug
// lived in what the browser remembered about that signed-out visit.

test.beforeEach(async ({ request }) => {
  await resetBackend(request);
});

test("logging in from My Trips lands on My Trips, signed in", async ({ page, request }) => {
  await seedUser(request, { email: "planner@example.com", password: "correct-horse", plan: "pro" });

  await page.goto("/account");
  await expect(signedOutAccountHeading(page)).toBeVisible();
  await page.getByRole("link", { name: "Log in or sign up" }).click();

  await submitAuthForm(page, "login", "planner@example.com", "correct-horse");

  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "planner@example.com" })).toBeVisible();
});

test("the header profile button stays signed in after logging in", async ({ page, request }) => {
  await seedUser(request, { email: "planner@example.com", password: "correct-horse", plan: "pro" });

  await page.goto("/account");
  await expect(signedOutAccountHeading(page)).toBeVisible();
  await page.getByRole("link", { name: "Log in or sign up" }).click();
  await submitAuthForm(page, "login", "planner@example.com", "correct-horse");
  await expect(page.getByRole("heading", { name: "planner@example.com" })).toBeVisible();

  // Wander off to the landing page, then come back through the header.
  await page.getByRole("banner").getByRole("link", { name: "Explore" }).click();
  await expect(page).toHaveURL(/\/$/);
  await accountButton(page).click();

  await expect(page.getByRole("heading", { name: "planner@example.com" })).toBeVisible();
  await expect(signedOutAccountHeading(page)).toHaveCount(0);
});

test("a new traveler who signs up from My Trips goes to My Trips, not the pricing wall", async ({ page }) => {
  await page.goto("/account");
  await page.getByRole("link", { name: "Log in or sign up" }).click();

  await submitAuthForm(page, "signup", "newcomer@example.com", "long-enough-password");

  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "newcomer@example.com" })).toBeVisible();
  await expect(page.getByText("No active plan")).toBeVisible();

  await page.getByRole("banner").getByRole("link", { name: "Explore" }).click();
  await accountButton(page).click();
  await expect(page.getByRole("heading", { name: "newcomer@example.com" })).toBeVisible();
});

test("a wrong password shows an error and keeps the traveler signed out", async ({ page, request }) => {
  await seedUser(request, { email: "planner@example.com", password: "correct-horse" });

  await page.goto("/unlock");
  await submitAuthForm(page, "login", "planner@example.com", "wrong-password");

  // Scoped to the form: Next.js keeps its own (empty) role="alert" route announcer on every page.
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Invalid login credentials");
  await accountButton(page).click();
  await expect(signedOutAccountHeading(page)).toBeVisible();
});

test("logging out signs the traveler out of My Trips", async ({ page, request }) => {
  await seedUser(request, { email: "planner@example.com", password: "correct-horse", plan: "pro" });

  await page.goto("/account");
  await page.getByRole("link", { name: "Log in or sign up" }).click();
  await submitAuthForm(page, "login", "planner@example.com", "correct-horse");
  await expect(page.getByRole("heading", { name: "planner@example.com" })).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/unlock$/);
  await expect(page.getByRole("tab", { name: "Log in" })).toBeVisible();

  await accountButton(page).click();
  await expect(signedOutAccountHeading(page)).toBeVisible();
});
