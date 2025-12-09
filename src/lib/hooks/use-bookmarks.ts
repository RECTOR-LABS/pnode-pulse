"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { logger } from "@/lib/logger";

const BOOKMARKS_KEY = "pnode-pulse-bookmarks";

interface BookmarkState {
  bookmarks: number[];
  isBookmarked: (nodeId: number) => boolean;
  toggle: (nodeId: number) => void;
  clear: () => void;
}

// Helper to load bookmarks from localStorage
function loadBookmarks(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(BOOKMARKS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    logger.error("Failed to load bookmarks:", e instanceof Error ? e : new Error(String(e)));
  }
  return [];
}

/**
 * Hook for managing bookmarked nodes with localStorage persistence
 * Syncs across browser tabs via storage event
 */
export function useBookmarks(): BookmarkState {
  const [bookmarks, setBookmarks] = useState<number[]>(loadBookmarks);
  const isInitialized = useRef(true);

  // Save to localStorage whenever bookmarks change
  useEffect(() => {
    if (isInitialized.current) {
      try {
        localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
      } catch (e) {
        logger.error("Failed to save bookmarks:", e instanceof Error ? e : new Error(String(e)));
      }
    }
  }, [bookmarks]);

  // Sync across tabs
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === BOOKMARKS_KEY && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          if (Array.isArray(parsed)) {
            setBookmarks(parsed);
          }
        } catch (e) {
          logger.error("Failed to sync bookmarks:", e instanceof Error ? e : new Error(String(e)));
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const toggle = useCallback((nodeId: number) => {
    setBookmarks((prev) => {
      if (prev.includes(nodeId)) {
        return prev.filter((id) => id !== nodeId);
      }
      return [...prev, nodeId];
    });
  }, []);

  const isBookmarked = useCallback(
    (nodeId: number) => bookmarks.includes(nodeId),
    [bookmarks]
  );

  const clear = useCallback(() => {
    setBookmarks([]);
  }, []);

  return {
    bookmarks,
    isBookmarked,
    toggle,
    clear,
  };
}
