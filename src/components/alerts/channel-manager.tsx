"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useSession } from "@/lib/hooks/use-session";

type ChannelType = "EMAIL" | "DISCORD" | "TELEGRAM";

export function ChannelManager() {
  const sessionId = useSession();
  const utils = trpc.useUtils();

  const [showAddModal, setShowAddModal] = useState(false);
  const [channelType, setChannelType] = useState<ChannelType>("EMAIL");
  const [channelName, setChannelName] = useState("");
  const [email, setEmail] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [chatId, setChatId] = useState("");
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: channels, isLoading } = trpc.alerts.channels.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  const resetForm = () => {
    setChannelName("");
    setEmail("");
    setWebhookUrl("");
    setChatId("");
    setShowAddModal(false);
  };

  const addEmailMutation = trpc.alerts.addEmail.useMutation({
    onSuccess: (result) => {
      utils.alerts.channels.invalidate();
      resetForm();
      setVerifyingId(result.id);
    },
    onError: (err) => setError(err.message),
  });

  const addDiscordMutation = trpc.alerts.addDiscord.useMutation({
    onSuccess: () => {
      utils.alerts.channels.invalidate();
      resetForm();
    },
    onError: (err) => setError(err.message),
  });

  const addTelegramMutation = trpc.alerts.addTelegram.useMutation({
    onSuccess: () => {
      utils.alerts.channels.invalidate();
      resetForm();
    },
    onError: (err) => setError(err.message),
  });

  const verifyEmailMutation = trpc.alerts.verifyEmail.useMutation({
    onSuccess: () => {
      utils.alerts.channels.invalidate();
      setVerifyingId(null);
      setVerificationCode("");
    },
    onError: (err) => setError(err.message),
  });

  const deleteMutation = trpc.alerts.deleteChannel.useMutation({
    onSuccess: () => utils.alerts.channels.invalidate(),
  });

  const handleAddChannel = () => {
    setError(null);

    if (!channelName.trim()) {
      setError("Channel name is required");
      return;
    }

    switch (channelType) {
      case "EMAIL":
        if (!email.trim() || !email.includes("@")) {
          setError("Valid email is required");
          return;
        }
        addEmailMutation.mutate({ sessionId, name: channelName.trim(), email: email.trim() });
        break;
      case "DISCORD":
        if (!webhookUrl.trim() || !webhookUrl.includes("discord.com/api/webhooks")) {
          setError("Valid Discord webhook URL is required");
          return;
        }
        addDiscordMutation.mutate({ sessionId, name: channelName.trim(), webhookUrl: webhookUrl.trim() });
        break;
      case "TELEGRAM":
        if (!chatId.trim()) {
          setError("Telegram chat ID is required");
          return;
        }
        addTelegramMutation.mutate({ sessionId, name: channelName.trim(), chatId: chatId.trim() });
        break;
    }
  };

  const getChannelIcon = (type: ChannelType) => {
    switch (type) {
      case "EMAIL":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      case "DISCORD":
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" />
          </svg>
        );
      case "TELEGRAM":
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.96 6.504-1.36 8.629-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
          </svg>
        );
    }
  };

  const isPending = addEmailMutation.isPending || addDiscordMutation.isPending || addTelegramMutation.isPending;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Notification Channels</h3>
          <p className="text-sm text-muted-foreground">
            Configure where to receive alerts
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
        >
          Add Channel
        </button>
      </div>

      {/* Channel list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !channels || channels.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg">
          <p className="text-lg mb-2">No channels configured</p>
          <p className="text-sm">Add a channel to receive alert notifications</p>
        </div>
      ) : (
        <div className="space-y-2">
          {channels.map((channel) => (
            <div
              key={channel.id}
              className="p-4 rounded-lg bg-card border border-border flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  {getChannelIcon(channel.type)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{channel.name}</span>
                    {channel.isVerified ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-status-active/20 text-status-active">
                        Verified
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-status-warning/20 text-status-warning">
                        Pending
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {channel.type.toLowerCase()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!channel.isVerified && channel.type === "EMAIL" && (
                  <button
                    onClick={() => setVerifyingId(channel.id)}
                    className="px-3 py-1.5 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
                  >
                    Verify
                  </button>
                )}
                <button
                  onClick={() => deleteMutation.mutate({ id: channel.id, sessionId })}
                  disabled={deleteMutation.isPending}
                  className="p-2 text-muted-foreground hover:text-status-inactive transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Channel Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md m-4">
            <h3 className="text-lg font-medium mb-4">Add Notification Channel</h3>

            {error && (
              <div className="p-3 mb-4 bg-status-inactive/10 border border-status-inactive/30 rounded-lg text-sm text-status-inactive">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Channel name */}
              <div>
                <label className="block text-sm font-medium mb-2">Channel Name</label>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="e.g., My Email, Ops Discord"
                  className="w-full px-3 py-2 bg-muted rounded-lg border-0 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Channel type selection */}
              <div>
                <label className="block text-sm font-medium mb-2">Channel Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["EMAIL", "DISCORD", "TELEGRAM"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setChannelType(type)}
                      className={`p-3 rounded-lg border transition-colors flex flex-col items-center gap-1 ${
                        channelType === type
                          ? "border-brand-500 bg-brand-500/10"
                          : "border-border bg-muted hover:bg-muted/80"
                      }`}
                    >
                      {getChannelIcon(type)}
                      <span className="text-xs">{type}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Channel-specific inputs */}
              {channelType === "EMAIL" && (
                <div>
                  <label className="block text-sm font-medium mb-2">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2 bg-muted rounded-lg border-0 focus:ring-2 focus:ring-brand-500"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    A verification code will be sent to this address
                  </p>
                </div>
              )}

              {channelType === "DISCORD" && (
                <div>
                  <label className="block text-sm font-medium mb-2">Webhook URL</label>
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                    className="w-full px-3 py-2 bg-muted rounded-lg border-0 focus:ring-2 focus:ring-brand-500"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Create a webhook in your Discord server settings
                  </p>
                </div>
              )}

              {channelType === "TELEGRAM" && (
                <div>
                  <label className="block text-sm font-medium mb-2">Chat ID</label>
                  <input
                    type="text"
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    placeholder="-1001234567890"
                    className="w-full px-3 py-2 bg-muted rounded-lg border-0 focus:ring-2 focus:ring-brand-500"
                  />
                  <div className="mt-3 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-2">
                    <p className="font-medium text-foreground">How to get your Chat ID:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Message <code className="bg-muted px-1 rounded">@userinfobot</code> on Telegram</li>
                      <li>It will reply with your Chat ID</li>
                      <li>For groups, add the bot to your group first</li>
                    </ol>
                    <p className="pt-1 border-t border-border">
                      Group IDs start with <code className="bg-muted px-1 rounded">-100</code>
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddChannel}
                disabled={isPending}
                className="flex-1 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                {isPending ? "Adding..." : "Add Channel"}
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setError(null);
                }}
                className="px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verification Modal */}
      {verifyingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md m-4">
            <h3 className="text-lg font-medium mb-4">Verify Email</h3>

            {error && (
              <div className="p-3 mb-4 bg-status-inactive/10 border border-status-inactive/30 rounded-lg text-sm text-status-inactive">
                {error}
              </div>
            )}

            <p className="text-sm text-muted-foreground mb-4">
              Enter the 6-digit code sent to your email address.
            </p>

            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
              placeholder="XXXXXX"
              maxLength={6}
              className="w-full px-4 py-3 text-center text-2xl font-mono bg-muted rounded-lg border-0 focus:ring-2 focus:ring-brand-500 tracking-widest"
            />

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => verifyEmailMutation.mutate({ channelId: verifyingId, sessionId, code: verificationCode })}
                disabled={verifyEmailMutation.isPending || verificationCode.length !== 6}
                className="flex-1 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                {verifyEmailMutation.isPending ? "Verifying..." : "Verify"}
              </button>
              <button
                onClick={() => {
                  setVerifyingId(null);
                  setVerificationCode("");
                  setError(null);
                }}
                className="px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
