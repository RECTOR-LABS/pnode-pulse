/**
 * Next.js Instrumentation
 *
 * This file is used to initialize monitoring tools like Sentry
 * before the application starts.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only initialize Sentry if DSN is configured
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) {
    console.log("[Sentry] No DSN configured, skipping initialization");
    return;
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Server-side Sentry initialization
    await import("../sentry.server.config");
    console.log("[Sentry] Server-side monitoring initialized");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    // Edge runtime Sentry initialization
    await import("../sentry.edge.config");
    console.log("[Sentry] Edge runtime monitoring initialized");
  }
}
