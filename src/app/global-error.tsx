"use client";

/**
 * Global Error Boundary
 *
 * This component catches unhandled errors in the root layout
 * and reports them to Sentry.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report error to Sentry
    Sentry.captureException(error, {
      tags: {
        errorBoundary: "global",
      },
      extra: {
        digest: error.digest,
      },
    });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
          <div className="text-center max-w-md px-4">
            <h1 className="text-4xl font-bold mb-4">Something went wrong</h1>
            <p className="text-gray-400 mb-6">
              An unexpected error occurred. Our team has been notified.
            </p>
            <div className="space-x-4">
              <button
                onClick={reset}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Try again
              </button>
              <a
                href="/"
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors inline-block"
              >
                Go home
              </a>
            </div>
            {process.env.NODE_ENV === "development" && (
              <details className="mt-8 text-left text-sm text-gray-500">
                <summary className="cursor-pointer">Error details</summary>
                <pre className="mt-2 p-4 bg-gray-800 rounded overflow-auto">
                  {error.message}
                  {error.stack && `\n\n${error.stack}`}
                </pre>
              </details>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
