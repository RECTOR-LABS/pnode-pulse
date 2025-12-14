/**
 * Redis Pub/Sub for Real-time Updates
 *
 * Enables horizontal scaling by broadcasting updates
 * across multiple server instances.
 */

import Redis from "ioredis";
import { logger } from "@/lib/logger";
import { getRedisConnectionConfig } from "@/lib/constants/redis";

// Channels for different update types
export const CHANNELS = {
  NETWORK_UPDATE: "pnode:network:update",
  NODE_UPDATE: "pnode:node:update",
  METRICS_UPDATE: "pnode:metrics:update",
  ALERT_UPDATE: "pnode:alert:update",
} as const;

export type Channel = (typeof CHANNELS)[keyof typeof CHANNELS];

// Update payload types
export interface NetworkUpdate {
  type: "network";
  timestamp: number;
  data: {
    totalNodes: number;
    activeNodes: number;
    inactiveNodes: number;
  };
}

export interface NodeUpdate {
  type: "node";
  timestamp: number;
  nodeId: number;
  data: {
    isActive: boolean;
    version?: string;
    lastSeen: string;
  };
}

export interface MetricsUpdate {
  type: "metrics";
  timestamp: number;
  nodeId: number;
  data: {
    cpu: number;
    ram: number;
    uptime: number;
    storage: number;
  };
}

export interface AlertUpdate {
  type: "alert";
  timestamp: number;
  data: {
    id: number;
    severity: string;
    message: string;
  };
}

export type UpdatePayload = NetworkUpdate | NodeUpdate | MetricsUpdate | AlertUpdate;

// Redis connection config for pub/sub
function getRedisConfig() {
  return {
    ...getRedisConnectionConfig(),
    maxRetriesPerRequest: null, // Required for pub/sub
    retryStrategy: (times: number) => {
      if (times > 10) return null;
      return Math.min(times * 100, 3000);
    },
  };
}

// Publisher singleton
let publisher: Redis | null = null;

/**
 * Get or create the publisher client
 */
export function getPublisher(): Redis {
  if (!publisher) {
    publisher = new Redis(getRedisConfig());
    publisher.on("error", (err) => {
      logger.error("[Redis Publisher] Error:", err);
    });
  }
  return publisher;
}

/**
 * Publish an update to a channel
 */
export async function publishUpdate(
  channel: Channel,
  payload: UpdatePayload
): Promise<void> {
  try {
    const pub = getPublisher();
    await pub.publish(channel, JSON.stringify(payload));
  } catch (error) {
    logger.error(`[Redis Pub/Sub] Failed to publish to ${channel}:`, error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Create a new subscriber client
 * Each SSE connection needs its own subscriber
 */
export function createSubscriber(): Redis {
  const subscriber = new Redis(getRedisConfig());

  subscriber.on("error", (err) => {
    logger.error("[Redis Subscriber] Error:", err);
  });

  return subscriber;
}

/**
 * Subscribe to channels and handle messages
 */
export async function subscribe(
  subscriber: Redis,
  channels: Channel[],
  onMessage: (channel: string, payload: UpdatePayload) => void
): Promise<void> {
  // Set up message handler
  subscriber.on("message", (channel, message) => {
    try {
      const payload = JSON.parse(message) as UpdatePayload;
      onMessage(channel, payload);
    } catch (error) {
      logger.error("[Redis Subscriber] Failed to parse message:", error instanceof Error ? error : new Error(String(error)));
    }
  });

  // Subscribe to channels
  await subscriber.subscribe(...channels);
}

/**
 * Unsubscribe and close a subscriber
 */
export async function closeSubscriber(subscriber: Redis): Promise<void> {
  try {
    await subscriber.unsubscribe();
    await subscriber.quit();
  } catch {
    // Ignore errors on cleanup
  }
}

/**
 * Helper to publish network stats update
 */
export async function publishNetworkUpdate(
  totalNodes: number,
  activeNodes: number,
  inactiveNodes: number
): Promise<void> {
  await publishUpdate(CHANNELS.NETWORK_UPDATE, {
    type: "network",
    timestamp: Date.now(),
    data: { totalNodes, activeNodes, inactiveNodes },
  });
}

/**
 * Helper to publish node metrics update
 */
export async function publishMetricsUpdate(
  nodeId: number,
  cpu: number,
  ram: number,
  uptime: number,
  storage: number
): Promise<void> {
  await publishUpdate(CHANNELS.METRICS_UPDATE, {
    type: "metrics",
    timestamp: Date.now(),
    nodeId,
    data: { cpu, ram, uptime, storage },
  });
}
