/**
 * pRPC Client - Type-safe client for pNode JSON-RPC API
 *
 * Usage:
 * ```ts
 * const client = new PRPCClient({ baseUrl: "http://192.190.136.36:6000" });
 * const stats = await client.getStats();
 * console.log(stats.cpu_percent);
 * ```
 *
 * Note: Uses undici's request() instead of fetch() because port 6000 is blocked
 * by the WHATWG Fetch specification as an "unsafe port".
 */

import { request } from "undici";

import {
  type JsonRpcRequest,
  type JsonRpcResponse,
  type PNodeVersion,
  type PNodeStats,
  type PodsResult,
  type PodsWithStatsResult,
  type PRPCClientConfig,
  PRPCError,
  PRPCErrorCode,
} from "@/types/prpc";

const DEFAULT_TIMEOUT = 5000;
const DEFAULT_RETRIES = 0;
const DEFAULT_RETRY_DELAY = 1000;

export class PRPCClient {
  private baseUrl: string;
  private timeout: number;
  private retries: number;
  private retryDelay: number;
  private requestId: number = 0;

  constructor(config: PRPCClientConfig) {
    if (!config.baseUrl) {
      throw new PRPCError("baseUrl is required", PRPCErrorCode.CONFIG_ERROR);
    }

    // Normalize URL (remove trailing slash, ensure /rpc path)
    let url = config.baseUrl.replace(/\/$/, "");
    if (!url.endsWith("/rpc")) {
      url = `${url}/rpc`;
    }

    this.baseUrl = url;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.retries = config.retries ?? DEFAULT_RETRIES;
    this.retryDelay = config.retryDelay ?? DEFAULT_RETRY_DELAY;
  }

  /**
   * Get pNode software version
   */
  async getVersion(): Promise<PNodeVersion> {
    return this.call<PNodeVersion>("get-version");
  }

  /**
   * Get pNode stats (CPU, RAM, storage, etc.)
   */
  async getStats(): Promise<PNodeStats> {
    return this.call<PNodeStats>("get-stats");
  }

  /**
   * Get list of peer nodes (pods)
   * @deprecated Use getPodsWithStats() for v0.7.0+ nodes with comprehensive stats
   */
  async getPods(): Promise<PodsResult> {
    return this.call<PodsResult>("get-pods");
  }

  /**
   * Get list of peer nodes with comprehensive stats (v0.7.0+)
   * Returns ALL pNodes in gossip network with storage, uptime, and public/private status.
   * Note: Older pNodes (<v0.7.0) will appear with limited stats (null fields).
   */
  async getPodsWithStats(): Promise<PodsWithStatsResult> {
    return this.call<PodsWithStatsResult>("get-pods-with-stats");
  }

  /**
   * Low-level RPC call method
   */
  private async call<T>(method: string, params?: unknown): Promise<T> {
    const rpcRequest: JsonRpcRequest = {
      jsonrpc: "2.0",
      method,
      params,
      id: ++this.requestId,
    };

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        return await this.executeRequest<T>(rpcRequest);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on RPC errors (they're deterministic)
        if (error instanceof PRPCError && error.code === PRPCErrorCode.RPC_ERROR) {
          throw error;
        }

        // Wait before retrying
        if (attempt < this.retries) {
          await this.sleep(this.retryDelay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Execute a single RPC request using undici
   */
  private async executeRequest<T>(rpcRequest: JsonRpcRequest): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const { statusCode, body } = await request(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(rpcRequest),
        signal: controller.signal,
        headersTimeout: this.timeout,
        bodyTimeout: this.timeout,
      });

      if (statusCode !== 200) {
        throw new PRPCError(
          `HTTP ${statusCode}`,
          PRPCErrorCode.NETWORK_ERROR
        );
      }

      const data: JsonRpcResponse<T> = await body.json() as JsonRpcResponse<T>;

      if (data.error) {
        throw new PRPCError(
          data.error.message || "RPC error",
          PRPCErrorCode.RPC_ERROR
        );
      }

      if (data.result === undefined) {
        throw new PRPCError(
          "No result in response",
          PRPCErrorCode.PARSE_ERROR
        );
      }

      return data.result;
    } catch (error) {
      if (error instanceof PRPCError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === "AbortError" || error.message.includes("abort")) {
          throw new PRPCError(
            `Request timed out after ${this.timeout}ms`,
            PRPCErrorCode.TIMEOUT,
            error
          );
        }

        throw new PRPCError(
          error.message,
          PRPCErrorCode.NETWORK_ERROR,
          error
        );
      }

      throw new PRPCError(
        "Unknown error",
        PRPCErrorCode.NETWORK_ERROR
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get the base URL for this client
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Extract IP address from the base URL
   */
  getIp(): string {
    try {
      const url = new URL(this.baseUrl);
      return url.hostname;
    } catch {
      return this.baseUrl;
    }
  }
}

/**
 * Create a PRPCClient instance from an IP address
 */
export function createClient(ip: string, options?: Partial<PRPCClientConfig>): PRPCClient {
  return new PRPCClient({
    baseUrl: `http://${ip}:6000`,
    ...options,
  });
}

/**
 * List of known public pNode endpoints
 */
export const PUBLIC_PNODES = [
  "173.212.203.145",
  "173.212.220.65",
  "161.97.97.41",
  "192.190.136.36",
  "192.190.136.37",
  "192.190.136.38",
  "192.190.136.28",
  "192.190.136.29",
  "207.244.255.1",
] as const;

export type PublicPNodeIP = typeof PUBLIC_PNODES[number];
