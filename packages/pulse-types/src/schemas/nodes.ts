import { z } from "zod";
import {
  paginationSchema,
  pubkeySchema,
  sortOrderSchema,
  timeRangeSchema,
} from "./common";

export const listNodesQuerySchema = paginationSchema.extend({
  status: z.enum(["all", "active", "inactive", "archived"]).default("all"),
  version: z.string().optional(),
  search: z.string().optional(),
  orderBy: z
    .enum(["lastSeen", "firstSeen", "address", "version", "isActive"])
    .default("lastSeen"),
  order: sortOrderSchema,
  includeMetrics: z.coerce.boolean().default(false),
});
export type ListNodesQuery = z.infer<typeof listNodesQuerySchema>;

export const nodePubkeyParamSchema = z.object({
  pubkey: pubkeySchema,
});

export const nodeMetricsQuerySchema = timeRangeSchema;
export type NodeMetricsQuery = z.infer<typeof nodeMetricsQuerySchema>;
