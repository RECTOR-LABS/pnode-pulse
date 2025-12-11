"use client";

import { trpc } from "@/lib/trpc";
import { useSession } from "@/lib/hooks/use-session";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

function getPercentileBadge(percentile: number): { label: string; color: string; icon: boolean } {
  if (percentile >= 90) return { label: "Top 10%", color: "text-yellow-500 bg-yellow-500/10", icon: true };
  if (percentile >= 75) return { label: "Top 25%", color: "text-status-active bg-status-active/10", icon: true };
  if (percentile >= 50) return { label: "Top 50%", color: "text-blue-500 bg-blue-500/10", icon: false };
  return { label: `Top ${100 - percentile}%`, color: "text-muted-foreground bg-muted", icon: false };
}

export function BenchmarkTable() {
  const sessionId = useSession();

  const { data: benchmark, isLoading } = trpc.portfolio.benchmark.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  if (!sessionId || isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-48" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!benchmark) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 text-center text-muted-foreground">
        <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p>Add nodes to your portfolio to see benchmarks</p>
      </div>
    );
  }

  const metrics = [
    {
      label: "CPU Usage",
      yourValue: `${benchmark.cpu.yourValue.toFixed(1)}%`,
      networkAvg: `${benchmark.cpu.networkAvg.toFixed(1)}%`,
      percentile: benchmark.cpu.percentile,
      lowerIsBetter: true,
    },
    {
      label: "RAM Usage",
      yourValue: `${benchmark.ram.yourValue.toFixed(1)}%`,
      networkAvg: `${benchmark.ram.networkAvg.toFixed(1)}%`,
      percentile: benchmark.ram.percentile,
      lowerIsBetter: true,
    },
    {
      label: "Storage",
      yourValue: formatBytes(benchmark.storage.yourValue),
      networkAvg: formatBytes(benchmark.storage.networkAvg),
      percentile: benchmark.storage.percentile,
      lowerIsBetter: false,
    },
    {
      label: "Uptime",
      yourValue: formatUptime(benchmark.uptime.yourValue),
      networkAvg: formatUptime(benchmark.uptime.networkAvg),
      percentile: benchmark.uptime.percentile,
      lowerIsBetter: false,
    },
  ];

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="font-medium">Performance Benchmark</h3>
        <p className="text-sm text-muted-foreground">
          Comparing your {benchmark.nodeCount} node{benchmark.nodeCount !== 1 ? "s" : ""} against {benchmark.networkNodeCount} network nodes
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Metric</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Your Nodes</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Network Avg</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Percentile</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric) => {
              const badge = getPercentileBadge(metric.percentile);
              return (
                <tr key={metric.label} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{metric.label}</td>
                  <td className="px-4 py-3 text-right font-mono">{metric.yourValue}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{metric.networkAvg}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
                      {badge.icon && (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      )}
                      {badge.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
