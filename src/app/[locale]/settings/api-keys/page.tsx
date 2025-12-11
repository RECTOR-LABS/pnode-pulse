"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { trpc } from "@/lib/trpc/client";
import { formatDistanceToNow } from "date-fns";
import { RATE_LIMITS } from "@/lib/api/constants";

export default function ApiKeysPage() {
  const { token, isAuthenticated } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Queries
  const {
    data: keys,
    isLoading,
    refetch,
  } = trpc.apiKeys.list.useQuery(
    { token: token || "" },
    { enabled: !!token }
  );

  // Mutations
  const createMutation = trpc.apiKeys.create.useMutation();
  const revokeMutation = trpc.apiKeys.revoke.useMutation();
  const rotateMutation = trpc.apiKeys.rotate.useMutation();

  const handleCreateKey = async () => {
    if (!token || !newKeyName.trim()) return;

    setError(null);
    try {
      const result = await createMutation.mutateAsync({
        token,
        name: newKeyName.trim(),
        scopes: ["read"],
      });

      setCreatedKey(result.key);
      setNewKeyName("");
      setIsCreating(false);
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key");
    }
  };

  const handleRevokeKey = async (keyId: string, keyName: string) => {
    if (!token) return;
    if (!confirm(`Are you sure you want to revoke "${keyName}"? This cannot be undone.`)) return;

    try {
      await revokeMutation.mutateAsync({ token, keyId });
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke key");
    }
  };

  const handleRotateKey = async (keyId: string, keyName: string) => {
    if (!token) return;
    if (!confirm(`Rotate "${keyName}"? The old key will stop working immediately.`)) return;

    try {
      const result = await rotateMutation.mutateAsync({ token, keyId });
      setCreatedKey(result.key);
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rotate key");
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold mb-4">API Keys</h1>
        <p className="text-muted-foreground mb-6">
          Connect your wallet to manage API keys for programmatic access.
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
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link
            href="/settings"
            className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
          >
            &larr; Back to Settings
          </Link>
          <h1 className="text-2xl font-semibold">API Keys</h1>
          <p className="text-muted-foreground mt-1">
            Manage API keys for programmatic access to pNode Pulse data
          </p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
        >
          Create New Key
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-status-error/10 text-status-error rounded-lg">
          {error}
          <button
            onClick={() => setError(null)}
            className="float-right text-sm hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Created Key Display */}
      {createdKey && (
        <div className="mb-6 p-6 bg-status-active/10 border border-status-active/30 rounded-xl">
          <h3 className="font-semibold text-status-active mb-2">
            API Key Created Successfully!
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Copy this key now. For security reasons, it won&apos;t be shown again.
          </p>
          <div className="flex gap-2">
            <code className="flex-1 p-3 bg-background rounded-lg font-mono text-sm break-all">
              {createdKey}
            </code>
            <button
              onClick={() => copyToClipboard(createdKey)}
              className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors whitespace-nowrap"
            >
              {copiedKey ? "Copied!" : "Copy"}
            </button>
          </div>
          <button
            onClick={() => setCreatedKey(null)}
            className="mt-4 text-sm text-muted-foreground hover:text-foreground"
          >
            I&apos;ve saved my key, close this
          </button>
        </div>
      )}

      {/* Create Key Form */}
      {isCreating && (
        <div className="mb-6 p-6 border border-border rounded-xl bg-muted/30">
          <h3 className="font-semibold mb-4">Create New API Key</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Key Name</label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g., Production App, Development, My Script"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand-500"
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground mt-1">
                A descriptive name to help you identify this key
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewKeyName("");
                }}
                className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateKey}
                disabled={!newKeyName.trim() || createMutation.isPending}
                className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50"
              >
                {createMutation.isPending ? "Creating..." : "Create Key"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rate Limits Info */}
      <div className="mb-6 p-4 bg-muted/30 rounded-xl">
        <h3 className="font-medium mb-2">Rate Limits</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Anonymous</div>
            <div className="font-medium">{RATE_LIMITS.ANONYMOUS}/min</div>
          </div>
          <div>
            <div className="text-muted-foreground">Free Tier</div>
            <div className="font-medium">{RATE_LIMITS.FREE}/min</div>
          </div>
          <div>
            <div className="text-muted-foreground">Pro Tier</div>
            <div className="font-medium">{RATE_LIMITS.PRO}/min</div>
          </div>
          <div>
            <div className="text-muted-foreground">Enterprise</div>
            <div className="font-medium">{RATE_LIMITS.ENTERPRISE}/min</div>
          </div>
        </div>
      </div>

      {/* Keys List */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="p-4 bg-muted/30 border-b border-border">
          <h3 className="font-medium">Your API Keys</h3>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            Loading keys...
          </div>
        ) : keys && keys.length > 0 ? (
          <div className="divide-y divide-border">
            {keys.map((key) => (
              <div
                key={key.id}
                className={`p-4 ${key.revokedAt ? "opacity-50 bg-muted/20" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{key.name}</span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          key.revokedAt
                            ? "bg-status-error/10 text-status-error"
                            : key.isActive
                              ? "bg-status-active/10 text-status-active"
                              : "bg-status-warning/10 text-status-warning"
                        }`}
                      >
                        {key.revokedAt ? "Revoked" : key.isActive ? "Active" : "Inactive"}
                      </span>
                      <span className="px-2 py-0.5 text-xs bg-muted rounded-full">
                        {key.tier}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-sm text-muted-foreground">
                      {key.prefix}...
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span>
                        Created {formatDistanceToNow(new Date(key.createdAt), { addSuffix: true })}
                      </span>
                      {key.lastUsedAt && (
                        <span>
                          Last used {formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true })}
                        </span>
                      )}
                      <span>{key.requestCount.toLocaleString()} requests</span>
                    </div>
                  </div>

                  {!key.revokedAt && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRotateKey(key.id, key.name)}
                        disabled={rotateMutation.isPending}
                        className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                        title="Rotate key"
                      >
                        Rotate
                      </button>
                      <button
                        onClick={() => handleRevokeKey(key.id, key.name)}
                        disabled={revokeMutation.isPending}
                        className="px-3 py-1.5 text-sm text-status-error border border-status-error/30 rounded-lg hover:bg-status-error/10 transition-colors"
                        title="Revoke key"
                      >
                        Revoke
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-muted-foreground">
            <svg
              className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
            <p className="text-lg font-medium mb-2">No API Keys Yet</p>
            <p className="mb-4">Create your first API key to start making requests</p>
            <button
              onClick={() => setIsCreating(true)}
              className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
            >
              Create Your First Key
            </button>
          </div>
        )}
      </div>

      {/* Documentation Link */}
      <div className="mt-8 p-6 border border-border rounded-xl">
        <h3 className="font-semibold mb-2">API Documentation</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Learn how to use the pNode Pulse API to fetch network data, node metrics, and more.
        </p>
        <div className="flex gap-4">
          <a
            href="/api/v1/docs"
            target="_blank"
            className="text-brand-500 hover:underline text-sm"
          >
            View API Reference &rarr;
          </a>
          <a
            href="/openapi.yaml"
            target="_blank"
            className="text-brand-500 hover:underline text-sm"
          >
            Download OpenAPI Spec &rarr;
          </a>
        </div>
      </div>

      {/* Usage Example */}
      <div className="mt-6 p-6 border border-border rounded-xl">
        <h3 className="font-semibold mb-2">Quick Start</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Use your API key in the X-API-Key header or as a Bearer token:
        </p>
        <pre className="p-4 bg-muted/50 rounded-lg overflow-x-auto text-sm font-mono">
{`# Using X-API-Key header
curl -H "X-API-Key: pk_live_YOUR_KEY" \\
  https://pulse.rectorspace.com/api/v1/network

# Using Bearer token
curl -H "Authorization: Bearer pk_live_YOUR_KEY" \\
  https://pulse.rectorspace.com/api/v1/nodes`}
        </pre>
      </div>
    </div>
  );
}
