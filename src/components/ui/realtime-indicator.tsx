"use client";

import { useRealtimeStatus } from "@/lib/hooks/use-realtime";

interface RealtimeIndicatorProps {
  showLabel?: boolean;
}

/**
 * Visual indicator for real-time connection status
 * Accessible to screen readers with live region
 */
export function RealtimeIndicator({ showLabel = true }: RealtimeIndicatorProps) {
  const { connected, lastUpdate, reconnectAttempts } = useRealtimeStatus();

  const getStatusColor = () => {
    if (connected) return "bg-status-active";
    if (reconnectAttempts > 0) return "bg-yellow-500";
    return "bg-status-inactive";
  };

  const getStatusLabel = () => {
    if (connected) return "Live";
    if (reconnectAttempts > 0) return "Reconnecting...";
    return "Offline";
  };

  const getAriaLabel = () => {
    if (connected) {
      return lastUpdate
        ? `Real-time connection active. Last update: ${new Date(lastUpdate).toLocaleTimeString()}`
        : "Real-time connection active";
    }
    if (reconnectAttempts > 0) {
      return `Connection lost. Reconnection attempt ${reconnectAttempts}`;
    }
    return "Real-time connection offline";
  };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={getAriaLabel()}
      className="flex items-center gap-2 text-sm"
      title={
        lastUpdate
          ? `Last update: ${new Date(lastUpdate).toLocaleTimeString()}`
          : "Waiting for updates..."
      }
    >
      <span className="relative flex h-2 w-2" aria-hidden="true">
        {connected && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${getStatusColor()} opacity-75 motion-reduce:animate-none`}
          />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${getStatusColor()}`}
        />
      </span>
      {showLabel && (
        <span className="text-muted-foreground hidden sm:inline">
          {getStatusLabel()}
        </span>
      )}
      {/* Screen reader only full status */}
      <span className="sr-only">{getAriaLabel()}</span>
    </div>
  );
}
