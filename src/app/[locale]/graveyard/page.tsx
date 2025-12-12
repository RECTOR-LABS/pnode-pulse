"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  formatAddress,
  formatRelativeTime,
  formatBytes,
  formatUptime,
  formatVersion,
} from "@/lib/utils/format";
import Link from "next/link";

type OrderBy = "lastSeen" | "firstSeen" | "version";
type Order = "asc" | "desc";

export default function GraveyardPage() {
  const [orderBy, setOrderBy] = useState<OrderBy>("lastSeen");
  const [order, setOrder] = useState<Order>("desc");
  const [versionFilter, setVersionFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 25;

  const { data: stats, isLoading: statsLoading } =
    trpc.analytics.graveyard.stats.useQuery();

  const { data: churn } = trpc.analytics.graveyard.churn.useQuery({
    range: "30d",
  });

  const { data: nodes, isLoading: nodesLoading } =
    trpc.analytics.graveyard.list.useQuery({
      limit,
      offset,
      orderBy,
      order,
      versionFilter: versionFilter || undefined,
    });

  const toggleSort = (field: OrderBy) => {
    if (orderBy === field) {
      setOrder(order === "desc" ? "asc" : "desc");
    } else {
      setOrderBy(field);
      setOrder("desc");
    }
    setOffset(0);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center py-8">
        <div className="text-6xl mb-4">👻</div>
        <h1 className="text-3xl font-bold mb-2">pNode Graveyard</h1>
        <p className="text-muted-foreground">
          Honoring nodes that served the network
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Ever"
          value={stats?.totalEver ?? 0}
          icon="📊"
          loading={statsLoading}
        />
        <StatCard
          label="Active"
          value={stats?.active ?? 0}
          icon="✅"
          className="text-green-600 dark:text-green-400"
          loading={statsLoading}
        />
        <StatCard
          label="Inactive"
          value={stats?.inactive ?? 0}
          icon="⏸️"
          className="text-yellow-600 dark:text-yellow-400"
          loading={statsLoading}
        />
        <StatCard
          label="Archived"
          value={stats?.archived ?? 0}
          icon="🪦"
          className="text-gray-500"
          loading={statsLoading}
        />
      </div>

      {/* Churn Stats */}
      {churn && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">30-Day Network Churn</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                +{churn.newJoins}
              </div>
              <div className="text-sm text-muted-foreground">New Joins</div>
            </div>
            <div className="text-center p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                -{churn.newlyArchived}
              </div>
              <div className="text-sm text-muted-foreground">Archived</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div
                className={`text-2xl font-bold ${
                  churn.netChange >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {churn.netChange >= 0 ? "+" : ""}
                {churn.netChange}
              </div>
              <div className="text-sm text-muted-foreground">Net Change</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{churn.churnRate}%</div>
              <div className="text-sm text-muted-foreground">Churn Rate</div>
            </div>
          </div>
        </div>
      )}

      {/* Survival Rate */}
      {stats && (
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Network Survival Rate</h2>
              <p className="text-sm text-muted-foreground">
                Percentage of nodes still active since first seen
              </p>
            </div>
            <div className="text-4xl font-bold text-brand-500">
              {stats.survivalRate}%
            </div>
          </div>
          <div className="mt-4 h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all"
              style={{ width: `${stats.survivalRate}%` }}
            />
          </div>
        </div>
      )}

      {/* Archived Nodes Table */}
      <div className="card p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>🪦</span>
            Archived Nodes
            {nodes && (
              <span className="text-sm font-normal text-muted-foreground">
                ({nodes.total} total)
              </span>
            )}
          </h2>

          {/* Version Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Version:</label>
            <input
              type="text"
              value={versionFilter}
              onChange={(e) => {
                setVersionFilter(e.target.value);
                setOffset(0);
              }}
              placeholder="e.g., 0.6"
              className="px-3 py-1.5 text-sm bg-muted rounded-md border-0 focus:ring-2 focus:ring-brand-500 w-32"
            />
          </div>
        </div>

        {nodesLoading ? (
          <TableSkeleton />
        ) : !nodes || nodes.nodes.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="text-4xl mb-4">🌱</div>
            <p>No archived nodes found</p>
            <p className="text-sm">All nodes are still active!</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      Node
                    </th>
                    <th
                      className="text-left py-3 px-4 font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                      onClick={() => toggleSort("version")}
                    >
                      Version{" "}
                      {orderBy === "version" && (order === "desc" ? "↓" : "↑")}
                    </th>
                    <th
                      className="text-left py-3 px-4 font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                      onClick={() => toggleSort("lastSeen")}
                    >
                      Last Seen{" "}
                      {orderBy === "lastSeen" && (order === "desc" ? "↓" : "↑")}
                    </th>
                    <th
                      className="text-left py-3 px-4 font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                      onClick={() => toggleSort("firstSeen")}
                    >
                      Lifetime{" "}
                      {orderBy === "firstSeen" &&
                        (order === "desc" ? "↓" : "↑")}
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      Last Uptime
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      Storage
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {nodes.nodes.map((node) => (
                    <tr
                      key={node.id}
                      className="border-b border-muted/50 hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <Link
                          href={`/nodes/${node.id}`}
                          className="hover:text-brand-500 transition-colors"
                        >
                          <div className="font-mono font-medium flex items-center gap-2">
                            <span className="opacity-50">🪦</span>
                            {formatAddress(node.address)}
                          </div>
                          {node.pubkey && (
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {node.pubkey.slice(0, 8)}...
                              {node.pubkey.slice(-8)}
                            </div>
                          )}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 text-xs rounded-full bg-muted">
                          {formatVersion(node.version)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {node.lastSeen
                          ? formatRelativeTime(new Date(node.lastSeen))
                          : "N/A"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-muted-foreground">
                          {node.lifetimeDays} days
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {formatUptime(node.lastMetric?.uptime)}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {formatBytes(node.lastMetric?.fileSize)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {offset + 1}-{Math.min(offset + limit, nodes.total)} of{" "}
                {nodes.total}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="px-3 py-1.5 text-sm bg-muted rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/80 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={!nodes.hasMore}
                  className="px-3 py-1.5 text-sm bg-muted rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/80 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Version Distribution */}
      {stats && stats.versionDistribution.length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">
            Archived by Version
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.versionDistribution.slice(0, 8).map((v) => (
              <div
                key={v.version}
                className="p-3 bg-muted/50 rounded-lg text-center"
              >
                <div className="text-lg font-bold">{v.count}</div>
                <div className="text-xs text-muted-foreground">
                  v{v.version}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  className = "",
  loading = false,
}: {
  label: string;
  value: number;
  icon: string;
  className?: string;
  loading?: boolean;
}) {
  return (
    <div className="card p-6 text-center">
      <div className="text-3xl mb-2">{icon}</div>
      {loading ? (
        <div className="h-8 bg-muted rounded animate-pulse w-16 mx-auto mb-1" />
      ) : (
        <div className={`text-2xl font-bold ${className}`}>{value}</div>
      )}
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-16 bg-muted rounded animate-pulse" />
      ))}
    </div>
  );
}
