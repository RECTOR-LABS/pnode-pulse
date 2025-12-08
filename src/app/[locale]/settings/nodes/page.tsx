"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { trpc } from "@/lib/trpc/client";
import { formatRelativeTime, formatAddress } from "@/lib/utils/format";

export default function MyNodesPage() {
  const { user, token, isAuthenticated } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");

  const { data: claims, isLoading, refetch } = trpc.claims.list.useQuery(
    { userId: user?.id || "" },
    { enabled: !!user?.id }
  );

  const updateMutation = trpc.claims.updateDisplayName.useMutation({
    onSuccess: () => {
      setEditingId(null);
      refetch();
    },
  });

  const releaseMutation = trpc.claims.release.useMutation({
    onSuccess: () => refetch(),
  });

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold mb-4">My Nodes</h1>
        <p className="text-muted-foreground">
          Connect your wallet to view your claimed nodes.
        </p>
      </div>
    );
  }

  const verifiedClaims = claims?.filter((c) => c.status === "VERIFIED") || [];
  const pendingClaims = claims?.filter((c) => c.status === "PENDING") || [];

  const startEditing = (claim: typeof verifiedClaims[0]) => {
    setEditingId(claim.id);
    setDisplayName(claim.displayName || "");
  };

  const saveDisplayName = (claimId: string) => {
    if (!user) return;
    updateMutation.mutate({
      claimId,
      userId: user.id,
      displayName: displayName || null,
    });
  };

  const handleRelease = (claimId: string) => {
    if (!user) return;
    if (!confirm("Are you sure you want to release this claim? You will need to verify again to reclaim.")) {
      return;
    }
    releaseMutation.mutate({ claimId, userId: user.id });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">My Nodes</h1>
          <p className="text-muted-foreground">
            Manage nodes you have claimed ownership of
          </p>
        </div>
        <Link
          href="/nodes"
          className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
        >
          Find Nodes
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-border rounded-xl p-4 animate-pulse">
              <div className="h-5 bg-muted rounded w-1/3 mb-2" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Verified Claims */}
          {verifiedClaims.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Verified Nodes ({verifiedClaims.length})
              </h2>
              <div className="space-y-4">
                {verifiedClaims.map((claim) => (
                  <div key={claim.id} className="border border-border rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {editingId === claim.id ? (
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="text"
                              value={displayName}
                              onChange={(e) => setDisplayName(e.target.value)}
                              placeholder="Display name (optional)"
                              className="input flex-1"
                              autoFocus
                            />
                            <button
                              onClick={() => saveDisplayName(claim.id)}
                              className="px-3 py-1.5 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600"
                              disabled={updateMutation.isPending}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1.5 border border-border text-sm rounded-lg hover:bg-muted"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mb-2">
                            <Link
                              href={`/nodes/${claim.nodeId}`}
                              className="font-medium hover:text-brand-500 transition-colors"
                            >
                              {claim.displayName || (claim.node ? formatAddress(claim.node.address) : `Node #${claim.nodeId}`)}
                            </Link>
                            <button
                              onClick={() => startEditing(claim)}
                              className="p-1 text-muted-foreground hover:text-foreground"
                              title="Edit display name"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          </div>
                        )}

                        <div className="text-sm text-muted-foreground">
                          {claim.node && (
                            <span className="font-mono">{claim.node.address}</span>
                          )}
                          {claim.node?.version && (
                            <span className="ml-2 px-1.5 py-0.5 text-xs bg-muted rounded">
                              v{claim.node.version}
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground mt-2">
                          Claimed {claim.claimedAt ? formatRelativeTime(new Date(claim.claimedAt)) : "recently"}
                          {" • "}
                          {claim.verificationMethod.replace(/_/g, " ").toLowerCase()}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {claim.node?.isActive ? (
                          <span className="status-badge status-badge-active">Active</span>
                        ) : (
                          <span className="status-badge status-badge-inactive">Inactive</span>
                        )}
                        <button
                          onClick={() => handleRelease(claim.id)}
                          className="text-sm text-red-500 hover:underline"
                        >
                          Release
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending Claims */}
          {pendingClaims.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                Pending Verification ({pendingClaims.length})
              </h2>
              <div className="space-y-4">
                {pendingClaims.map((claim) => (
                  <div key={claim.id} className="border border-yellow-500/30 bg-yellow-500/5 rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <Link
                          href={`/nodes/${claim.nodeId}`}
                          className="font-medium hover:text-brand-500 transition-colors"
                        >
                          {claim.node ? formatAddress(claim.node.address) : `Node #${claim.nodeId}`}
                        </Link>
                        <div className="text-sm text-muted-foreground mt-1">
                          Verification pending • {claim.verificationMethod.replace(/_/g, " ").toLowerCase()}
                        </div>
                      </div>
                      <Link
                        href={`/nodes/${claim.nodeId}`}
                        className="px-3 py-1.5 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600"
                      >
                        Complete Verification
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {verifiedClaims.length === 0 && pendingClaims.length === 0 && (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2">No Claimed Nodes</h3>
              <p className="text-muted-foreground mb-4">
                Claim ownership of your pNodes to manage them from your dashboard
              </p>
              <Link
                href="/nodes"
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Browse Nodes
              </Link>
            </div>
          )}

          {/* Info Box */}
          <div className="mt-8 p-4 bg-muted/30 rounded-lg">
            <h3 className="font-medium mb-2">Why Claim Nodes?</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Set custom display names for your nodes</li>
              <li>• Get personalized alerts and reports</li>
              <li>• Track your fleet performance in one place</li>
              <li>• Prove ownership to the community</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
