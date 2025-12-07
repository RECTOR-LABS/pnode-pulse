"use client";

import { useState, useEffect, useCallback } from "react";

const BOOKMARKS_KEY = "pnode-pulse-bookmarks";

interface BookmarkState {
  bookmarks: number[];
  isBookmarked: (nodeId: number) => boolean;
  toggle: (nodeId: number) => void;
  clear: () => void;
}

/**
 * Hook for managing bookmarked nodes with localStorage persistence
 * Syncs across browser tabs via storage event
 */
export function useBookmarks(): BookmarkState {
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(BOOKMARKS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setBookmarks(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load bookmarks:", e);
    }
    setIsInitialized(true);
  }, []);

  // Save to localStorage whenever bookmarks change
  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
      } catch (e) {
        console.error("Failed to save bookmarks:", e);
      }
    }
  }, [bookmarks, isInitialized]);

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
          console.error("Failed to sync bookmarks:", e);
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
