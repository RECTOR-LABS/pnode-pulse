"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";

export function GraveyardStats() {
  const { data, isLoading } = trpc.analytics.graveyard.stats.useQuery(
    undefined,
    { refetchInterval: 60000 } // Refresh every minute
  );

  if (isLoading) {
    return <GraveyardStatsSkeleton />;
  }

  if (!data) {
    return null;
  }

  return (
    <Link
      href="/graveyard"
      className="card p-4 hover:border-brand-500/50 transition-colors group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-2xl">👻</div>
          <div>
            <div className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              Network History
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{data.totalEver}</span>
              <span className="text-sm text-muted-foreground">total ever</span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-green-600 dark:text-green-400 font-medium">
                {data.active}
              </span>
              <span className="text-muted-foreground ml-1">active</span>
            </div>
            <div>
              <span className="text-gray-500 font-medium">{data.archived}</span>
              <span className="text-muted-foreground ml-1">archived</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {data.survivalRate}% survival rate
          </div>
        </div>
      </div>
    </Link>
  );
}

function GraveyardStatsSkeleton() {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-muted rounded animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            <div className="h-6 w-16 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
          <div className="h-3 w-24 bg-muted rounded animate-pulse ml-auto" />
        </div>
      </div>
    </div>
  );
}
