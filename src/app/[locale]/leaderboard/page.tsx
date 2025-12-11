"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { formatBytes, formatUptime, formatPercent, formatAddress } from "@/lib/utils/format";

type Metric = "uptime" | "cpu" | "ram" | "storage";
type Order = "top" | "bottom";

const METRICS: { value: Metric; label: string; description: string }[] = [
  { value: "uptime", label: "Uptime", description: "Longest running nodes" },
  { value: "storage", label: "Storage", description: "Highest storage capacity" },
  { value: "cpu", label: "CPU Efficiency", description: "Lowest CPU usage" },
  { value: "ram", label: "RAM Efficiency", description: "Lowest RAM usage" },
];

const PERIODS = [
  { value: "24h", label: "24H" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "all", label: "All Time" },
];

export default function LeaderboardPage() {
  const [metric, setMetric] = useState<Metric>("uptime");
  const [order, setOrder] = useState<Order>("top");
  const [period, setPeriod] = useState("7d");

  const { data, isLoading } = trpc.nodes.leaderboard.useQuery(
    { metric, order, limit: 20 },
    { refetchInterval: 60000 }
  );

  const formatValue = (m: Metric, value: number, metrics: { uptimeSeconds?: number; cpuPercent?: number; ramPercent?: number; storageBytes?: number }) => {
    switch (m) {
      case "uptime":
        return formatUptime(metrics.uptimeSeconds || 0);
      case "cpu":
        return formatPercent(metrics.cpuPercent || 0);
      case "ram":
        return formatPercent(metrics.ramPercent || 0);
      case "storage":
        return formatBytes(metrics.storageBytes || 0);
    }
  };

  const getRankIcon = (rank: number) => {
    if (order === "bottom") return null;
    switch (rank) {
      case 1:
        return <span className="text-2xl">🥇</span>;
      case 2:
        return <span className="text-2xl">🥈</span>;
      case 3:
        return <span className="text-2xl">🥉</span>;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
        <p className="text-muted-foreground">
          Top performing pNodes ranked by various metrics
        </p>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          {/* Metric selector */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Metric
            </label>
            <div className="grid grid-cols-2 gap-2">
              {METRICS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMetric(m.value)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    metric === m.value
                      ? "border-brand-500 bg-brand-500/10"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <div className="font-medium text-sm">{m.label}</div>
                  <div className="text-xs text-muted-foreground">{m.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Period selector */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Period
            </label>
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    period === p.value
                      ? "bg-background shadow text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Order toggle */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Show
            </label>
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => setOrder("top")}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  order === "top"
                    ? "bg-background shadow text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Best
              </button>
              <button
                onClick={() => setOrder("bottom")}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  order === "bottom"
                    ? "bg-background shadow text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Worst
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Rankings */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
                <div className="w-8 h-8 bg-muted rounded-full" />
                <div className="flex-1">
                  <div className="h-5 bg-muted rounded w-1/3 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/4" />
                </div>
                <div className="h-6 bg-muted rounded w-20" />
              </div>
            ))}
          </div>
        ) : data && data.length > 0 ? (
          <div className="divide-y divide-border">
            {data.map((node, index) => {
              const rank = index + 1;
              const metrics = {
                uptimeSeconds: node.metrics?.uptime || 0,
                cpuPercent: node.metrics?.cpu || 0,
                ramPercent: node.metrics?.ram || 0,
                storageBytes: Number(node.metrics?.storage || 0),
              };

              return (
                <Link
                  key={node.nodeId}
                  href={`/nodes/${node.nodeId}`}
                  className="p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors"
                >
                  {/* Rank */}
                  <div className="w-12 flex items-center justify-center">
                    {getRankIcon(rank) || (
                      <span className="text-lg font-bold text-muted-foreground">
                        {rank}
                      </span>
                    )}
                  </div>

                  {/* Node info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-medium truncate">
                      {formatAddress(node.address)}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="px-1.5 py-0.5 text-xs bg-muted rounded">
                        v{node.version}
                      </span>
                    </div>
                  </div>

                  {/* Value */}
                  <div className="text-right">
                    <div className="text-lg font-bold">
                      {formatValue(metric, 0, metrics)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {METRICS.find((m) => m.value === metric)?.label}
                    </div>
                  </div>

                  {/* Additional metrics */}
                  <div className="hidden lg:grid grid-cols-3 gap-4 text-sm text-muted-foreground">
                    {metric !== "uptime" && (
                      <div className="text-center">
                        <div className="font-medium text-foreground">
                          {formatUptime(metrics.uptimeSeconds)}
                        </div>
                        <div className="text-xs">Uptime</div>
                      </div>
                    )}
                    {metric !== "cpu" && (
                      <div className="text-center">
                        <div className="font-medium text-foreground">
                          {formatPercent(metrics.cpuPercent)}
                        </div>
                        <div className="text-xs">CPU</div>
                      </div>
                    )}
                    {metric !== "storage" && (
                      <div className="text-center">
                        <div className="font-medium text-foreground">
                          {formatBytes(metrics.storageBytes)}
                        </div>
                        <div className="text-xs">Storage</div>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center text-muted-foreground">
            <p>No data available for the selected period</p>
          </div>
        )}
      </div>

      {/* Badge Preview */}
      <div className="mt-8 card p-6">
        <h3 className="font-semibold mb-4">Embed Badges</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Add these badges to your README or website:
        </p>

        <div className="space-y-4">
          <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
            <img src="/api/badge/network.svg" alt="Network Status" className="h-5" />
            <code className="text-xs text-muted-foreground flex-1 truncate">
              ![Network](https://pulse.rectorspace.com/api/badge/network.svg)
            </code>
          </div>
          <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
            <img src="/api/badge/nodes.svg" alt="Node Count" className="h-5" />
            <code className="text-xs text-muted-foreground flex-1 truncate">
              ![Nodes](https://pulse.rectorspace.com/api/badge/nodes.svg)
            </code>
          </div>
          <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
            <img src="/api/badge/storage.svg" alt="Storage" className="h-5" />
            <code className="text-xs text-muted-foreground flex-1 truncate">
              ![Storage](https://pulse.rectorspace.com/api/badge/storage.svg)
            </code>
          </div>
        </div>
      </div>

      {/* API Link */}
      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">
          Access this data via API:{" "}
          <a
            href="/api/v1/leaderboard"
            target="_blank"
            className="text-brand-500 hover:underline"
          >
            GET /api/v1/leaderboard
          </a>
        </p>
      </div>
    </div>
  );
}
