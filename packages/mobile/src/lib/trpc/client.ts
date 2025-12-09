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
  // Development: use environment variable (required for React Native)
  // Note: localhost doesn't work in React Native - must be local IP or ngrok
  if (__DEV__) {
    const devUrl = process.env.EXPO_PUBLIC_API_URL || process.env.API_URL;
    if (!devUrl) {
      throw new Error(
        "Development API URL required. Set EXPO_PUBLIC_API_URL=http://<your-local-ip>:3000 in .env"
      );
    }
    return devUrl;
  }

  // Production: use environment variable with fallback
  return process.env.EXPO_PUBLIC_API_URL || "https://pulse.rectorspace.com";
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
