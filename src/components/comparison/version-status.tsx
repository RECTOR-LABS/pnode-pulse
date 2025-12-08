"use client";

import { trpc } from "@/lib/trpc";
import { useSession } from "@/lib/hooks/use-session";

type ViewMode = "portfolio" | "network";

interface VersionStatusProps {
  mode?: ViewMode;
}

interface VersionInfo {
  count: number;
  percent: number;
}

interface NodeUpdate {
  id: number;
  address: string;
  currentVersion: string;
  latestVersion: string;
  isActive: boolean;
}

export function VersionStatus({ mode = "portfolio" }: VersionStatusProps) {
  const sessionId = useSession();

  const { data: portfolioVersion, isLoading: portfolioLoading } =
    trpc.comparison.portfolioVersionStatus.useQuery(
      { sessionId: sessionId! },
      { enabled: !!sessionId && mode === "portfolio" }
    );

  const { data: networkVersion, isLoading: networkLoading } =
    trpc.comparison.versionStatus.useQuery(undefined, {
      enabled: mode === "network",
    });

  const isLoading = mode === "portfolio" ? portfolioLoading : networkLoading;

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 animate-pulse">
        <div className="h-5 bg-muted rounded w-40 mb-3" />
        <div className="h-8 bg-muted rounded w-24 mb-4" />
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-3/4" />
        </div>
      </div>
    );
  }

  // Portfolio mode
  if (mode === "portfolio") {
    if (!portfolioVersion) {
      return (
        <div className="bg-card border border-border rounded-lg p-4 text-center text-muted-foreground">
          <p>No version data available</p>
        </div>
      );
    }

    const allOnLatest = portfolioVersion.nodesNeedingUpdate.length === 0;

    return (
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Version Status</h3>
            {portfolioVersion.latestVersion && (
              <span className="px-2 py-1 bg-brand-500/10 text-brand-600 dark:text-brand-400 text-xs font-medium rounded">
                Latest: v{portfolioVersion.latestVersion}
              </span>
            )}
          </div>
        </div>

        <div className="p-4">
          {allOnLatest ? (
            <div className="flex items-center gap-2 text-status-active mb-4">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">All nodes on latest version</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-status-warning mb-4">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium">
                {portfolioVersion.nodesNeedingUpdate.length} node{portfolioVersion.nodesNeedingUpdate.length > 1 ? "s" : ""} need updates
              </span>
            </div>
          )}

          {portfolioVersion.nodesNeedingUpdate.length > 0 && (
            <NodesNeedingUpdateList nodes={portfolioVersion.nodesNeedingUpdate} />
          )}
        </div>
      </div>
    );
  }

  // Network mode
  if (!networkVersion) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 text-center text-muted-foreground">
        <p>No version data available</p>
      </div>
    );
  }

  const allOnLatest = networkVersion.nodesNeedingUpdate.length === 0;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Version Status</h3>
          {networkVersion.latestVersion && (
            <span className="px-2 py-1 bg-brand-500/10 text-brand-600 dark:text-brand-400 text-xs font-medium rounded">
              Latest: v{networkVersion.latestVersion}
            </span>
          )}
        </div>
      </div>

      <div className="p-4">
        {allOnLatest ? (
          <div className="flex items-center gap-2 text-status-active mb-4">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">All nodes on latest version</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-status-warning mb-4">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-medium">
              {networkVersion.nodesNeedingUpdate.length} node{networkVersion.nodesNeedingUpdate.length > 1 ? "s" : ""} need updates
            </span>
          </div>
        )}

        {/* Version Distribution */}
        {networkVersion.versionDistribution && (
          <VersionDistribution
            distribution={networkVersion.versionDistribution}
            latestVersion={networkVersion.latestVersion}
          />
        )}

        {networkVersion.nodesNeedingUpdate.length > 0 && (
          <NodesNeedingUpdateList nodes={networkVersion.nodesNeedingUpdate} />
        )}
      </div>
    </div>
  );
}

function VersionDistribution({
  distribution,
  latestVersion,
}: {
  distribution: Record<string, VersionInfo>;
  latestVersion: string | null;
}) {
  const sortedVersions = Object.entries(distribution).sort(([a], [b]) => {
    const aParts = a.split(".").map(Number);
    const bParts = b.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      if ((aParts[i] || 0) !== (bParts[i] || 0)) {
        return (bParts[i] || 0) - (aParts[i] || 0);
      }
    }
    return 0;
  });

  return (
    <div className="space-y-2 mb-4">
      <p className="text-sm text-muted-foreground mb-2">Version Distribution</p>
      {sortedVersions.map(([version, info]) => (
        <div key={version} className="flex items-center gap-2">
          <span className="text-sm font-mono w-16">v{version}</span>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full ${
                version === latestVersion ? "bg-status-active" : "bg-status-warning"
              }`}
              style={{ width: `${info.percent}%` }}
            />
          </div>
          <span className="text-sm text-muted-foreground w-16 text-right">
            {info.count} ({info.percent}%)
          </span>
        </div>
      ))}
    </div>
  );
}

function NodesNeedingUpdateList({ nodes }: { nodes: NodeUpdate[] }) {
  return (
    <div className="mt-4">
      <p className="text-sm text-muted-foreground mb-2">Nodes Needing Update</p>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {nodes.slice(0, 5).map((node) => (
          <div
            key={node.id}
            className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded"
          >
            <span className="font-mono">{node.address.split(":")[0]}</span>
            <span className="text-muted-foreground">
              v{node.currentVersion} → v{node.latestVersion}
            </span>
          </div>
        ))}
        {nodes.length > 5 && (
          <p className="text-xs text-muted-foreground text-center py-1">
            +{nodes.length - 5} more
          </p>
        )}
      </div>
    </div>
  );
}
