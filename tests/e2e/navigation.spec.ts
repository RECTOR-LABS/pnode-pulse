import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("can navigate from homepage to nodes page", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Click on Nodes link in navigation
    await page.getByRole("link", { name: /nodes/i }).first().click();

    await expect(page).toHaveURL(/\/nodes/);
    await expect(page.locator("h1")).toContainText("Network Nodes");
  });

  test("can navigate from homepage to leaderboard", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.getByRole("link", { name: /leaderboard/i }).first().click();

    await expect(page).toHaveURL(/\/leaderboard/);
  });

  test("can navigate to analytics page", async ({ page }) => {
    await page.goto("/en/analytics");

    await expect(page.locator("h1")).toBeVisible();
  });

  test("can navigate to privacy policy", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Scroll to footer and click privacy link
    await page.getByRole("link", { name: /privacy policy/i }).click();

    await expect(page).toHaveURL(/\/privacy/);
    await expect(page.locator("h1")).toContainText("Privacy Policy");
  });

  test("can navigate to terms of service", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.getByRole("link", { name: /terms of service/i }).click();

    await expect(page).toHaveURL(/\/terms/);
    await expect(page.locator("h1")).toContainText("Terms of Service");
  });
});

test.describe("Locale Redirects", () => {
  test("redirects /nodes to /en/nodes", async ({ page }) => {
    await page.goto("/nodes");

    await expect(page).toHaveURL(/\/en\/nodes/);
  });

  test("redirects /analytics to /en/analytics", async ({ page }) => {
    await page.goto("/analytics");

    await expect(page).toHaveURL(/\/en\/analytics/);
  });

  test("redirects /privacy to /en/privacy", async ({ page }) => {
    await page.goto("/privacy");

    await expect(page).toHaveURL(/\/en\/privacy/);
  });

  test("redirects /terms to /en/terms", async ({ page }) => {
    await page.goto("/terms");

    await expect(page).toHaveURL(/\/en\/terms/);
  });
});

test.describe("Responsive Design", () => {
  test("mobile viewport renders correctly", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
  });

  test("tablet viewport renders correctly", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");

    await expect(page.locator("h1")).toBeVisible();
  });

  test("desktop viewport renders correctly", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/");

    await expect(page.locator("h1")).toBeVisible();
  });
});
