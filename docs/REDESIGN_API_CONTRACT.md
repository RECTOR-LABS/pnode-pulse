# API Contract — pulse-api (Phase 1)

> Defines the contract for the new `pulse-api` service that replaces direct DB access from the Next.js app. Input for Phase 2 (implementation).
>
> **Inputs**: [`REDESIGN_PRISMA_AUDIT.md`](./REDESIGN_PRISMA_AUDIT.md) (Phase 0)
> **Repo**: `RECTOR-LABS/pnode-pulse` @ `main`
> **Generated**: 2026-05-27

---

## 1. Decision log

All decisions below are RECOMMENDED — flagged with `[CONFIRM]` where a different choice would materially change the architecture. Please push back on these before Phase 2 starts.

### 1.1 Framework: **Hono** `[CONFIRM]`

| | Hono | Express | tRPC server-only |
|---|---|---|---|
| Runtime | Node, Bun, Cloudflare, Vercel | Node | Node |
| Bundle size | ~14 KB | ~250 KB | tRPC + ts-rest deps |
| Validation | First-class zod adapter | Manual | Built-in zod |
| Streaming / SSE | Built-in | Plugin | Limited |
| OpenAPI generation | `@hono/zod-openapi` | swagger-jsdoc (manual) | `trpc-openapi` (mostly works) |
| Performance | Fast (built on web-standard fetch) | Slower | Same as transport |
| RECTOR's stack fit | Matches devsol API pattern | Heavy | Already used internally — we're moving AWAY from it |

**Decision**: Hono. Matches the handoff recommendation, has the cleanest zod story, gives us OpenAPI export for free.

### 1.2 Runtime: **Node 24 LTS** (Fluid Compute compatible)

Since pulse-api lives on the VPS as a long-running Docker container (not on Vercel), we get full Node freedom. No edge constraints. Node 24 LTS is the current default per the Vercel knowledge update — keeping parity with the FE makes shared-types easier.

### 1.3 Authentication: **`Authorization: Bearer <token>` header for everything** `[CONFIRM]`

The Next.js app today passes JWT as a tRPC **input field** (`token`). That breaks REST conventions and forces every procedure to declare an unrelated `token` zod field. The new contract switches to standard headers.

| Caller | Auth | Header |
|---|---|---|
| Dashboard (user-facing, Vercel FE → pulse-api) | JWT (existing wallet-sig flow) | `Authorization: Bearer <jwt>` |
| Public REST (SDKs, bots, mobile, Grafana) | API key (existing `ApiKey` table) | `Authorization: Bearer <api_key>` *(or `X-API-Key` accepted for backward compat)* |
| Internal (health probe, Prometheus scrape) | none / shared secret | n/a or `X-Internal-Key` |

Reasons:
- Standard, works with any HTTP client without per-procedure schema changes
- Cleaner OpenAPI specs (auth as a global security scheme)
- Easier rate-limiting + observability — the auth layer doesn't need to parse the request body

**Migration impact**: the existing tRPC `authMiddleware` is re-implemented as a Hono middleware that reads `Authorization` instead of `getRawInput().token`. The wallet-sig flow + DB session lookup logic carry over unchanged.

### 1.4 Serialization: **plain JSON; BigInt → string, Date → ISO 8601** `[CONFIRM]`

The current tRPC setup uses **superjson** (transparent `BigInt` + `Date`). Replicating that across pulse-api → FE → SDKs would require every consumer to install superjson. We don't need it.

| Field type | Wire format | Client parsing |
|---|---|---|
| `BigInt` (13 fields in schema) | JSON string, decimal `"94633"` | `BigInt(str)` or just keep as string for display |
| `DateTime` (65 fields) | ISO 8601 string `"2026-05-27T10:00:00.000Z"` | `new Date(str)` |
| `Int`, `Float` | JSON number | native |
| `Boolean`, `String` | native | native |
| `null` | `null` | native |
| Enums | string literal `"ACTIVE"` | TS string literal type |

**Why string for BigInt**: JSON spec doesn't allow it. Numbers above `2^53` lose precision. Strings round-trip exactly.

**Helper for pulse-api**: one shared serializer that walks Prisma results and converts `bigint` → string, `Date` → ISO string. Roughly:

```ts
function serialize<T>(v: T): T {
  if (typeof v === 'bigint') return v.toString() as any;
  if (v instanceof Date) return v.toISOString() as any;
  if (Array.isArray(v)) return v.map(serialize) as any;
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, serialize(val)])) as any;
  }
  return v;
}
```

Applied once at the response edge. Hono's `c.json()` runs through this wrapper.

### 1.5 Real-time approach: **polling, 5–30s cadence** `[CONFIRM]`

The audit found **zero WebSocket usage** in the current app. The dashboard already polls. Polling is:
- Trivial on Vercel (no persistent connections)
- Friendly to Vercel Runtime Cache (responses are cacheable)
- Easy to scale (just shard by client)

**SSE option** kept open: Hono supports `streamSSE()` out of the box and Vercel proxies it fine. We add SSE later if a feature genuinely needs sub-5s push (e.g., a "live attack mode" view). Not required for v1.

**No WebSocket**. Vercel doesn't support persistent WS in serverless, and we don't have a use case that justifies running a separate WS server on the VPS.

### 1.6 Caching: **3 layers, all opt-in per endpoint**

| Layer | Where | What | TTL guidance |
|---|---|---|---|
| 1. pulse-api `Cache-Control` | response header | tells Vercel + CDN how long to cache | `public, s-maxage=30, stale-while-revalidate=60` for live data; longer for historical |
| 2. Vercel Runtime Cache | FE side (per-region KV) | wrap outbound `fetch` calls from RSC / route handlers | per-call `cache: 'force-cache'` + `next.revalidate` |
| 3. Redis (already running on VPS) | pulse-api side | only for heavy aggregate queries that don't benefit from continuous aggregates | 60–300s |

**Default**: no caching. Add it per-endpoint where measured latency or load justifies it. Don't pre-optimize.

### 1.7 Public REST URL strategy: **Vercel rewrites for backward compat** `[CONFIRM]`

External consumers (SDKs, bots, mobile, Grafana plugin) hit `https://pulse.rectorspace.com/api/v1/*` today. After cutover:

- Add `vercel.ts` `rewrites` mapping `/api/v1/*` → `https://api.pulse.rectorspace.com/v1/*`
- Keep external URLs stable indefinitely (no SDK release coordination needed for cutover)
- SDKs can OPTIONALLY be updated later to skip the rewrite hop, but it's not required

Trade-off: each public-API request goes Vercel → VPS instead of direct → VPS (one extra TLS hop). Acceptable; Vercel rewrites are cheap and we avoid breaking every external consumer at once.

### 1.8 Local dev story: **default to production API for reads**

- FE local dev (`pnpm dev`): default `NEXT_PUBLIC_PULSE_API_URL=https://api.pulse.rectorspace.com` — gets real data, can't mutate
- Mutation testing: developer runs pulse-api locally with `pnpm dev` in `packages/pulse-api/`, points FE at `http://localhost:7004`, uses local Postgres
- Vercel preview deployments: default to production API (read-only previews) unless a `vercel.ts` env override points to a staging API

We don't run staging instances of pulse-api unless we see a need.

---

## 2. URL & request conventions

### 2.1 Base URL

| Env | Base URL |
|---|---|
| Production | `https://api.pulse.rectorspace.com` |
| Local | `http://localhost:7004` |

### 2.2 Path structure

```
/healthz                              # internal liveness — no auth
/metrics                              # Prometheus scrape — no auth (network-restricted)
/v1/<domain>/<resource>[/<action>]    # versioned API
```

- **Versioned**: `/v1` prefix on everything user-facing. We'll commit to v1 stability for at least 12 months.
- **Domain-grouped**: matches tRPC routers — `/v1/nodes/*`, `/v1/network/*`, `/v1/alerts/*`, etc.
- **Public sub-tree**: `/v1/public/*` for endpoints that allow anonymous/API-key access (today's `/api/v1/*` lands here). Internal endpoints under `/v1/<domain>/*` require JWT.

### 2.3 HTTP methods

| Method | Purpose |
|---|---|
| `GET` | Reads (idempotent) |
| `POST` | Creates + non-idempotent actions (e.g., `/v1/alerts/rules/:id/acknowledge`) |
| `PATCH` | Partial updates |
| `PUT` | Full replace (rare; we'll usually use PATCH) |
| `DELETE` | Deletes |

### 2.4 Resource identifiers

Per `CLAUDE.md` + Brad's guidance, **pubkey is the primary public identifier** for nodes (IPs can change). Internal numeric IDs are not exposed in v1.

```
GET /v1/nodes/:pubkey                # base58 pubkey
GET /v1/nodes/:pubkey/metrics
GET /v1/alerts/rules/:ruleId         # cuid for user-scoped records
GET /v1/portfolio/nodes/:pubkey
```

For records without a natural public key (alert rules, portfolios, claims), we use the existing Prisma `cuid()` string IDs.

### 2.5 Pagination

Standard query params; preserves current `/api/v1/nodes` shape:

```
GET /v1/nodes?limit=50&offset=0&orderBy=lastSeen&order=desc
```

| Param | Type | Default | Limits |
|---|---|---|---|
| `limit` | int | 50 | 1–100 |
| `offset` | int | 0 | ≥0 |
| `orderBy` | string | per-endpoint | per-endpoint whitelist |
| `order` | `"asc"\|"desc"` | `"desc"` | |

Response envelope:

```json
{
  "data": [...],
  "page": { "limit": 50, "offset": 0, "total": 137, "hasMore": true }
}
```

(Aside: today's REST returns `nodes`, `total`, `limit`, `offset`, `hasMore` at top level. The new shape with `data` + `page` is more consistent across resources. The Vercel rewrite for `/api/v1/*` can shim this back to the old shape for SDK backward compat — see §1.7.)

### 2.6 Filtering

Resource-specific query params. Documented per endpoint. Example:

```
GET /v1/nodes?status=active&version=0.7.3&search=192.190.136
```

### 2.7 Time ranges (metrics endpoints)

Standardized on **ISO 8601 + bucket** for any time-series endpoint:

```
GET /v1/nodes/:pubkey/metrics?from=2026-05-20T00:00:00Z&to=2026-05-27T00:00:00Z&bucket=hour
```

| Param | Required | Values |
|---|---|---|
| `from` | yes | ISO 8601 UTC |
| `to` | no — default = now | ISO 8601 UTC |
| `bucket` | no — default = `auto` | `raw \| minute \| hour \| day \| week \| auto` |

`auto` picks bucket based on range: <6h → raw, <2d → minute, <30d → hour, <180d → day, ≥180d → week. Server returns the chosen bucket in the response.

`raw` / `minute` hit the hypertable directly. `hour` / `day` / `week` hit the matching continuous aggregate (`node_metrics_hourly` / `_daily` / `_weekly`).

### 2.8 Error format

Single shape for every error response:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "No node with pubkey 7T4z...",
    "details": null
  },
  "requestId": "req_01HZ..."
}
```

`code` is from a closed enum (below). `message` is human-readable. `details` is an arbitrary object — for validation errors it carries zod issues; for rate-limit errors the limit info; otherwise `null`.

`requestId`: pulse-api assigns one per request, logs it, returns it. Lets us correlate FE bug reports with server logs.

#### Error code enum

| Code | HTTP | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing/invalid auth token |
| `FORBIDDEN` | 403 | Authenticated but not allowed |
| `RESOURCE_NOT_FOUND` | 404 | No record at the path |
| `VALIDATION_ERROR` | 400 | Request body/params failed zod validation; `details` contains zod issues |
| `RATE_LIMIT_EXCEEDED` | 429 | Sliding window exceeded; `details` carries `{ limit, tier, retryAfter }` |
| `CONFLICT` | 409 | Unique constraint violation (e.g., wallet already claimed) |
| `UPSTREAM_ERROR` | 502 | DB/Redis unreachable; pulse-api up but can't serve |
| `INTERNAL_ERROR` | 500 | Unhandled exception |

### 2.9 Response headers (standard)

| Header | Set when |
|---|---|
| `Content-Type: application/json; charset=utf-8` | always (JSON responses) |
| `Cache-Control` | per-endpoint (default `no-store` for authenticated, `public, s-maxage=…` for public reads) |
| `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` | public-tier requests |
| `Retry-After` | 429 responses |
| `X-Request-Id` | always (matches `requestId` in error body) |

### 2.10 Pubkey & ID validation

- Pubkey: zod `z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)` (base58, Solana keypair length)
- cuid: `z.string().regex(/^c[a-z0-9]{24,}$/i)`
- Both validated at the route layer; consistent `VALIDATION_ERROR` response on miss.

---

## 3. Endpoint inventory

Full mapping of every tRPC procedure + REST route to its pulse-api equivalent. Use this as the checklist for Phase 2.

> **Legend**
> - `*` = consumed by FE today (count: 86)
> - `(int)` = internal/admin-only, not FE-consumed
> - `(public)` = anonymous + API-key accessible (under `/v1/public/`)

### 3.1 nodes module — `/v1/nodes/*`

| METHOD | Path | tRPC equivalent | Auth | Notes |
|---|---|---|---|---|
| `GET` | `/v1/nodes` * | `nodes.list` | JWT | filters: status, version, search; paginated |
| `GET` | `/v1/nodes/:pubkey` * | `nodes.byId` | JWT | by pubkey, not numeric id |
| `GET` | `/v1/nodes/:pubkey/metrics` * | `nodes.metrics` + `metricsHistory` | JWT | unified, uses `from`/`to`/`bucket` (§2.7) |
| `GET` | `/v1/nodes/:pubkey/metrics/latest` * | `nodes.latestMetric` | JWT | single snapshot |
| `GET` | `/v1/nodes/:pubkey/peers` * | `nodes.peers` | JWT | |
| `GET` | `/v1/nodes/:pubkey/address-history` * | `nodes.addressHistory` | JWT | IP change log |
| `GET` | `/v1/nodes` (with `?includeMetrics=true`) * | `nodes.listWithMetrics` | JWT | merged into list endpoint |
| `GET` | `/v1/nodes/leaderboard` * | `nodes.leaderboard` | JWT | mirrors public leaderboard, JWT-protected variant |
| `GET` | `/v1/nodes/versions` * | `nodes.versions` | JWT | version distribution |
| `GET` | `/v1/nodes/recent-address-changes` * | `nodes.recentAddressChanges` | JWT | |

### 3.2 network module — `/v1/network/*`

| METHOD | Path | tRPC equivalent | Auth | Notes |
|---|---|---|---|---|
| `GET` | `/v1/network/overview` * | `network.overview` | JWT | live snapshot |
| `GET` | `/v1/network/trends` * | `network.trends` | JWT | `bucket=` param |
| `GET` | `/v1/network/collection-status` * | `network.collectionStatus` | JWT | collector job state |
| `GET` | `/v1/network/geo/nodes` * | `network.geoNodes` | JWT | for map view |
| `GET` | `/v1/network/geo/connections` * | `network.geoConnections` | JWT | peer edges |
| `GET` | `/v1/network/peer-graph` * | `network.peerGraph` | JWT | graph data |

### 3.3 alerts module — `/v1/alerts/*`

| METHOD | Path | tRPC equivalent | Auth |
|---|---|---|---|
| `GET` | `/v1/alerts/rules` * | `alerts.rules` | JWT |
| `POST` | `/v1/alerts/rules` * | `alerts.createRule` | JWT |
| `PATCH` | `/v1/alerts/rules/:id` * | `alerts.updateRule` | JWT |
| `DELETE` | `/v1/alerts/rules/:id` * | `alerts.deleteRule` | JWT |
| `POST` | `/v1/alerts/rules/:id/toggle` * | `alerts.toggleRule` | JWT |
| `GET` | `/v1/alerts/history` * | `alerts.history` | JWT |
| `POST` | `/v1/alerts/:id/acknowledge` * | `alerts.acknowledge` | JWT |
| `POST` | `/v1/alerts/:id/resolve` * | `alerts.resolve` | JWT |
| `GET` | `/v1/alerts/channels` * | `alerts.channels` | JWT |
| `POST` | `/v1/alerts/channels/email` * | `alerts.addEmail` | JWT |
| `POST` | `/v1/alerts/channels/email/:id/verify` * | `alerts.verifyEmail` | JWT |
| `POST` | `/v1/alerts/channels/telegram` * | `alerts.addTelegram` | JWT |
| `POST` | `/v1/alerts/channels/discord` * | `alerts.addDiscord` | JWT |
| `DELETE` | `/v1/alerts/channels/:id` * | `alerts.deleteChannel` | JWT |
| `GET` | `/v1/alerts/escalation-policies` * | `alerts.escalationPolicies` | JWT |
| `POST` | `/v1/alerts/escalation-policies` * | `alerts.createEscalationPolicy` | JWT |
| `PATCH` | `/v1/alerts/escalation-policies/:id` * | `alerts.updateEscalationPolicy` | JWT |
| `DELETE` | `/v1/alerts/escalation-policies/:id` * | `alerts.deleteEscalationPolicy` | JWT |
| `POST` | `/v1/alerts/migrate-to-user` * | `alerts.migrateToUser` | JWT |

### 3.4 analytics module — `/v1/analytics/*`

| METHOD | Path | tRPC equivalent | Auth |
|---|---|---|---|
| `GET` | `/v1/analytics/network-health` * | `analytics.networkHealth` | JWT |
| `GET` | `/v1/analytics/at-risk-nodes` * | `analytics.atRiskNodes` | JWT |
| `GET` | `/v1/analytics/network-degradation` * | `analytics.networkDegradation` | JWT |
| `GET` | `/v1/analytics/network-growth` * | `analytics.networkGrowth` | JWT |
| `GET` | `/v1/analytics/network-connectivity` * | `analytics.networkConnectivity` | JWT |
| `GET` | `/v1/analytics/peer-optimizations` * | `analytics.peerOptimizations` | JWT |
| `GET` | `/v1/analytics/storage-stats` * | `analytics.storageStats` | JWT |
| `GET` | `/v1/analytics/node-accessibility` * | `analytics.nodeAccessibility` | JWT |
| `GET` | `/v1/analytics/version-distribution` (int?) | `analytics.storageVersionDistribution` + version router | JWT |
| `GET` | `/v1/analytics/graveyard` * | `analytics.graveyard.list` | JWT |
| `GET` | `/v1/analytics/graveyard/stats` * | `analytics.graveyard.stats` | JWT |
| `GET` | `/v1/analytics/graveyard/churn` * | `analytics.graveyard.churn` | JWT |

### 3.5 portfolio module — `/v1/portfolio/*`

| METHOD | Path | tRPC equivalent | Auth |
|---|---|---|---|
| `GET` | `/v1/portfolio` * | `portfolio.get` | JWT |
| `GET` | `/v1/portfolio/stats` * | `portfolio.stats` | JWT |
| `GET` | `/v1/portfolio/benchmark` * | `portfolio.benchmark` | JWT |
| `GET` | `/v1/portfolio/uptime-report` * | `portfolio.uptimeReport` | JWT |
| `POST` | `/v1/portfolio/nodes` * | `portfolio.addNode` | JWT |
| `PATCH` | `/v1/portfolio/nodes/:pubkey` * | `portfolio.updateNode` | JWT |
| `DELETE` | `/v1/portfolio/nodes/:pubkey` * | `portfolio.removeNode` | JWT |

### 3.6 comparison module — `/v1/comparison/*`

| METHOD | Path | tRPC equivalent | Auth |
|---|---|---|---|
| `GET` | `/v1/comparison/nodes` * (query: `pubkeys=a,b,c`) | `comparison.compareNodes` | JWT |
| `GET` | `/v1/comparison/peer-health` * | `comparison.peerHealth` | JWT |
| `GET` | `/v1/comparison/portfolio-version-status` * | `comparison.portfolioVersionStatus` | JWT |
| `GET` | `/v1/comparison/recommendations` * | `comparison.recommendations` | JWT |
| `GET` | `/v1/comparison/search` * | `comparison.searchNodes` | JWT |
| `GET` | `/v1/comparison/underperformers` * | `comparison.underperformers` | JWT |
| `GET` | `/v1/comparison/version-status` * | `comparison.versionStatus` | JWT |

### 3.7 export module — `/v1/export/*`

| METHOD | Path | tRPC equivalent | Auth |
|---|---|---|---|
| `GET` | `/v1/export/preview` * | `export.preview` | JWT |
| `POST` | `/v1/export/csv` * | `export.generateCsv` | JWT |

### 3.8 auth module — `/v1/auth/*`

| METHOD | Path | tRPC equivalent | Auth |
|---|---|---|---|
| `POST` | `/v1/auth/challenge` * | `auth.requestChallenge` | none |
| `POST` | `/v1/auth/verify` * | `auth.verifySignature` | none (returns JWT) |
| `GET` | `/v1/auth/me` * | `auth.me` | JWT |
| `GET` | `/v1/auth/sessions` * | `auth.sessions` | JWT |
| `DELETE` | `/v1/auth/sessions/:id` * | `auth.revokeSession` | JWT |
| `POST` | `/v1/auth/logout` * | `auth.logout` | JWT |
| `POST` | `/v1/auth/logout-all` * | `auth.logoutAll` | JWT |
| `PATCH` | `/v1/auth/me/preferences` * | `auth.updatePreferences` | JWT |
| `PATCH` | `/v1/auth/me/profile` * | `auth.updateProfile` | JWT |

### 3.9 claims module — `/v1/claims/*`

| METHOD | Path | tRPC equivalent | Auth |
|---|---|---|---|
| `GET` | `/v1/claims` * | `claims.list` | JWT |
| `GET` | `/v1/claims/:pubkey/check` * | `claims.checkNode` | JWT |
| `POST` | `/v1/claims` * | `claims.initiate` | JWT |
| `POST` | `/v1/claims/:id/verify` * | `claims.verify` | JWT |
| `PATCH` | `/v1/claims/:id` * | `claims.updateDisplayName` | JWT |
| `DELETE` | `/v1/claims/:id` * | `claims.release` | JWT |

### 3.10 apiKeys module — `/v1/api-keys/*`

| METHOD | Path | tRPC equivalent | Auth |
|---|---|---|---|
| `GET` | `/v1/api-keys` * | `apiKeys.list` | JWT |
| `POST` | `/v1/api-keys` * | `apiKeys.create` | JWT (returns plaintext once) |
| `POST` | `/v1/api-keys/:id/rotate` * | `apiKeys.rotate` | JWT |
| `DELETE` | `/v1/api-keys/:id` * | `apiKeys.revoke` | JWT |

### 3.11 profiles module — `/v1/profiles/*`

| METHOD | Path | tRPC equivalent | Auth |
|---|---|---|---|
| `GET` | `/v1/profiles/me` (int) | `profiles.*` | JWT |

(Profiles router has 14 DB calls but isn't FE-consumed via tRPC — likely internal helpers; flesh out during Phase 2 inspection.)

### 3.12 badges module — `/v1/badges/*`

| METHOD | Path | tRPC equivalent | Auth |
|---|---|---|---|
| `GET` | `/v1/badges` (int) | `badges.*` | JWT |
| `GET` | `/v1/operators/:pubkey/badges` (int) | `badges.*` | JWT |

### 3.13 reports module — `/v1/reports/*`

| METHOD | Path | tRPC equivalent | Auth |
|---|---|---|---|
| `GET` | `/v1/reports` * | `reports.list` | JWT |
| `POST` | `/v1/reports` * | `reports.create` | JWT |
| `POST` | `/v1/reports/:id/toggle` * | `reports.toggle` | JWT |
| `POST` | `/v1/reports/:id/send-now` * | `reports.sendNow` | JWT |
| `DELETE` | `/v1/reports/:id` * | `reports.delete` | JWT |
| `GET` | `/v1/reports/timezones` * | `reports.timezones` | none (static data; or move to FE) |

### 3.14 public — `/v1/public/*` (API-key or anonymous)

These replace today's `/api/v1/*` REST. Behind the scenes the Vercel rewrite from §1.7 keeps the old URLs working.

| METHOD | Path | Replaces | Auth |
|---|---|---|---|
| `GET` | `/v1/public/nodes` (public) | `app/api/v1/nodes/route.ts` | API key or anonymous (rate-limited) |
| `GET` | `/v1/public/nodes/:pubkey` (public) | `app/api/v1/nodes/[id]/route.ts` | API key or anonymous |
| `GET` | `/v1/public/nodes/:pubkey/metrics` (public) | `app/api/v1/nodes/[id]/metrics/route.ts` | API key or anonymous |
| `GET` | `/v1/public/network` (public) | `app/api/v1/network/route.ts` | API key or anonymous |
| `GET` | `/v1/public/network/stats` (public) | `app/api/v1/network/stats/route.ts` | API key or anonymous |
| `GET` | `/v1/public/leaderboard` (public) | `app/api/v1/leaderboard/route.ts` | API key or anonymous |
| `GET` | `/v1/public/docs` (public) | `app/api/v1/docs/page.tsx` | none (or moves to FE as static doc) |

### 3.15 special routes (outside `/v1`)

| METHOD | Path | Purpose | Auth |
|---|---|---|---|
| `GET` | `/healthz` | Liveness probe (DB ping + Redis ping) | none |
| `GET` | `/metrics` | Prometheus exporter | none (network-restricted via nginx) |
| `GET` | `/badge/:type` | SVG status badge (current `app/api/badge/[type]/route.ts`) | none |

### 3.16 Inventory totals

| Module | Public-FE endpoints | Internal/admin endpoints | Public REST endpoints | Total |
|---|---:|---:|---:|---:|
| nodes | 10 | — | — | 10 |
| network | 6 | — | — | 6 |
| alerts | 19 | — | — | 19 |
| analytics | 11 | 1 | — | 12 |
| portfolio | 7 | — | — | 7 |
| comparison | 7 | — | — | 7 |
| export | 2 | — | — | 2 |
| auth | 9 | — | — | 9 |
| claims | 6 | — | — | 6 |
| apiKeys | 4 | — | — | 4 |
| profiles | — | ~5 | — | 5 |
| badges | — | ~2 | — | 2 |
| reports | 6 | — | — | 6 |
| public | — | — | 7 | 7 |
| special | — | 3 | — | 3 |
| **Total** | **87** | **~11** | **7** | **~105 endpoints** |

Matches the Phase 0 estimate (~110). Of those, ~95 are first-class FE/SDK endpoints; the rest are operational/internal.

---

## 4. Sample endpoint specs

Five representative patterns. The remaining ~100 endpoints follow these templates.

### 4.1 Pattern A — Paginated list with filters

**`GET /v1/nodes`**

Request:
```
GET /v1/nodes?limit=50&offset=0&status=active&version=0.7.3&orderBy=lastSeen&order=desc
Authorization: Bearer <jwt>
```

Query params:
| Name | Type | Required | Default | Notes |
|---|---|---|---|---|
| `limit` | int | no | 50 | 1–100 |
| `offset` | int | no | 0 | ≥0 |
| `status` | enum | no | `all` | `all \| active \| inactive \| archived` |
| `version` | string | no | — | exact match on `version` |
| `search` | string | no | — | substring match on address/pubkey |
| `orderBy` | enum | no | `lastSeen` | `lastSeen \| firstSeen \| address \| version \| isActive` |
| `order` | enum | no | `desc` | `asc \| desc` |

Response 200:
```json
{
  "data": [
    {
      "pubkey": "7T4zPNNDAT7rwkQ6Rf2QyMvLwowQ4KDSxKRXF9qEtYvR",
      "address": "62.84.180.240:9001",
      "version": "0.7.3",
      "status": "ACTIVE",
      "isPublic": true,
      "rpcPort": 6000,
      "firstSeen": "2025-12-08T12:00:00.000Z",
      "lastSeen": "2026-05-27T09:54:00.000Z",
      "country": "US",
      "city": "Denver",
      "latitude": 39.7392,
      "longitude": -104.9903
    }
  ],
  "page": { "limit": 50, "offset": 0, "total": 137, "hasMore": true }
}
```

Errors: `UNAUTHORIZED`, `VALIDATION_ERROR`, `INTERNAL_ERROR`.

### 4.2 Pattern B — Single resource by pubkey

**`GET /v1/nodes/:pubkey`**

Path params:
| Name | Type | Notes |
|---|---|---|
| `pubkey` | base58 string | validated per §2.10 |

Response 200:
```json
{
  "pubkey": "7T4zPNNDAT7rwkQ6Rf2QyMvLwowQ4KDSxKRXF9qEtYvR",
  "address": "62.84.180.240:9001",
  "gossipAddress": "62.84.180.240:9001",
  "version": "0.7.3",
  "status": "ACTIVE",
  "isActive": true,
  "isPublic": true,
  "rpcPort": 6000,
  "firstSeen": "2025-12-08T12:00:00.000Z",
  "lastSeen": "2026-05-27T09:54:00.000Z",
  "country": "US",
  "city": "Denver",
  "latitude": 39.7392,
  "longitude": -104.9903,
  "peerCount": 23,
  "latestMetric": {
    "time": "2026-05-27T09:54:00.000Z",
    "cpuPercent": 6.63,
    "ramUsed": "5399207936",
    "ramTotal": "12567232512",
    "uptime": 154484,
    "fileSize": "558000000000",
    "totalBytes": "94633",
    "storageCommitted": "183000000000",
    "storageUsagePercent": 0.00005
  }
}
```

Errors: `UNAUTHORIZED`, `VALIDATION_ERROR` (bad pubkey format), `RESOURCE_NOT_FOUND`.

Cache: `Cache-Control: public, s-maxage=15, stale-while-revalidate=60`.

### 4.3 Pattern C — Time-series metrics with bucket selection

**`GET /v1/nodes/:pubkey/metrics`**

Query params:
| Name | Type | Required | Default |
|---|---|---|---|
| `from` | ISO 8601 | yes | — |
| `to` | ISO 8601 | no | now |
| `bucket` | enum | no | `auto` |

Response 200:
```json
{
  "pubkey": "7T4zPNNDAT...",
  "bucket": "hour",
  "source": "node_metrics_hourly",
  "from": "2026-05-20T00:00:00.000Z",
  "to": "2026-05-27T00:00:00.000Z",
  "series": [
    {
      "bucket": "2026-05-20T00:00:00.000Z",
      "avgCpu": 7.2,
      "avgRamPercent": 42.9,
      "maxUptime": 86400,
      "maxFileSize": "558000000000",
      "sampleCount": 60
    }
  ]
}
```

Server picks `bucket=hour` because the 7-day range falls in the `hour` band; reports it back in `bucket` and notes which Timescale view (`node_metrics_hourly`) was queried in `source`. For `raw`/`minute`, `source` would be `node_metrics`.

This is the contract pattern that locks pulse-api to TimescaleDB. Any future migration would need to recreate equivalent pre-aggregations.

### 4.4 Pattern D — Mutation (create + return)

**`POST /v1/alerts/rules`**

Request:
```http
POST /v1/alerts/rules HTTP/1.1
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "nodePubkey": "7T4z...",
  "metric": "CPU_PERCENT",
  "operator": "GREATER_THAN",
  "threshold": 80,
  "durationSeconds": 300,
  "channelIds": ["clxxxxxxxxxx"]
}
```

Body validation (zod):
```ts
z.object({
  nodePubkey: pubkeySchema,
  metric: z.enum(['CPU_PERCENT','RAM_PERCENT','UPTIME','STORAGE_PERCENT', /* ... */]),
  operator: z.enum(['GREATER_THAN','LESS_THAN','EQUALS']),
  threshold: z.number(),
  durationSeconds: z.number().int().min(60).max(86400),
  channelIds: z.array(cuidSchema).min(1)
})
```

Response 201:
```json
{
  "id": "clxxxxxxxxxxxxxxxxxxxxxxx",
  "userId": "clyyy...",
  "nodePubkey": "7T4z...",
  "metric": "CPU_PERCENT",
  "operator": "GREATER_THAN",
  "threshold": 80,
  "durationSeconds": 300,
  "isEnabled": true,
  "createdAt": "2026-05-27T10:00:00.000Z"
}
```

Errors: `UNAUTHORIZED`, `VALIDATION_ERROR`, `RESOURCE_NOT_FOUND` (channel doesn't exist or belongs to other user), `CONFLICT` (duplicate rule).

### 4.5 Pattern E — Action on resource

**`POST /v1/alerts/:id/acknowledge`**

Request:
```http
POST /v1/alerts/clxxxxxxx/acknowledge HTTP/1.1
Authorization: Bearer <jwt>
Content-Type: application/json

{ "note": "Investigating; node looks healthy" }
```

Response 200:
```json
{
  "id": "clxxxxxxx",
  "status": "ACKNOWLEDGED",
  "acknowledgedAt": "2026-05-27T10:05:00.000Z",
  "acknowledgedBy": "clyyy...",
  "note": "Investigating; node looks healthy"
}
```

Errors: `UNAUTHORIZED`, `FORBIDDEN` (not your alert), `RESOURCE_NOT_FOUND`, `CONFLICT` (already resolved).

---

## 5. Shared types strategy

The existing tRPC routers already have:
- **Input validation** via zod schemas
- **Output types** inferred from Prisma + procedure return values
- **End-to-end type safety** from FE through to DB

We want to preserve as much of this as possible across the FE/API split.

### 5.1 Recommended: `packages/pulse-types`

A new workspace package shared between FE and pulse-api:

```
packages/pulse-types/
├── package.json
├── src/
│   ├── index.ts                # public surface
│   ├── schemas/                # zod schemas (request validation)
│   │   ├── nodes.ts
│   │   ├── alerts.ts
│   │   └── ...
│   ├── responses/              # output type definitions
│   │   ├── nodes.ts
│   │   └── ...
│   └── enums/                  # shared enum types (mirrored from Prisma)
│       ├── node-status.ts
│       └── ...
```

- pulse-api imports schemas to validate incoming requests
- pulse-api imports response types to enforce return shape
- FE imports response types to type the data it receives from `fetch()`
- Both stay in sync because there's one source

### 5.2 Generation flow

1. Define zod schemas + TS response types in `packages/pulse-types` (these are the contract)
2. pulse-api: `hono` route uses `zValidator('json'|'query', schema)` for inputs; return type asserted as the matching response type
3. FE: typed `fetch` wrapper (`src/lib/pulse-api/client.ts`) — generic over `<Req, Res>`, infers from the schema
4. Optionally: `@hono/zod-openapi` exports `openapi.json` at build time for SDK consumers

### 5.3 Alternative considered: OpenAPI-first with codegen

- Write `openapi.yaml` by hand → generate clients with `openapi-typescript` / `openapi-fetch`
- Pro: language-agnostic, SDKs in Python/Rust easier
- Con: more boilerplate, less ergonomic for internal FE work, easier to drift between yaml and code

**Recommendation**: start with `packages/pulse-types` (zod-first). Add `@hono/zod-openapi` for spec emission. SDKs can consume the generated OpenAPI; no hand-written yaml.

### 5.4 Enums

Prisma enums (16 of them) live in `prisma/schema.prisma`. The schema stays with pulse-api. We mirror the enum string values in `packages/pulse-types/src/enums/` as TS string-literal unions:

```ts
export const NodeStatus = ['ACTIVE', 'INACTIVE', 'ARCHIVED'] as const;
export type NodeStatus = (typeof NodeStatus)[number];
```

Add a CI check: if Prisma enum values diverge from the mirror, fail the build.

---

## 6. Migration strategy (input for Phase 3)

The audit found zero Server Component / Server Action DB access — all FE data flows through tRPC. This enables a **strangler pattern**:

1. Build pulse-api with all endpoints (Phase 2)
2. Keep the tRPC HTTP handler running on Vercel — rewrite each procedure body to call pulse-api instead of `ctx.db`
3. FE components don't change at all during this phase
4. After all procedures are proxied, optionally collapse the tRPC indirection (replace `trpc.X.Y.useQuery()` with a pulse-api hook)

**Why this matters**: every router can migrate independently. Per-router rollback is trivial (revert that router's file). FE work can be deferred or skipped entirely if the proxy layer is acceptable long-term.

```
PHASE 2:    pulse-api stands up alongside, FE unchanged
PHASE 3a:   tRPC handlers become proxies — one router at a time
PHASE 3b:   (optional) collapse tRPC → direct pulse-api client in FE
PHASE 4-6:  Vercel deploy + DNS cutover
PHASE 7:    Decommission old monolith
```

This is more conservative than the original Phase 3 in the handoff. It's worth considering whether to skip 3b entirely — the tRPC-as-proxy layer adds one network hop but eliminates a whole class of FE refactor risk.

---

## 7. Open questions for Phase 2 sign-off

These need to be confirmed BEFORE Phase 2 implementation starts. They're flagged `[CONFIRM]` in §1 above:

1. **Framework**: Hono (vs Express, Fastify, tRPC)?
2. **Auth header**: `Authorization: Bearer` (vs keep input-field model)?
3. **Serialization**: Plain JSON with BigInt→string (vs superjson everywhere)?
4. **Real-time**: Polling-only for v1 (vs add SSE upfront)?
5. **Public v1 URL strategy**: Vercel rewrite to keep old URLs (vs coordinate SDK release)?

Plus three secondary decisions that don't block Phase 2 but should be settled:

6. **Strangler vs full refactor for Phase 3**: tRPC-as-proxy long-term, or eliminate tRPC entirely?
7. **API versioning policy**: How long do we commit to `/v1` stability before introducing `/v2`?
8. **Profiles router exposure**: 14 DB calls, no FE consumption — keep internal, expose, or delete?

---

## 8. Phase 2 prerequisites checklist

Before starting implementation:

- [ ] All `[CONFIRM]` decisions in §1 signed off
- [ ] `packages/pulse-types` workspace package scaffolded
- [ ] VPS port `7004` reserved (per handoff)
- [ ] DNS plan for `api.pulse.rectorspace.com` confirmed (Cloudflare A record → VPS IP, proxied)
- [ ] nginx site config drafted for `api.pulse.rectorspace.com` (proxy_pass `http://localhost:7004`)
- [ ] GHCR repo + GitHub Actions secrets ready for pulse-api deploys
- [ ] Decision on monorepo layout: pulse-api lives in `packages/pulse-api/` (recommended) vs new repo
- [ ] Test database strategy: pulse-api needs its own connection string in CI / local dev

---

**Phase 1 deliverable status**: this document. Phase 2 starter prompt (in [VERCEL_MIGRATION_HANDOFF.md](../VERCEL_MIGRATION_HANDOFF.md)) consumes it.
