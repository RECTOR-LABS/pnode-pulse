"use client";

import { createContext, useContext, ReactNode } from "react";
import { useBookmarks } from "@/lib/hooks/use-bookmarks";

interface BookmarkContextValue {
  bookmarks: number[];
  isBookmarked: (nodeId: number) => boolean;
  toggle: (nodeId: number) => void;
  clear: () => void;
}

const BookmarkContext = createContext<BookmarkContextValue | null>(null);

export function BookmarkProvider({ children }: { children: ReactNode }) {
  const bookmarks = useBookmarks();
  return (
    <BookmarkContext.Provider value={bookmarks}>
      {children}
    </BookmarkContext.Provider>
  );
}

export function useBookmarkContext(): BookmarkContextValue {
  const context = useContext(BookmarkContext);
  if (!context) {
    throw new Error("useBookmarkContext must be used within BookmarkProvider");
  }
  return context;
}
