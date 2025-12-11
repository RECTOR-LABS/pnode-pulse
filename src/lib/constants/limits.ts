/**
 * Application-wide Constants and Limits
 *
 * Centralized configuration for magic numbers and limits.
 * All values include documentation explaining their purpose and rationale.
 */

// ============================================================================
// Time Intervals (milliseconds)
// ============================================================================

/** How often to collect metrics from pNodes (1 minute) */
export const COLLECTION_INTERVAL_MS = 60_000;

/** How often client refetches node data (30 seconds) */
export const NODE_REFETCH_INTERVAL_MS = 30_000;

/** How often to evaluate alert rules (30 seconds) */
export const ALERT_EVALUATION_INTERVAL_MS = 30_000;

/** How often to process escalations (1 minute) */
export const ALERT_ESCALATION_INTERVAL_MS = 60_000;

/** JWT validity period (7 days) */
export const JWT_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000;

/** Authentication challenge validity (5 minutes) */
export const CHALLENGE_VALIDITY_MS = 5 * 60 * 1000;

/** Rate limit window size (1 minute) */
export const RATE_LIMIT_WINDOW_MS = 60_000;

// ============================================================================
// Query & Pagination Limits
// ============================================================================

/** Maximum nodes returned per query (prevents overwhelming frontend) */
export const MAX_NODES_PER_QUERY = 100;

/** Maximum raw metrics data points (prevents memory issues) */
export const MAX_RAW_METRICS = 1000;

/** Maximum API keys per user */
export const MAX_API_KEYS_PER_USER = 10;

/** Default pagination limit */
export const DEFAULT_PAGE_SIZE = 50;

/** Maximum page size allowed */
export const MAX_PAGE_SIZE = 200;

// ============================================================================
// Connection & Retry Limits
// ============================================================================

/** Maximum Redis reconnection attempts */
export const MAX_REDIS_RETRIES = 3;

/** Maximum WebSocket reconnection attempts */
export const MAX_WEBSOCKET_RECONNECT_ATTEMPTS = 5;

/** pRPC request timeout (5 seconds) */
export const PRPC_TIMEOUT_MS = 5_000;

/** Maximum concurrent workers for queues */
export const DEFAULT_WORKER_CONCURRENCY = 5;

// ============================================================================
// Data Retention
// ============================================================================

/** How long to keep completed jobs in queue */
export const QUEUE_COMPLETED_JOB_RETENTION = 100;

/** How long to keep failed jobs in queue */
export const QUEUE_FAILED_JOB_RETENTION = 500;

// ============================================================================
// Validation Limits
// ============================================================================

/** Minimum alert threshold value */
export const MIN_ALERT_THRESHOLD = 0;

/** Maximum alert threshold value */
export const MAX_ALERT_THRESHOLD = 100;

/** Maximum alert rule name length */
export const MAX_ALERT_NAME_LENGTH = 100;

/** Maximum report name length */
export const MAX_REPORT_NAME_LENGTH = 100;

// ============================================================================
// Rate Limits (requests per minute)
// ============================================================================

export const RATE_LIMITS = {
  ANONYMOUS: 60,
  FREE: 120,
  PRO: 500,
  ENTERPRISE: 2000,
} as const;
