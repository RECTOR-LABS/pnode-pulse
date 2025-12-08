"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

/**
 * Screen reader announcer context
 * Provides a way to announce dynamic content changes to screen readers
 */
interface AnnouncerContextType {
  announce: (message: string, priority?: "polite" | "assertive") => void;
}

const AnnouncerContext = createContext<AnnouncerContextType | null>(null);

export function useAnnouncer() {
  const context = useContext(AnnouncerContext);
  if (!context) {
    throw new Error("useAnnouncer must be used within ScreenReaderProvider");
  }
  return context;
}

interface ScreenReaderProviderProps {
  children: ReactNode;
}

/**
 * Provider component that manages screen reader announcements
 */
export function ScreenReaderProvider({ children }: ScreenReaderProviderProps) {
  const [politeMessage, setPoliteMessage] = useState("");
  const [assertiveMessage, setAssertiveMessage] = useState("");

  const announce = useCallback((message: string, priority: "polite" | "assertive" = "polite") => {
    if (priority === "assertive") {
      setAssertiveMessage("");
      // Small delay to ensure the region is cleared first
      setTimeout(() => setAssertiveMessage(message), 50);
    } else {
      setPoliteMessage("");
      setTimeout(() => setPoliteMessage(message), 50);
    }
  }, []);

  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}
      {/* Screen reader only live regions */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMessage}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </AnnouncerContext.Provider>
  );
}

/**
 * Visually hidden text that is still accessible to screen readers
 */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

/**
 * Component for providing accessible descriptions
 */
export function AccessibleDescription({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return (
    <span id={id} className="sr-only">
      {children}
    </span>
  );
}

/**
 * Live region for real-time data updates
 */
export function LiveRegion({
  children,
  mode = "polite",
}: {
  children: ReactNode;
  mode?: "polite" | "assertive" | "off";
}) {
  return (
    <div aria-live={mode} aria-atomic="true">
      {children}
    </div>
  );
}
