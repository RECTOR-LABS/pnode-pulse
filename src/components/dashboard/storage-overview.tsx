"use client";

import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Database } from "lucide-react";
import { formatBytes, formatPercent } from "@/lib/utils/format";

export function StorageOverview() {
  const { data, isLoading } = trpc.analytics.storageStats.useQuery(
    undefined,
    { refetchInterval: 30000 }, // Refresh every 30s
  );

  if (isLoading) {
    return <StorageOverviewSkeleton />;
  }

  if (!data || data.nodesWithStats === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Network Storage
          </CardTitle>
          <CardDescription>
            No storage data available yet (requires v0.7.0+ nodes)
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Network Storage
        </CardTitle>
        <CardDescription>
          Storage utilization across {data.nodesWithStats} nodes with v0.7.0+
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total Committed */}
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-sm text-muted-foreground">
              Total Committed
            </span>
            <span className="text-2xl font-bold">
              {formatBytes(data.totalCommitted)}
            </span>
          </div>
          <Progress value={100} className="h-2" />
        </div>

        {/* Total Used */}
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-sm text-muted-foreground">Total Used</span>
            <span className="text-2xl font-bold">
              {formatBytes(data.totalUsed)}
            </span>
          </div>
          <Progress
            value={
              data.totalCommitted > 0
                ? (data.totalUsed / data.totalCommitted) * 100
                : 0
            }
            className="h-2"
          />
        </div>

        {/* Average Usage */}
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-sm text-muted-foreground">Average Usage</span>
            <span className="text-2xl font-bold">
              {formatPercent(data.avgUsagePercent)}
            </span>
          </div>
          <Progress value={data.avgUsagePercent} className="h-2" />
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold">{data.nodesWithStats}</div>
            <div className="text-xs text-muted-foreground">
              With Storage Data
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {((data.nodesWithStats / data.totalNodes) * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-muted-foreground">
              v0.7.0+ Adoption
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StorageOverviewSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Network Storage
        </CardTitle>
        <CardDescription>Loading...</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 animate-pulse">
          <div className="h-16 bg-muted rounded" />
          <div className="h-16 bg-muted rounded" />
          <div className="h-16 bg-muted rounded" />
        </div>
      </CardContent>
    </Card>
  );
}
