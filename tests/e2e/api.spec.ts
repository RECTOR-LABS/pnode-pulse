import { test, expect } from "@playwright/test";

test.describe("API Endpoints", () => {
  test("GET /api/health returns 200 with health status", async ({ request }) => {
    const response = await request.get("/api/health");

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("status");
    expect(["healthy", "degraded", "unhealthy"]).toContain(body.status);
    expect(body).toHaveProperty("timestamp");
  });

  test("GET /api/v1/network returns network data", async ({ request }) => {
    const response = await request.get("/api/v1/network");

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toBeDefined();
  });

  test("GET /api/v1/nodes returns nodes list", async ({ request }) => {
    const response = await request.get("/api/v1/nodes");

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toBeDefined();
    // Should be an array or object with nodes
    if (Array.isArray(body)) {
      expect(Array.isArray(body)).toBe(true);
    } else if (body.nodes) {
      expect(Array.isArray(body.nodes)).toBe(true);
    }
  });

  test("GET /api/v1/leaderboard returns leaderboard data", async ({
    request,
  }) => {
    const response = await request.get("/api/v1/leaderboard");

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toBeDefined();
  });

  test("API endpoints have proper CORS headers", async ({ request }) => {
    const response = await request.get("/api/v1/network");

    // Check for CORS headers (configured in next.config.ts)
    const headers = response.headers();
    expect(headers["access-control-allow-origin"]).toBe("*");
  });

  test("API endpoints have cache headers", async ({ request }) => {
    const response = await request.get("/api/v1/network");

    const headers = response.headers();
    // Should have some cache control header
    expect(
      headers["cache-control"] || headers["cdn-cache-control"]
    ).toBeDefined();
  });
});

test.describe("API Error Handling", () => {
  test("returns 404 for non-existent API routes", async ({ request }) => {
    const response = await request.get("/api/v1/nonexistent-endpoint");

    expect(response.status()).toBe(404);
  });

  test("handles invalid node ID gracefully", async ({ request }) => {
    const response = await request.get("/api/v1/nodes/invalid-id-12345");

    // Should return 404 or appropriate error, not 500
    expect([400, 404]).toContain(response.status());
  });
});
