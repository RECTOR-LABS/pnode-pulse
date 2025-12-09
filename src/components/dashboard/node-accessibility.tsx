"use client";

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, Lock, HelpCircle } from "lucide-react";
import { formatNumber } from "@/lib/utils/format";

export function NodeAccessibility() {
  const { data, isLoading } = trpc.analytics.nodeAccessibility.useQuery(
    undefined,
    { refetchInterval: 30000 } // Refresh every 30s
  );

  if (isLoading) {
    return <NodeAccessibilitySkeleton />;
  }

  if (!data || data.total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Node Accessibility</CardTitle>
          <CardDescription>No data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const publicPercent = (data.publicNodes / data.total) * 100;
  const privatePercent = (data.privateNodes / data.total) * 100;
  const unknownPercent = (data.unknownNodes / data.total) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Node Accessibility</CardTitle>
        <CardDescription>
          RPC port accessibility across {formatNumber(data.total)} active nodes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Public Nodes */}
        <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <Globe className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="font-semibold">Public RPC</div>
              <div className="text-sm text-muted-foreground">
                Publicly queryable
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{formatNumber(data.publicNodes)}</div>
            <div className="text-sm text-muted-foreground">
              {publicPercent.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Private Nodes */}
        <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-900">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
              <Lock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <div className="font-semibold">Private RPC</div>
              <div className="text-sm text-muted-foreground">
                Not publicly accessible
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{formatNumber(data.privateNodes)}</div>
            <div className="text-sm text-muted-foreground">
              {privatePercent.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Unknown Nodes */}
        {data.unknownNodes > 0 && (
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-950/20 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 dark:bg-gray-900 rounded-lg">
                <HelpCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <div className="font-semibold">Unknown</div>
                <div className="text-sm text-muted-foreground">
                  Legacy nodes (pre-v0.7.0)
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{formatNumber(data.unknownNodes)}</div>
              <div className="text-sm text-muted-foreground">
                {unknownPercent.toFixed(1)}%
              </div>
            </div>
          </div>
        )}

        {/* Info Note */}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          <strong>Note:</strong> Private nodes are still active and serving the network.
          They don&apos;t answer public RPC queries to save resources.
        </div>
      </CardContent>
    </Card>
  );
}

function NodeAccessibilitySkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Node Accessibility</CardTitle>
        <CardDescription>Loading...</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 animate-pulse">
          <div className="h-20 bg-muted rounded-lg" />
          <div className="h-20 bg-muted rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}
