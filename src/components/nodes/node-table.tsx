"use client";

import { useRouter } from "next/navigation";
import { formatBytes, formatUptime, formatPercent, formatRelativeTime, formatAddress } from "@/lib/utils/format";
import { BookmarkButton } from "@/components/ui/bookmark-button";

interface NodeMetric {
  cpuPercent: number;
  ramPercent: number;
  fileSize: bigint;
  uptime: number;
}

interface Node {
  id: number;
  address: string;
  pubkey: string | null;
  version: string | null;
  isActive: boolean;
  lastSeen: Date | null;
  firstSeen: Date;
  latestMetric: NodeMetric | null;
}

interface NodeTableProps {
  nodes: Node[];
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSort: (column: string) => void;
  isLoading?: boolean;
}

type SortColumn = "isActive" | "address" | "version" | "cpu" | "ram" | "storage" | "uptime" | "lastSeen";

const columns: { key: SortColumn; label: string; sortable: boolean }[] = [
  { key: "isActive", label: "Status", sortable: true },
  { key: "address", label: "Address", sortable: true },
  { key: "version", label: "Version", sortable: true },
  { key: "cpu", label: "CPU", sortable: false },
  { key: "ram", label: "RAM", sortable: false },
  { key: "storage", label: "Storage", sortable: false },
  { key: "uptime", label: "Uptime", sortable: false },
  { key: "lastSeen", label: "Last Seen", sortable: true },
];

export function NodeTable({ nodes, sortBy, sortOrder, onSort, isLoading }: NodeTableProps) {
  const router = useRouter();

  const handleRowClick = (nodeId: number) => {
    router.push(`/nodes/${nodeId}`);
  };

  const handleCopyAddress = (e: React.MouseEvent, address: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(formatAddress(address));
  };

  if (isLoading) {
    return <NodeTableSkeleton />;
  }

  if (nodes.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
          <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2">No Nodes Found</h2>
        <p className="text-muted-foreground">
          Try adjusting your search or filter criteria
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    onClick={() => column.sortable && onSort(column.key)}
                    className={`px-4 py-3 text-left text-sm font-medium text-muted-foreground ${
                      column.sortable ? "cursor-pointer hover:text-foreground" : ""
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      {column.label}
                      {column.sortable && sortBy === column.key && (
                        <svg
                          className={`w-4 h-4 transition-transform ${sortOrder === "desc" ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 w-10" title="Favorites"></th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {nodes.map((node) => (
                <tr
                  key={node.id}
                  onClick={() => handleRowClick(node.id)}
                  className="hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className={`status-badge status-badge-${node.isActive ? "active" : "inactive"}`}>
                      {node.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{formatAddress(node.address)}</span>
                      <button
                        onClick={(e) => handleCopyAddress(e, node.address)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Copy IP address"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-muted-foreground">
                      {node.version || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {node.latestMetric ? (
                      <span className={node.latestMetric.cpuPercent > 80 ? "text-status-warning" : ""}>
                        {formatPercent(node.latestMetric.cpuPercent)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {node.latestMetric ? (
                      <span className={node.latestMetric.ramPercent > 80 ? "text-status-warning" : ""}>
                        {formatPercent(node.latestMetric.ramPercent)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {node.latestMetric ? (
                      <span>{formatBytes(node.latestMetric.fileSize)}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {node.latestMetric ? (
                      <span>{formatUptime(node.latestMetric.uptime)}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-sm">
                    {node.lastSeen ? formatRelativeTime(new Date(node.lastSeen)) : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <BookmarkButton nodeId={node.id} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {nodes.map((node) => (
          <div
            key={node.id}
            onClick={() => handleRowClick(node.id)}
            className="card p-4 cursor-pointer hover:border-brand-500/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">{formatAddress(node.address)}</span>
                  <button
                    onClick={(e) => handleCopyAddress(e, node.address)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {node.version || "Unknown version"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <BookmarkButton nodeId={node.id} size="sm" />
                <span className={`status-badge status-badge-${node.isActive ? "active" : "inactive"}`}>
                  {node.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            {node.latestMetric && (
              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                <div>
                  <div className="font-medium">{formatPercent(node.latestMetric.cpuPercent, 0)}</div>
                  <div className="text-xs text-muted-foreground">CPU</div>
                </div>
                <div>
                  <div className="font-medium">{formatPercent(node.latestMetric.ramPercent, 0)}</div>
                  <div className="text-xs text-muted-foreground">RAM</div>
                </div>
                <div>
                  <div className="font-medium">{formatBytes(node.latestMetric.fileSize)}</div>
                  <div className="text-xs text-muted-foreground">Storage</div>
                </div>
                <div>
                  <div className="font-medium">{formatUptime(node.latestMetric.uptime)}</div>
                  <div className="text-xs text-muted-foreground">Uptime</div>
                </div>
              </div>
            )}

            {node.lastSeen && (
              <div className="text-xs text-muted-foreground mt-3 text-right">
                Last seen {formatRelativeTime(new Date(node.lastSeen))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function NodeTableSkeleton() {
  return (
    <div className="card overflow-hidden animate-pulse">
      <div className="bg-muted/50 px-4 py-3">
        <div className="h-4 bg-muted rounded w-full" />
      </div>
      <div className="divide-y divide-border">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="px-4 py-4 flex gap-4">
            <div className="h-4 bg-muted rounded w-16" />
            <div className="h-4 bg-muted rounded w-32" />
            <div className="h-4 bg-muted rounded w-16" />
            <div className="h-4 bg-muted rounded w-12" />
            <div className="h-4 bg-muted rounded w-12" />
            <div className="h-4 bg-muted rounded w-16" />
            <div className="h-4 bg-muted rounded w-12" />
            <div className="h-4 bg-muted rounded w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
