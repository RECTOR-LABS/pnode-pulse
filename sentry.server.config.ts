/**
 * Sentry Server-Side Configuration
 *
 * This file configures Sentry for the Node.js server environment.
 * It runs during SSR and API routes.
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

    // Release tracking (set by CI/CD)
    release: process.env.SENTRY_RELEASE || process.env.NEXT_PUBLIC_VERSION,

    // Performance Monitoring
    // Capture 10% of transactions in production, 100% in development
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Profile 10% of sampled transactions (for performance profiling)
    profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Only enable debug in development
    debug: process.env.NODE_ENV === "development",

    // Filter out noisy errors
    ignoreErrors: [
      // Expected errors
      "ECONNREFUSED", // Redis/DB connection during startup
      "ENOTFOUND", // DNS resolution failures
      // Rate limiting
      "Too Many Requests",
      // User-caused errors
      "Invalid token",
      "Challenge expired",
    ],

    // Add custom context before sending
    beforeSend(event, hint) {
      // Filter sensitive data from request
      if (event.request) {
        // Remove sensitive headers
        if (event.request.headers) {
          delete event.request.headers["authorization"];
          delete event.request.headers["cookie"];
          delete event.request.headers["x-api-key"];
        }

        // Remove sensitive query params
        if (event.request.query_string && typeof event.request.query_string === "string") {
          event.request.query_string = event.request.query_string
            .replace(/token=[^&]+/g, "token=[REDACTED]")
            .replace(/apiKey=[^&]+/g, "apiKey=[REDACTED]");
        }
      }

      // Add custom fingerprinting for database errors
      const error = hint.originalException;
      if (error instanceof Error) {
        if (error.message.includes("database")) {
          event.fingerprint = ["database-error"];
        }
        if (error.message.includes("pRPC")) {
          event.fingerprint = ["prpc-error"];
        }
      }

      return event;
    },

    // Additional integrations
    integrations: [
      // Capture unhandled promise rejections
      Sentry.captureConsoleIntegration({
        levels: ["error"],
      }),
    ],
  });
}
