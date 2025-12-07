"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { MetricGauge } from "@/components/ui/metric-gauge";
import { MetricCard } from "@/components/ui/metric-card";
import { TimeSeriesChart, RangeSelector } from "@/components/ui/time-series-chart";
import { PeerList } from "./peer-list";
import {
  formatBytes,
  formatUptime,
  formatPercent,
  formatNumber,
  formatRelativeTime,
  formatAddress,
} from "@/lib/utils/format";
import { BookmarkButton } from "@/components/ui/bookmark-button";

interface NodeDetailProps {
  nodeId: number;
}

type TimeRange = "1h" | "24h" | "7d" | "30d";

const rangeOptions = [
  { label: "1H", value: "1h" },
  { label: "24H", value: "24h" },
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
];

export function NodeDetail({ nodeId }: NodeDetailProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");

  const { data: node, isLoading: nodeLoading, error } = trpc.nodes.byId.useQuery(nodeId, {
    refetchInterval: 30000,
  });

  const { data: latestMetric } = trpc.nodes.latestMetric.useQuery(nodeId, {
    refetchInterval: 30000,
  });

  const { data: metrics } = trpc.nodes.metrics.useQuery(
    { nodeId, range: timeRange, aggregation: timeRange === "1h" ? "raw" : "hourly" },
    { refetchInterval: 60000 }
  );

  const { data: peers, isLoading: peersLoading } = trpc.nodes.peers.useQuery(nodeId);

  if (nodeLoading) {
    return <NodeDetailSkeleton />;
  }

  if (error) {
    return (
      <div className="card p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-status-inactive/10 mx-auto mb-4 flex items-center justify-center">
          <svg className="w-8 h-8 text-status-inactive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2">Node Not Found</h2>
        <p className="text-muted-foreground">
          {error.message || "The requested node could not be found."}
        </p>
      </div>
    );
  }

  if (!node) {
    return null;
  }

  const ramPercent = latestMetric?.ramUsed && latestMetric?.ramTotal
    ? Number((BigInt(latestMetric.ramUsed) * BigInt(100)) / BigInt(latestMetric.ramTotal))
    : 0;

  // Prepare chart data
  const cpuChartData = metrics?.map((m) => ({
    time: "bucket" in m ? m.bucket : m.time,
    value: "avg_cpu" in m ? (m.avg_cpu ?? 0) : (m.cpuPercent ?? 0),
  })) || [];

  const ramChartData = metrics?.map((m) => ({
    time: "bucket" in m ? m.bucket : m.time,
    value: "avg_ram_percent" in m
      ? (m.avg_ram_percent ?? 0)
      : (m.ramUsed && m.ramTotal ? Number((BigInt(m.ramUsed) * BigInt(100)) / BigInt(m.ramTotal)) : 0),
  })) || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="card p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold font-mono">
                {formatAddress(node.address)}
              </h1>
              <button
                onClick={() => navigator.clipboard.writeText(formatAddress(node.address))}
                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Copy IP address"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              <BookmarkButton nodeId={nodeId} size="lg" />
            </div>

            {node.pubkey && (
              <div className="text-sm text-muted-foreground mb-3 font-mono truncate max-w-lg">
                {node.pubkey}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <span className={`status-badge status-badge-${node.isActive ? "active" : "inactive"}`}>
                {node.isActive ? "Active" : "Inactive"}
              </span>
              {node.version && (
                <span className="px-2 py-1 text-xs rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400">
                  v{node.version}
                </span>
              )}
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            <div>First seen: {formatRelativeTime(new Date(node.firstSeen))}</div>
            {node.lastSeen && (
              <div>Last seen: {formatRelativeTime(new Date(node.lastSeen))}</div>
            )}
          </div>
        </div>
      </div>

      {/* Gauges */}
      {latestMetric && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card p-6 flex flex-col items-center">
            <MetricGauge
              value={latestMetric.cpuPercent ?? 0}
              label="CPU Usage"
              size="md"
            />
          </div>
          <div className="card p-6 flex flex-col items-center">
            <MetricGauge
              value={ramPercent}
              label="RAM Usage"
              size="md"
            />
          </div>
          <div className="card p-6 flex flex-col items-center justify-center text-center">
            <div className="text-3xl font-bold">{formatBytes(latestMetric.fileSize ?? 0)}</div>
            <div className="text-sm text-muted-foreground mt-2">Storage Used</div>
          </div>
          <div className="card p-6 flex flex-col items-center justify-center text-center">
            <div className="text-3xl font-bold">{formatUptime(latestMetric.uptime ?? 0)}</div>
            <div className="text-sm text-muted-foreground mt-2">Uptime</div>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      {latestMetric && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Active Streams"
            value={formatNumber(latestMetric.activeStreams ?? 0)}
            icon={<StreamIcon />}
          />
          <MetricCard
            title="Packets Received"
            value={formatNumber(latestMetric.packetsReceived ?? 0)}
            icon={<InboxIcon />}
          />
          <MetricCard
            title="Packets Sent"
            value={formatNumber(latestMetric.packetsSent ?? 0)}
            icon={<OutboxIcon />}
          />
          <MetricCard
            title="Total Pages"
            value={formatNumber(latestMetric.totalPages ?? 0)}
            icon={<PageIcon />}
          />
        </div>
      )}

      {/* Charts */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Historical Metrics</h2>
          <RangeSelector
            value={timeRange}
            onChange={(v) => setTimeRange(v as TimeRange)}
            options={rangeOptions}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h3 className="text-sm font-medium mb-4">CPU Usage</h3>
            <TimeSeriesChart
              data={cpuChartData}
              label="CPU %"
              formatValue={(v) => `${v.toFixed(0)}%`}
              height={200}
            />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-4">RAM Usage</h3>
            <TimeSeriesChart
              data={ramChartData}
              label="RAM %"
              formatValue={(v) => `${v.toFixed(0)}%`}
              height={200}
            />
          </div>
        </div>
      </div>

      {/* Peers */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Peer Connections</h2>
          <span className="text-sm text-muted-foreground">
            {peers?.length || 0} peers
          </span>
        </div>
        <PeerList peers={peers || []} isLoading={peersLoading} />
      </div>
    </div>
  );
}

function NodeDetailSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="card p-6">
        <div className="h-8 bg-muted rounded w-48 mb-4" />
        <div className="h-4 bg-muted rounded w-96 mb-4" />
        <div className="flex gap-2">
          <div className="h-6 bg-muted rounded w-16" />
          <div className="h-6 bg-muted rounded w-16" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-6 h-40" />
        ))}
      </div>

      <div className="card p-6 h-80" />
    </div>
  );
}

// Simple icon components
function StreamIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  );
}

function OutboxIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function PageIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
