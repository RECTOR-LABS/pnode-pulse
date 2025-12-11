"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useSession } from "@/lib/hooks/use-session";
import { ALERT_METRICS, ALERT_OPERATORS, type AlertMetric, type AlertOperator } from "@/lib/notifications/types";

interface RuleListProps {
  onEdit?: (rule: {
    id: string;
    name: string;
    description: string | null;
    targetType: string;
    nodeIds: number[];
    metric: AlertMetric;
    operator: AlertOperator;
    threshold: number;
    cooldown: number;
    channels: string[];
    isEnabled: boolean;
    lastTriggeredAt: Date | null;
  }) => void;
}

export function RuleList({ onEdit }: RuleListProps) {
  const sessionId = useSession();
  const utils = trpc.useUtils();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: rules, isLoading } = trpc.alerts.rules.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  const toggleMutation = trpc.alerts.toggleRule.useMutation({
    onSuccess: () => utils.alerts.rules.invalidate(),
  });

  const deleteMutation = trpc.alerts.deleteRule.useMutation({
    onSuccess: () => {
      utils.alerts.rules.invalidate();
      setDeletingId(null);
    },
  });

  const handleToggle = (id: string, currentState: boolean) => {
    toggleMutation.mutate({ id, sessionId, enabled: !currentState });
  };

  const handleDelete = (id: string) => {
    if (deletingId === id) {
      deleteMutation.mutate({ id, sessionId });
    } else {
      setDeletingId(id);
      // Reset after 3 seconds if not confirmed
      setTimeout(() => setDeletingId(null), 3000);
    }
  };

  const formatCondition = (rule: { metric: AlertMetric; operator: AlertOperator; threshold: number }) => {
    const metricLabel = ALERT_METRICS[rule.metric]?.label || rule.metric;
    const operatorInfo = ALERT_OPERATORS[rule.operator];
    const unit = ALERT_METRICS[rule.metric]?.unit || "";
    return `${metricLabel} ${operatorInfo?.label || rule.operator} ${rule.threshold}${unit}`;
  };

  const formatCooldown = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!rules || rules.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg mb-2">No alert rules configured</p>
        <p className="text-sm">Create your first rule to start monitoring</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rules.map((rule) => (
        <div
          key={rule.id}
          className={`p-4 rounded-lg border transition-colors ${
            rule.isEnabled
              ? "bg-card border-border"
              : "bg-muted/30 border-border/50 opacity-60"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium truncate">{rule.name}</h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    rule.isEnabled
                      ? "bg-status-active/20 text-status-active"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {rule.isEnabled ? "Active" : "Disabled"}
                </span>
              </div>

              {rule.description && (
                <p className="text-sm text-muted-foreground mb-2 truncate">
                  {rule.description}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="text-muted-foreground">
                  {formatCondition(rule)}
                </span>
                <span className="text-muted-foreground">
                  Cooldown: {formatCooldown(rule.cooldown)}
                </span>
                {rule._count.alerts > 0 && (
                  <span className="text-status-warning">
                    {rule._count.alerts} alert{rule._count.alerts !== 1 ? "s" : ""}
                  </span>
                )}
                {rule.lastTriggeredAt && (
                  <span className="text-xs text-muted-foreground">
                    Last: {new Date(rule.lastTriggeredAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Toggle */}
              <button
                onClick={() => handleToggle(rule.id, rule.isEnabled)}
                disabled={toggleMutation.isPending}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  rule.isEnabled ? "bg-status-active" : "bg-muted"
                }`}
                title={rule.isEnabled ? "Disable rule" : "Enable rule"}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    rule.isEnabled ? "left-7" : "left-1"
                  }`}
                />
              </button>

              {/* Edit */}
              {onEdit && (
                <button
                  onClick={() => onEdit({
                    id: rule.id,
                    name: rule.name,
                    description: rule.description,
                    targetType: rule.targetType,
                    nodeIds: rule.nodeIds as number[],
                    metric: rule.metric,
                    operator: rule.operator,
                    threshold: rule.threshold,
                    cooldown: rule.cooldown,
                    channels: rule.channels as string[],
                    isEnabled: rule.isEnabled,
                    lastTriggeredAt: rule.lastTriggeredAt,
                  })}
                  className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                  title="Edit rule"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}

              {/* Delete */}
              <button
                onClick={() => handleDelete(rule.id)}
                disabled={deleteMutation.isPending}
                className={`p-2 transition-colors ${
                  deletingId === rule.id
                    ? "text-status-inactive"
                    : "text-muted-foreground hover:text-status-inactive"
                }`}
                title={deletingId === rule.id ? "Click again to confirm" : "Delete rule"}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
