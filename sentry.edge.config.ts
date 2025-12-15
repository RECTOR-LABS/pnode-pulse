/**
 * Sentry Edge Runtime Configuration
 *
 * This file configures Sentry for Edge Runtime (middleware, edge API routes).
 * Edge runtime has limited APIs compared to Node.js.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from "@sentry/nextjs";

// Only initialize if DSN is configured
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Environment tagging
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,

    // Performance Monitoring
    // Lower sample rate for edge (runs on every request)
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 1.0,

    // Only enable debug in development
    debug: process.env.NODE_ENV === "development",

    // Filter sensitive data
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
      return event;
    },
  });
}
