"use client";

import { trpc } from "@/lib/trpc";
import { useSession } from "@/lib/hooks/use-session";

export function UnderperformersCard() {
  const sessionId = useSession();

  const { data: underperformers, isLoading } =
    trpc.comparison.underperformers.useQuery(
      { sessionId: sessionId! },
      { enabled: !!sessionId }
    );

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 animate-pulse">
        <div className="h-5 bg-muted rounded w-48 mb-4" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!underperformers || underperformers.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-status-active/10 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-status-active"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="font-medium mb-1">All Nodes Performing Well</h3>
        <p className="text-sm text-muted-foreground">
          No performance issues detected in your portfolio
        </p>
      </div>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-status-inactive text-white";
      case "warning":
        return "bg-status-warning text-black";
      default:
        return "bg-muted text-foreground";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-status-active";
    if (score >= 50) return "text-status-warning";
    return "text-status-inactive";
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Underperforming Nodes</h3>
          <span className="px-2 py-1 bg-status-inactive/10 text-status-inactive text-xs font-medium rounded">
            {underperformers.length} issue{underperformers.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Node List */}
      <div className="divide-y divide-border max-h-96 overflow-y-auto">
        {underperformers.map((node) => (
          <div key={node.nodeId} className="p-4">
            {/* Node Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    node.isActive ? "bg-status-active" : "bg-status-inactive"
                  }`}
                />
                <span className="font-mono text-sm">
                  {node.address.split(":")[0]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Score:</span>
                <span className={`font-bold ${getScoreColor(node.score)}`}>
                  {node.score}
                </span>
              </div>
            </div>

            {/* Issues */}
            <div className="space-y-2">
              {node.issues.map((issue, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 text-sm"
                >
                  <span
                    className={`px-1.5 py-0.5 text-xs rounded ${getSeverityColor(
                      issue.severity
                    )}`}
                  >
                    {issue.severity}
                  </span>
                  <span className="text-muted-foreground flex-1">
                    {issue.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
