"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatBytes } from "@/lib/utils/format";

type Range = "24h" | "7d" | "30d" | "90d";
type TrendDataPoint = { time: Date; value: number | bigint };

export function NetworkGrowthChart() {
  const [range, setRange] = useState<Range>("7d");
  const [metric, setMetric] = useState<"nodes" | "storage">("nodes");

  const { data, isLoading } = trpc.network.trends.useQuery(
    { range, metric },
    { refetchInterval: 60000 }
  );

  if (isLoading) {
    return <ChartSkeleton />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-muted-foreground text-sm text-center py-8">
        No trend data available yet. Data will appear after collection runs.
      </div>
    );
  }

  // Prepare chart data
  const values = data.map((d: TrendDataPoint) => Number(d.value));
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          <MetricButton
            active={metric === "nodes"}
            onClick={() => setMetric("nodes")}
          >
            Nodes
          </MetricButton>
          <MetricButton
            active={metric === "storage"}
            onClick={() => setMetric("storage")}
          >
            Storage
          </MetricButton>
        </div>
        <div className="flex gap-1">
          {(["24h", "7d", "30d", "90d"] as const).map((r) => (
            <RangeButton key={r} active={range === r} onClick={() => setRange(r)}>
              {r}
            </RangeButton>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-48 relative">
        <svg
          viewBox={`0 0 400 150`}
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y * 130 + 10}
              x2="400"
              y2={y * 130 + 10}
              stroke="currentColor"
              strokeOpacity="0.1"
            />
          ))}

          {/* Area fill */}
          <path
            d={`
              M 0,${140 - ((Number(data[0]?.value ?? 0) - minValue) / valueRange) * 130}
              ${data
                .map((d: TrendDataPoint, i: number) => {
                  const x = (i / (data.length - 1)) * 400;
                  const y = 140 - ((Number(d.value) - minValue) / valueRange) * 130;
                  return `L ${x},${y}`;
                })
                .join(" ")}
              L 400,140
              L 0,140
              Z
            `}
            fill="url(#gradient)"
            opacity="0.3"
          />

          {/* Line */}
          <path
            d={`
              M 0,${140 - ((Number(data[0]?.value ?? 0) - minValue) / valueRange) * 130}
              ${data
                .map((d: TrendDataPoint, i: number) => {
                  const x = (i / (data.length - 1)) * 400;
                  const y = 140 - ((Number(d.value) - minValue) / valueRange) * 130;
                  return `L ${x},${y}`;
                })
                .join(" ")}
            `}
            fill="none"
            stroke="hsl(var(--brand-500))"
            strokeWidth="2"
          />

          {/* Gradient definition */}
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--brand-500))" />
              <stop offset="100%" stopColor="hsl(var(--brand-500))" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-muted-foreground py-2">
          <span>{metric === "storage" ? formatBytes(maxValue) : maxValue}</span>
          <span>{metric === "storage" ? formatBytes(minValue) : minValue}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex justify-between text-sm">
        <div>
          <span className="text-muted-foreground">Current: </span>
          <span className="font-medium">
            {metric === "storage"
              ? formatBytes(Number(data[data.length - 1]?.value ?? 0))
              : data[data.length - 1]?.value ?? 0}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Change: </span>
          <span
            className={`font-medium ${
              Number(data[data.length - 1]?.value ?? 0) >= Number(data[0]?.value ?? 0)
                ? "text-status-active"
                : "text-status-inactive"
            }`}
          >
            {Number(data[data.length - 1]?.value ?? 0) >= Number(data[0]?.value ?? 0) ? "+" : ""}
            {(
              ((Number(data[data.length - 1]?.value ?? 0) - Number(data[0]?.value ?? 0)) /
                (Number(data[0]?.value ?? 1) || 1)) *
              100
            ).toFixed(1)}
            %
          </span>
        </div>
      </div>
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
        active
          ? "bg-brand-500 text-white"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
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
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ChartSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <div className="h-8 w-24 bg-muted animate-pulse rounded" />
        <div className="h-8 w-32 bg-muted animate-pulse rounded" />
      </div>
      <div className="h-48 bg-muted animate-pulse rounded" />
    </div>
  );
}
