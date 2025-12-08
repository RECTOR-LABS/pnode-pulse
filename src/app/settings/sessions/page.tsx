"use client";

import { useAuth } from "@/lib/auth";
import { trpc } from "@/lib/trpc/client";

export default function SessionsPage() {
  const { token, isAuthenticated, logout } = useAuth();

  const { data: sessions, refetch } = trpc.auth.sessions.useQuery(
    { token: token || "" },
    { enabled: !!token }
  );

  const revokeMutation = trpc.auth.revokeSession.useMutation({
    onSuccess: () => refetch(),
  });

  const logoutAllMutation = trpc.auth.logoutAll.useMutation({
    onSuccess: () => logout(),
  });

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold mb-4">Sessions</h1>
        <p className="text-muted-foreground">
          Connect your wallet to view your active sessions.
        </p>
      </div>
    );
  }

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString();
  };

  const parseUserAgent = (ua: string | null) => {
    if (!ua) return { browser: "Unknown", os: "Unknown" };

    let browser = "Unknown";
    let os = "Unknown";

    // Browser detection
    if (ua.includes("Chrome")) browser = "Chrome";
    else if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("Safari")) browser = "Safari";
    else if (ua.includes("Edge")) browser = "Edge";

    // OS detection
    if (ua.includes("Windows")) os = "Windows";
    else if (ua.includes("Mac")) os = "macOS";
    else if (ua.includes("Linux")) os = "Linux";
    else if (ua.includes("Android")) os = "Android";
    else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

    return { browser, os };
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Sessions</h1>
          <p className="text-muted-foreground">
            Manage your active login sessions
          </p>
        </div>
        <button
          onClick={() => {
            if (confirm("Sign out from all devices? You will need to sign in again.")) {
              logoutAllMutation.mutate({ token: token || "" });
            }
          }}
          className="px-4 py-2 text-red-500 border border-red-500 rounded-lg hover:bg-red-500/10 transition-colors"
        >
          Sign Out All
        </button>
      </div>

      <div className="space-y-4">
        {sessions?.map((session) => {
          const { browser, os } = parseUserAgent(session.userAgent);

          return (
            <div
              key={session.id}
              className={`border rounded-xl p-4 ${
                session.isCurrent ? "border-brand-500 bg-brand-500/5" : "border-border"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-muted rounded-lg">
                    <DeviceIcon os={os} />
                  </div>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {browser} on {os}
                      {session.isCurrent && (
                        <span className="px-2 py-0.5 text-xs bg-brand-500 text-white rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {session.ipAddress || "Unknown IP"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Last active: {formatDate(session.lastUsedAt)}
                    </div>
                  </div>
                </div>

                {!session.isCurrent && (
                  <button
                    onClick={() => {
                      if (confirm("Revoke this session?")) {
                        revokeMutation.mutate({
                          token: token || "",
                          sessionId: session.id,
                        });
                      }
                    }}
                    className="text-sm text-red-500 hover:underline"
                  >
                    Revoke
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {(!sessions || sessions.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            No active sessions
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-muted/30 rounded-lg">
        <h3 className="font-medium mb-2">Security Tips</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>Revoke any sessions you don&apos;t recognize</li>
          <li>Use &quot;Sign Out All&quot; if you suspect unauthorized access</li>
          <li>Sessions expire automatically after 7 days of inactivity</li>
        </ul>
      </div>
    </div>
  );
}

function DeviceIcon({ os }: { os: string }) {
  if (os === "Windows" || os === "macOS" || os === "Linux") {
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    );
  }

  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
    </svg>
  );
}
