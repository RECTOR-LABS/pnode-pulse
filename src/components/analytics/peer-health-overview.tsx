"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";

const priorityColors = {
  critical: { bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/30" },
  high: { bg: "bg-orange-500/10", text: "text-orange-500", border: "border-orange-500/30" },
  medium: { bg: "bg-yellow-500/10", text: "text-yellow-500", border: "border-yellow-500/30" },
  low: { bg: "bg-blue-500/10", text: "text-blue-500", border: "border-blue-500/30" },
};

export function PeerHealthOverview() {
  const { data: connectivity, isLoading: connectivityLoading } = trpc.analytics.networkConnectivity.useQuery({
    limit: 100,
  });
  const { data: optimizations, isLoading: optimizationsLoading } = trpc.analytics.peerOptimizations.useQuery({
    limit: 20,
    priorityFilter: "all",
  });

  const isLoading = connectivityLoading || optimizationsLoading;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 border border-border rounded-xl p-6 animate-pulse">
          <div className="h-6 bg-muted rounded w-1/3 mb-4" />
          <div className="h-48 bg-muted rounded" />
        </div>
        <div className="border border-border rounded-xl p-6 animate-pulse">
          <div className="h-6 bg-muted rounded w-1/2 mb-4" />
          <div className="h-48 bg-muted rounded" />
        </div>
      </div>
    );
  }

  const score = connectivity?.connectivityScore ?? 0;
  const scoreColor = score >= 80 ? "text-green-500" : score >= 60 ? "text-blue-500" : score >= 40 ? "text-yellow-500" : "text-red-500";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Connectivity Overview */}
      <div className="lg:col-span-2 border border-border rounded-xl p-6">
        <h3 className="font-semibold mb-4">Network Connectivity</h3>

        {connectivity && (
          <div className="space-y-6">
            {/* Score and Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className={`text-4xl font-bold ${scoreColor}`}>
                  {score}
                </div>
                <div className="text-sm text-muted-foreground">
                  Connectivity Score
                </div>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="text-2xl font-bold">
                  {connectivity.avgPeersPerNode?.toFixed(1) ?? 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  Avg Peers/Node
                </div>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="text-2xl font-bold">
                  {connectivity.medianPeersPerNode?.toFixed(0) ?? 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  Median Peers
                </div>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="text-2xl font-bold">
                  {connectivity.totalConnections ?? 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Connections
                </div>
              </div>
            </div>

            {/* Node Distribution */}
            <div>
              <h4 className="text-sm font-medium mb-3">Node Distribution by Connectivity</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <div className="text-xl font-bold text-red-500">
                    {connectivity.isolatedNodes ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Isolated (0-2 peers)
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <div className="text-xl font-bold text-blue-500">
                    {connectivity.wellConnectedNodes ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Well Connected (10+)
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  <div className="text-xl font-bold text-green-500">
                    {connectivity.highlyConnectedNodes ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Highly Connected (20+)
                  </div>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            {connectivity.recommendations && connectivity.recommendations.length > 0 && (
              <div className="pt-4 border-t border-border">
                <h4 className="text-sm font-medium mb-3">Recommendations</h4>
                <div className="space-y-2">
                  {connectivity.recommendations.map((rec, idx) => {
                    const colors = priorityColors[rec.priority];
                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg ${colors.bg} border ${colors.border}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-medium uppercase ${colors.text}`}>
                            {rec.priority}
                          </span>
                          <span className="font-medium text-sm">{rec.title}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {rec.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Optimization Opportunities */}
      <div className="border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Optimization Needed</h3>
          {optimizations?.summary && (
            <span className="text-sm text-muted-foreground">
              {optimizations.summary.nodesNeedingOptimization}
            </span>
          )}
        </div>

        {optimizations?.summary && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="p-2 rounded bg-red-500/10 text-center">
              <div className="text-lg font-bold text-red-500">
                {optimizations.summary.byPriority.critical}
              </div>
              <div className="text-xs text-muted-foreground">Critical</div>
            </div>
            <div className="p-2 rounded bg-orange-500/10 text-center">
              <div className="text-lg font-bold text-orange-500">
                {optimizations.summary.byPriority.high}
              </div>
              <div className="text-xs text-muted-foreground">High</div>
            </div>
            <div className="p-2 rounded bg-yellow-500/10 text-center">
              <div className="text-lg font-bold text-yellow-500">
                {optimizations.summary.byPriority.medium}
              </div>
              <div className="text-xs text-muted-foreground">Medium</div>
            </div>
            <div className="p-2 rounded bg-blue-500/10 text-center">
              <div className="text-lg font-bold text-blue-500">
                {optimizations.summary.byPriority.low}
              </div>
              <div className="text-xs text-muted-foreground">Low</div>
            </div>
          </div>
        )}

        {optimizations?.optimizations && optimizations.optimizations.length > 0 ? (
          <div className="space-y-2">
            {optimizations.optimizations.slice(0, 6).map((opt, idx) => {
              const colors = priorityColors[opt.priority];
              return (
                <Link
                  key={idx}
                  href={`/nodes/${opt.nodeId}`}
                  className={`block p-2 rounded ${colors.bg} hover:opacity-80 transition-opacity`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs truncate max-w-[140px]">
                      {opt.address}
                    </span>
                    <span className={`text-xs ${colors.text}`}>
                      {opt.currentPeers}→{opt.targetPeers}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {opt.issue}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <div className="text-2xl mb-2">✓</div>
            <p className="text-sm">All nodes well connected</p>
          </div>
        )}
      </div>
    </div>
  );
}
