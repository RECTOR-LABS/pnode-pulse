/**
 * tRPC Client for Mobile
 *
 * Connects to the pNode Pulse API server.
 * Uses vanilla tRPC client since we don't have shared types yet.
 */

import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const trpcClient = createTRPCClient<any>({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
    }),
  ],
});

export { getBaseUrl };
