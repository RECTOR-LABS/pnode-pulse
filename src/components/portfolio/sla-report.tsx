"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useSession } from "@/lib/hooks/use-session";

type Period = "day" | "week" | "month";

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SlaReport() {
  const sessionId = useSession();
  const [period, setPeriod] = useState<Period>("month");
  const [selectedNodeId, setSelectedNodeId] = useState<number | undefined>();

  const { data: portfolio } = trpc.portfolio.get.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  const { data: report, isLoading } = trpc.portfolio.uptimeReport.useQuery(
    { sessionId, period, nodeId: selectedNodeId },
    { enabled: !!sessionId }
  );

  if (!sessionId || isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-48" />
          <div className="h-24 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!report || !portfolio?.nodes.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 text-center text-muted-foreground">
        <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p>Add nodes to your portfolio to see SLA reports</p>
      </div>
    );
  }

  const uptimeColor = report.uptimePercent >= 99.9
    ? "text-status-active"
    : report.uptimePercent >= 99
    ? "text-status-warning"
    : "text-status-inactive";

  const progressWidth = Math.min(100, report.uptimePercent);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">SLA Report</h3>
            <p className="text-sm text-muted-foreground">
              {new Date(report.period.from).toLocaleDateString()} - {new Date(report.period.to).toLocaleDateString()}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Node selector */}
            <select
              value={selectedNodeId ?? "all"}
              onChange={(e) => setSelectedNodeId(e.target.value === "all" ? undefined : Number(e.target.value))}
              className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm"
            >
              <option value="all">All Nodes</option>
              {portfolio.nodes.map((pn) => (
                <option key={pn.nodeId} value={pn.nodeId}>
                  {pn.label || pn.node.address.split(":")[0]}
                </option>
              ))}
            </select>

            {/* Period selector */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              {(["day", "week", "month"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    period === p
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Uptime Summary */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-muted-foreground">Overall Uptime</span>
          <span className={`text-2xl font-bold ${uptimeColor}`}>
            {report.uptimePercent.toFixed(2)}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              report.uptimePercent >= 99.9
                ? "bg-status-active"
                : report.uptimePercent >= 99
                ? "bg-status-warning"
                : "bg-status-inactive"
            }`}
            style={{ width: `${progressWidth}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-4 text-sm">
          <div>
            <span className="text-muted-foreground">Downtime:</span>{" "}
            <span className="font-medium">{formatDuration(report.downtimeMinutes)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Incidents:</span>{" "}
            <span className="font-medium">{report.incidents.length}</span>
          </div>
        </div>
      </div>

      {/* Incident Log */}
      <div className="p-4">
        <h4 className="font-medium mb-3">Incident Log</h4>

        {report.incidents.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>No downtime incidents during this period</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {report.incidents.slice(0, 10).map((incident, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg text-sm"
              >
                <div className="w-2 h-2 rounded-full bg-status-inactive" />
                <div className="flex-1">
                  <span className="font-medium">{incident.nodeAddress}</span>
                  <p className="text-muted-foreground">
                    {formatDate(incident.start)}
                    {incident.end ? ` - ${formatDate(incident.end)}` : " (ongoing)"}
                  </p>
                </div>
                <span className="text-muted-foreground">
                  {formatDuration(incident.durationMinutes)}
                </span>
              </div>
            ))}
            {report.incidents.length > 10 && (
              <p className="text-center text-sm text-muted-foreground py-2">
                +{report.incidents.length - 10} more incidents
              </p>
            )}
          </div>
        )}
      </div>

      {/* Per-Node Stats */}
      {!selectedNodeId && report.nodes.length > 1 && (
        <div className="p-4 border-t border-border">
          <h4 className="font-medium mb-3">Per-Node Uptime</h4>
          <div className="space-y-2">
            {report.nodes.map((node) => (
              <div key={node.nodeId} className="flex items-center justify-between text-sm">
                <span className="font-mono">{node.address.split(":")[0]}</span>
                <div className="flex items-center gap-2">
                  <span className={node.meetsSla ? "text-status-active" : "text-status-inactive"}>
                    {node.uptimePercent.toFixed(2)}%
                  </span>
                  {node.slaTarget && (
                    <span className="text-xs text-muted-foreground">
                      (target: {node.slaTarget}%)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
