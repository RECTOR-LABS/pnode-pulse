import { describe, it, expect, afterEach } from "vitest";
import { cronAuthError } from "@/lib/cron/auth";

describe("cronAuthError", () => {
  const original = process.env.CRON_SECRET;
  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  const reqWith = (auth?: string) =>
    new Request(
      "https://example.com/api/cron/rollups",
      auth ? { headers: { authorization: auth } } : undefined,
    );

  it("returns 401 when CRON_SECRET is not configured", () => {
    delete process.env.CRON_SECRET;
    expect(cronAuthError(reqWith("Bearer anything"))?.status).toBe(401);
  });

  it("returns 401 when the Authorization header is missing", () => {
    process.env.CRON_SECRET = "s3cr3t";
    expect(cronAuthError(reqWith())?.status).toBe(401);
  });

  it("returns 401 when the bearer token is wrong", () => {
    process.env.CRON_SECRET = "s3cr3t";
    expect(cronAuthError(reqWith("Bearer nope"))?.status).toBe(401);
  });

  it("returns null when the bearer token matches", () => {
    process.env.CRON_SECRET = "s3cr3t";
    expect(cronAuthError(reqWith("Bearer s3cr3t"))).toBeNull();
  });
});
