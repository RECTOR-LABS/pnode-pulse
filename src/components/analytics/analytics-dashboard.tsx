"use client";

import dynamic from "next/dynamic";
import { NetworkHealthCard } from "./health-score-card";
import { trpc } from "@/lib/trpc/client";

// Dynamic imports for heavy analytics components (code splitting)
const GrowthForecast = dynamic(
  () => import("./growth-forecast").then((mod) => mod.GrowthForecast),
  { loading: () => <SectionSkeleton />, ssr: false }
);

const DegradationPanel = dynamic(
  () => import("./degradation-panel").then((mod) => mod.DegradationPanel),
  { loading: () => <SectionSkeleton />, ssr: false }
);

const PeerHealthOverview = dynamic(
  () => import("./peer-health-overview").then((mod) => mod.PeerHealthOverview),
  { loading: () => <SectionSkeleton />, ssr: false }
);

function SectionSkeleton() {
  return (
    <div className="border border-border rounded-xl p-6 animate-pulse">
      <div className="h-6 bg-muted rounded w-1/3 mb-4" />
      <div className="h-32 bg-muted rounded" />
    </div>
  );
}

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
