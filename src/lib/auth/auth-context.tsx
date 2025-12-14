"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { trpc } from "@/lib/trpc/client";
import { useSession } from "@/lib/hooks/use-session";
import bs58 from "bs58";
import { logger } from "@/lib/logger";

interface User {
  id: string;
  walletAddress: string;
  displayName: string | null;
  avatarUrl: string | null;
  preferences: Record<string, unknown>;
  claimedNodes: Array<{ nodeId: number; displayName: string | null }>;
  createdAt: Date;
  lastLoginAt: Date | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "pnode-pulse-auth-token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const sessionId = useSession();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const requestChallenge = trpc.auth.requestChallenge.useMutation();
  const verifySignature = trpc.auth.verifySignature.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation();
  const migrateAlerts = trpc.alerts.migrateToUser.useMutation();

  // Load token from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedToken) {
      setToken(storedToken);
    }
    setIsLoading(false);
  }, []);

  // Fetch user when token changes
  const { data: userData, refetch: refetchUser, isSuccess, isFetched } = trpc.auth.me.useQuery(
    { token: token || "" },
    {
      enabled: !!token,
      staleTime: 0, // Always fetch fresh on mount (auth is critical)
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      retry: false,
    }
  );

  useEffect(() => {
    if (userData) {
      setUser(userData as User);
    } else if (token && isFetched && isSuccess && userData === null) {
      // Query completed successfully but returned null = invalid/expired token
      setToken(null);
      setUser(null);
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [userData, token, isFetched, isSuccess]);

  const login = useCallback(async () => {
    if (!publicKey || !signMessage) {
      throw new Error("Wallet not connected");
    }

    setIsLoading(true);

    try {
      const walletAddress = publicKey.toBase58();

      // Request challenge
      const challenge = await requestChallenge.mutateAsync({ walletAddress });

      // Sign message
      const messageBytes = new TextEncoder().encode(challenge.message);
      const signatureBytes = await signMessage(messageBytes);
      const signature = bs58.encode(signatureBytes);

      // Verify signature
      const result = await verifySignature.mutateAsync({
        challengeId: challenge.challengeId,
        walletAddress,
        signature,
      });

      // Store token
      setToken(result.token);
      localStorage.setItem(TOKEN_KEY, result.token);

      // Migrate session alerts to user account
      if (sessionId) {
        try {
          await migrateAlerts.mutateAsync({
            sessionId,
            userId: result.user.id,
          });
        } catch {
          // Ignore migration errors - non-critical
          logger.warn("Failed to migrate session alerts to user");
        }
      }

      // Fetch user data
      await refetchUser();
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, signMessage, requestChallenge, verifySignature, refetchUser, sessionId, migrateAlerts]);

  const logout = useCallback(async () => {
    if (token) {
      try {
        await logoutMutation.mutateAsync({ token });
      } catch {
        // Ignore errors on logout
      }
    }

    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);

    // Disconnect wallet
    if (connected) {
      await disconnect();
    }
  }, [token, logoutMutation, connected, disconnect]);

  const refreshUser = useCallback(async () => {
    if (token) {
      await refetchUser();
    }
  }, [token, refetchUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && !!token,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
