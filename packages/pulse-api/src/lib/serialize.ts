/**
 * Wire-format serializer.
 *
 * Converts:
 *   - bigint  → decimal string (JSON-safe, lossless)
 *   - Date    → ISO 8601 string
 *
 * Walks arrays and plain objects recursively. Buffers, Maps, Sets are
 * passed through unchanged — they shouldn't appear in API payloads.
 *
 * See docs/REDESIGN_API_CONTRACT.md §1.4.
 */

export function serialize<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString() as unknown as T;
  if (value instanceof Date) return value.toISOString() as unknown as T;
  if (Array.isArray(value))
    return value.map((v) => serialize(v)) as unknown as T;
  if (typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto === Object.prototype || proto === null) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = serialize(v);
      }
      return out as unknown as T;
    }
  }
  return value;
}
