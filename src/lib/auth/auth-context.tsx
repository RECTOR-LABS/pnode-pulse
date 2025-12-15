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
  const [tokenChecked, setTokenChecked] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const requestChallenge = trpc.auth.requestChallenge.useMutation();
  const verifySignature = trpc.auth.verifySignature.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation();
  const migrateAlerts = trpc.alerts.migrateToUser.useMutation();

  // Load token from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedToken) {
      logger.debug("[Auth] Token found in localStorage");
      setToken(storedToken);
    } else {
      logger.debug("[Auth] No token in localStorage");
    }
    setTokenChecked(true);
  }, []);

  // Fetch user when token changes
  const {
    data: userData,
    refetch: refetchUser,
    isFetched,
    isError,
    isPending,
  } = trpc.auth.me.useQuery(
    { token: token || "" },
    {
      enabled: !!token,
      staleTime: 0, // Always fetch fresh on mount (auth is critical)
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      retry: 1, // Retry once for network glitches
    }
  );

  // Handle query results
  useEffect(() => {
    if (!token) {
      // No token = not authenticated
      setUser(null);
      return;
    }

    if (!isFetched) {
      // Query still running
      return;
    }

    if (isError) {
      // Query failed (network error, server error, etc.)
      logger.warn("[Auth] Token verification failed with error, clearing token");
      setToken(null);
      setUser(null);
      localStorage.removeItem(TOKEN_KEY);
      return;
    }

    if (userData) {
      // Valid user data returned
      logger.debug("[Auth] User authenticated", { wallet: userData.walletAddress });
      setUser(userData as User);
    } else {
      // Query succeeded but returned null = session expired/invalid
      logger.debug("[Auth] Token invalid or session expired, clearing");
      setToken(null);
      setUser(null);
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [userData, token, isFetched, isError]);

  // Compute loading state:
  // Loading if: localStorage not checked yet OR (token exists AND query not done) OR signing in
  const isLoading = !tokenChecked || (!!token && isPending) || isSigningIn;

  const login = useCallback(async () => {
    if (!publicKey || !signMessage) {
      throw new Error("Wallet not connected");
    }

    setIsSigningIn(true);
    logger.debug("[Auth] Starting sign-in process...");

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
      logger.debug("[Auth] Token stored, fetching user data...");

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
      logger.debug("[Auth] Sign-in complete");
    } finally {
      setIsSigningIn(false);
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
