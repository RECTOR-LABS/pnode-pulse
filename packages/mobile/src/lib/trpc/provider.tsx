/**
 * tRPC Provider for React Native
 *
 * Simple provider using vanilla tRPC client with React Query
 */

import React, { useState, createContext, useContext } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpcClient } from "./client";

// Context for tRPC client
const TRPCContext = createContext(trpcClient);

// Hook to access tRPC client
export function useTRPC() {
  return useContext(TRPCContext);
}

interface TRPCProviderProps {
  children: React.ReactNode;
}

export function TRPCProvider({ children }: TRPCProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60, // 1 minute
            gcTime: 1000 * 60 * 5, // 5 minutes
            retry: 2,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <TRPCContext.Provider value={trpcClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </TRPCContext.Provider>
  );
}
