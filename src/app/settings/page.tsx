"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { trpc } from "@/lib/trpc/client";

type Theme = "light" | "dark" | "system";
type DateFormat = "US" | "EU" | "ISO";
type DefaultDashboard = "network" | "portfolio";

interface Preferences {
  theme: Theme;
  timezone: string;
  dateFormat: DateFormat;
  defaultDashboard: DefaultDashboard;
  refreshInterval: number;
  emailNotifications: boolean;
  showInLeaderboard: boolean;
  publicProfile: boolean;
}

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (US)" },
  { value: "America/Chicago", label: "Central Time (US)" },
  { value: "America/Denver", label: "Mountain Time (US)" },
  { value: "America/Los_Angeles", label: "Pacific Time (US)" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Paris / Berlin" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Australia/Sydney", label: "Sydney" },
];

const DEFAULT_PREFERENCES: Preferences = {
  theme: "system",
  timezone: "UTC",
  dateFormat: "ISO",
  defaultDashboard: "network",
  refreshInterval: 30,
  emailNotifications: false,
  showInLeaderboard: true,
  publicProfile: false,
};

export default function SettingsPage() {
  const { user, token, isAuthenticated, refreshUser } = useAuth();
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [displayName, setDisplayName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const updatePreferencesMutation = trpc.auth.updatePreferences.useMutation();
  const updateProfileMutation = trpc.auth.updateProfile.useMutation();

  // Load preferences from user
  useEffect(() => {
    if (user) {
      const userPrefs = (user.preferences || {}) as Partial<Preferences>;
      setPreferences({ ...DEFAULT_PREFERENCES, ...userPrefs });
      setDisplayName(user.displayName || "");
    }
  }, [user]);

  // Apply theme immediately
  useEffect(() => {
    const root = document.documentElement;
    if (preferences.theme === "dark") {
      root.classList.add("dark");
    } else if (preferences.theme === "light") {
      root.classList.remove("dark");
    } else {
      // System preference
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  }, [preferences.theme]);

  const handleSavePreferences = async () => {
    if (!token) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      await updatePreferencesMutation.mutateAsync({
        token,
        preferences,
      });

      if (displayName !== user?.displayName) {
        await updateProfileMutation.mutateAsync({
          token,
          displayName: displayName || undefined,
        });
      }

      await refreshUser();
      setSaveMessage({ type: "success", text: "Settings saved successfully" });
    } catch (error) {
      setSaveMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save settings",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold mb-4">Settings</h1>
        <p className="text-muted-foreground mb-6">
          Connect your wallet to access settings and sync preferences across devices.
        </p>
        <div className="p-8 border border-dashed border-border rounded-xl">
          <p className="text-muted-foreground">
            Please connect your wallet to continue
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-8">Settings</h1>

      {/* Save Message */}
      {saveMessage && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            saveMessage.type === "success"
              ? "bg-status-active/10 text-status-active"
              : "bg-status-error/10 text-status-error"
          }`}
        >
          {saveMessage.text}
        </div>
      )}

      {/* Quick Links */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <a
          href="/settings/api-keys"
          className="p-4 border border-border rounded-xl hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <div>
              <div className="font-medium">API Keys</div>
              <div className="text-sm text-muted-foreground">Manage API access</div>
            </div>
          </div>
        </a>
        <a
          href="/settings/sessions"
          className="p-4 border border-border rounded-xl hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <div>
              <div className="font-medium">Sessions</div>
              <div className="text-sm text-muted-foreground">Active sessions</div>
            </div>
          </div>
        </a>
        <a
          href="/settings/nodes"
          className="p-4 border border-border rounded-xl hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
            <div>
              <div className="font-medium">Claimed Nodes</div>
              <div className="text-sm text-muted-foreground">Your owned nodes</div>
            </div>
          </div>
        </a>
      </div>

      <div className="space-y-8">
        {/* Profile Section */}
        <section className="border border-border rounded-xl p-6">
          <h2 className="text-lg font-medium mb-4">Profile</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your display name"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground mt-1">
                This name will be shown in leaderboards and public profiles
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Wallet Address</label>
              <div className="px-3 py-2 border border-border rounded-lg bg-muted/30 font-mono text-sm">
                {user?.walletAddress}
              </div>
            </div>
          </div>
        </section>

        {/* Appearance Section */}
        <section className="border border-border rounded-xl p-6">
          <h2 className="text-lg font-medium mb-4">Appearance</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Theme</label>
              <div className="flex gap-4">
                {(["light", "dark", "system"] as Theme[]).map((theme) => (
                  <label key={theme} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={preferences.theme === theme}
                      onChange={() => setPreferences({ ...preferences, theme })}
                      className="text-brand-500"
                    />
                    <span className="capitalize">{theme}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Timezone</label>
              <select
                value={preferences.timezone}
                onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Date Format</label>
              <div className="flex gap-4">
                {([
                  { value: "US", label: "MM/DD/YYYY" },
                  { value: "EU", label: "DD/MM/YYYY" },
                  { value: "ISO", label: "YYYY-MM-DD" },
                ] as { value: DateFormat; label: string }[]).map((format) => (
                  <label key={format.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={preferences.dateFormat === format.value}
                      onChange={() => setPreferences({ ...preferences, dateFormat: format.value })}
                      className="text-brand-500"
                    />
                    <span>{format.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Dashboard Section */}
        <section className="border border-border rounded-xl p-6">
          <h2 className="text-lg font-medium mb-4">Dashboard</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Default View</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={preferences.defaultDashboard === "network"}
                    onChange={() => setPreferences({ ...preferences, defaultDashboard: "network" })}
                    className="text-brand-500"
                  />
                  <span>Network Overview</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={preferences.defaultDashboard === "portfolio"}
                    onChange={() => setPreferences({ ...preferences, defaultDashboard: "portfolio" })}
                    className="text-brand-500"
                  />
                  <span>My Portfolio</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Refresh Rate</label>
              <div className="flex gap-4">
                {[15, 30, 60, 120].map((interval) => (
                  <label key={interval} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={preferences.refreshInterval === interval}
                      onChange={() => setPreferences({ ...preferences, refreshInterval: interval })}
                      className="text-brand-500"
                    />
                    <span>{interval}s</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Notifications Section */}
        <section className="border border-border rounded-xl p-6">
          <h2 className="text-lg font-medium mb-4">Notifications</h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-medium">Email Notifications</div>
                <div className="text-sm text-muted-foreground">
                  Receive alert notifications via email
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.emailNotifications}
                onChange={(e) =>
                  setPreferences({ ...preferences, emailNotifications: e.target.checked })
                }
                className="w-5 h-5 text-brand-500 rounded"
              />
            </label>
          </div>
        </section>

        {/* Privacy Section */}
        <section className="border border-border rounded-xl p-6">
          <h2 className="text-lg font-medium mb-4">Privacy</h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-medium">Show in Leaderboard</div>
                <div className="text-sm text-muted-foreground">
                  Display your nodes in public leaderboards
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.showInLeaderboard}
                onChange={(e) =>
                  setPreferences({ ...preferences, showInLeaderboard: e.target.checked })
                }
                className="w-5 h-5 text-brand-500 rounded"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-medium">Public Profile</div>
                <div className="text-sm text-muted-foreground">
                  Allow others to view your profile and claimed nodes
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.publicProfile}
                onChange={(e) =>
                  setPreferences({ ...preferences, publicProfile: e.target.checked })
                }
                className="w-5 h-5 text-brand-500 rounded"
              />
            </label>
          </div>
        </section>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSavePreferences}
            disabled={isSaving}
            className="px-6 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </div>
    </div>
  );
}
