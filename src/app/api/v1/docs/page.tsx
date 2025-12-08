"use client";

import { useState } from "react";
import Link from "next/link";

interface Endpoint {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  summary: string;
  description: string;
  parameters?: Array<{
    name: string;
    in: "query" | "path" | "header";
    required: boolean;
    type: string;
    description: string;
    default?: string;
  }>;
  response: {
    example: object;
  };
}

const ENDPOINTS: Endpoint[] = [
  {
    method: "GET",
    path: "/api/v1/network",
    summary: "Network Overview",
    description: "Returns high-level network statistics including node counts, version distribution, and aggregate metrics.",
    response: {
      example: {
        nodes: { total: 45, active: 42, inactive: 3 },
        versions: [{ version: "0.6.0", count: 30 }, { version: "0.5.1", count: 15 }],
        metrics: {
          totalStorageBytes: 24902340000000,
          avgCpuPercent: 6.5,
          avgRamPercent: 43.2,
          avgUptimeSeconds: 432000,
          timestamp: "2024-01-15T12:00:00Z"
        }
      }
    }
  },
  {
    method: "GET",
    path: "/api/v1/network/stats",
    summary: "Detailed Network Statistics",
    description: "Returns detailed aggregate metrics with percentiles (p50, p90, p99) for CPU and RAM usage.",
    response: {
      example: {
        cpu: { avg: 6.5, min: 0.5, max: 85.2, p50: 4.2, p90: 15.8, p99: 45.3 },
        ram: { avgPercent: 43.2, minPercent: 12.1, maxPercent: 92.5, p50: 38.5, p90: 72.1, p99: 88.4 },
        storage: { total: 24902340000000, avg: 553385333333 },
        uptime: { avgSeconds: 432000 },
        nodeCount: 45
      }
    }
  },
  {
    method: "GET",
    path: "/api/v1/nodes",
    summary: "List Nodes",
    description: "Returns a paginated list of all known pNodes with optional filtering and sorting.",
    parameters: [
      { name: "status", in: "query", required: false, type: "string", description: "Filter by status", default: "all" },
      { name: "version", in: "query", required: false, type: "string", description: "Filter by version" },
      { name: "search", in: "query", required: false, type: "string", description: "Search by address or pubkey" },
      { name: "limit", in: "query", required: false, type: "integer", description: "Results per page (1-100)", default: "50" },
      { name: "offset", in: "query", required: false, type: "integer", description: "Pagination offset", default: "0" },
      { name: "orderBy", in: "query", required: false, type: "string", description: "Sort field", default: "lastSeen" },
      { name: "order", in: "query", required: false, type: "string", description: "Sort direction (asc/desc)", default: "desc" }
    ],
    response: {
      example: {
        nodes: [
          {
            id: 1,
            address: "192.168.1.100:6000",
            pubkey: "7T4zPNNDAT7rwkQ6Rf2QyMvLwowQ4KDSxKRXF9qEtYvR",
            version: "0.6.0",
            isActive: true,
            lastSeen: "2024-01-15T12:00:00Z",
            firstSeen: "2024-01-01T00:00:00Z"
          }
        ],
        total: 45,
        limit: 50,
        offset: 0,
        hasMore: false
      }
    }
  },
  {
    method: "GET",
    path: "/api/v1/nodes/{id}",
    summary: "Get Node Details",
    description: "Returns detailed information about a specific node including latest metrics.",
    parameters: [
      { name: "id", in: "path", required: true, type: "string", description: "Node ID or address" }
    ],
    response: {
      example: {
        id: 1,
        address: "192.168.1.100:6000",
        pubkey: "7T4zPNNDAT7rwkQ6Rf2QyMvLwowQ4KDSxKRXF9qEtYvR",
        version: "0.6.0",
        isActive: true,
        lastSeen: "2024-01-15T12:00:00Z",
        firstSeen: "2024-01-01T00:00:00Z",
        metrics: {
          cpuPercent: 6.5,
          ramUsedBytes: 5399207936,
          ramTotalBytes: 12567232512,
          ramPercent: 42.96,
          storageBytes: 558000000000,
          uptimeSeconds: 154484,
          packetsReceived: 7218,
          packetsSent: 5965,
          timestamp: "2024-01-15T12:00:00Z"
        },
        peerCount: 27,
        metricsCount: 4320
      }
    }
  },
  {
    method: "GET",
    path: "/api/v1/nodes/{id}/metrics",
    summary: "Get Node Metrics History",
    description: "Returns historical metrics for a node with configurable time range and aggregation.",
    parameters: [
      { name: "id", in: "path", required: true, type: "integer", description: "Node ID" },
      { name: "range", in: "query", required: false, type: "string", description: "Time range: 1h, 24h, 7d, 30d", default: "24h" },
      { name: "aggregation", in: "query", required: false, type: "string", description: "Aggregation: raw, hourly, daily", default: "hourly" }
    ],
    response: {
      example: {
        nodeId: 1,
        range: "24h",
        aggregation: "hourly",
        data: [
          { time: "2024-01-15T11:00:00Z", cpuPercent: 6.2, ramPercent: 42.5, storageBytes: 558000000000, uptimeSeconds: 154000 },
          { time: "2024-01-15T12:00:00Z", cpuPercent: 6.8, ramPercent: 43.1, storageBytes: 558000000000, uptimeSeconds: 157600 }
        ]
      }
    }
  },
  {
    method: "GET",
    path: "/api/v1/leaderboard",
    summary: "Node Leaderboard",
    description: "Returns node rankings by specified metric.",
    parameters: [
      { name: "metric", in: "query", required: false, type: "string", description: "Ranking metric: uptime, cpu, ram, storage", default: "uptime" },
      { name: "order", in: "query", required: false, type: "string", description: "Show top or bottom performers", default: "top" },
      { name: "limit", in: "query", required: false, type: "integer", description: "Number of results (1-100)", default: "10" },
      { name: "period", in: "query", required: false, type: "string", description: "Time period: 24h, 7d, 30d, all", default: "7d" }
    ],
    response: {
      example: {
        metric: "uptime",
        period: "7d",
        order: "top",
        rankings: [
          {
            rank: 1,
            nodeId: 5,
            address: "192.168.1.105:6000",
            version: "0.6.0",
            value: 604800,
            metrics: { uptimeSeconds: 604800, cpuPercent: 5.2, ramPercent: 38.5, storageBytes: 750000000000 }
          }
        ]
      }
    }
  }
];

const METHOD_COLORS = {
  GET: "bg-green-500/20 text-green-600 dark:text-green-400",
  POST: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  PUT: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
  DELETE: "bg-red-500/20 text-red-600 dark:text-red-400"
};

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const [expanded, setExpanded] = useState(false);
  const [tryItOpen, setTryItOpen] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useState<Record<string, string>>({});

  const handleTryIt = async () => {
    setLoading(true);
    setResponse(null);

    try {
      let url = endpoint.path;
      const queryParams: string[] = [];

      endpoint.parameters?.forEach((p) => {
        const value = params[p.name] || p.default;
        if (value) {
          if (p.in === "path") {
            url = url.replace(`{${p.name}}`, value);
          } else if (p.in === "query") {
            queryParams.push(`${p.name}=${encodeURIComponent(value)}`);
          }
        }
      });

      if (queryParams.length > 0) {
        url += `?${queryParams.join("&")}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (err) {
      setResponse(JSON.stringify({ error: "Request failed" }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors text-left"
      >
        <span className={`px-2 py-1 text-xs font-mono rounded ${METHOD_COLORS[endpoint.method]}`}>
          {endpoint.method}
        </span>
        <span className="font-mono text-sm flex-1">{endpoint.path}</span>
        <span className="text-sm text-muted-foreground hidden md:block">{endpoint.summary}</span>
        <svg
          className={`w-5 h-5 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border p-4 space-y-4">
          <p className="text-sm text-muted-foreground">{endpoint.description}</p>

          {/* Parameters */}
          {endpoint.parameters && endpoint.parameters.length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-2">Parameters</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="pb-2 pr-4">Name</th>
                      <th className="pb-2 pr-4">Location</th>
                      <th className="pb-2 pr-4">Type</th>
                      <th className="pb-2 pr-4">Required</th>
                      <th className="pb-2">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {endpoint.parameters.map((param) => (
                      <tr key={param.name}>
                        <td className="py-2 pr-4 font-mono text-xs">{param.name}</td>
                        <td className="py-2 pr-4 text-xs">{param.in}</td>
                        <td className="py-2 pr-4 text-xs">{param.type}</td>
                        <td className="py-2 pr-4 text-xs">{param.required ? "Yes" : "No"}</td>
                        <td className="py-2 text-xs text-muted-foreground">
                          {param.description}
                          {param.default && <span className="ml-1">(default: {param.default})</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Example Response */}
          <div>
            <h4 className="font-medium text-sm mb-2">Example Response</h4>
            <pre className="p-4 bg-muted/50 rounded-lg overflow-x-auto text-xs font-mono">
              {JSON.stringify(endpoint.response.example, null, 2)}
            </pre>
          </div>

          {/* Try It */}
          <div>
            <button
              onClick={() => setTryItOpen(!tryItOpen)}
              className="flex items-center gap-2 text-sm text-brand-500 hover:underline"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Try It
            </button>

            {tryItOpen && (
              <div className="mt-4 p-4 border border-border rounded-lg space-y-4">
                {endpoint.parameters && endpoint.parameters.length > 0 && (
                  <div className="grid gap-3">
                    {endpoint.parameters.map((param) => (
                      <div key={param.name} className="flex items-center gap-2">
                        <label className="w-24 text-sm font-mono">{param.name}</label>
                        <input
                          type="text"
                          placeholder={param.default || param.description}
                          value={params[param.name] || ""}
                          onChange={(e) => setParams({ ...params, [param.name]: e.target.value })}
                          className="flex-1 px-3 py-1.5 text-sm border border-border rounded bg-background"
                        />
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={handleTryIt}
                  disabled={loading}
                  className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50"
                >
                  {loading ? "Loading..." : "Send Request"}
                </button>

                {response && (
                  <pre className="p-4 bg-muted/50 rounded-lg overflow-x-auto text-xs font-mono max-h-96 overflow-y-auto">
                    {response}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block">
          &larr; Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold mb-2">API Documentation</h1>
        <p className="text-muted-foreground">
          REST API for programmatic access to pNode network data
        </p>
      </div>

      {/* Quick Info */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="p-4 border border-border rounded-xl">
          <div className="text-sm text-muted-foreground mb-1">Base URL</div>
          <code className="text-sm font-mono">https://pulse.rectorspace.com</code>
        </div>
        <div className="p-4 border border-border rounded-xl">
          <div className="text-sm text-muted-foreground mb-1">Authentication</div>
          <code className="text-sm font-mono">X-API-Key: pk_live_...</code>
        </div>
        <div className="p-4 border border-border rounded-xl">
          <div className="text-sm text-muted-foreground mb-1">Rate Limits</div>
          <span className="text-sm">30-10,000 req/min by tier</span>
        </div>
      </div>

      {/* Authentication Section */}
      <section className="mb-8 p-6 border border-border rounded-xl">
        <h2 className="text-xl font-semibold mb-4">Authentication</h2>
        <p className="text-sm text-muted-foreground mb-4">
          API requests can be made anonymously (30 req/min) or with an API key for higher limits.
          Create API keys in your <Link href="/settings/api-keys" className="text-brand-500 hover:underline">Settings</Link>.
        </p>
        <div className="space-y-2 text-sm">
          <div className="p-3 bg-muted/50 rounded-lg font-mono">
            <div className="text-muted-foreground mb-1"># Using X-API-Key header</div>
            curl -H &quot;X-API-Key: pk_live_YOUR_KEY&quot; https://pulse.rectorspace.com/api/v1/network
          </div>
          <div className="p-3 bg-muted/50 rounded-lg font-mono">
            <div className="text-muted-foreground mb-1"># Using Bearer token</div>
            curl -H &quot;Authorization: Bearer pk_live_YOUR_KEY&quot; https://pulse.rectorspace.com/api/v1/network
          </div>
        </div>
      </section>

      {/* Rate Limiting Section */}
      <section className="mb-8 p-6 border border-border rounded-xl">
        <h2 className="text-xl font-semibold mb-4">Rate Limiting</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Rate limits are applied per-minute using a sliding window. Response headers include:
        </p>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-2 pr-4">Header</th>
                <th className="pb-2">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">X-RateLimit-Limit</td>
                <td className="py-2 text-xs">Maximum requests allowed per minute</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">X-RateLimit-Remaining</td>
                <td className="py-2 text-xs">Requests remaining in current window</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">X-RateLimit-Reset</td>
                <td className="py-2 text-xs">Unix timestamp when limit resets</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-lg font-bold">30</div>
            <div className="text-xs text-muted-foreground">Anonymous</div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-lg font-bold">100</div>
            <div className="text-xs text-muted-foreground">Free Tier</div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-lg font-bold">1,000</div>
            <div className="text-xs text-muted-foreground">Pro Tier</div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-lg font-bold">10,000</div>
            <div className="text-xs text-muted-foreground">Enterprise</div>
          </div>
        </div>
      </section>

      {/* Endpoints */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Endpoints</h2>
        <div className="space-y-4">
          {ENDPOINTS.map((endpoint) => (
            <EndpointCard key={`${endpoint.method}-${endpoint.path}`} endpoint={endpoint} />
          ))}
        </div>
      </section>

      {/* Resources */}
      <section className="mt-8 p-6 border border-border rounded-xl">
        <h2 className="text-xl font-semibold mb-4">Resources</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <a
            href="/openapi.yaml"
            target="_blank"
            className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
          >
            <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div>
              <div className="font-medium">OpenAPI Spec</div>
              <div className="text-sm text-muted-foreground">Download YAML specification</div>
            </div>
          </a>
          <Link
            href="/settings/api-keys"
            className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
          >
            <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <div>
              <div className="font-medium">Get API Key</div>
              <div className="text-sm text-muted-foreground">Create keys for higher rate limits</div>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
