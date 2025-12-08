/**
 * pRPC (pNode RPC) Type Definitions
 *
 * Based on actual API responses from pNode RPC at port 6000.
 * Note: Some fields differ from official docs - these types reflect actual behavior.
 */

// ============================================
// RPC Base Types
// ============================================

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
  id: number;
}

export interface JsonRpcResponse<T> {
  jsonrpc: "2.0";
  result?: T;
  error?: JsonRpcError;
  id: number;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// ============================================
// pRPC Response Types
// ============================================

/**
 * Response from get-version RPC method
 */
export interface PNodeVersion {
  version: string;
}

/**
 * Response from get-stats RPC method
 * Note: This is a FLAT structure (differs from official docs)
 */
export interface PNodeStats {
  /** Number of active data streams */
  active_streams: number;
  /** CPU usage percentage (0-100) */
  cpu_percent: number;
  /** Current data index */
  current_index: number;
  /** Total file size in bytes */
  file_size: number;
  /** Unix timestamp of last update */
  last_updated: number;
  /** Total packets received */
  packets_received: number;
  /** Total packets sent */
  packets_sent: number;
  /** Total RAM in bytes */
  ram_total: number;
  /** Used RAM in bytes */
  ram_used: number;
  /** Total bytes stored */
  total_bytes: number;
  /** Total pages stored */
  total_pages: number;
  /** Uptime in seconds */
  uptime: number;
}

/**
 * A single pod (peer node) in the network
 * Note: pubkey field is not in official docs but is present in responses
 */
export interface Pod {
  /** Address in format "ip:port" (gossip port 9001) */
  address: string;
  /** Unix timestamp of last seen */
  last_seen_timestamp: number;
  /** Base58 public key of the node (may be null) */
  pubkey: string | null;
  /** pNode software version */
  version: string;
}

/**
 * Response from get-pods RPC method
 */
export interface PodsResult {
  /** Array of peer nodes */
  pods: Pod[];
  /** Total number of known peers */
  total_count: number;
}

/**
 * Enhanced pod with comprehensive stats (v0.7.0+)
 * From get-pods-with-stats RPC method
 */
export interface PodWithStats {
  /** Address in format "ip:port" (gossip port 9001) */
  address: string;
  /** Whether RPC port is publicly accessible (null if unknown) */
  is_public: boolean | null;
  /** Unix timestamp of last seen */
  last_seen_timestamp: number;
  /** Base58 public key of the node (null for older versions or private nodes) */
  pubkey: string | null;
  /** RPC service port (typically 6000, null if not available) */
  rpc_port: number | null;
  /** Total storage allocated in bytes (null if not available) */
  storage_committed: number | null;
  /** Storage utilization percentage (null if not available) */
  storage_usage_percent: number | null;
  /** Actual storage used in bytes (null if not available) */
  storage_used: number | null;
  /** Node uptime in seconds (null if not available) */
  uptime: number | null;
  /** pNode software version (may be "unknown") */
  version: string;
}

/**
 * Response from get-pods-with-stats RPC method (v0.7.0+)
 */
export interface PodsWithStatsResult {
  /** Array of pods with comprehensive stats */
  pods: PodWithStats[];
  /** Total number of known peers */
  total_count: number;
}

// ============================================
// Client Configuration Types
// ============================================

export interface PRPCClientConfig {
  /** Base URL of the pNode RPC endpoint (e.g., "http://192.190.136.36:6000") */
  baseUrl: string;
  /** Request timeout in milliseconds (default: 5000) */
  timeout?: number;
  /** Number of retry attempts on failure (default: 0) */
  retries?: number;
  /** Delay between retries in milliseconds (default: 1000) */
  retryDelay?: number;
}

// ============================================
// Error Types
// ============================================

export class PRPCError extends Error {
  constructor(
    message: string,
    public code: PRPCErrorCode,
    public cause?: Error
  ) {
    super(message);
    this.name = "PRPCError";
  }
}

export enum PRPCErrorCode {
  /** Network request failed */
  NETWORK_ERROR = "NETWORK_ERROR",
  /** Request timed out */
  TIMEOUT = "TIMEOUT",
  /** RPC returned an error response */
  RPC_ERROR = "RPC_ERROR",
  /** Response parsing failed */
  PARSE_ERROR = "PARSE_ERROR",
  /** Invalid configuration */
  CONFIG_ERROR = "CONFIG_ERROR",
}

// ============================================
// Computed/Derived Types
// ============================================

/**
 * Enhanced node stats with computed fields
 */
export interface EnhancedNodeStats extends PNodeStats {
  /** Node IP address */
  ip: string;
  /** RAM usage percentage */
  ram_percent: number;
  /** Formatted uptime string */
  uptime_formatted: string;
  /** Formatted file size string */
  file_size_formatted: string;
}

/**
 * Network-wide aggregated stats
 */
export interface NetworkStats {
  /** Total number of nodes */
  total_nodes: number;
  /** Number of active nodes */
  active_nodes: number;
  /** Total storage across all nodes */
  total_storage: number;
  /** Average CPU usage */
  avg_cpu: number;
  /** Average RAM usage percentage */
  avg_ram_percent: number;
  /** Average uptime in seconds */
  avg_uptime: number;
  /** Timestamp of aggregation */
  timestamp: Date;
}
