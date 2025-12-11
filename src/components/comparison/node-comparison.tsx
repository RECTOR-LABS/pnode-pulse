"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "-";
  const gb = bytes / 1e9;
  return `${gb.toFixed(1)} GB`;
}

function formatUptime(seconds: number | null): string {
  if (seconds === null) return "-";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

export function NodeComparison() {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const { data: searchResults } = trpc.comparison.searchNodes.useQuery(
    { query: searchQuery, excludeIds: selectedIds, limit: 10 },
    { enabled: searchQuery.length >= 2 }
  );

  const { data: comparison, isLoading } = trpc.comparison.compareNodes.useQuery(
    { nodeIds: selectedIds },
    { enabled: selectedIds.length >= 2 }
  );

  const addNode = (id: number) => {
    if (selectedIds.length < 4 && !selectedIds.includes(id)) {
      setSelectedIds([...selectedIds, id]);
    }
    setSearchQuery("");
    setIsSearching(false);
  };

  const removeNode = (id: number) => {
    setSelectedIds(selectedIds.filter((i) => i !== id));
  };

  const isBestValue = (nodeId: number, metric: string, value: number | null) => {
    if (!comparison || value === null) return false;
    const best = comparison.bestValues[metric as keyof typeof comparison.bestValues];
    if (best === undefined || best === null) return false;

    // Lower is better for cpu/ram, higher is better for storage/uptime
    if (metric === "cpu" || metric === "ram") {
      return value === best && value !== Infinity;
    }
    return value === best && value !== 0;
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h3 className="font-medium mb-1">Side-by-Side Comparison</h3>
        <p className="text-sm text-muted-foreground">
          Compare up to 4 nodes to identify performance differences
        </p>
      </div>

      {/* Node Selector */}
      <div className="p-4 border-b border-border">
        <div className="flex flex-wrap gap-2 mb-3">
          {selectedIds.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              Add at least 2 nodes to compare
            </span>
          ) : (
            comparison?.nodes.map((node) => (
              <div
                key={node.id}
                className="flex items-center gap-2 px-3 py-1 bg-muted rounded-full"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    node.isActive ? "bg-status-active" : "bg-status-inactive"
                  }`}
                />
                <span className="text-sm font-mono">
                  {node.address.split(":")[0]}
                </span>
                <button
                  onClick={() => removeNode(node.id)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        {selectedIds.length < 4 && (
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearching(true);
              }}
              onFocus={() => setIsSearching(true)}
              placeholder="Search by IP or pubkey..."
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
            />
            {isSearching && searchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                {searchResults.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => addNode(node.id)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          node.isActive ? "bg-status-active" : "bg-status-inactive"
                        }`}
                      />
                      <span className="font-mono text-sm">
                        {node.address.split(":")[0]}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      v{node.version}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Comparison Table */}
      {isLoading ? (
        <div className="p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full mx-auto" />
          <p className="mt-2 text-sm text-muted-foreground">Loading comparison...</p>
        </div>
      ) : comparison ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-muted-foreground font-medium">
                  Metric
                </th>
                {comparison.nodes.map((node) => (
                  <th
                    key={node.id}
                    className="px-4 py-3 text-center font-medium"
                  >
                    <div className="flex flex-col items-center">
                      <span className="font-mono">
                        {node.address.split(":")[0]}
                      </span>
                      <span
                        className={`text-xs ${
                          node.isActive
                            ? "text-status-active"
                            : "text-status-inactive"
                        }`}
                      >
                        {node.isActive ? "Online" : "Offline"}
                      </span>
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-muted-foreground font-medium">
                  Network Avg
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {/* Version */}
              <tr>
                <td className="px-4 py-3 text-muted-foreground">Version</td>
                {comparison.nodes.map((node) => (
                  <td
                    key={node.id}
                    className={`px-4 py-3 text-center ${
                      node.version === comparison.networkAvg.latestVersion
                        ? "text-status-active font-medium"
                        : ""
                    }`}
                  >
                    v{node.version || "-"}
                  </td>
                ))}
                <td className="px-4 py-3 text-center text-muted-foreground">
                  v{comparison.networkAvg.latestVersion || "-"}
                </td>
              </tr>

              {/* CPU */}
              <tr>
                <td className="px-4 py-3 text-muted-foreground">CPU Usage</td>
                {comparison.nodes.map((node) => (
                  <td
                    key={node.id}
                    className={`px-4 py-3 text-center ${
                      isBestValue(node.id, "cpu", node.metrics.cpu)
                        ? "text-status-active font-medium"
                        : ""
                    }`}
                  >
                    {node.metrics.cpu !== null
                      ? `${node.metrics.cpu.toFixed(1)}%`
                      : "-"}
                  </td>
                ))}
                <td className="px-4 py-3 text-center text-muted-foreground">
                  {comparison.networkAvg.cpu.toFixed(1)}%
                </td>
              </tr>

              {/* RAM */}
              <tr>
                <td className="px-4 py-3 text-muted-foreground">RAM Usage</td>
                {comparison.nodes.map((node) => (
                  <td
                    key={node.id}
                    className={`px-4 py-3 text-center ${
                      isBestValue(node.id, "ram", node.metrics.ram)
                        ? "text-status-active font-medium"
                        : ""
                    }`}
                  >
                    {node.metrics.ram !== null
                      ? `${node.metrics.ram.toFixed(1)}%`
                      : "-"}
                  </td>
                ))}
                <td className="px-4 py-3 text-center text-muted-foreground">
                  {comparison.networkAvg.ram.toFixed(1)}%
                </td>
              </tr>

              {/* Storage */}
              <tr>
                <td className="px-4 py-3 text-muted-foreground">Storage</td>
                {comparison.nodes.map((node) => (
                  <td
                    key={node.id}
                    className={`px-4 py-3 text-center ${
                      isBestValue(node.id, "storage", node.metrics.storage)
                        ? "text-status-active font-medium"
                        : ""
                    }`}
                  >
                    {formatBytes(node.metrics.storage)}
                  </td>
                ))}
                <td className="px-4 py-3 text-center text-muted-foreground">
                  {formatBytes(comparison.networkAvg.storage)}
                </td>
              </tr>

              {/* Uptime */}
              <tr>
                <td className="px-4 py-3 text-muted-foreground">Uptime</td>
                {comparison.nodes.map((node) => (
                  <td
                    key={node.id}
                    className={`px-4 py-3 text-center ${
                      isBestValue(node.id, "uptime", node.metrics.uptime)
                        ? "text-status-active font-medium"
                        : ""
                    }`}
                  >
                    {formatUptime(node.metrics.uptime)}
                  </td>
                ))}
                <td className="px-4 py-3 text-center text-muted-foreground">
                  {formatUptime(comparison.networkAvg.uptime)}
                </td>
              </tr>

              {/* Packets */}
              <tr>
                <td className="px-4 py-3 text-muted-foreground">
                  Packets (Rx/Tx)
                </td>
                {comparison.nodes.map((node) => (
                  <td key={node.id} className="px-4 py-3 text-center">
                    {node.metrics.packetsReceived !== null
                      ? `${node.metrics.packetsReceived.toLocaleString()} / ${(
                          node.metrics.packetsSent ?? 0
                        ).toLocaleString()}`
                      : "-"}
                  </td>
                ))}
                <td className="px-4 py-3 text-center text-muted-foreground">
                  -
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : selectedIds.length < 2 ? (
        <div className="p-8 text-center text-muted-foreground">
          <svg
            className="w-12 h-12 mx-auto mb-3 opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p>Select at least 2 nodes to compare</p>
        </div>
      ) : null}
    </div>
  );
}
