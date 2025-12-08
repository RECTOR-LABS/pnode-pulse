"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

interface NetworkData {
  nodes: {
    total: number;
    active: number;
    inactive: number;
  };
  versions: Array<{
    version: string;
    count: number;
  }>;
  metrics: {
    totalStorageBytes: number;
    avgCpuPercent: number;
    avgRamPercent: number;
    avgUptimeSeconds: number;
    timestamp: string;
  };
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(1)} ${units[i]}`;
}

function formatUptime(seconds: number): string {
  if (!seconds) return "0";
  const days = Math.floor(seconds / 86400);
  if (days > 0) return `${days}d`;
  const hours = Math.floor(seconds / 3600);
  return `${hours}h`;
}

export default function EmbedNetworkPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<NetworkData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Get customization params
  const theme = (searchParams.get("theme") || "light") as "light" | "dark";
  const compact = searchParams.get("compact") === "true";
  const showVersions = searchParams.get("versions") !== "false";

  const bgColor = theme === "dark" ? "bg-gray-900" : "bg-white";
  const textColor = theme === "dark" ? "text-white" : "text-gray-900";
  const mutedColor = theme === "dark" ? "text-gray-400" : "text-gray-500";
  const borderColor = theme === "dark" ? "border-gray-700" : "border-gray-200";
  const cardBg = theme === "dark" ? "bg-gray-800" : "bg-gray-50";
  const activeColor = theme === "dark" ? "text-green-400" : "text-green-600";

  useEffect(() => {
    const fetchNetwork = async () => {
      try {
        const response = await fetch("/api/v1/network");
        if (!response.ok) {
          setError("Failed to load network data");
          return;
        }
        const result = await response.json();
        setData(result);
      } catch {
        setError("Failed to load network data");
      } finally {
        setLoading(false);
      }
    };

    fetchNetwork();

    // Refresh every 30 seconds
    const interval = setInterval(fetchNetwork, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className={`${bgColor} ${textColor} rounded-xl border ${borderColor} p-4 flex items-center justify-center`}>
        <div className="animate-pulse">Loading network data...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`${bgColor} ${textColor} rounded-xl border ${borderColor} p-4 text-center`}>
        <div className="text-sm">{error || "No data available"}</div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`${bgColor} ${textColor} rounded-lg border ${borderColor} p-3`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <span className="text-blue-500 font-bold">P</span>
            </div>
            <div>
              <div className="font-medium text-sm">pNode Network</div>
              <div className={`text-xs ${mutedColor}`}>
                {data.nodes.active} / {data.nodes.total} nodes active
              </div>
            </div>
          </div>
          <div className={`text-xs ${mutedColor}`}>
            {formatBytes(data.metrics.totalStorageBytes)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${bgColor} ${textColor} rounded-xl border ${borderColor} p-4`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
          <span className="text-blue-500 font-bold text-lg">P</span>
        </div>
        <div>
          <div className="font-semibold">pNode Network</div>
          <div className={`text-sm ${mutedColor}`}>Real-time statistics</div>
        </div>
      </div>

      {/* Node Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className={`${cardBg} rounded-lg p-3 text-center`}>
          <div className="text-2xl font-bold">{data.nodes.total}</div>
          <div className={`text-xs ${mutedColor}`}>Total Nodes</div>
        </div>
        <div className={`${cardBg} rounded-lg p-3 text-center`}>
          <div className={`text-2xl font-bold ${activeColor}`}>{data.nodes.active}</div>
          <div className={`text-xs ${mutedColor}`}>Active</div>
        </div>
        <div className={`${cardBg} rounded-lg p-3 text-center`}>
          <div className="text-2xl font-bold">{formatBytes(data.metrics.totalStorageBytes)}</div>
          <div className={`text-xs ${mutedColor}`}>Storage</div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`${cardBg} rounded-lg p-3`}>
          <div className={`text-xs ${mutedColor} mb-1`}>Avg CPU</div>
          <div className="font-medium">{data.metrics.avgCpuPercent.toFixed(1)}%</div>
        </div>
        <div className={`${cardBg} rounded-lg p-3`}>
          <div className={`text-xs ${mutedColor} mb-1`}>Avg RAM</div>
          <div className="font-medium">{data.metrics.avgRamPercent.toFixed(1)}%</div>
        </div>
        <div className={`${cardBg} rounded-lg p-3`}>
          <div className={`text-xs ${mutedColor} mb-1`}>Avg Uptime</div>
          <div className="font-medium">{formatUptime(data.metrics.avgUptimeSeconds)}</div>
        </div>
      </div>

      {/* Version Distribution */}
      {showVersions && data.versions.length > 0 && (
        <div className="mt-4">
          <div className={`text-xs ${mutedColor} mb-2`}>Version Distribution</div>
          <div className="flex gap-2 flex-wrap">
            {data.versions.slice(0, 4).map((v) => (
              <span
                key={v.version}
                className={`px-2 py-1 text-xs rounded ${cardBg}`}
              >
                v{v.version}: {v.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className={`mt-4 pt-3 border-t ${borderColor} flex items-center justify-between text-xs ${mutedColor}`}>
        <span>
          Updated {new Date(data.metrics.timestamp).toLocaleTimeString()}
        </span>
        <a
          href="https://pulse.rectorspace.com"
          target="_blank"
          rel="noopener"
          className="hover:underline"
        >
          pNode Pulse
        </a>
      </div>
    </div>
  );
}
