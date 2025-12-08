"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { trpc } from "@/lib/trpc";
import { StatCard } from "@/components/ui/stat-card";
import { CollectionStatus } from "@/components/ui/collection-status";
import { NetworkHealth } from "@/components/ui/network-health";
import { formatBytes, formatUptime, formatPercent, formatNumber } from "@/lib/utils/format";

// Dynamic imports for heavy chart components (code splitting)
const VersionChart = dynamic(
  () => import("@/components/ui/version-chart").then((mod) => mod.VersionChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const NetworkGrowthChart = dynamic(
  () => import("@/components/dashboard/network-growth-chart").then((mod) => mod.NetworkGrowthChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const NodeLeaderboard = dynamic(
  () => import("@/components/dashboard/node-leaderboard").then((mod) => mod.NodeLeaderboard),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const CapacityProjection = dynamic(
  () => import("@/components/dashboard/capacity-projection").then((mod) => mod.CapacityProjection),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const PerformanceComparison = dynamic(
  () => import("@/components/dashboard/performance-comparison").then((mod) => mod.PerformanceComparison),
  { loading: () => <ChartSkeleton />, ssr: false }
);

function ChartSkeleton() {
  return (
    <div className="h-48 bg-muted/30 rounded-lg animate-pulse flex items-center justify-center">
      <span className="text-muted-foreground text-sm">Loading...</span>
    </div>
  );
}

export function NetworkOverview() {
  const { data: overview, isLoading: overviewLoading } = trpc.network.overview.useQuery(
    undefined,
    { refetchInterval: 30000 } // Refresh every 30s
  );

  const { data: collectionStatus } = trpc.network.collectionStatus.useQuery(
    undefined,
    { refetchInterval: 30000 }
  );

  if (overviewLoading) {
    return <NetworkOverviewSkeleton />;
  }

  if (!overview) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">No Data Available</h2>
        <p className="text-muted-foreground">
          Start the collector to begin gathering network data.
        </p>
        <code className="mt-4 block text-sm bg-muted p-3 rounded-lg">
          npm run collector
        </code>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Nodes"
          value={formatNumber(overview.nodes.total)}
          subtitle={`${overview.nodes.active} active`}
          status={overview.nodes.active > 0 ? "active" : "inactive"}
          icon={<NodeIcon />}
        />
        <StatCard
          title="Network Storage"
          value={overview.metrics ? formatBytes(overview.metrics.totalStorage) : "--"}
          subtitle="across all nodes"
          icon={<StorageIcon />}
        />
        <StatCard
          title="Avg CPU"
          value={overview.metrics ? formatPercent(overview.metrics.avgCpu) : "--"}
          subtitle="network average"
          icon={<CpuIcon />}
        />
        <StatCard
          title="Avg Uptime"
          value={overview.metrics ? formatUptime(overview.metrics.avgUptime) : "--"}
          subtitle="per node"
          icon={<UptimeIcon />}
        />
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Network Health */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Network Health</h2>
          {overview.metrics ? (
            <NetworkHealth
              avgCpu={overview.metrics.avgCpu}
              avgRam={overview.metrics.avgRam}
              activeNodes={overview.nodes.active}
              totalNodes={overview.nodes.total}
            />
          ) : (
            <div className="text-muted-foreground text-sm py-8 text-center">
              No metrics available yet
            </div>
          )}
        </div>

        {/* Version Distribution */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Version Distribution</h2>
          <VersionChart data={overview.versions} />
        </div>
      </div>

      {/* Network Growth & Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Network Growth Chart */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Network Growth</h2>
          <NetworkGrowthChart />
        </div>

        {/* Node Leaderboard */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Node Performance</h2>
          <NodeLeaderboard />
        </div>
      </div>

      {/* Capacity Projection & Performance Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Capacity Projection (#30) */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Storage Projection</h2>
          <CapacityProjection />
        </div>

        {/* Performance Comparison (#31) */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Performance Comparison</h2>
          <PerformanceComparison />
        </div>
      </div>

      {/* Collection Status */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Collection Status</h2>
        {collectionStatus ? (
          <CollectionStatus
            latest={collectionStatus.latest}
            recent={collectionStatus.recent}
          />
        ) : (
          <div className="text-muted-foreground text-sm py-4">Loading...</div>
        )}
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-status-active">
            {formatNumber(overview.nodes.active)}
          </div>
          <div className="text-sm text-muted-foreground">Active Nodes</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-status-inactive">
            {formatNumber(overview.nodes.inactive)}
          </div>
          <div className="text-sm text-muted-foreground">Inactive Nodes</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold">
            {overview.metrics ? formatPercent(overview.metrics.avgRam, 0) : "--"}
          </div>
          <div className="text-sm text-muted-foreground">Avg RAM Usage</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold">
            {overview.metrics ? formatNumber(overview.metrics.totalPeers) : "--"}
          </div>
          <div className="text-sm text-muted-foreground">Peer Connections</div>
        </div>
      </div>
    </div>
  );
}

function NetworkOverviewSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-6">
            <div className="h-4 bg-muted rounded w-24 mb-4" />
            <div className="h-8 bg-muted rounded w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6 h-64" />
        <div className="card p-6 h-64" />
      </div>
    </div>
  );
}

// Simple icon components
function NodeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    </svg>
  );
}

function StorageIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  );
}

function CpuIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
    </svg>
  );
}

function UptimeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
