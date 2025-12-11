"use client";

import { formatPercent } from "@/lib/utils/format";

interface NetworkHealthProps {
  avgCpu: number;
  avgRam: number;
  activeNodes: number;
  totalNodes: number;
}

export function NetworkHealth({ avgCpu, avgRam, activeNodes, totalNodes }: NetworkHealthProps) {
  const healthScore = calculateHealthScore(avgCpu, avgRam, activeNodes, totalNodes);
  const healthLabel = getHealthLabel(healthScore);

  return (
    <div className="space-y-4">
      {/* Health score */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold">{healthScore}%</div>
          <div className="text-sm text-muted-foreground">{healthLabel}</div>
        </div>
        <div className={`w-16 h-16 rounded-full border-4 ${
          healthScore >= 80 ? "border-status-active" :
          healthScore >= 60 ? "border-status-warning" :
          "border-status-inactive"
        } flex items-center justify-center`}>
          <span className="text-lg font-bold">{healthScore >= 80 ? "A" : healthScore >= 60 ? "B" : "C"}</span>
        </div>
      </div>

      {/* Metrics bars */}
      <div className="space-y-3">
        <MetricBar
          label="CPU Usage"
          value={avgCpu}
          maxValue={100}
          format={(v) => formatPercent(v)}
          inverse
        />
        <MetricBar
          label="RAM Usage"
          value={avgRam}
          maxValue={100}
          format={(v) => formatPercent(v)}
          inverse
        />
        <MetricBar
          label="Node Availability"
          value={activeNodes}
          maxValue={totalNodes}
          format={(v, max) => `${v}/${max}`}
        />
      </div>
    </div>
  );
}

function MetricBar({
  label,
  value,
  maxValue,
  format,
  inverse = false,
}: {
  label: string;
  value: number;
  maxValue: number;
  format: (value: number, max: number) => string;
  inverse?: boolean;
}) {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
  const isGood = inverse ? percentage < 70 : percentage > 70;

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{format(value, maxValue)}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isGood ? "bg-status-active" : percentage > 90 ? "bg-status-inactive" : "bg-status-warning"
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

function calculateHealthScore(avgCpu: number, avgRam: number, activeNodes: number, totalNodes: number): number {
  // Weighted health score
  const cpuScore = Math.max(0, 100 - avgCpu); // Lower CPU = better
  const ramScore = Math.max(0, 100 - avgRam); // Lower RAM = better
  const availabilityScore = totalNodes > 0 ? (activeNodes / totalNodes) * 100 : 0;

  // Weights: availability 40%, CPU 30%, RAM 30%
  const score = (availabilityScore * 0.4) + (cpuScore * 0.3) + (ramScore * 0.3);

  return Math.round(score);
}

function getHealthLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Good";
  if (score >= 70) return "Fair";
  if (score >= 60) return "Degraded";
  return "Critical";
}
