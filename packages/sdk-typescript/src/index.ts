/**
 * pNode Pulse TypeScript SDK
 *
 * Official SDK for accessing pNode network data via the pNode Pulse API.
 *
 * @example
 * ```typescript
 * import { PnodePulse } from '@pnode-pulse/sdk';
 *
 * const client = new PnodePulse({ apiKey: 'pk_live_...' });
 *
 * // Get network overview
 * const network = await client.network.getOverview();
 * console.log(`Active nodes: ${network.nodes.active}`);
 *
 * // Get node details
 * const node = await client.nodes.get(1);
 * console.log(`Node uptime: ${node.metrics?.uptimeSeconds}`);
 * ```
 */

// ============================================================
// Types
// ============================================================

export interface PnodePulseConfig {
  /** API key for authenticated requests (optional for anonymous access) */
  apiKey?: string;
  /** Base URL of the API (default: https://pulse.rectorspace.com) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Custom fetch implementation (for Node.js or testing) */
  fetch?: typeof fetch;
}

export interface NetworkOverview {
  nodes: {
    total: number;
    active: number;
    inactive: number;
  };
  versions: Array<{
    version: string;
    count: number;
  }>;
  metrics: {
    totalStorageBytes: number;
    avgCpuPercent: number;
    avgRamPercent: number;
    avgUptimeSeconds: number;
    timestamp: string;
  };
}

export interface NetworkStats {
  cpu: {
    avg: number;
    min: number;
    max: number;
    p50: number;
    p90: number;
    p99: number;
  };
  ram: {
    avgPercent: number;
    minPercent: number;
    maxPercent: number;
    p50: number;
    p90: number;
    p99: number;
  };
  storage: {
    total: number;
    avg: number;
  };
  uptime: {
    avgSeconds: number;
  };
  nodeCount: number;
}

export interface Node {
  id: number;
  address: string;
  pubkey: string | null;
  version: string | null;
  isActive: boolean;
  lastSeen: string | null;
  firstSeen: string;
}

export interface NodeDetails extends Node {
  metrics: {
    cpuPercent: number | null;
    ramUsedBytes: number;
    ramTotalBytes: number;
    ramPercent: number;
    storageBytes: number;
    uptimeSeconds: number | null;
    packetsReceived: number | null;
    packetsSent: number | null;
    timestamp: string;
  } | null;
  peerCount: number;
  metricsCount: number;
}

export interface NodeMetrics {
  nodeId: number;
  range: string;
  aggregation: string;
  data: Array<{
    time: string;
    cpuPercent: number;
    ramPercent: number;
    storageBytes: number;
    uptimeSeconds: number;
  }>;
}

export interface NodesListParams {
  status?: "all" | "active" | "inactive";
  version?: string;
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: "lastSeen" | "firstSeen" | "address" | "version";
  order?: "asc" | "desc";
}

export interface NodesList {
  nodes: Node[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface MetricsParams {
  range?: "1h" | "24h" | "7d" | "30d";
  aggregation?: "raw" | "hourly" | "daily";
}

export interface LeaderboardParams {
  metric?: "uptime" | "cpu" | "ram" | "storage";
  order?: "top" | "bottom";
  limit?: number;
  period?: "24h" | "7d" | "30d" | "all";
}

export interface LeaderboardEntry {
  rank: number;
  nodeId: number;
  address: string;
  version: string;
  value: number;
  metrics: {
    uptimeSeconds: number;
    cpuPercent: number;
    ramPercent: number;
    storageBytes: number;
  };
}

export interface Leaderboard {
  metric: string;
  period: string;
  order: string;
  rankings: LeaderboardEntry[];
}

export interface ApiError {
  code: string;
  message: string;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

// ============================================================
// Error Classes
// ============================================================

export class PnodePulseError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
    public rateLimit?: RateLimitInfo
  ) {
    super(message);
    this.name = "PnodePulseError";
  }
}

export class RateLimitError extends PnodePulseError {
  constructor(
    message: string,
    public retryAfter: number,
    rateLimit: RateLimitInfo
  ) {
    super(message, "RATE_LIMIT_EXCEEDED", 429, rateLimit);
    this.name = "RateLimitError";
  }
}

// ============================================================
// API Client
// ============================================================

const DEFAULT_BASE_URL = "https://pulse.rectorspace.com";
const DEFAULT_TIMEOUT = 30000;

class ApiClient {
  private baseUrl: string;
  private apiKey?: string;
  private timeout: number;
  private fetchFn: typeof fetch;

  constructor(config: PnodePulseConfig) {
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
    this.fetchFn = config.fetch || globalThis.fetch;
  }

  async request<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this.fetchFn(url.toString(), {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      const rateLimit: RateLimitInfo = {
        limit: parseInt(response.headers.get("X-RateLimit-Limit") || "0"),
        remaining: parseInt(response.headers.get("X-RateLimit-Remaining") || "0"),
        reset: parseInt(response.headers.get("X-RateLimit-Reset") || "0"),
      };

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get("Retry-After") || "60");
          throw new RateLimitError(
            data.error?.message || "Rate limit exceeded",
            retryAfter,
            rateLimit
          );
        }

        throw new PnodePulseError(
          data.error?.message || "API request failed",
          data.error?.code || "UNKNOWN_ERROR",
          response.status,
          rateLimit
        );
      }

      return data;
    } catch (error) {
      if (error instanceof PnodePulseError) {
        throw error;
      }
      if ((error as Error).name === "AbortError") {
        throw new PnodePulseError("Request timeout", "TIMEOUT");
      }
      throw new PnodePulseError(
        `Network error: ${(error as Error).message}`,
        "NETWORK_ERROR"
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// ============================================================
// Resource Classes
// ============================================================

export class NetworkResource {
  constructor(private client: ApiClient) {}

  /**
   * Get network overview including node counts, versions, and aggregate metrics
   */
  async getOverview(): Promise<NetworkOverview> {
    return this.client.request<NetworkOverview>("/api/v1/network");
  }

  /**
   * Get detailed network statistics with percentiles
   */
  async getStats(): Promise<NetworkStats> {
    return this.client.request<NetworkStats>("/api/v1/network/stats");
  }
}

export class NodesResource {
  constructor(private client: ApiClient) {}

  /**
   * List all nodes with optional filtering and pagination
   */
  async list(params?: NodesListParams): Promise<NodesList> {
    return this.client.request<NodesList>("/api/v1/nodes", params as Record<string, unknown>);
  }

  /**
   * Get details for a specific node by ID or address
   */
  async get(idOrAddress: number | string): Promise<NodeDetails> {
    return this.client.request<NodeDetails>(`/api/v1/nodes/${idOrAddress}`);
  }

  /**
   * Get historical metrics for a node
   */
  async getMetrics(nodeId: number, params?: MetricsParams): Promise<NodeMetrics> {
    return this.client.request<NodeMetrics>(`/api/v1/nodes/${nodeId}/metrics`, params as Record<string, unknown>);
  }
}

export class LeaderboardResource {
  constructor(private client: ApiClient) {}

  /**
   * Get node rankings by specified metric
   */
  async get(params?: LeaderboardParams): Promise<Leaderboard> {
    return this.client.request<Leaderboard>("/api/v1/leaderboard", params as Record<string, unknown>);
  }

  /**
   * Get top performers by uptime
   */
  async topUptime(limit = 10): Promise<Leaderboard> {
    return this.get({ metric: "uptime", order: "top", limit });
  }

  /**
   * Get most efficient nodes (lowest CPU usage)
   */
  async topEfficiency(limit = 10): Promise<Leaderboard> {
    return this.get({ metric: "cpu", order: "top", limit });
  }

  /**
   * Get highest storage capacity nodes
   */
  async topStorage(limit = 10): Promise<Leaderboard> {
    return this.get({ metric: "storage", order: "top", limit });
  }
}

// ============================================================
// Main Client
// ============================================================

/**
 * pNode Pulse API Client
 *
 * @example
 * ```typescript
 * // Anonymous access (30 req/min)
 * const client = new PnodePulse();
 *
 * // Authenticated access (higher limits)
 * const client = new PnodePulse({ apiKey: 'pk_live_...' });
 *
 * // Custom configuration
 * const client = new PnodePulse({
 *   apiKey: 'pk_live_...',
 *   baseUrl: 'https://custom.domain.com',
 *   timeout: 60000
 * });
 * ```
 */
export class PnodePulse {
  private client: ApiClient;

  /** Network-level endpoints */
  public network: NetworkResource;

  /** Node-level endpoints */
  public nodes: NodesResource;

  /** Leaderboard endpoints */
  public leaderboard: LeaderboardResource;

  constructor(config: PnodePulseConfig = {}) {
    this.client = new ApiClient(config);
    this.network = new NetworkResource(this.client);
    this.nodes = new NodesResource(this.client);
    this.leaderboard = new LeaderboardResource(this.client);
  }
}

// Default export
export default PnodePulse;
