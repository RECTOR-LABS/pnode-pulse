/**
 * tRPC Client for Mobile
 *
 * Connects to the pNode Pulse API server.
 */

import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../../../src/server/api/root";

// API Base URL - configurable per environment
const getBaseUrl = () => {
  // For development, use local network IP or ngrok
  // For production, use the actual API URL
  if (__DEV__) {
    // Replace with your local machine's IP when testing on device
    return "http://localhost:3000";
  }
  return "https://pulse.rectorspace.com";
};

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
    }),
  ],
});

export { getBaseUrl };
