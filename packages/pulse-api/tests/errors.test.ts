import { describe, it, expect } from "vitest";
import {
  ApiError,
  unauthorized,
  notFound,
  validation,
} from "../src/lib/errors";

describe("ApiError", () => {
  it("carries code, status, and details", () => {
    const e = new ApiError("CONFLICT", "duplicate", 409, { field: "pubkey" });
    expect(e.code).toBe("CONFLICT");
    expect(e.status).toBe(409);
    expect(e.message).toBe("duplicate");
    expect(e.details).toEqual({ field: "pubkey" });
  });

  it("helpers produce expected codes/statuses", () => {
    expect(unauthorized().code).toBe("UNAUTHORIZED");
    expect(unauthorized().status).toBe(401);
    expect(notFound().status).toBe(404);
    expect(validation("bad").status).toBe(400);
  });
});
