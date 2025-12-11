"use client";

import { trpc } from "@/lib/trpc/client";

const scenarioColors = {
  optimistic: { bg: "bg-green-500/10", text: "text-green-500", border: "border-green-500/30" },
  baseline: { bg: "bg-blue-500/10", text: "text-blue-500", border: "border-blue-500/30" },
  pessimistic: { bg: "bg-orange-500/10", text: "text-orange-500", border: "border-orange-500/30" },
};

const trendIcons = {
  accelerating: "↗",
  steady: "→",
  decelerating: "↘",
  declining: "↓",
};

const trendColors = {
  accelerating: "text-green-500",
  steady: "text-blue-500",
  decelerating: "text-yellow-500",
  declining: "text-red-500",
};

export function GrowthForecast() {
  const { data, isLoading, error } = trpc.analytics.networkGrowth.useQuery({ period: "30d" });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border border-border rounded-xl p-6 animate-pulse">
            <div className="h-6 bg-muted rounded w-2/3 mb-4" />
            <div className="h-20 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="border border-border rounded-xl p-6 text-center text-muted-foreground">
        Unable to load growth data
      </div>
    );
  }

  if (!data.hasEnoughData) {
    return (
      <div className="border border-border rounded-xl p-6">
        <h3 className="font-semibold mb-2">Growth Forecasting</h3>
        <p className="text-muted-foreground text-sm">
          Not enough historical data for forecasting. Need at least 3 days of data.
        </p>
        {data.current && (
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{data.current.totalNodes}</div>
              <div className="text-sm text-muted-foreground">Total Nodes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{data.current.activeNodes}</div>
              <div className="text-sm text-muted-foreground">Active Nodes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{data.current.storageTB.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">Storage (TB)</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const { report, scenarioComparison } = data;
  const metrics = report?.metrics;

  return (
    <div className="space-y-6">
      {/* Current Metrics & Trends */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Nodes</div>
          <div className="text-2xl font-bold">{metrics?.currentNodes ?? 0}</div>
          <div className="flex items-center gap-1 mt-1">
            <span className={trendColors[metrics?.nodeTrend ?? "steady"]}>
              {trendIcons[metrics?.nodeTrend ?? "steady"]}
            </span>
            <span className="text-sm text-muted-foreground capitalize">
              {metrics?.nodeTrend ?? "unknown"}
            </span>
          </div>
        </div>

        <div className="border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground mb-1">Active Nodes</div>
          <div className="text-2xl font-bold">{metrics?.currentActiveNodes ?? 0}</div>
          <div className="text-sm text-muted-foreground mt-1">
            {metrics?.currentNodes ? ((metrics.currentActiveNodes / metrics.currentNodes) * 100).toFixed(0) : 0}% active
          </div>
        </div>

        <div className="border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground mb-1">Storage</div>
          <div className="text-2xl font-bold">{metrics?.currentStorageTB?.toFixed(2) ?? 0} TB</div>
          <div className="flex items-center gap-1 mt-1">
            <span className={trendColors[metrics?.storageTrend ?? "steady"]}>
              {trendIcons[metrics?.storageTrend ?? "steady"]}
            </span>
            <span className="text-sm text-muted-foreground capitalize">
              {metrics?.storageTrend ?? "unknown"}
            </span>
          </div>
        </div>

        <div className="border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground mb-1">Daily Growth</div>
          <div className="text-2xl font-bold">
            {metrics?.dailyNodeGrowth !== undefined
              ? metrics.dailyNodeGrowth >= 0
                ? `+${metrics.dailyNodeGrowth.toFixed(1)}`
                : metrics.dailyNodeGrowth.toFixed(1)
              : 0}
          </div>
          <div className="text-sm text-muted-foreground mt-1">nodes/day</div>
        </div>
      </div>

      {/* Scenario Forecasts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {report?.scenarios.map((scenario) => {
          const colors = scenarioColors[scenario.scenario];
          return (
            <div
              key={scenario.scenario}
              className={`border ${colors.border} ${colors.bg} rounded-xl p-4`}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className={`font-semibold capitalize ${colors.text}`}>
                  {scenario.scenario}
                </h4>
                <span className="text-xs text-muted-foreground">
                  {scenario.growthMultiplier}x rate
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {scenario.description}
              </p>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">30 days</span>
                  <span className="font-medium">
                    {scenario.predictions.days30.nodes} nodes
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">60 days</span>
                  <span className="font-medium">
                    {scenario.predictions.days60.nodes} nodes
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">90 days</span>
                  <span className="font-medium">
                    {scenario.predictions.days90.nodes} nodes
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border/50">
                <div className="text-xs text-muted-foreground mb-2">
                  Confidence: {(scenario.predictions.days30.confidence * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Milestones */}
      {report?.scenarios[1]?.milestones && (
        <div className="border border-border rounded-xl p-4">
          <h4 className="font-semibold mb-4">Milestone Tracking</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {report.scenarios[1].milestones.map((milestone) => (
              <div
                key={milestone.id}
                className={`p-3 rounded-lg ${
                  milestone.achieved
                    ? "bg-green-500/10 border border-green-500/30"
                    : "bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {milestone.achieved ? (
                    <span className="text-green-500">✓</span>
                  ) : (
                    <span className="text-muted-foreground">○</span>
                  )}
                  <span className="font-medium text-sm">{milestone.name}</span>
                </div>
                {milestone.achieved ? (
                  <span className="text-xs text-green-500">Achieved</span>
                ) : milestone.daysUntil ? (
                  <span className="text-xs text-muted-foreground">
                    ~{milestone.daysUntil} days
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">TBD</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Highlights */}
      {report?.highlights && report.highlights.length > 0 && (
        <div className="border border-border rounded-xl p-4">
          <h4 className="font-semibold mb-3">Insights</h4>
          <ul className="space-y-2">
            {report.highlights.map((highlight, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm">
                <span className="text-brand-500">•</span>
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
