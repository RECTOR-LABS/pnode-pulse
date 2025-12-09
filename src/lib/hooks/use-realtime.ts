"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { UpdatePayload } from "@/lib/redis/pubsub";
import { logger } from "@/lib/logger";

interface UseRealtimeOptions {
  /** Channels to subscribe to */
  channels?: string[];
  /** Enable/disable the connection */
  enabled?: boolean;
  /** Called when connection status changes */
  onConnectionChange?: (connected: boolean) => void;
  /** Called when an update is received */
  onUpdate?: (payload: UpdatePayload) => void;
}

interface RealtimeState {
  connected: boolean;
  lastUpdate: number | null;
  reconnectAttempts: number;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

/**
 * Hook for subscribing to real-time updates via SSE
 *
 * Automatically reconnects on disconnect and invalidates
 * React Query caches when updates arrive.
 */
export function useRealtime(options: UseRealtimeOptions = {}) {
  const {
    channels,
    enabled = true,
    onConnectionChange,
    onUpdate,
  } = options;

  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectRef = useRef<() => void>(() => {});

  const [state, setState] = useState<RealtimeState>({
    connected: false,
    lastUpdate: null,
    reconnectAttempts: 0,
  });

  // Handle incoming updates - invalidate React Query caches
  const handleUpdate = useCallback(
    (payload: UpdatePayload) => {
      setState((prev) => ({ ...prev, lastUpdate: Date.now() }));
      onUpdate?.(payload);

      // Invalidate relevant React Query caches
      switch (payload.type) {
        case "network":
          queryClient.invalidateQueries({ queryKey: ["network"] });
          break;
        case "node":
          queryClient.invalidateQueries({
            queryKey: ["nodes", payload.nodeId],
          });
          break;
        case "metrics":
          queryClient.invalidateQueries({
            queryKey: ["nodes", payload.nodeId, "metrics"],
          });
          queryClient.invalidateQueries({ queryKey: ["analytics"] });
          break;
        case "alert":
          queryClient.invalidateQueries({ queryKey: ["alerts"] });
          break;
      }
    },
    [queryClient, onUpdate]
  );

  const connect = useCallback(() => {
    // Don't connect if disabled or already connected
    if (!enabled || eventSourceRef.current) return;

    // Build URL with optional channel filter
    let url = "/api/realtime";
    if (channels && channels.length > 0) {
      url += `?channels=${channels.join(",")}`;
    }

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setState((prev) => ({
        ...prev,
        connected: true,
        reconnectAttempts: 0,
      }));
      onConnectionChange?.(true);
    };

    eventSource.onerror = () => {
      setState((prev) => ({ ...prev, connected: false }));
      onConnectionChange?.(false);

      // Close and attempt reconnect
      eventSource.close();
      eventSourceRef.current = null;

      setState((prev) => {
        if (prev.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connectRef.current();
          }, RECONNECT_DELAY);

          return {
            ...prev,
            reconnectAttempts: prev.reconnectAttempts + 1,
          };
        }
        return prev;
      });
    };

    // Handle connection confirmation
    eventSource.addEventListener("connected", (event) => {
      logger.info("[Realtime] Connected:", JSON.parse(event.data));
    });

    // Handle network updates
    eventSource.addEventListener("update", (event) => {
      const payload = JSON.parse(event.data) as UpdatePayload;
      handleUpdate(payload);
    });

    // Handle specific event types
    eventSource.addEventListener("network", (event) => {
      const payload = JSON.parse(event.data) as UpdatePayload;
      handleUpdate(payload);
    });

    eventSource.addEventListener("metrics", (event) => {
      const payload = JSON.parse(event.data) as UpdatePayload;
      handleUpdate(payload);
    });

    eventSource.addEventListener("node", (event) => {
      const payload = JSON.parse(event.data) as UpdatePayload;
      handleUpdate(payload);
    });

    eventSource.addEventListener("alert", (event) => {
      const payload = JSON.parse(event.data) as UpdatePayload;
      handleUpdate(payload);
    });
  }, [enabled, channels, onConnectionChange, handleUpdate]);

  // Keep connectRef in sync with connect function
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setState((prev) => ({ ...prev, connected: false }));
    onConnectionChange?.(false);
  }, [onConnectionChange]);

  // Connect on mount, disconnect on unmount
  // When channels change, connect is recreated, triggering cleanup (disconnect) and reconnect
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    connected: state.connected,
    lastUpdate: state.lastUpdate,
    reconnectAttempts: state.reconnectAttempts,
    reconnect: () => {
      disconnect();
      setState((prev) => ({ ...prev, reconnectAttempts: 0 }));
      connect();
    },
  };
}

/**
 * Simple hook to check realtime connection status
 */
export function useRealtimeStatus() {
  const [connected, setConnected] = useState(false);

  const { lastUpdate, reconnectAttempts } = useRealtime({
    onConnectionChange: setConnected,
  });

  return { connected, lastUpdate, reconnectAttempts };
}
