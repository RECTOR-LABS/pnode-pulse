"use client";

import { formatRelativeTime } from "@/lib/utils/format";

interface CollectionJob {
  id: number;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  nodesPolled: number | null;
  nodesSuccess: number | null;
  nodesFailed: number | null;
}

interface CollectionStatusProps {
  latest: CollectionJob | null;
  recent: CollectionJob[];
}

export function CollectionStatus({ latest, recent }: CollectionStatusProps) {
  if (!latest) {
    return (
      <div className="text-muted-foreground text-sm text-center py-8">
        No collection data available. Start the collector to begin gathering data.
      </div>
    );
  }

  const successRate = latest.nodesPolled && latest.nodesSuccess
    ? ((latest.nodesSuccess / latest.nodesPolled) * 100).toFixed(1)
    : null;

  return (
    <div className="space-y-4">
      {/* Latest collection */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${
            latest.status === "COMPLETED" ? "bg-status-active" :
            latest.status === "RUNNING" ? "bg-status-warning animate-pulse" :
            "bg-status-inactive"
          }`} />
          <div>
            <div className="text-sm font-medium">
              {latest.status === "COMPLETED" ? "Last Collection" :
               latest.status === "RUNNING" ? "Collection in Progress" :
               "Collection Failed"}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatRelativeTime(new Date(latest.startedAt))}
            </div>
          </div>
        </div>

        {latest.status === "COMPLETED" && (
          <div className="text-right">
            <div className="text-sm font-medium">{successRate}% success</div>
            <div className="text-xs text-muted-foreground">
              {latest.nodesSuccess}/{latest.nodesPolled} nodes
            </div>
          </div>
        )}
      </div>

      {/* Recent jobs mini chart */}
      <div className="flex gap-1 h-8">
        {recent.slice(0, 12).reverse().map((job) => {
          const height = job.nodesPolled && job.nodesSuccess
            ? (job.nodesSuccess / job.nodesPolled) * 100
            : 0;

          return (
            <div
              key={job.id}
              className="flex-1 bg-muted rounded-sm overflow-hidden flex flex-col justify-end"
              title={`${new Date(job.startedAt).toLocaleString()}: ${job.nodesSuccess}/${job.nodesPolled}`}
            >
              <div
                className={`${
                  job.status === "COMPLETED" ? "bg-brand-500" :
                  job.status === "FAILED" ? "bg-status-inactive" :
                  "bg-status-warning"
                } transition-all duration-300`}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
