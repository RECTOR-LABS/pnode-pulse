"use client";

import Link from "next/link";
import { type OutlierCategory } from "@/lib/analytics/statistics";

interface OutlierNode {
  nodeId: number;
  address: string;
  version: string | null;
  value: number;
  zScore: number;
  category: OutlierCategory;
}

interface OutliersCardProps {
  metric: "cpu" | "ram" | "uptime";
  outliers: OutlierNode[];
  summary: {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
    count: number;
  };
  totalNodes: number;
}

const metricLabels = {
  cpu: "CPU Usage",
  ram: "RAM Usage",
  uptime: "Uptime",
};

const metricUnits = {
  cpu: "%",
  ram: "%",
  uptime: "s",
};

const categoryColors: Record<OutlierCategory, { bg: string; text: string }> = {
  normal: { bg: "bg-green-500/10", text: "text-green-500" },
  high: { bg: "bg-orange-500/10", text: "text-orange-500" },
  very_high: { bg: "bg-red-500/10", text: "text-red-500" },
  low: { bg: "bg-blue-500/10", text: "text-blue-500" },
  very_low: { bg: "bg-purple-500/10", text: "text-purple-500" },
};

function formatValue(metric: "cpu" | "ram" | "uptime", value: number): string {
  if (metric === "uptime") {
    const days = Math.floor(value / 86400);
    const hours = Math.floor((value % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    const minutes = Math.floor((value % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }
  return `${value.toFixed(1)}${metricUnits[metric]}`;
}

export function OutliersCard({
  metric,
  outliers,
  summary,
  totalNodes,
}: OutliersCardProps) {
  const hasOutliers = outliers.length > 0;

  return (
    <div className="border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">{metricLabels[metric]} Outliers</h3>
          <p className="text-sm text-muted-foreground">
            {outliers.length} of {totalNodes} nodes outside normal range
          </p>
        </div>
        {hasOutliers && (
          <span className="px-3 py-1 text-sm bg-orange-500/10 text-orange-500 rounded-full">
            {outliers.length} detected
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-muted/30 rounded-lg">
        <div>
          <p className="text-xs text-muted-foreground">Mean</p>
          <p className="font-medium">{formatValue(metric, summary.mean)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Std Dev</p>
          <p className="font-medium">{formatValue(metric, summary.stdDev)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Min</p>
          <p className="font-medium">{formatValue(metric, summary.min)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Max</p>
          <p className="font-medium">{formatValue(metric, summary.max)}</p>
        </div>
      </div>

      {hasOutliers ? (
        <div className="space-y-2">
          {outliers.slice(0, 10).map((outlier) => {
            const colors = categoryColors[outlier.category];
            return (
              <Link
                key={outlier.nodeId}
                href={`/nodes/${outlier.nodeId}`}
                className="flex items-center justify-between p-3 bg-muted/20 hover:bg-muted/40 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 text-xs rounded ${colors.bg} ${colors.text}`}>
                    {outlier.category.replace("_", " ")}
                  </span>
                  <div>
                    <p className="font-mono text-sm">{outlier.address}</p>
                    {outlier.version && (
                      <p className="text-xs text-muted-foreground">v{outlier.version}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatValue(metric, outlier.value)}</p>
                  <p className="text-xs text-muted-foreground">
                    z-score: {outlier.zScore.toFixed(2)}
                  </p>
                </div>
              </Link>
            );
          })}
          {outliers.length > 10 && (
            <p className="text-center text-sm text-muted-foreground py-2">
              +{outliers.length - 10} more outliers
            </p>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <svg
            className="w-12 h-12 mx-auto mb-3 opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p>All nodes within normal range</p>
          <p className="text-sm">No {metricLabels[metric].toLowerCase()} outliers detected</p>
        </div>
      )}
    </div>
  );
}
