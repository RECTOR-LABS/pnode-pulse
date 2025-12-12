"use client";

import { trpc } from "@/lib/trpc";
import { formatAddress, formatRelativeTime } from "@/lib/utils/format";
import Link from "next/link";

export function IpChangesWidget() {
  const { data, isLoading } = trpc.nodes.recentAddressChanges.useQuery(
    { limit: 5, range: "7d" },
    { refetchInterval: 60000 }
  );

  if (isLoading) {
    return <IpChangesWidgetSkeleton />;
  }

  if (!data || data.stats.totalChanges === 0) {
    return (
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">📍</span>
          <h3 className="font-medium">IP Changes (7d)</h3>
        </div>
        <div className="text-center py-4 text-muted-foreground text-sm">
          No IP changes detected
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📍</span>
          <h3 className="font-medium">IP Changes (7d)</h3>
        </div>
        <div className="text-sm text-muted-foreground">
          {data.stats.totalChanges} change{data.stats.totalChanges !== 1 ? "s" : ""} •{" "}
          {data.stats.uniqueNodes} node{data.stats.uniqueNodes !== 1 ? "s" : ""}
        </div>
      </div>

      <div className="space-y-2">
        {data.changes.slice(0, 3).map((change) => (
          <Link
            key={change.id}
            href={`/nodes/${change.nodeId}`}
            className="flex items-center gap-2 p-2 -mx-2 rounded hover:bg-muted/50 transition-colors text-sm"
          >
            <div className="flex items-center gap-1.5 font-mono text-xs flex-1 min-w-0">
              <span className="text-muted-foreground truncate">
                {formatAddress(change.oldAddress)}
              </span>
              <span className="text-muted-foreground">→</span>
              <span className="truncate">{formatAddress(change.newAddress)}</span>
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatRelativeTime(new Date(change.detectedAt))}
            </span>
          </Link>
        ))}
      </div>

      {data.stats.totalChanges > 3 && (
        <div className="mt-3 pt-3 border-t text-center">
          <span className="text-xs text-muted-foreground">
            +{data.stats.totalChanges - 3} more changes
          </span>
        </div>
      )}
    </div>
  );
}

function IpChangesWidgetSkeleton() {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 bg-muted rounded animate-pulse" />
        <div className="h-5 w-32 bg-muted rounded animate-pulse" />
      </div>
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-8 bg-muted rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}
