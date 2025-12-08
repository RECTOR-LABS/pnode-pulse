"use client";

import { type HealthScore, type HealthGrade } from "@/lib/analytics/health-scorer";

interface HealthScoreCardProps {
  health: HealthScore;
  showDetails?: boolean;
  compact?: boolean;
}

const gradeColors: Record<HealthGrade, { bg: string; text: string; ring: string }> = {
  A: { bg: "bg-green-500/10", text: "text-green-500", ring: "ring-green-500/30" },
  B: { bg: "bg-blue-500/10", text: "text-blue-500", ring: "ring-blue-500/30" },
  C: { bg: "bg-yellow-500/10", text: "text-yellow-500", ring: "ring-yellow-500/30" },
  D: { bg: "bg-orange-500/10", text: "text-orange-500", ring: "ring-orange-500/30" },
  F: { bg: "bg-red-500/10", text: "text-red-500", ring: "ring-red-500/30" },
};

function GradeBadge({ grade, score }: { grade: HealthGrade; score: number }) {
  const colors = gradeColors[grade];
  return (
    <div className={`flex items-center gap-2 ${colors.bg} rounded-lg px-3 py-2 ring-1 ${colors.ring}`}>
      <span className={`text-2xl font-bold ${colors.text}`}>{grade}</span>
      <span className={`text-sm ${colors.text}`}>{score}%</span>
    </div>
  );
}

function ComponentBar({
  label,
  score,
  status,
}: {
  label: string;
  score: number;
  status: string;
}) {
  const getBarColor = (s: number) => {
    if (s >= 80) return "bg-green-500";
    if (s >= 60) return "bg-blue-500";
    if (s >= 40) return "bg-yellow-500";
    if (s >= 20) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${getBarColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{status}</p>
    </div>
  );
}

export function HealthScoreCard({
  health,
  showDetails = true,
  compact = false,
}: HealthScoreCardProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <GradeBadge grade={health.grade} score={health.overall} />
      </div>
    );
  }

  return (
    <div className="border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Health Score</h3>
        <GradeBadge grade={health.grade} score={health.overall} />
      </div>

      {showDetails && (
        <div className="space-y-4">
          <ComponentBar
            label="Uptime"
            score={health.components.uptime}
            status={health.details.uptimeStatus}
          />
          <ComponentBar
            label="CPU"
            score={health.components.cpu}
            status={health.details.cpuStatus}
          />
          <ComponentBar
            label="Memory"
            score={health.components.ram}
            status={health.details.ramStatus}
          />
          <ComponentBar
            label="Connectivity"
            score={health.components.connectivity}
            status={health.details.connectivityStatus}
          />
          <ComponentBar
            label="Version"
            score={health.components.version}
            status={health.details.versionStatus}
          />
        </div>
      )}

      {health.outliers && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Outlier Status</p>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(health.outliers).map(([metric, category]) => {
              if (category === "normal") return null;
              const isHigh = category === "high" || category === "very_high";
              return (
                <span
                  key={metric}
                  className={`px-2 py-1 text-xs rounded ${
                    isHigh
                      ? "bg-orange-500/10 text-orange-500"
                      : "bg-blue-500/10 text-blue-500"
                  }`}
                >
                  {metric.toUpperCase()}: {category.replace("_", " ")}
                </span>
              );
            })}
            {Object.values(health.outliers).every((c) => c === "normal") && (
              <span className="text-xs text-muted-foreground">
                All metrics within normal range
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface NetworkHealthCardProps {
  avgScore: number;
  grade: HealthGrade;
  distribution: { A: number; B: number; C: number; D: number; F: number };
  healthyPercentage: number;
  totalNodes: number;
}

export function NetworkHealthCard({
  avgScore,
  grade,
  distribution,
  healthyPercentage,
  totalNodes,
}: NetworkHealthCardProps) {
  const colors = gradeColors[grade];

  return (
    <div className="border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Network Health</h3>
          <p className="text-sm text-muted-foreground">
            {totalNodes} active nodes
          </p>
        </div>
        <div className={`text-center ${colors.bg} rounded-xl px-6 py-4 ring-1 ${colors.ring}`}>
          <div className={`text-4xl font-bold ${colors.text}`}>{grade}</div>
          <div className={`text-sm ${colors.text}`}>{avgScore}%</div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 mb-4">
        {(["A", "B", "C", "D", "F"] as HealthGrade[]).map((g) => {
          const count = distribution[g];
          const percentage = totalNodes > 0 ? (count / totalNodes) * 100 : 0;
          return (
            <div key={g} className="text-center">
              <div className={`text-sm font-medium ${gradeColors[g].text}`}>
                {g}
              </div>
              <div className="text-lg font-bold">{count}</div>
              <div className="text-xs text-muted-foreground">
                {percentage.toFixed(0)}%
              </div>
            </div>
          );
        })}
      </div>

      <div className="h-3 bg-muted rounded-full overflow-hidden flex">
        {(["A", "B", "C", "D", "F"] as HealthGrade[]).map((g) => {
          const count = distribution[g];
          const percentage = totalNodes > 0 ? (count / totalNodes) * 100 : 0;
          if (percentage === 0) return null;
          return (
            <div
              key={g}
              className={`${gradeColors[g].text.replace("text-", "bg-")} h-full`}
              style={{ width: `${percentage}%` }}
            />
          );
        })}
      </div>

      <div className="mt-4 text-sm">
        <span className="text-muted-foreground">Healthy nodes: </span>
        <span className="font-medium">{healthyPercentage}%</span>
        <span className="text-muted-foreground"> (grade C or better)</span>
      </div>
    </div>
  );
}
