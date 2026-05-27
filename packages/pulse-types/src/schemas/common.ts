import { z } from "zod";

/** Solana base58 keypair (32-44 chars from the base58 alphabet). */
export const pubkeySchema = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, {
  message: "Invalid base58 pubkey",
});

/** Prisma cuid (default ID format for non-Node records). */
export const cuidSchema = z.string().regex(/^c[a-z0-9]{24,}$/i, {
  message: "Invalid cuid",
});

/** ISO 8601 datetime string. */
export const isoDateSchema = z.string().datetime({
  message: "Expected ISO 8601 datetime",
});

/** Pagination query params used by every list endpoint. */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type PaginationInput = z.infer<typeof paginationSchema>;

/** Sort order. */
export const sortOrderSchema = z.enum(["asc", "desc"]).default("desc");

/** Time bucket for time-series endpoints. */
export const bucketSchema = z
  .enum(["raw", "minute", "hour", "day", "week", "auto"])
  .default("auto");

/** Time range params used by metric endpoints. */
export const timeRangeSchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema.optional(),
  bucket: bucketSchema,
});
export type TimeRangeInput = z.infer<typeof timeRangeSchema>;
