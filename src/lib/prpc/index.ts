/**
 * pRPC Client Library
 *
 * Type-safe client for interacting with Xandeum pNode RPC API.
 *
 * @example
 * ```ts
 * import { PRPCClient, createClient, PUBLIC_PNODES } from "@/lib/prpc";
 *
 * // Create client for specific node
 * const client = createClient("192.190.136.36");
 * const stats = await client.getStats();
 *
 * // Or use the class directly
 * const client2 = new PRPCClient({ baseUrl: "http://192.190.136.36:6000" });
 * ```
 */

export { PRPCClient, createClient, PUBLIC_PNODES } from "./client";
export type { PublicPNodeIP } from "./client";

// Re-export types
export type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
  PNodeVersion,
  PNodeStats,
  Pod,
  PodsResult,
  PRPCClientConfig,
  EnhancedNodeStats,
  NetworkStats,
} from "@/types/prpc";

export { PRPCError, PRPCErrorCode } from "@/types/prpc";
