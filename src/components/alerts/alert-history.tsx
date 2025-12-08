"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useSession } from "@/lib/hooks/use-session";
import { ALERT_METRICS } from "@/lib/notifications/types";

type AlertStatus = "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED" | "SUPPRESSED" | "ALL";
type SortOrder = "newest" | "oldest";

interface AlertDetailProps {
  alert: {
    id: string;
    metric: string;
    value: number;
    threshold: number;
    message: string;
    status: string;
    triggeredAt: Date;
    acknowledgedAt: Date | null;
    resolvedAt: Date | null;
    node: { address: string } | null;
    rule: { name: string };
  };
  onClose: () => void;
  onAcknowledge: () => void;
  onResolve: () => void;
  isPending: boolean;
}

function AlertDetailModal({ alert, onClose, onAcknowledge, onResolve, isPending }: AlertDetailProps) {
  const formatDate = (date: Date | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return "bg-status-inactive/20 text-status-inactive";
      case "ACKNOWLEDGED": return "bg-status-warning/20 text-status-warning";
      case "RESOLVED": return "bg-status-active/20 text-status-active";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-medium">Alert Details</h3>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-medium">{alert.rule.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(alert.status)}`}>
              {alert.status}
            </span>
          </div>

          <p className="text-muted-foreground">{alert.message}</p>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Node</span>
              <p className="font-mono">{alert.node?.address.split(":")[0] || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Metric</span>
              <p>{ALERT_METRICS[alert.metric as keyof typeof ALERT_METRICS]?.label || alert.metric}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Current Value</span>
              <p className="font-semibold text-status-inactive">
                {alert.value}{ALERT_METRICS[alert.metric as keyof typeof ALERT_METRICS]?.unit || ""}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Threshold</span>
              <p>{alert.threshold}{ALERT_METRICS[alert.metric as keyof typeof ALERT_METRICS]?.unit || ""}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Triggered</span>
              <p>{formatDate(alert.triggeredAt)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Acknowledged</span>
              <p>{formatDate(alert.acknowledgedAt)}</p>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Resolved</span>
              <p>{formatDate(alert.resolvedAt)}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 p-4 border-t border-border">
          {alert.status === "ACTIVE" && (
            <button
              onClick={onAcknowledge}
              disabled={isPending}
              className="flex-1 px-4 py-2 bg-status-warning/20 text-status-warning rounded-lg hover:bg-status-warning/30 transition-colors"
            >
              Acknowledge
            </button>
          )}
          {(alert.status === "ACTIVE" || alert.status === "ACKNOWLEDGED") && (
            <button
              onClick={onResolve}
              disabled={isPending}
              className="flex-1 px-4 py-2 bg-status-active/20 text-status-active rounded-lg hover:bg-status-active/30 transition-colors"
            >
              Resolve
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function AlertHistory() {
  const sessionId = useSession();
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<AlertStatus>("ALL");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [offset, setOffset] = useState(0);
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);
  const limit = 20;

  const { data, isLoading } = trpc.alerts.history.useQuery(
    {
      sessionId,
      status: statusFilter === "ALL" ? undefined : statusFilter,
      limit,
      offset,
    },
    { enabled: !!sessionId }
  );

  const acknowledgeMutation = trpc.alerts.acknowledge.useMutation({
    onSuccess: () => utils.alerts.history.invalidate(),
  });

  const resolveMutation = trpc.alerts.resolve.useMutation({
    onSuccess: () => utils.alerts.history.invalidate(),
  });

  const rawAlerts = data?.alerts || [];
  const total = data?.total || 0;
  const hasMore = offset + limit < total;

  // Sort alerts
  const alerts = [...rawAlerts].sort((a, b) => {
    const aTime = new Date(a.triggeredAt).getTime();
    const bTime = new Date(b.triggeredAt).getTime();
    return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
  });

  const selectedAlertData = alerts.find(a => a.id === selectedAlert);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return "bg-status-inactive/20 text-status-inactive";
      case "ACKNOWLEDGED": return "bg-status-warning/20 text-status-warning";
      case "RESOLVED": return "bg-status-active/20 text-status-active";
      case "SUPPRESSED": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const formatDateTime = (date: Date) => {
    return new Date(date).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleExport = () => {
    if (alerts.length === 0) return;

    const headers = ["ID", "Rule", "Status", "Node", "Metric", "Value", "Threshold", "Message", "Triggered", "Acknowledged", "Resolved"];
    const rows = alerts.map(alert => [
      alert.id,
      alert.rule.name,
      alert.status,
      alert.node?.address || "",
      alert.metric,
      alert.value,
      alert.threshold,
      `"${alert.message.replace(/"/g, '""')}"`,
      new Date(alert.triggeredAt).toISOString(),
      alert.acknowledgedAt ? new Date(alert.acknowledgedAt).toISOString() : "",
      alert.resolvedAt ? new Date(alert.resolvedAt).toISOString() : "",
    ]);

    const csv = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alerts-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getMetricIcon = (metric: string) => {
    switch (metric) {
      case "CPU_PERCENT":
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />;
      case "RAM_PERCENT":
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />;
      case "NODE_STATUS":
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />;
      default:
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          {(["ALL", "ACTIVE", "ACKNOWLEDGED", "RESOLVED"] as const).map((status) => (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(status);
                setOffset(0);
              }}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                statusFilter === status
                  ? "bg-brand-500 text-white"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {status === "ALL" ? "All" : status.charAt(0) + status.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Sort */}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="px-3 py-1.5 text-sm bg-muted rounded-lg border-0 focus:ring-2 focus:ring-brand-500"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>

          {/* Export */}
          <button
            onClick={handleExport}
            disabled={alerts.length === 0}
            className="px-3 py-1.5 text-sm bg-muted rounded-lg hover:bg-muted/80 disabled:opacity-50 transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* Alert list */}
      {alerts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <p className="text-lg mb-2">No alerts found</p>
          <p className="text-sm">
            {statusFilter === "ALL"
              ? "Alerts will appear here when triggered"
              : `No ${statusFilter.toLowerCase()} alerts`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => setSelectedAlert(alert.id)}
              className="p-4 rounded-lg bg-card border border-border hover:border-brand-500/50 cursor-pointer transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {getMetricIcon(alert.metric)}
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium truncate">{alert.rule.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(alert.status)}`}>
                        {alert.status}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground mb-1 truncate">{alert.message}</p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {alert.node && (
                        <span className="font-mono">{alert.node.address.split(":")[0]}</span>
                      )}
                      <span>{ALERT_METRICS[alert.metric as keyof typeof ALERT_METRICS]?.label || alert.metric}</span>
                      <span>{formatDateTime(alert.triggeredAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {alert.status === "ACTIVE" && (
                    <button
                      onClick={() => acknowledgeMutation.mutate({ alertId: alert.id, sessionId })}
                      disabled={acknowledgeMutation.isPending}
                      className="px-3 py-1.5 text-sm bg-status-warning/20 text-status-warning rounded-lg hover:bg-status-warning/30 transition-colors"
                    >
                      Ack
                    </button>
                  )}
                  {(alert.status === "ACTIVE" || alert.status === "ACKNOWLEDGED") && (
                    <button
                      onClick={() => resolveMutation.mutate({ alertId: alert.id, sessionId })}
                      disabled={resolveMutation.isPending}
                      className="px-3 py-1.5 text-sm bg-status-active/20 text-status-active rounded-lg hover:bg-status-active/30 transition-colors"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4">
            <span className="text-sm text-muted-foreground">
              Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-3 py-1.5 text-sm bg-muted rounded-lg hover:bg-muted/80 disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={!hasMore}
                className="px-3 py-1.5 text-sm bg-muted rounded-lg hover:bg-muted/80 disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Detail Modal */}
      {selectedAlert && selectedAlertData && (
        <AlertDetailModal
          alert={selectedAlertData}
          onClose={() => setSelectedAlert(null)}
          onAcknowledge={() => {
            acknowledgeMutation.mutate({ alertId: selectedAlertData.id, sessionId });
            setSelectedAlert(null);
          }}
          onResolve={() => {
            resolveMutation.mutate({ alertId: selectedAlertData.id, sessionId });
            setSelectedAlert(null);
          }}
          isPending={acknowledgeMutation.isPending || resolveMutation.isPending}
        />
      )}
    </div>
  );
}
