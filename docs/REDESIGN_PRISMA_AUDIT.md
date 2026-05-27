# Prisma Audit — pulse-api Redesign (Phase 0)

> Input for Phase 1 (API contract design). Surveys every place the Next.js app reads/writes the DB via Prisma, so the new `pulse-api` service knows exactly which endpoints to expose.
>
> **Scope**: `src/` only (FE + tRPC + REST + workers). Tests excluded. Generated 2026-05-27.
>
> **Repo**: `RECTOR-LABS/pnode-pulse` @ `main` (commit `9ae0298`)

---

## 1. Topline numbers

| Metric | Count |
|---|---:|
| Files importing `@/lib/db` (the singleton) | 26 |
| Total `db.<model>.<method>` call sites | 302 |
| Total `ctx.db.<model>.<method>` call sites (tRPC) | 305 |
| Raw SQL call sites (`$queryRaw` / `$executeRaw`) — source, non-test | 67 |
| Distinct tRPC procedures consumed by FE | **86** |
| Prisma models in schema | 25 |
| Prisma enums in schema | 16 |
| `BigInt` fields in schema (serialization concern) | 13 |
| `DateTime` fields in schema (serialization concern) | 65 |

**Key finding**: **zero** Server Components, Server Actions, or `.tsx` pages call `db` directly. Every FE data path already goes through tRPC. This significantly reduces Phase 3 (FE refactor) risk — see §7.

---

## 2. Call sites by caller type

| Caller type | Files | DB calls | Disposition |
|---|---:|---:|---|
| **tRPC routers** (`src/server/api/routers/**`) | 22 | 305 | Replace with pulse-api endpoints |
| **Public REST API v1** (`src/app/api/v1/**`) | 7 | 35 | Replace with pulse-api endpoints (these are also external/SDK consumers — keep stable URL via Next.js rewrite or move to pulse-api directly) |
| **Internal REST** (`src/app/api/{health,metrics,badge}/**`) | 4 | 10 | Replace with pulse-api endpoints |
| **Workers** (`src/server/workers/**`) | 11 | 58 | **STAY ON VPS** — collector/pruner/alert-processor/report-processor keep their DB import |
| **DB client / auth helpers** (`src/lib/db`, `src/lib/auth/verify-token`, `src/lib/api/rate-limiter`) | 3 | n/a | Keep on pulse-api side; FE no longer imports `@/lib/db` |
| **Server Components / Server Actions / pages** | **0** | **0** | Nothing to refactor at the page layer |

### tRPC router call counts

| Router | DB calls | Notes |
|---|---:|---|
| `alerts.ts` | 44 | Largest; rules + channels + escalation + history |
| `nodes.ts` | 31 | + 14 raw SQL (continuous aggregates) |
| `export.ts` | 22 | CSV generation |
| `network.ts` | 20 | + 9 raw SQL (continuous aggregates) |
| `auth.ts` | 19 | Sessions, user, preferences |
| `portfolio.ts` | 17 | User-owned node grouping |
| `badges.ts` | 16 | + 1 raw SQL |
| `claims.ts` | 15 | Node ownership claims |
| `reports.ts` | 14 | Scheduled report config |
| `profiles.ts` | 14 | + 2 raw SQL |
| `comparison.ts` | 14 | + 3 raw SQL |
| `apiKeys.ts` | 14 | API key issuance/rotation |
| `analytics/graveyard.ts` | 13 | + 1 raw SQL — archived nodes |
| `analytics/health.ts` | 11 | + 3 raw SQL |
| `analytics/resources.ts` | 8 | + 1 raw SQL |
| `analytics/peers.ts` | 7 | + 1 raw SQL |
| `analytics/growth.ts` | 6 | + 1 raw SQL |
| `analytics/storage.ts` | 5 | v0.7.0 storage stats |
| `analytics/patterns.ts` | 4 | |
| `analytics/forecasting.ts` | 4 | + 2 raw SQL |
| `analytics/degradation.ts` | 4 | |
| `analytics/version.ts` | 3 | |
| `analytics/statistics.ts` | 2 | + 1 raw SQL |
| **Total** | **305** | + 39 raw SQL |

### Public REST `/api/v1/*` call counts

| Endpoint | DB calls | Raw SQL | Purpose |
|---|---:|---:|---|
| `v1/leaderboard/route.ts` | 16 | 16 | All-raw-SQL — biggest single file (CTEs, DISTINCT ON, multi-period rankings) |
| `v1/nodes/[id]/metrics/route.ts` | 4 | 2 | Per-node metrics with `time_bucket` for hourly/daily |
| `v1/network/route.ts` | 4 | 1 | Network-wide latest snapshot |
| `v1/nodes/route.ts` | 2 | 0 | List nodes |
| `v1/nodes/[id]/route.ts` | 2 | 0 | Get single node |
| `v1/network/stats/route.ts` | 1 | 1 | Network rolling stats |

### Internal REST

| Endpoint | DB calls | Raw SQL | Purpose |
|---|---:|---:|---|
| `api/badge/[type]/route.ts` | 6 | 2 | SVG status badges |
| `api/metrics/route.ts` | 2 | 1 | Prometheus exporter |
| `api/health/route.ts` | 1 | 1 | Liveness probe |

### Workers (stay on VPS)

| Worker | DB calls |
|---|---:|
| `workers/alert-processor.ts` | 14 |
| `workers/report-processor.ts` | 10 |
| `workers/collector/node-repository.ts` | 7 |
| `workers/collector/index.ts` | 6 |
| `workers/pruner.ts` | 5 |
| `workers/collector/node-discovery.ts` | 5 |
| `workers/collector/network-stats.ts` | 3 |
| `workers/collector/peer-manager.ts` | 2 |
| `workers/collector/metrics-saver.ts` | 2 |
| `workers/collector/geolocation.ts` | 2 |
| `workers/collector/federation-handler.ts` | 2 |
| **Total** | **58** |

---

## 3. Access pattern breakdown

Overall method distribution across `db.*` + `ctx.db.*` (excluding raw SQL):

| Method | Count | Type |
|---|---:|---|
| `findMany` | 162 | read |
| `findFirst` | 112 | read |
| `count` | 84 | read |
| `findUnique` | 69 | read |
| `groupBy` | 44 | read |
| `aggregate` | 4 | read |
| **Read total** | **475** | |
| `update` | 63 | write |
| `create` | 46 | write |
| `updateMany` | 13 | write |
| `deleteMany` | 14 | write |
| `delete` | 12 | write |
| `upsert` | 4 | write |
| **Write total** | **152** | |
| `$queryRaw` / `$executeRaw` | 67 | raw |

Reads outnumber writes ~3.1×, which is expected for a monitoring dashboard. Most writes are in workers (collector ingestion) or settings/CRUD routers (alerts/portfolio/apiKeys/claims).

---

## 4. Models accessed (by call frequency)

Top models by combined `db.*` + `ctx.db.*` access count:

| Model | Calls | Used by |
|---|---:|---|
| `Node` | 130 | nodes, network, comparison, analytics, leaderboard, badges, workers |
| `NodeMetric` | 23 | nodes, network, analytics, badge, metrics (mostly read via raw SQL on aggregates instead) |
| `AlertRule` | 19 | alerts, alert-processor worker |
| `Alert` | 19 | alerts, alert-processor |
| `Portfolio` | 15 | portfolio |
| `NodeClaim` | 15 | claims |
| `ApiKey` | 14 | apiKeys, rate-limiter |
| `OperatorProfile` | 13 | profiles, badges |
| `ScheduledReport` | 13 | reports, report-processor |
| `NotificationChannel` | 13 | alerts |
| `NodePeer` | 12 | network, analytics/peers |
| `EscalationPolicy` | 9 | alerts |
| `UserSession` | 9 | auth |
| `ReportDelivery` | 8 | reports, report-processor |
| `User` | 8 | auth |
| `NetworkStats` | 7 | network, workers/collector |
| `Badge` | 6 | badges |
| `NodeAddressChange` | 6 | nodes, workers/collector |
| `PortfolioNode` | 6 | portfolio |
| `OperatorBadge` | 5 | badges |
| `AuthChallenge` | 5 | auth |
| `CollectionJob` | 5 | workers/collector |
| `ApiKeyUsage` | 2 | apiKeys, rate-limiter |
| `UptimeEvent` | 1 | analytics |
| `EscalationStep` | 1 | alerts |

All 25 models in the schema are touched; nothing is dead.

---

## 5. TimescaleDB-specific queries — MUST stay TimescaleDB-aware

These cannot run against plain PostgreSQL (Neon, Supabase, Vercel Marketplace Postgres). They depend on TimescaleDB extensions: `time_bucket`, `create_hypertable`, continuous aggregate views.

### Continuous-aggregate reads (8 sites)

| Aggregate view | Read from |
|---|---|
| `node_metrics_hourly` | `nodes.ts:318`, `nodes.ts:599` |
| `node_metrics_daily` | `nodes.ts:323`, `nodes.ts:604` |
| `network_metrics_daily` | `network.ts:354` |
| `network_metrics_hourly` | `network.ts:359` |

Views are defined in `prisma/migrations/20251207013928_init/migration.sql` and `prisma/migrations/20251207_add_weekly_aggregate/migration.sql`. Refresh policies attached via `add_continuous_aggregate_policy`.

### `time_bucket` direct queries (2 sites)

- `src/app/api/v1/nodes/[id]/metrics/route.ts:131` — `time_bucket('1 hour', time)` for per-node hourly aggregation when continuous aggregates are stale or not used
- `src/app/api/v1/nodes/[id]/metrics/route.ts:167` — `time_bucket('1 day', time)` for daily

### Hypertable

- `node_metrics` is a hypertable (chunk interval = 1 day). Direct reads from it use `DISTINCT ON (node_id)` + `ORDER BY time DESC` patterns to get latest-per-node — seen in `leaderboard/route.ts`, `nodes.ts`, `network.ts`, `analytics/health.ts`.

### Implication for Phase 1 (API contract)

Every endpoint that does "metrics over time" needs the API to either:
- (a) accept a bucket parameter (`hour|day|week`) and route to the matching continuous aggregate, **or**
- (b) accept a raw time range and pass through to `time_bucket` directly.

This is the core reason DB stays on the VPS — moving to non-Timescale Postgres would require rewriting these queries with much worse query plans (no pre-aggregated buckets, no compression).

---

## 6. Serialization concerns for pulse-api

The current tRPC setup (`src/server/api/trpc.ts:30-32`) uses **superjson** for transport, which transparently handles `BigInt` and `Date`. If pulse-api uses Hono with plain JSON, two field types break:

### `BigInt` fields (13 — JSON.stringify throws on these)

Concentrated in metric fields where pNode stats overflow `Number.MAX_SAFE_INTEGER`:

- `ram_used`, `ram_total`, `file_size`, `total_bytes`
- `storage_committed`, `storage_used`
- Some count fields

**Options**:
- Use `superjson` end-to-end (hono-superjson middleware exists)
- Use a custom serializer that does `BigInt → string` (most APIs return as decimal strings)
- Decide once in Phase 1 and stick with it — the FE client wrapper hides the choice from components

### `DateTime` fields (65)

JSON has no native `Date` — wire format is ISO 8601 string. Decide in Phase 1:
- Plain JSON + ISO strings (FE parses with `new Date(...)`)
- Superjson (transparent, but adds dependency)

Recommendation: ISO strings unless we want zero-friction migration of existing tRPC consumers.

---

## 7. Caller-type implications for Phase 3 (FE refactor)

**Surprise win**: no `page.tsx`, no `layout.tsx`, no Server Action calls `db` directly. All FE data flows through tRPC:

```
page.tsx (Client Component) → trpc.<router>.<proc>.useQuery() → tRPC handler → ctx.db → Postgres
```

This means Phase 3 reduces to:

1. **Generate a typed pulse-api client** (OpenAPI codegen or shared TS types) that mimics the tRPC shape so component diffs are minimal
2. **Swap the import**: `import { trpc } from "@/trpc"` → `import { api } from "@/lib/pulse-api"` (or keep the tRPC client and have the tRPC handler proxy to pulse-api during transition)
3. **Delete `src/server/api/`**, `src/lib/db/`, `prisma/` once cutover complete

We do **not** need to rewrite individual pages. The handoff's "this is the longest phase" estimate may be conservative.

**Transition pattern available**: keep the tRPC HTTP handler in place during cutover, but rewrite each tRPC procedure body to call pulse-api instead of `ctx.db`. This lets us migrate one router at a time with zero FE changes, then later collapse the indirection.

---

## 8. pulse-api endpoint estimate

Two ways to count:

### (a) Surface-area count: ~108 endpoints

| Source | Count |
|---|---:|
| tRPC procedures consumed by FE (today) | 86 |
| Public REST `/api/v1/*` (external SDK consumers — must remain stable) | 8 |
| Internal REST (`/api/health`, `/api/metrics`, `/api/badge/[type]`) | ~3 (4 incl. `[type]` variants — `pulse`, `online`, `version` etc.) |
| Internal tRPC procedures (admin-only, not FE-consumed yet — count uncertain, likely <20) | up to 20 |
| **Working total** | **~110–115 endpoints** |

### (b) Domain count: 13 domain modules

If we batch endpoints into Hono route groups by router file, pulse-api ends up roughly as:

```
pulse-api/
├── nodes/        (~14 endpoints: list, byId, metrics, history, peers, ...)
├── network/      (~8: overview, stats, geo, peerGraph, trends, ...)
├── alerts/       (~19: rules, channels, escalation, history, ack, ...)
├── analytics/    (~15: health, growth, peers, forecasting, graveyard, ...)
├── portfolio/    (~7)
├── comparison/   (~7)
├── reports/      (~6)
├── auth/         (~8)
├── claims/       (~6)
├── apiKeys/      (~5)
├── profiles/     (~5 incl. operator badges)
├── badges/       (~5)
└── public-v1/    (8 stable REST endpoints — separate sub-tree, no auth wrapping)
```

13 router-equivalent groups. Each group maps to one router file in the new service, mirroring the existing tRPC layout for refactor convenience.

---

## 9. Risks / open questions for Phase 1

1. **Public REST `/api/v1/*` URL stability** — external SDKs (`packages/sdk-typescript`, `packages/sdk-python`), bots (`packages/discord-bot`, `packages/telegram-bot`), Grafana plugin, and mobile app likely call `https://pulse.rectorspace.com/api/v1/*`. After cutover:
   - Option A: Vercel `vercel.ts` `rewrites` → forward `/api/v1/*` to `api.pulse.rectorspace.com/v1/*` (one fewer breaking change for consumers)
   - Option B: Pin SDKs to `api.pulse.rectorspace.com` directly (cleaner long-term, but a coordinated SDK release)
   - Decide in Phase 1; affects pulse-api routing.

2. **`/api/badge/[type]/route.ts` returns SVG, not JSON** — likely cached by external sites. Confirm route should live on pulse-api (serves SVG) or remain on Vercel as an edge-cached proxy.

3. **`/api/metrics/route.ts` (Prometheus exporter)** — scrape target for monitoring; high-frequency. Should live close to DB (pulse-api on VPS) to minimize latency.

4. **Auth model**: tRPC currently uses JWT-in-input (`token` field on every request). pulse-api should likely use `Authorization: Bearer …` headers — cleaner, but means rewriting the auth middleware contract. Settle in Phase 1.

5. **superjson vs plain JSON**: see §6. Affects API contract format.

6. **Real-time / live data**: The dashboard polls. No WebSocket usage detected. SSE is an option but probably unnecessary for current refresh cadence — confirm polling is fine in Phase 1.

7. **Rate limiter (`src/lib/api/rate-limiter.ts`)** — uses DB for `ApiKeyUsage` tracking. Must move to pulse-api alongside `apiKeys` router.

8. **Local dev**: After refactor, FE on Vercel preview needs to talk to **production** pulse-api (no local DB). Decide if every preview environment should hit production read endpoints or if there's an isolated staging API.

---

## 10. Phase 1 input checklist (what this audit delivers)

- [x] Full list of every Prisma call site (302 + 305 + 67 = **674 calls** across **49 files**)
- [x] Caller-type categorization (RSC=0 / tRPC=22 routers / REST=7 v1 + 4 internal / workers=11)
- [x] Read/write/raw breakdown (475 read, 152 write, 67 raw)
- [x] Per-router DB-call counts (for endpoint estimation)
- [x] TimescaleDB-specific query inventory (8 continuous-aggregate reads, 2 direct `time_bucket`, multiple `DISTINCT ON` hypertable scans)
- [x] Model-access frequency (top: `Node` 130, `NodeMetric` 23, all 25 models in use)
- [x] Serialization concerns (`BigInt` ×13 fields, `DateTime` ×65 fields, superjson today)
- [x] Endpoint estimate for pulse-api (~110 endpoints across 13 domain modules + public-v1)
- [x] Open questions for Phase 1 (auth header style, public v1 URL strategy, badge/metrics routing, real-time approach)

**Next step**: Phase 1 — design `docs/REDESIGN_API_CONTRACT.md`, choose framework (Hono recommended), settle the open questions above, and produce the OpenAPI/typed-client spec.
