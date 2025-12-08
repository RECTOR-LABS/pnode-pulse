"use client";

import { useSyncExternalStore } from "react";
import { getSessionId } from "@/lib/session";

// External store for session ID
const sessionStore = {
  getSnapshot: () => {
    if (typeof window === "undefined") return "";
    return getSessionId();
  },
  getServerSnapshot: () => "",
  subscribe: () => () => {}, // Session ID doesn't change after initialization
};

/**
 * React hook to get the session ID
 * Handles SSR by only loading on client
 */
export function useSession(): string {
  return useSyncExternalStore(
    sessionStore.subscribe,
    sessionStore.getSnapshot,
    sessionStore.getServerSnapshot
  );
}
