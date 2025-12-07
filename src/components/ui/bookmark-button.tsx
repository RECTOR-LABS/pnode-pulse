"use client";

import { useBookmarkContext } from "@/components/providers/bookmark-provider";

interface BookmarkButtonProps {
  nodeId: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function BookmarkButton({ nodeId, className = "", size = "md" }: BookmarkButtonProps) {
  const { isBookmarked, toggle } = useBookmarkContext();
  const bookmarked = isBookmarked(nodeId);

  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(nodeId);
      }}
      className={`transition-colors hover:scale-110 ${className}`}
      aria-label={bookmarked ? "Remove from favorites" : "Add to favorites"}
      title={bookmarked ? "Remove from favorites" : "Add to favorites"}
    >
      {bookmarked ? (
        <svg
          className={`${sizeClasses[size]} text-yellow-500 fill-current`}
          viewBox="0 0 24 24"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ) : (
        <svg
          className={`${sizeClasses[size]} text-muted-foreground hover:text-yellow-500`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      )}
    </button>
  );
}
