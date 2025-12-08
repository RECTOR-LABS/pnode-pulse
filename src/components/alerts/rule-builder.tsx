"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useSession } from "@/lib/hooks/use-session";
import {
  ALERT_METRICS,
  ALERT_OPERATORS,
  ALERT_TARGET_TYPES,
  PRESET_THRESHOLDS,
  type AlertMetric,
  type AlertOperator,
  type AlertTargetType,
} from "@/lib/notifications/types";

interface RuleBuilderProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  editRule?: {
    id: string;
    name: string;
    description?: string | null;
    targetType: AlertTargetType;
    nodeIds: number[];
    metric: AlertMetric;
    operator: AlertOperator;
    threshold: number;
    cooldown: number;
    channels: string[];
  };
}

export function RuleBuilder({ onSuccess, onCancel, editRule }: RuleBuilderProps) {
  const sessionId = useSession();
  const utils = trpc.useUtils();

  const [name, setName] = useState(editRule?.name || "");
  const [description, setDescription] = useState(editRule?.description || "");
  const [targetType, setTargetType] = useState<AlertTargetType>(editRule?.targetType || "ALL_NODES");
  const [nodeIds, setNodeIds] = useState<number[]>(editRule?.nodeIds || []);
  const [metric, setMetric] = useState<AlertMetric>(editRule?.metric || "CPU_PERCENT");
  const [operator, setOperator] = useState<AlertOperator>(editRule?.operator || "GT");
  const [threshold, setThreshold] = useState(editRule?.threshold?.toString() || "80");
  const [cooldown, setCooldown] = useState(editRule?.cooldown?.toString() || "300");
  const [channels, setChannels] = useState<string[]>(editRule?.channels || []);
  const [error, setError] = useState<string | null>(null);

  // Get available channels
  const { data: availableChannels } = trpc.alerts.channels.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  // Get nodes for selection
  const { data: nodesData } = trpc.nodes.list.useQuery(undefined, {
    enabled: targetType === "SPECIFIC_NODES",
  });

  const createMutation = trpc.alerts.createRule.useMutation({
    onSuccess: () => {
      utils.alerts.rules.invalidate();
      onSuccess?.();
    },
    onError: (err) => setError(err.message),
  });

  const updateMutation = trpc.alerts.updateRule.useMutation({
    onSuccess: () => {
      utils.alerts.rules.invalidate();
      onSuccess?.();
    },
    onError: (err) => setError(err.message),
  });

  const handlePresetClick = (preset: typeof PRESET_THRESHOLDS[0]) => {
    setMetric(preset.metric);
    setOperator(preset.operator);
    setThreshold(preset.threshold.toString());
    if (!name) setName(preset.name);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    const thresholdNum = parseFloat(threshold);
    if (isNaN(thresholdNum)) {
      setError("Threshold must be a number");
      return;
    }

    const cooldownNum = parseInt(cooldown);
    if (isNaN(cooldownNum) || cooldownNum < 60) {
      setError("Cooldown must be at least 60 seconds");
      return;
    }

    const ruleData = {
      name: name.trim(),
      description: description.trim() || undefined,
      targetType,
      nodeIds,
      metric,
      operator,
      threshold: thresholdNum,
      cooldown: cooldownNum,
      channels,
    };

    if (editRule) {
      updateMutation.mutate({
        id: editRule.id,
        sessionId,
        rule: ruleData,
      });
    } else {
      createMutation.mutate({
        sessionId,
        rule: ruleData,
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-status-inactive/10 border border-status-inactive/30 rounded-lg text-sm text-status-inactive">
          {error}
        </div>
      )}

      {/* Presets */}
      {!editRule && (
        <div>
          <label className="block text-sm font-medium mb-2">Quick Presets</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_THRESHOLDS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => handlePresetClick(preset)}
                className="px-3 py-1.5 text-sm rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Name */}
      <div>
        <label className="block text-sm font-medium mb-2">Rule Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., High CPU Alert"
          className="w-full px-3 py-2 bg-muted rounded-lg border-0 focus:ring-2 focus:ring-brand-500"
          required
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-2">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description..."
          className="w-full px-3 py-2 bg-muted rounded-lg border-0 focus:ring-2 focus:ring-brand-500 resize-none"
          rows={2}
        />
      </div>

      {/* Target */}
      <div>
        <label className="block text-sm font-medium mb-2">Monitor</label>
        <select
          value={targetType}
          onChange={(e) => setTargetType(e.target.value as AlertTargetType)}
          className="w-full px-3 py-2 bg-muted rounded-lg border-0 focus:ring-2 focus:ring-brand-500"
        >
          {Object.entries(ALERT_TARGET_TYPES).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Node selection for specific nodes */}
      {targetType === "SPECIFIC_NODES" && nodesData && (
        <div>
          <label className="block text-sm font-medium mb-2">Select Nodes</label>
          <div className="max-h-40 overflow-y-auto bg-muted rounded-lg p-2 space-y-1">
            {nodesData.nodes.map((node) => (
              <label key={node.id} className="flex items-center gap-2 p-1 hover:bg-muted/80 rounded">
                <input
                  type="checkbox"
                  checked={nodeIds.includes(node.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setNodeIds([...nodeIds, node.id]);
                    } else {
                      setNodeIds(nodeIds.filter((id) => id !== node.id));
                    }
                  }}
                  className="rounded"
                />
                <span className="text-sm font-mono">{node.address.split(":")[0]}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Condition */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Metric</label>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as AlertMetric)}
            className="w-full px-3 py-2 bg-muted rounded-lg border-0 focus:ring-2 focus:ring-brand-500"
          >
            {Object.entries(ALERT_METRICS).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Condition</label>
          <select
            value={operator}
            onChange={(e) => setOperator(e.target.value as AlertOperator)}
            className="w-full px-3 py-2 bg-muted rounded-lg border-0 focus:ring-2 focus:ring-brand-500"
          >
            {Object.entries(ALERT_OPERATORS).map(([key, { label, description }]) => (
              <option key={key} value={key}>
                {label} ({description})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Threshold {ALERT_METRICS[metric]?.unit && `(${ALERT_METRICS[metric].unit})`}
          </label>
          <input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-full px-3 py-2 bg-muted rounded-lg border-0 focus:ring-2 focus:ring-brand-500"
            step="any"
          />
        </div>
      </div>

      {/* Cooldown */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Cooldown (seconds between repeated alerts)
        </label>
        <input
          type="number"
          value={cooldown}
          onChange={(e) => setCooldown(e.target.value)}
          min={60}
          max={86400}
          className="w-full px-3 py-2 bg-muted rounded-lg border-0 focus:ring-2 focus:ring-brand-500"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Minimum 60 seconds. This prevents alert spam.
        </p>
      </div>

      {/* Notification Channels */}
      <div>
        <label className="block text-sm font-medium mb-2">Notification Channels</label>
        {availableChannels && availableChannels.length > 0 ? (
          <div className="space-y-2">
            {availableChannels.map((channel) => (
              <label key={channel.id} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                <input
                  type="checkbox"
                  checked={channels.includes(channel.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setChannels([...channels, channel.id]);
                    } else {
                      setChannels(channels.filter((id) => id !== channel.id));
                    }
                  }}
                  className="rounded"
                />
                <span className="text-sm">{channel.name}</span>
                <span className="text-xs text-muted-foreground">({channel.type.toLowerCase()})</span>
                {!channel.isVerified && (
                  <span className="text-xs text-status-warning">(unverified)</span>
                )}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
            No notification channels configured. Add one in the Channels tab to receive alerts.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Saving..." : editRule ? "Update Rule" : "Create Rule"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
