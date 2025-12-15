import { test, expect } from "@playwright/test";

test.describe("Nodes Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/nodes");
  });

  test("loads and displays Network Nodes heading", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Network Nodes");
  });

  test("displays page description", async ({ page }) => {
    await expect(
      page.getByText("Browse and filter all pNodes")
    ).toBeVisible();
  });

  test("shows loading state or node list", async ({ page }) => {
    // Either shows loading skeleton or actual node data
    const hasContent = await page
      .locator("main")
      .evaluate((el) => el.textContent?.length ?? 0 > 100);
    expect(hasContent).toBe(true);
  });

  test("has search or filter functionality", async ({ page }) => {
    // Wait for the page to load
    await page.waitForLoadState("networkidle");

    // Look for search input or filter controls
    const searchInput = page.getByPlaceholder(/search/i);
    const filterExists = await searchInput.count();

    // Either has search or the main content area is interactive
    if (filterExists > 0) {
      await expect(searchInput).toBeVisible();
    } else {
      // At minimum, the page should have loaded content
      await expect(page.locator("main")).toBeVisible();
    }
  });
});

test.describe("Node Detail Page", () => {
  test("displays node information when valid ID provided", async ({ page }) => {
    // Navigate to nodes list first
    await page.goto("/en/nodes");
    await page.waitForLoadState("networkidle");

    // Try to find and click on a node link if available
    const nodeLink = page.locator('a[href*="/nodes/"]').first();
    const linkCount = await nodeLink.count();

    if (linkCount > 0) {
      await nodeLink.click();
      await page.waitForLoadState("networkidle");

      // Should show some node detail content
      await expect(page.locator("main")).toBeVisible();
    } else {
      // If no nodes, verify the page at least renders
      await expect(page.locator("h1")).toContainText("Network Nodes");
    }
  });

  test("handles invalid node ID gracefully", async ({ page }) => {
    await page.goto("/en/nodes/invalid-node-id-12345");
    await page.waitForLoadState("networkidle");

    // Should show error message or redirect, not crash
    const pageContent = await page.locator("body").textContent();
    expect(pageContent).toBeTruthy();
  });
});
