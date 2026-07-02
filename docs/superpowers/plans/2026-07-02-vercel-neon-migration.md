# pnode-pulse → 100% Vercel + Neon Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move pnode-pulse off the reclabs3 VPS to run 100% on Vercel (FE + all `/api/*` as Vercel Functions + Vercel Cron), backed by Neon (vanilla Postgres, replacing TimescaleDB) and Upstash Redis (rate-limiting only).

**Architecture:** Deploy the existing Next.js 16 monolith to Vercel (drop the `PULSE_API_URL` proxy so Next serves `/api/*` itself — no route porting). Replace TimescaleDB with Neon: `node_metrics` becomes a plain indexed table; the 5 continuous aggregates become **incremental rollup tables** upserted by a Vercel Cron; retention becomes a Cron `DELETE`. The 30s in-process collector becomes a 1-minute Vercel Cron hitting the existing `runCollection()`. SSE realtime is replaced by React-Query polling (its only consumer is a liveness dot), which removes the need for Redis pub/sub — Redis shrinks to the `/api/v1` rate-limiter on Upstash. Dormant BullMQ is retired.

**Tech Stack:** Next.js 16, Prisma 6, Neon serverless Postgres (`@prisma/adapter-neon` + `@neondatabase/serverless`), Upstash Redis (`@upstash/redis` + `@upstash/ratelimit`), Vercel Functions + Cron (Fluid Compute), TypeScript 5.

## Global Constraints

- **Retention:** raw `node_metrics` = **14 days** (RECTOR's choice). Rollup tables persist independently (long-term history).
- **No secrets in code/commits.** Env var NAMES only; values in Vercel env / `~/Documents/secret/.env`.
- **No AI attribution** in any commit/PR/file. Write as a human dev. 2-space indent.
- **TDD + small commits** (one per task). Run `npm run typecheck` + `npm run lint` before each commit; `npm run test` where tests exist.
- **Do NOT touch reclabs3.** The box stays running (rollback path) until `10-DECOMMISSION`. All DB work targets Neon or a local scratch.
- **Node 24 / Prisma 6 / Next 16** floors (already in `package.json`).
- **Vercel plan = Pro** (required for 1-minute cron granularity; covers all projects).

## ⚠️ Design decisions (confirm before executing — baked into tasks below)

1. **Realtime = React-Query polling** (remove SSE `/api/realtime`). Only consumer is `realtime-indicator.tsx` (a liveness dot that cache-busts). Poll cadence = 60s (matches collector). _If true server-push is ever required → Ably/Pusher free tier; out of scope here._
2. **Rollups = incremental tables + upsert cron** (not plain matviews). A matview `REFRESH` recomputes from raw = only 14 days; rollup **tables** keep months of hourly/daily/weekly history after raw is pruned.

---

## File structure (create / modify)

**Create:**

- `prisma/migrations/20260702000000_neon_baseline/migration.sql` — Neon-compatible schema (plain table + rollup tables + indexes) [see Task 1.2 for the migration strategy]
- `src/app/api/cron/collect/route.ts` — 1-min collector cron
- `src/app/api/cron/rollups/route.ts` — rollup upsert cron
- `src/app/api/cron/retention/route.ts` — 14-day retention DELETE cron
- `src/lib/db/rollups.ts` — SQL for incremental hourly/daily/weekly upserts
- `src/lib/cron/auth.ts` — `CRON_SECRET` verification helper
- `src/lib/redis/upstash.ts` — Upstash REST client + `@upstash/ratelimit` limiter
- `tests/lib/rollups.test.ts`, `tests/lib/cron-auth.test.ts`, `tests/api/metrics-date-trunc.test.ts`

**Modify:**

- `prisma/schema.prisma` — add `directUrl`, add rollup-table models, `driverAdapters` preview
- `src/lib/db/index.ts` — Neon pooled adapter
- `src/app/api/v1/nodes/[id]/metrics/route.ts` — `time_bucket()` → `date_trunc()`
- `src/server/api/routers/nodes.ts`, `src/server/api/routers/network.ts` — read rollup tables (names unchanged if we keep names; see Task 3.1)
- `src/lib/api/rate-limiter.ts`, `src/lib/constants/redis.ts` — Upstash
- `src/server/workers/collector/index.ts` — remove Redis publish calls (polling replaces SSE)
- `src/lib/hooks/use-realtime.ts`, `src/components/ui/realtime-indicator.tsx` — polling
- `next.config.ts` — remove `PULSE_API_URL` rewrite + `output: standalone`
- `vercel.json` — add `crons` + `functions.maxDuration` + regions
- `package.json` — add `@prisma/adapter-neon @neondatabase/serverless @upstash/redis @upstash/ratelimit`; remove/retire `bullmq`

**Delete:**

- `src/app/api/realtime/route.ts`, `src/lib/redis/pubsub.ts` (after polling swap)
- `src/lib/queue/*`, `scripts/start-alert-processor.ts` (retire dormant BullMQ) — OR guard-behind-flag if you want to keep for a future Cron reimpl (see Task 7.3)

---

## Phase 0 — Provision (infra)

### Task 0.1: Vercel project + Pro + Neon + Upstash

- [ ] **Link the Vercel project** (repo root; framework auto = next):
  ```bash
  cd ~/local-dev/pnode-pulse && vercel link
  ```
- [ ] **Upgrade to Vercel Pro** (needed for 1-min cron) — dashboard → Settings → Billing, or confirm already Pro. (One Pro membership covers all projects.)
- [ ] **Provision Neon** via Marketplace (auto-injects `DATABASE_URL` + pooled URL):
  ```bash
  vercel integration add neon
  ```
  Capture BOTH connection strings: pooled (`...-pooler...`, for the app) and direct (for `prisma migrate`).
- [ ] **Provision Upstash Redis** via Marketplace (auto-injects `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`):
  ```bash
  vercel integration add upstash
  ```
- [ ] **Pull env locally:**
  ```bash
  vercel env pull .env.local --yes
  ```
- [ ] Verify: `.env.local` contains `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. **No commit** (env only).

---

## Phase 1 — DB layer: Neon-compatible schema

### Task 1.1: Add rollup-table models + Neon adapter config to schema

**Files:** Modify `prisma/schema.prisma`

- [ ] **Step 1:** Add `directUrl` + driver adapters to the datasource/generator:
  ```prisma
  generator client {
    provider        = "prisma-client-js"
    previewFeatures = ["driverAdapters"]
  }
  datasource db {
    provider  = "postgresql"
    url       = env("DATABASE_URL")     // Neon pooled (-pooler)
    directUrl = env("DIRECT_DATABASE_URL") // Neon direct, for migrations
  }
  ```
- [ ] **Step 2:** Add rollup-table models (persist independent of raw retention). Mirror the CAgg columns from `20251207013928_init` (avg/min/max cpu, ram, storage, sample_count):
  ```prisma
  model NodeMetricHourly {
    bucket      DateTime
    nodeId      String   @map("node_id")
    avgCpu      Float?   @map("avg_cpu")
    avgRam      Float?   @map("avg_ram")
    // ...mirror every aggregate column from the init CAgg definition...
    sampleCount Int      @map("sample_count")
    @@id([bucket, nodeId])
    @@map("node_metrics_hourly")
  }
  // Repeat: NodeMetricDaily(node_metrics_daily), NodeMetricWeekly(node_metrics_weekly),
  // NetworkMetricHourly(network_metrics_hourly), NetworkMetricDaily(network_metrics_daily)
  ```
  (Copy the exact SELECT column list from `prisma/migrations/20251207013928_init/migration.sql` L150-195 and `20251207_add_weekly_aggregate/migration.sql` so the rollup tables match what `nodes.ts`/`network.ts` already `SELECT`.)
- [ ] **Step 3:** `npm run typecheck` → PASS. Commit: `refactor(db): add rollup-table models + neon driver-adapter config`.

### Task 1.2: Neon baseline migration (neutralize Timescale)

**Strategy:** Neon is a FRESH DB with no Prisma history, and the box DB is EOL — so we make the migration chain Neon-safe by neutralizing the 3 Timescale migrations and adding a baseline for the rollup tables. Edit in place (safe: no live DB has these checksums except the box, which we never migrate again).

**Files:** Modify `prisma/migrations/20251207013928_init/migration.sql`, `.../20251207_add_weekly_aggregate/migration.sql`; Create `prisma/migrations/20260702000000_neon_baseline/migration.sql`

- [ ] **Step 1:** In `20251207013928_init/migration.sql`, replace the Timescale block (L131-195) with Neon-safe equivalents:
  - Remove `CREATE EXTENSION timescaledb;`
  - Remove the `DROP CONSTRAINT node_metrics_pkey` + `create_hypertable` + composite `(time,id)` PK dance → keep the plain `id` PK from the table create.
  - Remove `add_retention_policy(...)` (handled by retention cron).
  - Convert the 2 continuous-aggregate matviews → **empty rollup tables** already defined via Prisma in Task 1.1 (so DELETE those `CREATE MATERIALIZED VIEW ... WITH (timescaledb.continuous)` blocks here; the tables come from the Prisma model DDL).
  - Remove `add_continuous_aggregate_policy(...)`.
- [ ] **Step 2:** In `20251207_add_weekly_aggregate/migration.sql`, delete the 3 `CREATE MATERIALIZED VIEW ... WITH (timescaledb.continuous)` + their `add_continuous_aggregate_policy` calls (L1-78); KEEP the non-Timescale `ALTER TABLE network_stats ADD COLUMN version_distribution JSONB` (L85).
- [ ] **Step 3:** Generate the baseline for the new rollup-table models against the direct URL:
  ```bash
  npx dotenv -e .env.local -- npx prisma migrate diff \
    --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma \
    --script > prisma/migrations/20260702000000_neon_baseline/migration.sql
  ```
  Review it: should only CREATE the 5 rollup tables + their indexes (unique index on `(bucket, node_id)` / `(bucket)` — needed for upsert + any CONCURRENTLY reads).
- [ ] **Step 4:** Apply to Neon (fresh DB):
  ```bash
  DATABASE_URL="$DIRECT_DATABASE_URL" npx dotenv -e .env.local -- npx prisma migrate deploy
  ```
  Expected: all migrations apply cleanly (no timescaledb errors). Verify: `psql "$DIRECT_DATABASE_URL" -c "\dt"` lists `node_metrics`, `nodes`, `network_stats`, `collection_jobs`, and the 5 `*_hourly/daily/weekly` tables.
- [ ] **Step 5:** Add explicit indexes if not present (raw read path):
  ```sql
  -- in a follow-on migration or the baseline:
  CREATE INDEX IF NOT EXISTS node_metrics_node_time_idx ON node_metrics (node_id, time DESC);
  CREATE INDEX IF NOT EXISTS node_metrics_time_brin ON node_metrics USING brin (time);
  ```
- [ ] **Step 6:** Commit: `refactor(db): neon-compatible migrations (drop timescale hypertable/CAgg/retention)`.

---

## Phase 2 — Neon pooled connection

### Task 2.1: Wire Prisma to Neon serverless pooled adapter

**Files:** Modify `src/lib/db/index.ts`; `package.json`

- [ ] **Step 1:** Install: `npm i @prisma/adapter-neon @neondatabase/serverless` ; `npm run db:generate`.
- [ ] **Step 2:** Replace the client init (keep the global-singleton + build-safe lazy pattern; do NOT wrap in a JS Proxy):

  ```ts
  import { PrismaClient } from "@prisma/client";
  import { PrismaNeon } from "@prisma/adapter-neon";

  const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
  function make() {
    const adapter = new PrismaNeon({
      connectionString: process.env.DATABASE_URL,
    });
    return new PrismaClient({
      adapter,
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    });
  }
  export const db = globalForPrisma.prisma ?? make();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
  ```

- [ ] **Step 3:** `npm run typecheck` → PASS. Smoke: `npx dotenv -e .env.local -- npx tsx -e "import{db}from'./src/lib/db';db.node.count().then(c=>console.log('nodes',c)).finally(()=>process.exit())"` → returns a number (0 on fresh DB).
- [ ] **Step 4:** Commit: `refactor(db): use neon serverless pooled adapter`.

---

## Phase 3 — Query refactor (time_bucket → date_trunc) + rollup readers

### Task 3.1: Point rollup readers at the new tables

**Files:** `src/server/api/routers/nodes.ts` (L320-327, L599-604), `src/server/api/routers/network.ts` (L378-383)

- [ ] **Step 1:** These already `SELECT ... FROM node_metrics_hourly|daily` / `network_metrics_hourly|daily`. Since Task 1.1 created **tables with the same names + columns**, the `$queryRaw` reads are unchanged. Verify each SELECT's columns exist on the new tables (compare to the model). Drop the `node_metrics_weekly` branch only if confirmed unused (survey found no reader).
- [ ] **Step 2:** `npm run typecheck` → PASS. Commit only if any column rename was needed: `refactor(api): align rollup readers to neon rollup tables`.

### Task 3.2: Replace `time_bucket()` with `date_trunc()`

**Files:** `src/app/api/v1/nodes/[id]/metrics/route.ts` (L121-131 hourly, L157-167 daily); Test `tests/api/metrics-date-trunc.test.ts`

- [ ] **Step 1: Write failing test** — assert the hourly branch buckets by hour on plain PG (use a Neon test URL or a local postgres):
  ```ts
  import { describe, it, expect } from "vitest";
  // integration: insert 3 rows in same hour → expect 1 bucket row
  ```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Change `time_bucket('1 hour', time)` → `date_trunc('hour', time)` and `time_bucket('1 day', time)` → `date_trunc('day', time)` (2 spots). Keep alias `as bucket`.
- [ ] **Step 4:** Run test → PASS. `npm run typecheck` → PASS.
- [ ] **Step 5:** Commit: `refactor(api): time_bucket → date_trunc for neon`.

---

## Phase 4 — Rollup upsert + retention crons

### Task 4.1: Rollup upsert SQL + cron

**Files:** Create `src/lib/db/rollups.ts`, `src/app/api/cron/rollups/route.ts`, `src/lib/cron/auth.ts`; Test `tests/lib/rollups.test.ts`

- [ ] **Step 1:** `src/lib/cron/auth.ts`:
  ```ts
  export function assertCron(req: Request) {
    if (
      req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
    )
      throw new Response("Unauthorized", { status: 401 });
  }
  ```
- [ ] **Step 2: Write failing test** for the hourly upsert (insert raw rows → run upsert → rollup row has correct avg + sample_count; re-run → idempotent, no dupes).
- [ ] **Step 3:** `src/lib/db/rollups.ts` — incremental upsert (only recent buckets), e.g. hourly:
  ```ts
  export async function upsertHourly(db) {
    await db.$executeRaw`
      INSERT INTO node_metrics_hourly (bucket, node_id, avg_cpu, /* ...*/ sample_count)
      SELECT date_trunc('hour', time) AS bucket, node_id, AVG(cpu_percent), /* ... */ COUNT(*)
      FROM node_metrics
      WHERE time >= now() - interval '3 hours'
      GROUP BY 1, node_id
      ON CONFLICT (bucket, node_id) DO UPDATE
        SET avg_cpu = EXCLUDED.avg_cpu, /* ... */ sample_count = EXCLUDED.sample_count`;
  }
  // upsertDaily (interval '2 days'), upsertWeekly (interval '2 weeks'),
  // upsertNetworkHourly/Daily (GROUP BY bucket only)
  ```
- [ ] **Step 4:** Run test → PASS.
- [ ] **Step 5:** `src/app/api/cron/rollups/route.ts`:
  ```ts
  import { assertCron } from "@/lib/cron/auth";
  import { db } from "@/lib/db";
  import * as R from "@/lib/db/rollups";
  export const maxDuration = 60;
  export async function GET(req: Request) {
    assertCron(req);
    await R.upsertHourly(db);
    await R.upsertDaily(db);
    await R.upsertWeekly(db);
    await R.upsertNetworkHourly(db);
    await R.upsertNetworkDaily(db);
    return Response.json({ ok: true });
  }
  ```
- [ ] **Step 6:** Commit: `feat(cron): incremental rollup upserts`.

### Task 4.2: Retention cron (14-day raw DELETE)

**Files:** Create `src/app/api/cron/retention/route.ts`

- [ ] **Step 1:**
  ```ts
  import { assertCron } from "@/lib/cron/auth";
  import { db } from "@/lib/db";
  export const maxDuration = 60;
  export async function GET(req: Request) {
    assertCron(req);
    const n =
      await db.$executeRaw`DELETE FROM node_metrics WHERE time < now() - interval '14 days'`;
    return Response.json({ deleted: n });
  }
  ```
- [ ] **Step 2:** `npm run typecheck` → PASS. Commit: `feat(cron): 14-day raw retention`.

---

## Phase 5 — Collector → Vercel Cron

### Task 5.1: Cron collect route (reuse `runCollection()`)

**Files:** Create `src/app/api/cron/collect/route.ts`; Modify `src/server/workers/collector/index.ts` (export `runCollection` if not already)

- [ ] **Step 1:** Confirm `runCollection()` is exported (survey: it is, used by `/api/admin/collect`).
- [ ] **Step 2:** Cron route — double-sample to keep ~30s granularity within a 1-min cron:
  ```ts
  import { assertCron } from "@/lib/cron/auth";
  import { runCollection } from "@/server/workers/collector";
  export const maxDuration = 60;
  export async function GET(req: Request) {
    assertCron(req);
    await runCollection();
    await new Promise((r) => setTimeout(r, 30000)); // second sample at ~t+30s
    await runCollection();
    return Response.json({ ok: true });
  }
  ```
  (If a single cycle risks >25s, drop the double-sample and accept 60s resolution.)
- [ ] **Step 3:** Commit: `feat(cron): collector as vercel cron`.

### Task 5.2: Wire crons in vercel.json

**Files:** Modify `vercel.json`

- [ ] **Step 1:**
  ```json
  {
    "$schema": "https://openapi.vercel.sh/vercel.json",
    "buildCommand": "npx prisma generate && next build",
    "framework": "nextjs",
    "regions": ["fra1"],
    "functions": { "src/app/api/cron/**": { "maxDuration": 60 } },
    "crons": [
      { "path": "/api/cron/collect", "schedule": "* * * * *" },
      { "path": "/api/cron/rollups", "schedule": "*/5 * * * *" },
      { "path": "/api/cron/retention", "schedule": "0 3 * * *" }
    ]
  }
  ```
- [ ] **Step 2:** Set `CRON_SECRET` in Vercel env (`vercel env add CRON_SECRET production`). Commit: `chore(vercel): cron schedules + maxDuration`.

---

## Phase 6 — Realtime → polling (remove SSE)

### Task 6.1: Switch consumer to React-Query polling

**Files:** Modify `src/lib/hooks/use-realtime.ts`, `src/components/ui/realtime-indicator.tsx`; Delete `src/app/api/realtime/route.ts`, `src/lib/redis/pubsub.ts`; Modify `src/server/workers/collector/index.ts` (remove publish calls)

- [ ] **Step 1:** Replace `use-realtime.ts` EventSource logic with a no-op/liveness hook; add `refetchInterval: 60_000` to the dashboard's React-Query options (nodes/network queries). `realtime-indicator.tsx` shows "auto-refresh (60s)".
- [ ] **Step 2:** Remove `publishMetricsUpdate` / `publishNetworkUpdate` calls in `collector/index.ts` (L119) and `network-stats.ts` (L76). Delete `pubsub.ts` + `realtime/route.ts`.
- [ ] **Step 3:** `npm run build` → PASS (no dangling imports). Commit: `refactor(realtime): SSE → react-query polling (serverless-safe)`.

---

## Phase 7 — Redis → Upstash (rate-limiting only); retire BullMQ

### Task 7.1: Upstash client + limiter

**Files:** Create `src/lib/redis/upstash.ts`; Modify `src/lib/api/rate-limiter.ts`

- [ ] **Step 1:** `npm i @upstash/redis @upstash/ratelimit`.
- [ ] **Step 2:** `src/lib/redis/upstash.ts`:
  ```ts
  import { Redis } from "@upstash/redis";
  import { Ratelimit } from "@upstash/ratelimit";
  export const redis = Redis.fromEnv();
  export const apiLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "60 s"),
    analytics: false,
  });
  ```
- [ ] **Step 3:** Rework `rate-limiter.ts` to use `apiLimiter.limit(key)`; KEEP the in-memory fallback (note it's per-instance). Preserve the existing call signature so the 10 `/api/v1` call sites are unchanged.
- [ ] **Step 4:** `npm run typecheck` → PASS. Commit: `refactor(redis): rate-limiter on upstash`.

### Task 7.2: Retire dormant BullMQ + local Redis config

**Files:** Modify `src/lib/constants/redis.ts`, `src/app/api/health/route.ts`; Delete `src/lib/queue/*`, `scripts/start-alert-processor.ts`, `src/lib/redis/index.ts` (if only BullMQ/pubsub used it); Modify `package.json` (remove `bullmq`, `ioredis` if now unused)

- [ ] **Step 1:** Grep for remaining `getRedis`, `bullmq`, `ioredis`, `getReportQueue`, `queue` imports. For each: alert/report enqueue calls in the tRPC routers → remove or wrap in a `if (process.env.ENABLE_ALERTS)` no-op (alerting was dormant; document as "reimplement via cron later" if desired).
- [ ] **Step 2:** `health/route.ts` → replace `isRedisAvailable()` with an Upstash `redis.ping()` (or drop the redis check).
- [ ] **Step 3:** `npm run build` → PASS with no `ioredis`/`bullmq` imports. Commit: `chore: retire dormant bullmq + local redis`.

---

## Phase 8 — next.config + build

### Task 8.1: Drop the proxy so Next serves /api itself

**Files:** Modify `next.config.ts`

- [ ] **Step 1:** Remove the `rewrites()` block (L70-78) OR ensure `PULSE_API_URL` is unset in Vercel (so the beforeFiles rewrite returns `[]`). Remove `output: "standalone"` (L44). Keep Sentry/CSP/headers.
- [ ] **Step 2:** Do NOT set `PULSE_API_URL` / `NEXT_PUBLIC_API_URL` to the VPS on Vercel. `NEXT_PUBLIC_API_URL` can be empty (client tRPC → same-origin `/api/trpc`).
- [ ] **Step 3:** `npm run build` → PASS. Commit: `chore(next): serve /api on vercel (drop VPS proxy)`.

---

## Phase 9 — Data migration (backup → Neon)

### Task 9.1: Load 14-day raw + full rollup history into Neon

**Files:** none (ops); uses `~/reclabs3-backups/2026-07-02/pnode-pulse-timescale.pgcopy`

- [ ] **Step 1:** Restore the backup into a local scratch Timescale (as in `00-BACKUP` verify), between `timescaledb_pre_restore()/post_restore()`.
- [ ] **Step 2:** From scratch, dump ONLY what Neon needs, as plain data:
  ```bash
  # relational tables (full):
  pg_dump "$SCRATCH" --data-only --no-owner -t nodes -t node_peers -t network_stats -t collection_jobs -t 'auth_*' > /tmp/rel.sql
  # raw metrics, last 14 days only:
  psql "$SCRATCH" -c "\copy (SELECT * FROM node_metrics WHERE time > now() - interval '14 days') TO '/tmp/nm.csv' CSV HEADER"
  # rollup history (full — from the materialized hypertables behind the CAgg views):
  psql "$SCRATCH" -c "\copy (SELECT * FROM node_metrics_hourly) TO '/tmp/nmh.csv' CSV HEADER"   # + daily/weekly/network_*
  ```
- [ ] **Step 3:** Load into Neon (`psql "$DIRECT_DATABASE_URL"`): `\copy node_metrics FROM '/tmp/nm.csv' CSV HEADER` (and each rollup CSV → its table; `\i /tmp/rel.sql` for relational). Handle `id` sequence: `SELECT setval(...)` after load.
- [ ] **Step 4:** Verify parity: `SELECT count(*) FROM nodes;` matches box; `SELECT max(time) FROM node_metrics;` within 14 days; rollup tables non-empty.
- [ ] **Step 5:** Tear down scratch (`docker rm -f pulse-scratch && docker volume rm pulse-scratch`).

---

## Phase 10 — Deploy, cutover, verify, buffer, decom

### Task 10.1: Deploy + smoke

- [ ] `vercel --prod`. Smoke on the `*.vercel.app` URL: dashboard renders with data; `/api/health` 200; `/api/v1/nodes` 200 (rate-limit header present); trigger `/api/cron/collect` manually with the `CRON_SECRET` bearer → new `node_metrics` rows + `collection_jobs` COMPLETED.

### Task 10.2: DNS cutover (Cloudflare) — grey-cloud during cut

- [ ] `pulse.rectorspace.com`: add domain in Vercel; Cloudflare A → CNAME `cname.vercel-dns.com`, DNS-only (grey), TTL 300; `dig +short pulse.rectorspace.com` → Vercel; `curl -sI https://pulse.rectorspace.com` → 200.
- [ ] `api.pulse.rectorspace.com`: no longer needed (all `/api` on the main app) → after buffer, remove the record (or point it at the same Vercel app if external consumers use it). Note in `10-DECOMMISSION`.

### Task 10.3: Verify (production)

- [ ] Dashboard live at pulse.rectorspace.com; charts (hourly/daily) render from rollup tables. Cron logs (Vercel → Functions) show collect/rollups/retention firing. `SELECT max(time) FROM node_metrics` advances each minute. Rate-limiter works (Upstash console shows commands). No SSE errors (polling active).

### Task 10.4: Buffer + decom

- [ ] 14-day stability buffer (box stays running = rollback via DNS revert to `151.245.137.75`). Then mark pnode-pulse DONE in `~/Documents/secret/strategy/reclabs3-migration/README.md` and run the pnode-pulse Phase-2 block in `10-DECOMMISSION-reclabs3.md`.

---

## Self-review notes

- **Spec coverage:** DB refactor (P1-3), rollups+retention (P4), collector cron (P5), realtime (P6), redis/upstash (P7), config (P8), data (P9), cutover/decom (P10), provisioning (P0). ✅
- **Rollback:** box untouched until P10.4; DNS revert is instant during the 14-day buffer.
- **Open risk to watch:** the double-sample `setTimeout(30s)` in the collect cron consumes function wall-clock — if a full cycle is slow, drop to single-sample / 60s resolution (Task 5.1 note).
- **Retention vs rollups:** raw = 14 days; rollup tables persist (upsert cron), so long-term charts survive. This is the key correctness point vs a naive matview.
