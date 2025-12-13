"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { StatusBadge } from "@/components/ui/status-dot";

type RiskLevel = "healthy" | "warning" | "elevated" | "critical";

interface AtRiskNode {
  nodeId: number;
  address: string;
  riskLevel: RiskLevel;
  riskScore: number;
  topPrediction: {
    id: string;
    metric: "cpu" | "ram" | "uptime" | "overall";
    severity: RiskLevel;
    title: string;
    timeToIssue: number | null;
  } | null;
}

const riskLevelColors: Record<RiskLevel, string> = {
  healthy: "text-status-active",
  warning: "text-status-warning",
  elevated: "text-orange-500",
  critical: "text-status-inactive",
};

const riskLevelBg: Record<RiskLevel, string> = {
  healthy: "bg-status-active-bg",
  warning: "bg-status-warning-bg",
  elevated: "bg-orange-100 dark:bg-orange-900/20",
  critical: "bg-status-inactive-bg",
};

const metricIcons: Record<string, React.ReactNode> = {
  cpu: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
    </svg>
  ),
  ram: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
    </svg>
  ),
  uptime: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  overall: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
};

function formatTimeToIssue(hours: number | null): string {
  if (hours === null) return "Unknown";
  if (hours === 0) return "Imminent";
  if (hours < 1) return `~${Math.round(hours * 60)}m`;
  if (hours < 24) return `~${Math.round(hours)}h`;
  return `~${Math.round(hours / 24)}d`;
}

function truncateAddress(address: string): string {
  if (address.length <= 20) return address;
  return `${address.slice(0, 12)}...${address.slice(-6)}`;
}

export function NodesAtRisk() {
  const { data, isLoading, error } = trpc.analytics.networkDegradation.useQuery(
    { limit: 50 },
    { refetchInterval: 60000 }
  );

  if (isLoading) {
    return <NodesAtRiskSkeleton />;
  }

  if (error) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        Unable to load risk data
      </div>
    );
  }

  if (!data || data.atRiskNodes.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-status-active-bg flex items-center justify-center">
          <svg className="w-6 h-6 text-status-active" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm font-medium">All nodes healthy</p>
        <p className="text-xs text-muted-foreground mt-1">
          {data?.analyzedNodes ?? 0} nodes analyzed, {(data?.healthyPercentage ?? 100).toFixed(0)}% healthy
        </p>
      </div>
    );
  }

  const topRiskNodes = data.atRiskNodes.slice(0, 5) as AtRiskNode[];

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          {data.criticalAlerts > 0 && (
            <span className="flex items-center gap-1.5 text-status-inactive font-medium">
              <span className="w-2 h-2 rounded-full bg-status-inactive status-pulse" />
              {data.criticalAlerts} critical
            </span>
          )}
          {data.elevatedAlerts > 0 && (
            <span className="flex items-center gap-1.5 text-orange-500">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              {data.elevatedAlerts} elevated
            </span>
          )}
        </div>
        <span className="text-muted-foreground text-xs">
          {data.analyzedNodes} analyzed
        </span>
      </div>

      {/* Risk Nodes List */}
      <div className="space-y-2">
        {topRiskNodes.map((node, index) => (
          <Link
            key={node.nodeId}
            href={`/nodes/${node.nodeId}`}
            className={`
              block p-3 rounded-lg border transition-all
              hover:shadow-md hover:-translate-y-0.5
              ${riskLevelBg[node.riskLevel]}
              animate-fade-in-up
            `}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`${riskLevelColors[node.riskLevel]}`}>
                    {metricIcons[node.topPrediction?.metric || "overall"]}
                  </span>
                  <span className="font-mono text-sm truncate">
                    {truncateAddress(node.address)}
                  </span>
                </div>
                {node.topPrediction && (
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {node.topPrediction.title}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge
                  status={node.riskLevel === "critical" ? "inactive" : node.riskLevel === "elevated" ? "warning" : "warning"}
                  label={node.riskLevel}
                  size="sm"
                />
                {node.topPrediction?.timeToIssue !== null && (
                  <span className="text-xs text-muted-foreground">
                    {formatTimeToIssue(node.topPrediction?.timeToIssue ?? null)}
                  </span>
                )}
              </div>
            </div>
            {/* Risk Score Bar */}
            <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full animate-progress ${
                  node.riskLevel === "critical"
                    ? "bg-status-inactive"
                    : node.riskLevel === "elevated"
                    ? "bg-orange-500"
                    : "bg-status-warning"
                }`}
                style={{ width: `${node.riskScore}%` }}
              />
            </div>
          </Link>
        ))}
      </div>

      {/* View All Link */}
      {data.atRiskNodes.length > 5 && (
        <Link
          href="/analytics/risk"
          className="block text-center text-sm text-brand-500 hover:text-brand-600 transition-colors py-2"
        >
          View all {data.atRiskNodes.length} at-risk nodes
        </Link>
      )}
    </div>
  );
}

function NodesAtRiskSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex justify-between">
        <div className="h-4 w-24 bg-muted rounded" />
        <div className="h-4 w-16 bg-muted rounded" />
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="p-3 rounded-lg bg-muted/30">
          <div className="flex justify-between mb-2">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-4 w-16 bg-muted rounded" />
          </div>
          <div className="h-1 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}
