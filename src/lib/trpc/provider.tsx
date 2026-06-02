"use client";

/**
 * tRPC Provider
 *
 * Wraps the application with React Query and tRPC clients.
 */

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "./client";

function getBaseUrl() {
  // If NEXT_PUBLIC_API_URL is set, route all tRPC traffic to the external
  // pulse-api service (e.g. https://api.pulse.rectorspace.com). This is the
  // Phase 3 cutover path — the Vercel-hosted FE talks to pulse-api on VPS
  // instead of the monolith's local /api/trpc route handler.
  // When unset, fall back to legacy behavior: relative path in the browser,
  // localhost during SSR — i.e. the monolith handles tRPC itself.
  const externalApiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (externalApiUrl) {
    return externalApiUrl.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    return "";
  }
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Stale time of 30 seconds for dashboard data
            staleTime: 30 * 1000,
            // Retry once on failure
            retry: 1,
            // Refetch on window focus for real-time feel
            refetchOnWindowFocus: true,
          },
        },
      }),
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
