"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface UseRealtimeOptions {
  /** Enable/disable the periodic refresh loop. */
  enabled?: boolean;
  /** Refresh interval in milliseconds. */
  intervalMs?: number;
  /** Called when the refresh loop starts (true) or stops (false). */
  onConnectionChange?: (connected: boolean) => void;
}

// Collection runs on a daily schedule, so this interval is about keeping the
// dashboard fresh without a manual reload (and driving the liveness dot), not
// low-latency push. Kept modest so the UI still feels live.
const DEFAULT_INTERVAL_MS = 60_000;

// Query-key prefixes to refresh. These mirror the keys the former SSE handler
// invalidated, so every dashboard query that reacted to live updates continues
// to refresh — now on a timer instead of a server-pushed event.
const REFRESH_KEYS: string[][] = [
  ["network"],
  ["nodes"],
  ["analytics"],
  ["alerts"],
];

/**
 * Periodically refreshes dashboard data by invalidating the relevant React
 * Query caches. Replaces the former SSE stream (/api/realtime + Redis pub/sub),
 * which required a persistent connection unsuited to serverless and unnecessary
 * for the daily collection cadence.
 */
export function useRealtime(options: UseRealtimeOptions = {}) {
  const {
    enabled = true,
    intervalMs = DEFAULT_INTERVAL_MS,
    onConnectionChange,
  } = options;

  const queryClient = useQueryClient();
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      onConnectionChange?.(false);
      return;
    }

    onConnectionChange?.(true);

    const interval = setInterval(() => {
      for (const queryKey of REFRESH_KEYS) {
        queryClient.invalidateQueries({ queryKey });
      }
      setLastUpdate(Date.now());
    }, intervalMs);

    return () => {
      clearInterval(interval);
      onConnectionChange?.(false);
    };
  }, [enabled, intervalMs, queryClient, onConnectionChange]);

  return {
    connected: enabled,
    lastUpdate,
    reconnectAttempts: 0,
    reconnect: () => {},
  };
}

/**
 * Simple hook exposing refresh status for the header liveness indicator.
 */
export function useRealtimeStatus() {
  const [connected, setConnected] = useState(false);
  const { lastUpdate } = useRealtime({ onConnectionChange: setConnected });
  return { connected, lastUpdate, reconnectAttempts: 0 };
}
