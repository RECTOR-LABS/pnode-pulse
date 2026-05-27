/**
 * Cross-cutting types used by every endpoint.
 *
 * Wire-format conventions (see docs/REDESIGN_API_CONTRACT.md §1.4):
 *   - BigInt fields  → JSON decimal string ("94633")
 *   - Date fields    → ISO 8601 string ("2026-05-27T10:00:00.000Z")
 */

export type BigIntString = string;
export type IsoDate = string;

export interface PageInfo {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

export interface Paginated<T> {
  data: T[];
  page: PageInfo;
}

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RESOURCE_NOT_FOUND"
  | "VALIDATION_ERROR"
  | "RATE_LIMIT_EXCEEDED"
  | "CONFLICT"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR";

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details: unknown | null;
  };
  requestId: string;
}

export type SortOrder = "asc" | "desc";

export type Bucket = "raw" | "minute" | "hour" | "day" | "week" | "auto";
