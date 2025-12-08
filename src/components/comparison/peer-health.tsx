"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

interface PeerHealthProps {
  nodeId: number;
  nodeAddress?: string;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function PeerHealth({ nodeId, nodeAddress }: PeerHealthProps) {
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading } = trpc.comparison.peerHealth.useQuery({ nodeId });

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 animate-pulse">
        <div className="h-5 bg-muted rounded w-40 mb-4" />
        <div className="h-24 bg-muted rounded mb-4" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 text-center text-muted-foreground">
        <p>No peer data available</p>
      </div>
    );
  }

  const getHealthColor = (status: string) => {
    switch (status) {
      case "good":
        return "text-status-active";
      case "warning":
        return "text-status-warning";
      case "critical":
        return "text-status-inactive";
      default:
        return "text-muted-foreground";
    }
  };

  const getHealthBg = (status: string) => {
    switch (status) {
      case "good":
        return "bg-status-active/10";
      case "warning":
        return "bg-status-warning/10";
      case "critical":
        return "bg-status-inactive/10";
      default:
        return "bg-muted";
    }
  };

  const displayedPeers = showAll ? data.peers : data.peers.slice(0, 10);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Peer Health Analysis</h3>
            <p className="text-sm text-muted-foreground">
              {nodeAddress || data.nodeAddress}
            </p>
          </div>
          <div
            className={`px-3 py-1 rounded-full text-sm font-medium ${getHealthBg(
              data.healthStatus
            )} ${getHealthColor(data.healthStatus)}`}
          >
            {data.healthStatus.charAt(0).toUpperCase() + data.healthStatus.slice(1)}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 border-b border-border">
        <div>
          <p className="text-sm text-muted-foreground">Total Peers</p>
          <p className="text-xl font-bold">{data.totalPeers}</p>
          <p className="text-xs text-muted-foreground">
            Network avg: {data.networkAvgPeers}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Active</p>
          <p className="text-xl font-bold text-status-active">
            {data.activePeers}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Stale</p>
          <p className="text-xl font-bold text-status-warning">
            {data.stalePeers}
          </p>
          <p className="text-xs text-muted-foreground">{data.stalePercent}%</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">On Latest</p>
          <p className="text-xl font-bold">{data.onLatestPercent}%</p>
        </div>
      </div>

      {/* Version Distribution */}
      {data.versionDistribution.length > 0 && (
        <div className="p-4 border-b border-border">
          <p className="text-sm text-muted-foreground mb-3">
            Peer Version Distribution
          </p>
          <div className="space-y-2">
            {data.versionDistribution.map((v) => (
              <div key={v.version} className="flex items-center gap-2">
                <span className="text-sm font-mono w-16">v{v.version}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      v.isLatest ? "bg-status-active" : "bg-muted-foreground"
                    }`}
                    style={{ width: `${v.percent}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-20 text-right">
                  {v.count} ({v.percent}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Peer List */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground">Peer List</p>
          {data.peers.length > 10 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs text-brand-500 hover:underline"
            >
              {showAll ? "Show Less" : `Show All (${data.peers.length})`}
            </button>
          )}
        </div>

        <div className="space-y-1 max-h-64 overflow-y-auto">
          {displayedPeers.map((peer, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    peer.isActive && !peer.isStale
                      ? "bg-status-active"
                      : peer.isStale
                      ? "bg-status-warning"
                      : "bg-status-inactive"
                  }`}
                />
                <span className="font-mono">{peer.address.split(":")[0]}</span>
              </div>
              <div className="flex items-center gap-4 text-muted-foreground">
                <span className="text-xs">v{peer.version}</span>
                <span className="text-xs">{formatDuration(peer.lastSeenAgo)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
