import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("loads and displays Network Overview heading", async ({ page }) => {
    // Should redirect to /en and show the main heading
    await expect(page.locator("h1")).toContainText("Network Overview");
  });

  test("displays network description", async ({ page }) => {
    await expect(
      page.getByText("Real-time status and metrics from Xandeum")
    ).toBeVisible();
  });

  test("has navigation header", async ({ page }) => {
    // Check for main navigation links
    await expect(page.getByRole("link", { name: /nodes/i })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /leaderboard/i })
    ).toBeVisible();
  });

  test("has footer with legal links", async ({ page }) => {
    await expect(
      page.getByRole("link", { name: /privacy policy/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /terms of service/i })
    ).toBeVisible();
  });

  test("loads without JavaScript errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(errors).toHaveLength(0);
  });
});
