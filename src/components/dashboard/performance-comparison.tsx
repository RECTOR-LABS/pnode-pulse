"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatPercent } from "@/lib/utils/format";

// Helper to ensure valid number for SVG paths (returns 0 for NaN/Infinity)
const safeNum = (n: number): number => (Number.isFinite(n) ? n : 0);

type Metric = "cpu" | "ram";
type Range = "7d" | "30d" | "90d";

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

export function PerformanceComparison() {
  const [metric, setMetric] = useState<Metric>("cpu");
  const [range, setRange] = useState<Range>("7d");
  const [selectedNode, setSelectedNode] = useState<number | null>(null);

  // Get network average trends
  const { data: networkTrends, isLoading: networkLoading } = trpc.network.trends.useQuery(
    { range, metric },
    { refetchInterval: 60000 }
  );

  // Get top nodes for selection
  const { data: topNodes } = trpc.nodes.leaderboard.useQuery(
    { metric, order: "top", limit: 10 },
    { refetchInterval: 60000 }
  );

  // Get selected node's metrics history
  const { data: nodeMetrics, isLoading: nodeLoading } = trpc.nodes.metricsHistory.useQuery(
    { nodeId: selectedNode!, range },
    { enabled: !!selectedNode, refetchInterval: 60000 }
  );

  const isLoading = networkLoading || (selectedNode && nodeLoading);

  if (isLoading && !networkTrends) {
    return <ComparisonSkeleton />;
  }

  if (!networkTrends || networkTrends.length === 0) {
    return (
      <div className="text-muted-foreground text-sm text-center py-8">
        No trend data available yet. Data will appear after collection runs.
      </div>
    );
  }

  // Calculate network average
  const networkAvg =
    networkTrends.reduce((sum: number, d: { value: number | bigint }) => sum + Number(d.value), 0) /
    networkTrends.length;

  // Calculate node average if selected
  const nodeAvg =
    nodeMetrics && nodeMetrics.length > 0
      ? nodeMetrics.reduce(
          (sum: number, d: { cpu: number | null; ram: number | null }) =>
            sum + (metric === "cpu" ? d.cpu ?? 0 : d.ram ?? 0),
          0
        ) / nodeMetrics.length
      : null;

  // Prepare comparison data
  const comparison = nodeAvg !== null ? nodeAvg - networkAvg : 0;
  const comparisonPercent = networkAvg > 0 ? (comparison / networkAvg) * 100 : 0;

  // Prepare chart data - align network and node data by normalizing time
  const chartData: { x: number; network: number; node: number | null }[] = [];
  const timeRange = networkTrends.length;

  for (let i = 0; i < timeRange; i++) {
    const networkValue = Number(networkTrends[i]?.value ?? 0);
    let nodeValue: number | null = null;

    if (nodeMetrics && nodeMetrics.length > 0) {
      // Find corresponding node metric
      const nodeIndex = Math.floor((i / timeRange) * nodeMetrics.length);
      const nodeData = nodeMetrics[nodeIndex];
      if (nodeData) {
        nodeValue = metric === "cpu" ? nodeData.cpu ?? null : nodeData.ram ?? null;
      }
    }

    chartData.push({
      x: i,
      network: networkValue,
      node: nodeValue,
    });
  }

  const allValues = chartData.flatMap((d) => [d.network, d.node].filter((v): v is number => v !== null));
  const minValue = Math.min(...allValues, 0);
  const maxValue = Math.max(...allValues, 100);
  const valueRange = maxValue - minValue || 1;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          <MetricButton active={metric === "cpu"} onClick={() => setMetric("cpu")}>
            CPU
          </MetricButton>
          <MetricButton active={metric === "ram"} onClick={() => setMetric("ram")}>
            RAM
          </MetricButton>
        </div>
        <div className="flex gap-1">
          {(["7d", "30d", "90d"] as const).map((r) => (
            <RangeButton key={r} active={range === r} onClick={() => setRange(r)}>
              {r}
            </RangeButton>
          ))}
        </div>
      </div>

      {/* Node selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Compare with:</span>
        <select
          value={selectedNode ?? ""}
          onChange={(e) => setSelectedNode(e.target.value ? Number(e.target.value) : null)}
          className="text-sm bg-muted rounded-md px-2 py-1 border-0 focus:ring-2 focus:ring-brand-500 flex-1"
        >
          <option value="">Network average only</option>
          {topNodes?.map((node: LeaderboardNode) => (
            <option key={node.nodeId} value={node.nodeId}>
              {node.address.split(":")[0]}
            </option>
          ))}
        </select>
      </div>

      {/* Chart */}
      <div className="h-40 relative">
        <svg viewBox="0 0 400 120" className="w-full h-full" preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y * 100 + 10}
              x2="400"
              y2={y * 100 + 10}
              stroke="currentColor"
              strokeOpacity="0.1"
            />
          ))}

          {/* Network line */}
          <path
            d={`
              M 0,${safeNum(110 - (((chartData[0]?.network ?? 0) - minValue) / valueRange) * 100)}
              ${chartData
                .map((d, i) => {
                  const x = safeNum(chartData.length > 1 ? (i / (chartData.length - 1)) * 400 : 200);
                  const y = safeNum(110 - ((d.network - minValue) / valueRange) * 100);
                  return `L ${x},${y}`;
                })
                .join(" ")}
            `}
            fill="none"
            stroke="hsl(var(--brand-500))"
            strokeWidth="2"
          />

          {/* Node line (if selected) */}
          {selectedNode && (
            <path
              d={`
                M 0,${safeNum(110 - (((chartData[0]?.node ?? chartData[0]?.network ?? 0) - minValue) / valueRange) * 100)}
                ${chartData
                  .map((d, i) => {
                    const x = safeNum(chartData.length > 1 ? (i / (chartData.length - 1)) * 400 : 200);
                    const value = d.node ?? d.network;
                    const y = safeNum(110 - ((value - minValue) / valueRange) * 100);
                    return `L ${x},${y}`;
                  })
                  .join(" ")}
              `}
              fill="none"
              stroke="hsl(var(--status-warning))"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
          )}
        </svg>

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-muted-foreground py-2">
          <span>{formatPercent(maxValue, 0)}</span>
          <span>{formatPercent(minValue, 0)}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-brand-500" />
          <span>Network Avg</span>
        </div>
        {selectedNode && (
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-status-warning" style={{ borderStyle: "dashed" }} />
            <span>Selected Node</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <div className="text-lg font-bold">{formatPercent(networkAvg)}</div>
          <div className="text-xs text-muted-foreground">Network Avg {metric.toUpperCase()}</div>
        </div>
        {selectedNode && nodeAvg !== null ? (
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-lg font-bold">{formatPercent(nodeAvg)}</div>
            <div className="text-xs text-muted-foreground">Node Avg {metric.toUpperCase()}</div>
          </div>
        ) : (
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-lg font-bold text-muted-foreground">--</div>
            <div className="text-xs text-muted-foreground">Select a node</div>
          </div>
        )}
      </div>

      {/* Comparison indicator */}
      {selectedNode && nodeAvg !== null && (
        <div
          className={`text-center text-sm p-2 rounded-lg ${
            comparison < 0 ? "bg-status-active/10 text-status-active" : "bg-status-warning/10 text-status-warning"
          }`}
        >
          Node is{" "}
          <span className="font-bold">
            {Math.abs(comparisonPercent).toFixed(1)}% {comparison < 0 ? "below" : "above"}
          </span>{" "}
          network average
        </div>
      )}
    </div>
  );
}

function MetricButton({
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
        active ? "bg-brand-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
      }`}
    >
      {children}
    </button>
  );
}

function RangeButton({
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
      className={`px-2 py-1 text-xs rounded transition-colors ${
        active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ComparisonSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex justify-between">
        <div className="h-8 w-20 bg-muted rounded" />
        <div className="h-8 w-24 bg-muted rounded" />
      </div>
      <div className="h-8 bg-muted rounded" />
      <div className="h-40 bg-muted rounded" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-16 bg-muted rounded" />
        <div className="h-16 bg-muted rounded" />
      </div>
    </div>
  );
}
