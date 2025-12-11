"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useBookmarkContext } from "@/components/providers/bookmark-provider";
import { trpc } from "@/lib/trpc";

export function FavoritesDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { bookmarks, toggle } = useBookmarkContext();

  // Fetch bookmarked nodes data
  const { data: nodes } = trpc.nodes.list.useQuery(undefined, {
    enabled: bookmarks.length > 0,
  });

  // Filter to only bookmarked nodes
  const bookmarkedNodes = nodes?.nodes.filter((n) => bookmarks.includes(n.id)) ?? [];

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
        aria-label="Favorites"
      >
        <svg
          className={`w-5 h-5 ${bookmarks.length > 0 ? "text-yellow-500 fill-current" : "text-muted-foreground"}`}
          viewBox="0 0 24 24"
          fill={bookmarks.length > 0 ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        {bookmarks.length > 0 && (
          <span className="text-sm font-medium">{bookmarks.length}</span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-card border border-border rounded-lg shadow-lg z-50">
          <div className="p-3 border-b border-border">
            <h3 className="font-semibold text-sm">Favorite Nodes</h3>
          </div>

          {bookmarks.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              <svg
                className="w-8 h-8 mx-auto mb-2 opacity-50"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <p>No favorites yet</p>
              <p className="text-xs mt-1">Click the star icon on any node to add it here</p>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {bookmarkedNodes.map((node) => (
                <div
                  key={node.id}
                  className="flex items-center gap-2 p-2 hover:bg-muted transition-colors"
                >
                  <Link
                    href={`/nodes/${node.id}`}
                    className="flex-1 min-w-0"
                    onClick={() => setIsOpen(false)}
                  >
                    <div className="text-sm font-medium truncate hover:text-brand-500">
                      {node.address.split(":")[0]}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      v{node.version || "unknown"} - {node.isActive ? "Active" : "Inactive"}
                    </div>
                  </Link>
                  <button
                    onClick={() => toggle(node.id)}
                    className="p-1 hover:bg-muted-foreground/10 rounded"
                    title="Remove from favorites"
                  >
                    <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {bookmarks.length > 0 && (
            <div className="p-2 border-t border-border">
              <Link
                href="/nodes?filter=favorites"
                className="block text-center text-sm text-brand-500 hover:text-brand-600 py-1"
                onClick={() => setIsOpen(false)}
              >
                View all favorites
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
