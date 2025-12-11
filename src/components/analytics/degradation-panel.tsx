"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";

const riskColors = {
  healthy: { bg: "bg-green-500/10", text: "text-green-500", badge: "bg-green-500" },
  warning: { bg: "bg-yellow-500/10", text: "text-yellow-500", badge: "bg-yellow-500" },
  elevated: { bg: "bg-orange-500/10", text: "text-orange-500", badge: "bg-orange-500" },
  critical: { bg: "bg-red-500/10", text: "text-red-500", badge: "bg-red-500" },
};

const trendLabels = {
  increasing: { label: "Increasing", icon: "↑", color: "text-red-500" },
  stable: { label: "Stable", icon: "→", color: "text-blue-500" },
  decreasing: { label: "Decreasing", icon: "↓", color: "text-green-500" },
  improving: { label: "Improving", icon: "↓", color: "text-green-500" },
};

export function DegradationPanel() {
  const { data: summary, isLoading: summaryLoading } = trpc.analytics.networkDegradation.useQuery({
    limit: 50,
  });
  const { data: atRisk, isLoading: atRiskLoading } = trpc.analytics.atRiskNodes.useQuery({
    limit: 10,
    minRiskScore: 20,
  });

  const isLoading = summaryLoading || atRiskLoading;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-border rounded-xl p-6 animate-pulse">
          <div className="h-6 bg-muted rounded w-1/2 mb-4" />
          <div className="h-32 bg-muted rounded" />
        </div>
        <div className="border border-border rounded-xl p-6 animate-pulse">
          <div className="h-6 bg-muted rounded w-1/2 mb-4" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Risk Distribution Summary */}
      <div className="border border-border rounded-xl p-6">
        <h3 className="font-semibold mb-4">Risk Distribution</h3>

        {summary && (
          <>
            {/* Risk Level Bars */}
            <div className="space-y-3 mb-6">
              {(["healthy", "warning", "elevated", "critical"] as const).map((level) => {
                const count = summary.byRiskLevel[level];
                const percentage = summary.analyzedNodes > 0
                  ? (count / summary.analyzedNodes) * 100
                  : 0;
                const colors = riskColors[level];

                return (
                  <div key={level}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className={`capitalize ${colors.text}`}>{level}</span>
                      <span className="text-muted-foreground">
                        {count} ({percentage.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${colors.badge}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
              <div>
                <div className="text-2xl font-bold">{summary.analyzedNodes}</div>
                <div className="text-sm text-muted-foreground">Nodes Analyzed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-500">
                  {summary.byRiskLevel.elevated + summary.byRiskLevel.critical}
                </div>
                <div className="text-sm text-muted-foreground">Need Attention</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* At-Risk Nodes List */}
      <div className="border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">At-Risk Nodes</h3>
          {atRisk && (
            <span className="text-sm text-muted-foreground">
              {atRisk.atRiskCount} of {atRisk.totalAnalyzed}
            </span>
          )}
        </div>

        {atRisk?.nodes && atRisk.nodes.length > 0 ? (
          <div className="space-y-3">
            {atRisk.nodes.slice(0, 5).map((node) => {
              const colors = riskColors[node.riskLevel];
              const cpuTrend = trendLabels[node.cpuTrend] ?? trendLabels.stable;
              const ramTrend = trendLabels[node.ramTrend] ?? trendLabels.stable;

              return (
                <Link
                  key={node.nodeId}
                  href={`/nodes/${node.nodeId}`}
                  className={`block p-3 rounded-lg ${colors.bg} hover:opacity-80 transition-opacity`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm truncate max-w-[200px]">
                      {node.address}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors.text} ${colors.bg}`}>
                      {node.riskScore}% risk
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-muted-foreground">
                      CPU: <span className={cpuTrend.color}>{cpuTrend.icon} {cpuTrend.label}</span>
                    </span>
                    <span className="text-muted-foreground">
                      RAM: <span className={ramTrend.color}>{ramTrend.icon} {ramTrend.label}</span>
                    </span>
                  </div>
                  {node.topPrediction && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {node.topPrediction.title}
                    </div>
                  )}
                </Link>
              );
            })}

            {atRisk.nodes.length > 5 && (
              <div className="text-center pt-2">
                <span className="text-sm text-muted-foreground">
                  +{atRisk.nodes.length - 5} more at-risk nodes
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <div className="text-3xl mb-2">✓</div>
            <p>No nodes at elevated risk</p>
            <p className="text-sm">All nodes are performing within normal parameters</p>
          </div>
        )}
      </div>
    </div>
  );
}
