"use client";

import { use, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

interface NodeData {
  id: number;
  address: string;
  pubkey: string | null;
  version: string | null;
  isActive: boolean;
  lastSeen: string | null;
  metrics: {
    cpuPercent: number | null;
    ramPercent: number;
    storageBytes: number;
    uptimeSeconds: number | null;
    timestamp: string;
  } | null;
}

interface Props {
  params: Promise<{ id: string }>;
}

function formatUptime(seconds: number): string {
  if (!seconds) return "0s";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(1)} ${units[i]}`;
}

export default function EmbedNodePage({ params }: Props) {
  const { id } = use(params);
  const searchParams = useSearchParams();

  const [node, setNode] = useState<NodeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Get customization params
  const theme = searchParams.get("theme") || "light";
  const showMetrics = searchParams.get("metrics") !== "false";
  const showStatus = searchParams.get("status") !== "false";
  const compact = searchParams.get("compact") === "true";

  useEffect(() => {
    const fetchNode = async () => {
      try {
        const response = await fetch(`/api/v1/nodes/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("Node not found");
          } else {
            setError("Failed to load node data");
          }
          return;
        }
        const data = await response.json();
        setNode(data);
      } catch {
        setError("Failed to load node data");
      } finally {
        setLoading(false);
      }
    };

    fetchNode();

    // Refresh every 30 seconds
    const interval = setInterval(fetchNode, 30000);
    return () => clearInterval(interval);
  }, [id]);

  // Apply theme
  const bgColor = theme === "dark" ? "bg-gray-900" : "bg-white";
  const textColor = theme === "dark" ? "text-white" : "text-gray-900";
  const mutedColor = theme === "dark" ? "text-gray-400" : "text-gray-500";
  const borderColor = theme === "dark" ? "border-gray-700" : "border-gray-200";
  const activeColor = theme === "dark" ? "bg-green-500/20 text-green-400" : "bg-green-100 text-green-700";
  const inactiveColor = theme === "dark" ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-700";
  const cardBg = theme === "dark" ? "bg-gray-800" : "bg-gray-50";

  if (loading) {
    return (
      <div className={`min-h-screen ${bgColor} ${textColor} flex items-center justify-center`}>
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen ${bgColor} ${textColor} flex items-center justify-center p-4`}>
        <div className="text-center">
          <div className="text-lg font-medium">{error}</div>
          <a
            href="https://pulse.rectorspace.com"
            target="_blank"
            rel="noopener"
            className={`text-sm ${mutedColor} hover:underline mt-2 block`}
          >
            pNode Pulse
          </a>
        </div>
      </div>
    );
  }

  if (!node) return null;

  if (compact) {
    return (
      <div className={`${bgColor} ${textColor} p-3 rounded-lg border ${borderColor}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            {showStatus && (
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  node.isActive ? "bg-green-500" : "bg-red-500"
                }`}
              />
            )}
            <span className="font-mono text-sm truncate">{node.address}</span>
          </div>
          {node.metrics && showMetrics && (
            <div className={`flex gap-3 text-xs ${mutedColor}`}>
              <span>CPU {node.metrics.cpuPercent?.toFixed(1) ?? "N/A"}%</span>
              <span>RAM {node.metrics.ramPercent.toFixed(1)}%</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${bgColor} ${textColor} p-4 rounded-xl border ${borderColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <span className="text-blue-500 font-bold text-lg">P</span>
          </div>
          <div>
            <div className="font-mono text-sm">{node.address}</div>
            {node.version && (
              <div className={`text-xs ${mutedColor}`}>v{node.version}</div>
            )}
          </div>
        </div>
        {showStatus && (
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              node.isActive ? activeColor : inactiveColor
            }`}
          >
            {node.isActive ? "Online" : "Offline"}
          </span>
        )}
      </div>

      {/* Metrics */}
      {node.metrics && showMetrics && (
        <div className="grid grid-cols-2 gap-3">
          <div className={`${cardBg} rounded-lg p-3`}>
            <div className={`text-xs ${mutedColor} mb-1`}>CPU Usage</div>
            <div className="text-lg font-medium">
              {node.metrics.cpuPercent?.toFixed(1) ?? "N/A"}%
            </div>
          </div>
          <div className={`${cardBg} rounded-lg p-3`}>
            <div className={`text-xs ${mutedColor} mb-1`}>RAM Usage</div>
            <div className="text-lg font-medium">
              {node.metrics.ramPercent.toFixed(1)}%
            </div>
          </div>
          <div className={`${cardBg} rounded-lg p-3`}>
            <div className={`text-xs ${mutedColor} mb-1`}>Storage</div>
            <div className="text-lg font-medium">
              {formatBytes(node.metrics.storageBytes)}
            </div>
          </div>
          <div className={`${cardBg} rounded-lg p-3`}>
            <div className={`text-xs ${mutedColor} mb-1`}>Uptime</div>
            <div className="text-lg font-medium">
              {formatUptime(node.metrics.uptimeSeconds ?? 0)}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className={`mt-4 pt-3 border-t ${borderColor} flex items-center justify-between text-xs ${mutedColor}`}>
        <span>
          {node.lastSeen
            ? `Updated ${new Date(node.lastSeen).toLocaleTimeString()}`
            : "Never seen"}
        </span>
        <a
          href={`https://pulse.rectorspace.com/nodes/${node.id}`}
          target="_blank"
          rel="noopener"
          className="hover:underline"
        >
          View on pNode Pulse
        </a>
      </div>
    </div>
  );
}
