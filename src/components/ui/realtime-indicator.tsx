"use client";

import { useRealtimeStatus } from "@/lib/hooks/use-realtime";

interface RealtimeIndicatorProps {
  showLabel?: boolean;
}

/**
 * Visual indicator for real-time connection status
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

  return (
    <div
      className="flex items-center gap-2 text-sm"
      title={
        lastUpdate
          ? `Last update: ${new Date(lastUpdate).toLocaleTimeString()}`
          : "Waiting for updates..."
      }
    >
      <span className="relative flex h-2 w-2">
        {connected && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${getStatusColor()} opacity-75`}
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
    </div>
  );
}
