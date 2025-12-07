"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { formatUptime, formatBytes, formatPercent } from "@/lib/utils/format";

type Metric = "uptime" | "cpu" | "ram" | "storage";
type Order = "top" | "bottom";

interface LeaderboardNode {
  nodeId: number;
  address: string;
  version: string | null;
  metrics: {
    cpu: number | null;
    ram: number | null;
    storage: bigint | null;
    uptime: number | null;
  };
}

export function NodeLeaderboard() {
  const [metric, setMetric] = useState<Metric>("uptime");
  const [order, setOrder] = useState<Order>("top");

  const { data, isLoading } = trpc.nodes.leaderboard.useQuery(
    { metric, order, limit: 5 },
    { refetchInterval: 30000 }
  );

  const metricLabels: Record<Metric, string> = {
    uptime: "Uptime",
    cpu: "CPU Usage",
    ram: "RAM Usage",
    storage: "Storage",
  };

  const formatMetricValue = (node: NonNullable<typeof data>[0]) => {
    switch (metric) {
      case "uptime":
        return formatUptime(node.metrics.uptime ?? 0);
      case "cpu":
        return formatPercent(node.metrics.cpu ?? 0);
      case "ram":
        return formatPercent(node.metrics.ram ?? 0);
      case "storage":
        return formatBytes(node.metrics.storage ?? BigInt(0));
    }
  };

  const getMedalEmoji = (index: number, order: Order) => {
    if (order === "top") {
      return index === 0 ? "1" : index === 1 ? "2" : index === 2 ? "3" : `${index + 1}`;
    }
    return `${index + 1}`;
  };

  return (
    <div className="space-y-4">
      {/* Header with controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          <OrderButton active={order === "top"} onClick={() => setOrder("top")}>
            Top
          </OrderButton>
          <OrderButton active={order === "bottom"} onClick={() => setOrder("bottom")}>
            Bottom
          </OrderButton>
        </div>
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value as Metric)}
          className="text-sm bg-muted rounded-md px-2 py-1 border-0 focus:ring-2 focus:ring-brand-500"
        >
          {Object.entries(metricLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Leaderboard list */}
      {isLoading ? (
        <LeaderboardSkeleton />
      ) : !data || data.length === 0 ? (
        <div className="text-muted-foreground text-sm text-center py-4">
          No active nodes found
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((node: LeaderboardNode, index: number) => (
            <Link
              key={node.nodeId}
              href={`/nodes/${node.nodeId}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
            >
              {/* Rank */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  order === "top" && index < 3
                    ? index === 0
                      ? "bg-yellow-500/20 text-yellow-600"
                      : index === 1
                        ? "bg-gray-400/20 text-gray-500"
                        : "bg-amber-600/20 text-amber-700"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {getMedalEmoji(index, order)}
              </div>

              {/* Node info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate group-hover:text-brand-500 transition-colors">
                  {node.address.split(":")[0]}
                </div>
                <div className="text-xs text-muted-foreground">
                  v{node.version || "unknown"}
                </div>
              </div>

              {/* Metric value */}
              <div className="text-sm font-mono font-medium">
                {formatMetricValue(node)}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* View all link */}
      <Link
        href="/nodes"
        className="block text-center text-sm text-brand-500 hover:text-brand-600 transition-colors"
      >
        View all nodes
      </Link>
    </div>
  );
}

function OrderButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-sm rounded-md transition-colors ${
        active
          ? "bg-foreground text-background"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
      }`}
    >
      {children}
    </button>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2">
          <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
          <div className="flex-1 space-y-1">
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            <div className="h-3 w-16 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-4 w-20 bg-muted animate-pulse rounded" />
        </div>
      ))}
    </div>
  );
}
