"use client";

import {
  type VersionAdvisory,
  type AdvisorySeverity,
  type VersionDistribution,
} from "@/lib/analytics/version-advisor";

interface VersionAdvisoryBadgeProps {
  advisory: VersionAdvisory;
  compact?: boolean;
}

const severityColors: Record<AdvisorySeverity, { bg: string; text: string; border: string }> = {
  none: { bg: "bg-green-500/10", text: "text-green-500", border: "border-green-500/30" },
  low: { bg: "bg-blue-500/10", text: "text-blue-500", border: "border-blue-500/30" },
  medium: { bg: "bg-yellow-500/10", text: "text-yellow-500", border: "border-yellow-500/30" },
  high: { bg: "bg-orange-500/10", text: "text-orange-500", border: "border-orange-500/30" },
  critical: { bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/30" },
};

export function VersionAdvisoryBadge({ advisory, compact = false }: VersionAdvisoryBadgeProps) {
  const colors = severityColors[advisory.severity];

  if (compact) {
    return (
      <span className={`px-2 py-1 text-xs rounded ${colors.bg} ${colors.text}`}>
        v{advisory.currentVersion}
        {advisory.status !== "current" && (
          <span className="ml-1 opacity-75">
            ({advisory.versionsBehind.major > 0
              ? `${advisory.versionsBehind.major}M`
              : advisory.versionsBehind.minor > 0
                ? `${advisory.versionsBehind.minor}m`
                : `${advisory.versionsBehind.patch}p`} behind)
          </span>
        )}
      </span>
    );
  }

  return (
    <div className={`${colors.bg} border ${colors.border} rounded-lg p-4`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`font-medium ${colors.text}`}>{advisory.message}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Current: v{advisory.currentVersion} | Latest: v{advisory.latestVersion}
          </p>
        </div>
        <span className={`px-2 py-1 text-xs rounded ${colors.bg} ${colors.text} uppercase`}>
          {advisory.severity}
        </span>
      </div>
      <p className="text-sm mt-3">{advisory.recommendation}</p>
    </div>
  );
}

interface VersionDistributionCardProps {
  distribution: VersionDistribution[];
  latestVersion: string;
  healthyPercentage: number;
  outdatedCount: number;
  recommendations: string[];
}

export function VersionDistributionCard({
  distribution,
  latestVersion,
  healthyPercentage,
  outdatedCount,
  recommendations,
}: VersionDistributionCardProps) {

  return (
    <div className="border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Version Distribution</h3>
          <p className="text-sm text-muted-foreground">
            Latest: v{latestVersion}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-green-500">
            {healthyPercentage}%
          </div>
          <div className="text-xs text-muted-foreground">up to date</div>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {distribution.map((v) => {
          const colors = severityColors[v.severity];
          return (
            <div key={v.version} className="flex items-center gap-3">
              <div className="w-20 text-sm font-mono">v{v.version}</div>
              <div className="flex-1">
                <div className="h-6 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${colors.text.replace("text-", "bg-")} rounded-full flex items-center px-2`}
                    style={{ width: `${Math.max(v.percentage, 10)}%` }}
                  >
                    <span className="text-xs text-white font-medium">
                      {v.count}
                    </span>
                  </div>
                </div>
              </div>
              <div className="w-16 text-right text-sm text-muted-foreground">
                {v.percentage.toFixed(1)}%
              </div>
              <span className={`px-2 py-0.5 text-xs rounded ${colors.bg} ${colors.text}`}>
                {v.status.replace("_", " ")}
              </span>
            </div>
          );
        })}
      </div>

      {outdatedCount > 0 && (
        <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
          <p className="text-sm text-orange-500">
            {outdatedCount} node(s) running outdated versions
          </p>
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="border-t border-border pt-4">
          <p className="text-sm font-medium mb-2">Recommendations</p>
          <ul className="space-y-1">
            {recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-muted-foreground">
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
