"use client";

import { GrowthForecast } from "./growth-forecast";
import { DegradationPanel } from "./degradation-panel";
import { PeerHealthOverview } from "./peer-health-overview";
import { NetworkHealthCard } from "./health-score-card";
import { trpc } from "@/lib/trpc/client";

export function AnalyticsDashboard() {
  const { data: networkHealth, isLoading: healthLoading } = trpc.analytics.networkHealth.useQuery();

  return (
    <div className="space-y-8">
      {/* Network Health Overview */}
      <section>
        {healthLoading ? (
          <div className="border border-border rounded-xl p-6 animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-4" />
            <div className="h-24 bg-muted rounded" />
          </div>
        ) : networkHealth ? (
          <NetworkHealthCard
            avgScore={networkHealth.avgScore}
            grade={networkHealth.grade}
            distribution={networkHealth.distribution}
            healthyPercentage={networkHealth.healthyPercentage}
            totalNodes={networkHealth.totalNodes}
          />
        ) : null}
      </section>

      {/* Growth Forecasting Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Growth Forecasts</h2>
        <GrowthForecast />
      </section>

      {/* Degradation Predictions Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Performance Health</h2>
        <DegradationPanel />
      </section>

      {/* Peer Connectivity Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Network Connectivity</h2>
        <PeerHealthOverview />
      </section>
    </div>
  );
}
