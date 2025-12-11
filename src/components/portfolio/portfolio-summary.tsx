"use client";

import { trpc } from "@/lib/trpc";
import { useSession } from "@/lib/hooks/use-session";

function formatBytes(bytes: bigint | number): string {
  const b = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (b === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  if (seconds === 0) return "0s";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function PortfolioSummary() {
  const sessionId = useSession();

  const { data: stats, isLoading } = trpc.portfolio.stats.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  if (!sessionId || isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-4 animate-pulse">
            <div className="h-8 bg-muted rounded w-16 mb-2" />
            <div className="h-4 bg-muted rounded w-24" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Total Nodes",
      value: stats?.totalNodes ?? 0,
      icon: "M5 12h14M12 5l7 7-7 7",
      color: "text-brand-500",
    },
    {
      label: "Active",
      value: stats?.activeNodes ?? 0,
      suffix: stats?.inactiveNodes ? ` / ${stats.inactiveNodes} offline` : "",
      icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
      color: stats?.activeNodes === stats?.totalNodes ? "text-status-active" : "text-status-warning",
    },
    {
      label: "Total Storage",
      value: stats ? formatBytes(stats.totalStorageBytes) : "0 B",
      icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
      color: "text-purple-500",
    },
    {
      label: "Avg Uptime",
      value: stats ? formatUptime(stats.avgUptimeSeconds) : "0s",
      icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
      color: "text-blue-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-card border border-border rounded-lg p-4"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-muted ${card.color}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {card.value}
                {card.suffix && (
                  <span className="text-sm font-normal text-muted-foreground">{card.suffix}</span>
                )}
              </p>
              <p className="text-sm text-muted-foreground">{card.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
