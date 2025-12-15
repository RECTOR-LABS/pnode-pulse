/**
 * Sentry Client-Side Configuration
 *
 * This file configures Sentry for the browser environment.
 * It is imported automatically by the Sentry Next.js SDK.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from "@sentry/nextjs";

// Only initialize if DSN is configured
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Environment tagging
    environment: process.env.NODE_ENV,

    // Performance Monitoring
    // Capture 10% of transactions for performance monitoring
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Session Replay (for debugging user issues)
    // Capture 10% of sessions, 100% of sessions with errors
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Only enable debug in development
    debug: process.env.NODE_ENV === "development",

    // Filter out noisy errors
    ignoreErrors: [
      // Browser extensions
      /extensions\//i,
      /^chrome-extension:/i,
      /^moz-extension:/i,
      // Network errors (usually client-side connectivity issues)
      "Network request failed",
      "Failed to fetch",
      "Load failed",
      // User cancellations
      "AbortError",
      // Benign React errors
      "ResizeObserver loop",
    ],

    // Filter out non-application URLs
    denyUrls: [
      // Browser extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
      /^moz-extension:\/\//i,
      // External scripts
      /^https?:\/\/www\.google-analytics\.com/,
      /^https?:\/\/www\.googletagmanager\.com/,
    ],

    // Add custom context before sending
    beforeSend(event, hint) {
      // Filter out sensitive data
      if (event.request) {
        // Remove auth headers
        if (event.request.headers) {
          delete event.request.headers["Authorization"];
          delete event.request.headers["Cookie"];
        }
      }

      return event;
    },

    // Integrate with React Error Boundaries
    integrations: [
      Sentry.replayIntegration({
        // Mask all text in session replays for privacy
        maskAllText: false,
        // Block all media in session replays
        blockAllMedia: false,
      }),
    ],
  });
}
