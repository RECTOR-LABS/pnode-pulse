"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useSession } from "@/lib/hooks/use-session";

interface PortfolioNodeCardProps {
  portfolioNode: {
    id: string;
    nodeId: number;
    label: string | null;
    isStarred: boolean;
    slaTarget: number | null;
    node: {
      id: number;
      address: string;
      version: string | null;
      isActive: boolean;
      lastSeen: Date | null;
      metrics: Array<{
        cpuPercent: number | null;
        ramUsed: bigint | null;
        ramTotal: bigint | null;
        fileSize: bigint | null;
        uptime: number | null;
      }>;
    };
  };
  onUpdate: () => void;
}

function formatBytes(bytes: bigint | number | null): string {
  if (bytes === null) return "—";
  const b = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (b === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatUptime(seconds: number | null): string {
  if (seconds === null) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatTimeAgo(date: Date | null): string {
  if (!date) return "Never";
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function PortfolioNodeCard({ portfolioNode, onUpdate }: PortfolioNodeCardProps) {
  const sessionId = useSession();
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(portfolioNode.label || "");

  const { node } = portfolioNode;
  const metric = node.metrics[0];

  const updateMutation = trpc.portfolio.updateNode.useMutation({
    onSuccess: () => {
      onUpdate();
      setIsEditing(false);
    },
  });

  const removeMutation = trpc.portfolio.removeNode.useMutation({
    onSuccess: () => onUpdate(),
  });

  const handleStar = () => {
    updateMutation.mutate({
      sessionId,
      nodeId: node.id,
      isStarred: !portfolioNode.isStarred,
    });
  };

  const handleRemove = () => {
    if (confirm("Remove this node from your portfolio?")) {
      removeMutation.mutate({ sessionId, nodeId: node.id });
    }
  };

  const handleSaveLabel = () => {
    updateMutation.mutate({
      sessionId,
      nodeId: node.id,
      label: editLabel || undefined,
    });
  };

  const ramPercent = metric?.ramUsed && metric?.ramTotal && metric.ramTotal > BigInt(0)
    ? (Number(metric.ramUsed) / Number(metric.ramTotal) * 100).toFixed(1)
    : null;

  return (
    <div className={`bg-card border rounded-lg p-4 transition-colors ${
      node.isActive ? "border-border hover:border-brand-300" : "border-status-inactive/30 bg-status-inactive/5"
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div className={`w-3 h-3 rounded-full ${
            node.isActive ? "bg-status-active" : "bg-status-inactive"
          }`} />

          <div>
            {/* Node address/label */}
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="Node label"
                  className="px-2 py-1 bg-background border border-border rounded text-sm w-40"
                  autoFocus
                />
                <button
                  onClick={handleSaveLabel}
                  className="p-1 text-status-active hover:bg-status-active/10 rounded"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="p-1 text-muted-foreground hover:text-foreground"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <Link href={`/nodes/${node.id}`} className="hover:text-brand-500 transition-colors">
                <span className="font-medium">
                  {portfolioNode.label || node.address.split(":")[0]}
                </span>
                {portfolioNode.label && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {node.address.split(":")[0]}
                  </span>
                )}
              </Link>
            )}

            {/* Version */}
            <div className="flex items-center gap-2 mt-0.5">
              {node.version && (
                <span className="text-xs text-muted-foreground">v{node.version}</span>
              )}
              {!node.isActive && (
                <span className="text-xs text-status-inactive">
                  Offline - Last seen {formatTimeAgo(node.lastSeen)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Star button */}
          <button
            onClick={handleStar}
            className={`p-1.5 rounded transition-colors ${
              portfolioNode.isStarred
                ? "text-yellow-500 hover:text-yellow-600"
                : "text-muted-foreground hover:text-yellow-500"
            }`}
            title={portfolioNode.isStarred ? "Unstar" : "Star"}
          >
            <svg
              className="w-4 h-4"
              fill={portfolioNode.isStarred ? "currentColor" : "none"}
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>

          {/* Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-20 min-w-[140px] py-1">
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Label
                  </button>
                  <Link
                    href={`/nodes/${node.id}`}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                    onClick={() => setShowMenu(false)}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View Details
                  </Link>
                  <hr className="my-1 border-border" />
                  <button
                    onClick={() => {
                      handleRemove();
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-500/10 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Remove
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Metrics */}
      {node.isActive && metric && (
        <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-border text-sm">
          <div>
            <span className="text-muted-foreground">CPU</span>
            <p className="font-medium">{metric.cpuPercent?.toFixed(1) ?? "—"}%</p>
          </div>
          <div>
            <span className="text-muted-foreground">RAM</span>
            <p className="font-medium">{ramPercent ?? "—"}%</p>
          </div>
          <div>
            <span className="text-muted-foreground">Storage</span>
            <p className="font-medium">{formatBytes(metric.fileSize)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Uptime</span>
            <p className="font-medium">{formatUptime(metric.uptime)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
