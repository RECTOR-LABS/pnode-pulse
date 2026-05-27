import { describe, it, expect } from "vitest";
import { serialize } from "../src/lib/serialize";

describe("serialize", () => {
  it("converts bigint to decimal string", () => {
    expect(serialize(BigInt(94633))).toBe("94633");
    expect(serialize(BigInt("99999999999999999999"))).toBe(
      "99999999999999999999",
    );
  });

  it("converts Date to ISO 8601", () => {
    const d = new Date("2026-05-27T10:00:00.000Z");
    expect(serialize(d)).toBe("2026-05-27T10:00:00.000Z");
  });

  it("walks arrays recursively", () => {
    expect(serialize([BigInt(1), BigInt(2), BigInt(3)])).toEqual([
      "1",
      "2",
      "3",
    ]);
  });

  it("walks plain objects recursively", () => {
    const input = {
      id: 1,
      ramUsed: BigInt(5_000_000_000),
      time: new Date("2026-05-27T10:00:00.000Z"),
      nested: { uptime: BigInt(86400) },
    };
    expect(serialize(input)).toEqual({
      id: 1,
      ramUsed: "5000000000",
      time: "2026-05-27T10:00:00.000Z",
      nested: { uptime: "86400" },
    });
  });

  it("passes through primitives unchanged", () => {
    expect(serialize(42)).toBe(42);
    expect(serialize("hello")).toBe("hello");
    expect(serialize(true)).toBe(true);
    expect(serialize(null)).toBe(null);
    expect(serialize(undefined)).toBe(undefined);
  });

  it("preserves null fields inside objects", () => {
    expect(serialize({ a: null, b: BigInt(1) })).toEqual({ a: null, b: "1" });
  });

  it("handles arrays of objects with bigint and date", () => {
    const input = [
      { id: 1, time: new Date("2026-05-27T00:00:00.000Z"), bytes: BigInt(100) },
      { id: 2, time: new Date("2026-05-28T00:00:00.000Z"), bytes: BigInt(200) },
    ];
    expect(serialize(input)).toEqual([
      { id: 1, time: "2026-05-27T00:00:00.000Z", bytes: "100" },
      { id: 2, time: "2026-05-28T00:00:00.000Z", bytes: "200" },
    ]);
  });
});
