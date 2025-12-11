"use client";

import Link from "next/link";
import { formatRelativeTime, formatAddress } from "@/lib/utils/format";

interface Peer {
  peerAddress: string;
  peerVersion: string | null;
  lastSeenAt: Date;
  peerNode?: {
    id: number;
    address: string;
    version: string | null;
    isActive: boolean;
  } | null;
}

interface PeerListProps {
  peers: Peer[];
  isLoading?: boolean;
}

export function PeerList({ peers, isLoading }: PeerListProps) {
  if (isLoading) {
    return <PeerListSkeleton />;
  }

  if (peers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No peer connections found
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {peers.map((peer, index) => (
        <div
          key={`${peer.peerAddress}-${index}`}
          className="py-3 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-2 h-2 rounded-full ${
                peer.peerNode?.isActive ? "bg-status-active" : "bg-status-inactive"
              }`}
            />
            <div>
              {peer.peerNode ? (
                <Link
                  href={`/nodes/${peer.peerNode.id}`}
                  className="font-mono text-sm hover:text-brand-500 transition-colors"
                >
                  {formatAddress(peer.peerAddress)}
                </Link>
              ) : (
                <span className="font-mono text-sm text-muted-foreground">
                  {formatAddress(peer.peerAddress)}
                </span>
              )}
              <div className="text-xs text-muted-foreground">
                {peer.peerVersion || "Unknown version"}
              </div>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            {formatRelativeTime(new Date(peer.lastSeenAt))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PeerListSkeleton() {
  return (
    <div className="divide-y divide-border animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-muted" />
            <div>
              <div className="h-4 bg-muted rounded w-32 mb-1" />
              <div className="h-3 bg-muted rounded w-20" />
            </div>
          </div>
          <div className="h-4 bg-muted rounded w-16" />
        </div>
      ))}
    </div>
  );
}
