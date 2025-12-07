"use client";

import { trpc } from "@/lib/trpc";
import { formatBytes } from "@/lib/utils/format";
import { linearRegression, projectValues, projectMilestone } from "@/lib/utils/projections";

// Target milestones in bytes
const MILESTONES = [
  { value: 5 * 1024 ** 4, label: "5 TB" },
  { value: 10 * 1024 ** 4, label: "10 TB" },
  { value: 50 * 1024 ** 4, label: "50 TB" },
  { value: 100 * 1024 ** 4, label: "100 TB" },
];

export function CapacityProjection() {
  const { data: trends, isLoading } = trpc.network.trends.useQuery(
    { range: "30d", metric: "storage" },
    { refetchInterval: 60000 }
  );

  if (isLoading) {
    return <ProjectionSkeleton />;
  }

  if (!trends || trends.length < 5) {
    return (
      <div className="text-muted-foreground text-sm text-center py-8">
        Need more historical data for projections. Check back after collecting data for a few days.
      </div>
    );
  }

  // Convert to data points
  const dataPoints = trends.map((t: { time: Date; value: number | bigint }) => ({
    time: new Date(t.time),
    value: Number(t.value),
  }));

  const { slope, r2 } = linearRegression(dataPoints);
  const projections = projectValues(dataPoints, 30, 10);
  const currentValue = dataPoints[dataPoints.length - 1].value;

  // Calculate daily growth rate
  const dailyGrowthBytes = slope;
  const dailyGrowthPercent = currentValue > 0 ? (slope / currentValue) * 100 : 0;

  // Find next milestone
  const nextMilestone = MILESTONES.find((m) => m.value > currentValue);
  const milestoneProjection = nextMilestone
    ? projectMilestone(dataPoints, nextMilestone.value)
    : null;

  // Prepare chart data
  const allPoints = [...dataPoints, ...projections];
  const values = allPoints.map((d) => d.value);
  const minValue = Math.min(...values) * 0.9;
  const maxValue = Math.max(...values) * 1.1;
  const valueRange = maxValue - minValue || 1;

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div className="h-48 relative">
        <svg viewBox="0 0 400 150" className="w-full h-full" preserveAspectRatio="none">
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

          {/* Historical data area */}
          <path
            d={`
              M 0,${140 - ((dataPoints[0].value - minValue) / valueRange) * 130}
              ${dataPoints.map((d, i) => {
                const x = (i / (allPoints.length - 1)) * 400;
                const y = 140 - ((d.value - minValue) / valueRange) * 130;
                return `L ${x},${y}`;
              }).join(" ")}
              L ${((dataPoints.length - 1) / (allPoints.length - 1)) * 400},140
              L 0,140
              Z
            `}
            fill="hsl(var(--brand-500))"
            opacity="0.2"
          />

          {/* Historical data line */}
          <path
            d={`
              M 0,${140 - ((dataPoints[0].value - minValue) / valueRange) * 130}
              ${dataPoints.map((d, i) => {
                const x = (i / (allPoints.length - 1)) * 400;
                const y = 140 - ((d.value - minValue) / valueRange) * 130;
                return `L ${x},${y}`;
              }).join(" ")}
            `}
            fill="none"
            stroke="hsl(var(--brand-500))"
            strokeWidth="2"
          />

          {/* Projection line (dashed) */}
          <path
            d={`
              M ${((dataPoints.length - 1) / (allPoints.length - 1)) * 400},${
                140 - ((dataPoints[dataPoints.length - 1].value - minValue) / valueRange) * 130
              }
              ${projections.map((d, i) => {
                const x = ((dataPoints.length + i) / (allPoints.length - 1)) * 400;
                const y = 140 - ((d.value - minValue) / valueRange) * 130;
                return `L ${x},${y}`;
              }).join(" ")}
            `}
            fill="none"
            stroke="hsl(var(--brand-500))"
            strokeWidth="2"
            strokeDasharray="4 4"
            opacity="0.6"
          />

          {/* Projection area */}
          <path
            d={`
              M ${((dataPoints.length - 1) / (allPoints.length - 1)) * 400},${
                140 - ((dataPoints[dataPoints.length - 1].value - minValue) / valueRange) * 130
              }
              ${projections.map((d, i) => {
                const x = ((dataPoints.length + i) / (allPoints.length - 1)) * 400;
                const y = 140 - ((d.value - minValue) / valueRange) * 130;
                return `L ${x},${y}`;
              }).join(" ")}
              L 400,140
              L ${((dataPoints.length - 1) / (allPoints.length - 1)) * 400},140
              Z
            `}
            fill="hsl(var(--brand-500))"
            opacity="0.1"
          />
        </svg>

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-muted-foreground py-2">
          <span>{formatBytes(maxValue)}</span>
          <span>{formatBytes(minValue)}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <div className="text-lg font-bold">{formatBytes(currentValue)}</div>
          <div className="text-xs text-muted-foreground">Current Storage</div>
        </div>
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <div className={`text-lg font-bold ${dailyGrowthBytes >= 0 ? "text-status-active" : "text-status-inactive"}`}>
            {dailyGrowthBytes >= 0 ? "+" : ""}{formatBytes(Math.abs(dailyGrowthBytes))}/day
          </div>
          <div className="text-xs text-muted-foreground">Growth Rate</div>
        </div>
      </div>

      {/* Milestone projection */}
      {nextMilestone && milestoneProjection?.daysFromNow && (
        <div className="p-3 bg-brand-500/10 rounded-lg text-center">
          <div className="text-sm">
            <span className="font-bold">{nextMilestone.label}</span> milestone projected in{" "}
            <span className="font-bold">{milestoneProjection.daysFromNow} days</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            ~{milestoneProjection.date?.toLocaleDateString()}
          </div>
        </div>
      )}

      {/* Confidence indicator */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span>Projection confidence:</span>
        <span className={`font-medium ${r2 > 0.8 ? "text-status-active" : r2 > 0.5 ? "text-status-warning" : "text-status-inactive"}`}>
          {r2 > 0.8 ? "High" : r2 > 0.5 ? "Medium" : "Low"} (R²={r2.toFixed(2)})
        </span>
      </div>
    </div>
  );
}

function ProjectionSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-48 bg-muted rounded" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-16 bg-muted rounded" />
        <div className="h-16 bg-muted rounded" />
      </div>
    </div>
  );
}
