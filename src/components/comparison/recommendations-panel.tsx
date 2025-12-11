"use client";

import { trpc } from "@/lib/trpc";
import { useSession } from "@/lib/hooks/use-session";

export function RecommendationsPanel() {
  const sessionId = useSession();

  const { data: recommendations, isLoading } =
    trpc.comparison.recommendations.useQuery(
      { sessionId: sessionId! },
      { enabled: !!sessionId }
    );

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 animate-pulse">
        <div className="h-5 bg-muted rounded w-40 mb-4" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!recommendations || recommendations.length === 0) {
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
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h3 className="font-medium mb-1">No Recommendations</h3>
        <p className="text-sm text-muted-foreground">
          Your portfolio nodes are performing optimally
        </p>
      </div>
    );
  }

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "critical":
        return {
          border: "border-status-inactive/30",
          bg: "bg-status-inactive/5",
          icon: "text-status-inactive",
          badge: "bg-status-inactive text-white",
        };
      case "warning":
        return {
          border: "border-status-warning/30",
          bg: "bg-status-warning/5",
          icon: "text-status-warning",
          badge: "bg-status-warning text-black",
        };
      default:
        return {
          border: "border-brand-500/30",
          bg: "bg-brand-500/5",
          icon: "text-brand-500",
          badge: "bg-brand-500/20 text-brand-600 dark:text-brand-400",
        };
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "optimization":
        return (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        );
      case "update":
        return (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        );
      case "network":
        return (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
          />
        );
      case "status":
        return (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        );
      default:
        return (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        );
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Recommendations</h3>
          <span className="text-sm text-muted-foreground">
            {recommendations.length} action{recommendations.length > 1 ? "s" : ""}{" "}
            suggested
          </span>
        </div>
      </div>

      {/* Recommendations List */}
      <div className="divide-y divide-border">
        {recommendations.map((rec) => {
          const styles = getSeverityStyles(rec.severity);
          return (
            <div
              key={rec.id}
              className={`p-4 ${styles.bg} border-l-4 ${styles.border}`}
            >
              {/* Header */}
              <div className="flex items-start gap-3 mb-2">
                <div
                  className={`w-8 h-8 rounded-lg bg-background flex items-center justify-center flex-shrink-0 ${styles.icon}`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    {getTypeIcon(rec.type)}
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-1.5 py-0.5 text-xs rounded ${styles.badge}`}>
                      {rec.severity}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {rec.type}
                    </span>
                  </div>
                  <h4 className="font-medium text-sm">{rec.title}</h4>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground mb-3 ml-11">
                {rec.description}
              </p>

              {/* Affected Nodes */}
              <div className="ml-11 mb-3">
                <div className="flex flex-wrap gap-1">
                  {rec.nodeAddresses.slice(0, 3).map((addr, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-muted rounded text-xs font-mono"
                    >
                      {addr}
                    </span>
                  ))}
                  {rec.nodeAddresses.length > 3 && (
                    <span className="px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground">
                      +{rec.nodeAddresses.length - 3} more
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="ml-11 flex gap-2">
                {rec.actions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => action.href && window.open(action.href, "_blank")}
                    className="px-3 py-1 text-sm bg-background border border-border rounded hover:bg-muted transition-colors"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
