"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { formatBytes } from "@/lib/utils/format";

type Range = "24h" | "7d" | "30d" | "90d";
type TrendDataPoint = { time: Date; value: number | bigint };

// Helper to ensure valid number for SVG paths (returns fallback for NaN/Infinity)
const safeNum = (n: number, fallback = 0): number =>
  Number.isFinite(n) ? n : fallback;

// Convert value to safe number, handling bigint and null/undefined
const toSafeNumber = (value: number | bigint | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const num = typeof value === "bigint" ? Number(value) : value;
  return Number.isFinite(num) ? num : 0;
};

export function NetworkGrowthChart() {
  const [range, setRange] = useState<Range>("7d");
  const [metric, setMetric] = useState<"nodes" | "storage">("nodes");

  const { data, isLoading } = trpc.network.trends.useQuery(
    { range, metric },
    { refetchInterval: 60000 },
  );

  // Prepare and validate chart data
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;

    // Convert all values to safe numbers
    const values = data.map((d: TrendDataPoint) => toSafeNumber(d.value));

    // Filter out any remaining invalid values for min/max calculation
    const validValues = values.filter((v) => Number.isFinite(v) && v >= 0);

    if (validValues.length === 0) return null;

    const minValue = Math.min(...validValues);
    const maxValue = Math.max(...validValues);

    // Handle edge cases for display range
    const isFlat = maxValue === minValue;
    let displayMin: number;
    let displayMax: number;

    if (isFlat) {
      // For flat data, create 20% padding around the value
      if (minValue === 0) {
        // Special case: all zeros - show 0 to 1 range
        displayMin = 0;
        displayMax = 1;
      } else {
        displayMin = minValue * 0.9;
        displayMax = maxValue * 1.1;
      }
    } else {
      displayMin = minValue;
      displayMax = maxValue;
    }

    const valueRange = displayMax - displayMin || 1;

    return {
      values,
      minValue,
      maxValue,
      displayMin,
      displayMax,
      valueRange,
      isFlat,
    };
  }, [data]);

  if (isLoading) {
    return <ChartSkeleton />;
  }

  if (!data || data.length === 0 || !chartData) {
    return (
      <div className="text-muted-foreground text-sm text-center py-8">
        No trend data available yet. Data will appear after collection runs.
      </div>
    );
  }

  const { values, minValue, maxValue, displayMin, valueRange } = chartData;

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
            <RangeButton
              key={r}
              active={range === r}
              onClick={() => setRange(r)}
            >
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
            d={(() => {
              // Calculate points using pre-validated values
              const points = values.map((value, i) => {
                const x = safeNum(
                  values.length > 1 ? (i / (values.length - 1)) * 400 : 200,
                );
                const y = safeNum(
                  140 - ((value - displayMin) / valueRange) * 130,
                  75,
                );
                return { x, y };
              });

              if (points.length === 0) return "";

              // For single point, draw a horizontal line across the chart
              if (points.length === 1) {
                const y = points[0].y;
                return `M 0,${y} L 400,${y} L 400,140 L 0,140 Z`;
              }

              // Build path: start at first point, line through all points, close area
              const pathParts = [
                `M 0,${points[0].y}`,
                ...points.map((p) => `L ${p.x},${p.y}`),
                `L 400,140`,
                `L 0,140`,
                `Z`,
              ];

              return pathParts.join(" ");
            })()}
            fill="url(#network-growth-gradient)"
            opacity="0.3"
          />

          {/* Line */}
          <path
            d={(() => {
              const points = values.map((value, i) => {
                const x = safeNum(
                  values.length > 1 ? (i / (values.length - 1)) * 400 : 200,
                );
                const y = safeNum(
                  140 - ((value - displayMin) / valueRange) * 130,
                  75,
                );
                return { x, y };
              });

              if (points.length === 0) return "";

              // For single point, draw a horizontal line across the chart
              if (points.length === 1) {
                const y = points[0].y;
                return `M 0,${y} L 400,${y}`;
              }

              // Build line path: start at first point x=0, line through all points
              return [
                `M 0,${points[0].y}`,
                ...points.map((p) => `L ${p.x},${p.y}`),
              ].join(" ");
            })()}
            fill="none"
            stroke="#06B6D4"
            strokeWidth="2.5"
          />

          {/* Gradient definition - unique ID to avoid conflicts */}
          <defs>
            <linearGradient
              id="network-growth-gradient"
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#06B6D4" stopOpacity="0" />
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
              ? formatBytes(values[values.length - 1] ?? 0)
              : (values[values.length - 1] ?? 0)}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Change: </span>
          {(() => {
            const current = values[values.length - 1] ?? 0;
            const first = values[0] ?? 0;
            const change = first !== 0 ? ((current - first) / first) * 100 : 0;
            const isPositive = current >= first;
            return (
              <span
                className={`font-medium ${
                  isPositive ? "text-status-active" : "text-status-inactive"
                }`}
              >
                {isPositive ? "+" : ""}
                {safeNum(change).toFixed(1)}%
              </span>
            );
          })()}
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
