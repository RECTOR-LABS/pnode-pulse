"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useAuth } from "@/lib/auth";

export function ConnectWallet() {
  const { publicKey, connected, connecting, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const { user, isLoading, isAuthenticated, login, logout } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = () => {
    setError(null);
    setVisible(true);
  };

  const handleSignIn = async () => {
    setError(null);
    setIsSigningIn(true);
    try {
      await login();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleDisconnect = async () => {
    await logout();
  };

  // Show connect button if not connected
  if (!connected) {
    return (
      <button
        onClick={handleConnect}
        disabled={connecting}
        className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50"
      >
        <WalletIcon />
        {connecting ? "Connecting..." : "Connect Wallet"}
      </button>
    );
  }

  // Connected but not authenticated - show sign in
  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <div className="text-sm text-muted-foreground">
          {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
        </div>
        <button
          onClick={handleSignIn}
          disabled={isSigningIn || isLoading}
          className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50"
        >
          {isSigningIn ? "Signing..." : "Sign In"}
        </button>
        <button
          onClick={() => disconnect()}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          title="Disconnect"
        >
          <DisconnectIcon />
        </button>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    );
  }

  // Authenticated - show user menu
  return (
    <div className="relative group">
      <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted transition-colors">
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt=""
            className="w-6 h-6 rounded-full"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center">
            <span className="text-white text-xs font-medium">
              {user?.displayName?.[0]?.toUpperCase() || user?.walletAddress.slice(0, 2)}
            </span>
          </div>
        )}
        <span className="text-sm font-medium max-w-[100px] truncate">
          {user?.displayName || `${user?.walletAddress.slice(0, 4)}...${user?.walletAddress.slice(-4)}`}
        </span>
        <ChevronIcon />
      </button>

      {/* Dropdown */}
      <div className="absolute right-0 top-full mt-1 w-48 py-1 bg-background border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <div className="px-3 py-2 border-b border-border">
          <div className="text-sm font-medium truncate">
            {user?.displayName || "Anonymous"}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {user?.walletAddress.slice(0, 8)}...{user?.walletAddress.slice(-8)}
          </div>
        </div>

        <a
          href="/settings"
          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
        >
          <SettingsIcon />
          Settings
        </a>

        <a
          href="/settings/sessions"
          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
        >
          <SessionsIcon />
          Sessions
        </a>

        <a
          href="/settings/nodes"
          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
        >
          <NodesIcon />
          My Nodes
        </a>

        <button
          onClick={handleDisconnect}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-muted transition-colors"
        >
          <LogoutIcon />
          Sign Out
        </button>
      </div>
    </div>
  );
}

function WalletIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

function DisconnectIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function SessionsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

function NodesIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    </svg>
  );
}
