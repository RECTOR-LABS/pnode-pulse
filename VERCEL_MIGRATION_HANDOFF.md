# Vercel Migration / Redesign — pnode-pulse

> Handoff for the **pnode-pulse FE+API split redesign**. NOT a quick migration — this is a multi-week refactor.
>
> **Origin session**: `[vercel_migration_1]` on 2026-05-26 (audit + decision: redesign over quick-migrate).
> **Decision rationale**: RECTOR prefers a clean architectural split over a shortcut (exposing Postgres or paying for Timescale Cloud). No urgency.
> **Status**: NOT STARTED.

## Scope

| # | Project | Local repo | GitHub | Domain | Stack | Status |
|---|---------|-----------|--------|--------|-------|--------|
| 1 | pnode-pulse | `~/local-dev/pnode-pulse` | `RECTOR-LABS/pnode-pulse` | pulse.rectorspace.com | Next.js 16 + Prisma + TimescaleDB + Redis + worker | NOT STARTED |

## Why redesign instead of quick-migrate

**Quick options rejected:**
- ❌ Move entire app to Vercel + expose Postgres publicly (violates VPS hardening policy)
- ❌ Move DB to Timescale Cloud (paid SaaS, adds $35+/mo for limited gain)
- ❌ Migrate to plain Postgres on Neon (loses TimescaleDB features: hypertables, continuous aggregates, retention policies)

**Chosen path: FE+API split**
- ✅ FE moves to Vercel (Next.js 16) — gains Vercel CDN, atomic deploys, branch previews
- ✅ DB + collector + Redis stay on VPS (security policy intact, TimescaleDB preserved)
- ✅ New lightweight API service introduced on VPS (Hono or Express) — decouples FE from data layer
- ✅ Clean architecture for future maintenance — could later swap FE without DB exposure

---

## Target architecture

```
BEFORE (current):
[Browser] → [Next.js + Prisma (monolith)] → [TimescaleDB] ← [Collector]
            (port 7001 on VPS)              (port 5434)    (worker)
                                            ↑
                                         [Redis :6381]

AFTER (target):
[Browser] → [Vercel Next.js (FE only)] ─HTTPS─→ [VPS Hono API :7004] → [TimescaleDB]
            (pulse.rectorspace.com)              (api.pulse.rectorspace.com)  ↑
                                                      ↑                  [Redis :6381]
                                                      │
                                                 [Collector worker]
                                                      ↓
                                                 (writes to DB)
```

## Phased plan (multi-session, no rush)

| Phase | Goal | Output | Est. effort |
|-------|------|--------|-------------|
| 0 | Audit current code paths | List of all Prisma calls in Next.js | 1 session |
| 1 | Design API contract | OpenAPI / tRPC schema for all FE-needed endpoints | 1 session |
| 2 | Build pulse-api on VPS | New Hono service on port 7004, JWT auth, exposes data endpoints | 2-3 sessions |
| 3 | Refactor FE to use API | Replace Prisma calls in Next.js with `fetch()` to pulse-api | 2-3 sessions |
| 4 | Deploy pulse-api to VPS | New container, nginx config, cert for api.pulse.rectorspace.com | 1 session |
| 5 | Deploy FE to Vercel | New Vercel project, env config, preview testing | 1 session |
| 6 | Cutover production | DNS swap, monitor | 0.5 session |
| 7 | Decommission old container | Stop monolith Next.js container on VPS, keep DB+Redis+collector | 0.5 session |

**Total**: ~10 sessions across however many weeks. Each phase is independently shippable.

## How to use this file

Each phase below is its own starter prompt. `cd ~/local-dev/pnode-pulse`, start a new Claude Code session, paste the matching phase's prompt.

---

## Phase 0 — Audit current code paths

### Starter Prompt

```
You are starting Phase 0 of the pnode-pulse redesign: audit all Prisma usage to scope the API refactor.

Goal: produce a list of every place Next.js reads/writes the DB via Prisma. This list becomes the input for Phase 1 (API design).

Steps:
1) Survey Prisma usage
   $ grep -rn "prisma\." src/ app/ pages/ packages/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules" > /tmp/pulse-prisma-calls.txt
   $ wc -l /tmp/pulse-prisma-calls.txt

2) Categorize by access pattern:
   - READ queries (findMany, findUnique, findFirst, count, aggregate, raw SQL with SELECT)
   - WRITE queries (create, update, delete, upsert, raw SQL with INSERT/UPDATE/DELETE)
   - Schema model used (which Prisma model — User, Node, Metric, etc.)

3) Identify Server Components vs Route Handlers vs Server Actions:
   - Server Components (app/.../page.tsx) calling prisma directly
   - Route Handlers (app/api/.../route.ts) calling prisma
   - Server Actions (use server directives)

4) Document TimescaleDB-specific queries
   - Continuous aggregates (typically queried via raw SQL: prisma.$queryRaw)
   - Hypertable functions: time_bucket, first, last, locf
   - These are the ones that MUST stay on a TimescaleDB-aware API

5) Generate output: docs/REDESIGN_PRISMA_AUDIT.md with:
   - Total Prisma call sites
   - Grouped by feature (e.g., "Nodes dashboard reads 4 places")
   - List of TimescaleDB-specific calls
   - Estimate of API endpoints needed

Success: docs/REDESIGN_PRISMA_AUDIT.md committed, reviewed.

This audit drives Phase 1 (API contract design).
```

---

## Phase 1 — Design API contract

### Starter Prompt

```
You are starting Phase 1 of the pnode-pulse redesign: design the API contract for the new pulse-api service.

Prerequisite: Phase 0 audit (docs/REDESIGN_PRISMA_AUDIT.md) is complete.

Goal: produce an OpenAPI spec (or tRPC schema) defining every endpoint the Vercel-hosted FE will call.

Design considerations:
1) Framework choice for pulse-api: Hono (recommended — matches RECTOR's devsol stack, fast, simple)
   - Alternative: Express, Fastify, tRPC

2) Authentication strategy
   - Option A: API key (simplest — single key shared between Vercel project and pulse-api)
   - Option B: JWT (better if there's user-level auth in the dashboard)
   - Decide based on whether pulse has multi-user accounts or is single-tenant

3) Endpoint design — group by domain:
   - /api/nodes/* (CRUD on nodes being monitored)
   - /api/metrics/* (time-series reads — most important; these hit TimescaleDB hypertables)
   - /api/alerts/* (if applicable)
   - /api/aggregates/* (continuous aggregate queries)

4) Real-time considerations
   - Does the dashboard need live updates? (probably yes for a monitoring tool)
   - Options:
     a) SSE (Server-Sent Events) — supported by Hono, works through Vercel
     b) WebSocket — needs persistent connection (Hono WS requires Node adapter, Vercel doesn't support WS in serverless)
     c) Polling — simplest, works fine for 1-5s refresh intervals
   - For Vercel-hosted FE, polling or SSE is safest. WebSocket would require a separate WS server.

5) Caching strategy
   - GET endpoints can use Vercel Runtime Cache API (per-region KV)
   - Vary by query params, short TTL (5-30s for live data)

Deliverables:
- docs/REDESIGN_API_CONTRACT.md — full endpoint list with request/response shapes
- pulse-api/openapi.yaml (or tRPC type exports) — formal schema
- Decision log: chosen framework + auth strategy + real-time approach

Success: API contract documented + reviewed before any code is written.
```

---

## Phase 2 — Build pulse-api on VPS

### Starter Prompt

```
You are starting Phase 2 of the pnode-pulse redesign: build the new pulse-api service.

Prerequisites:
- Phase 0 audit complete (docs/REDESIGN_PRISMA_AUDIT.md)
- Phase 1 API contract complete (docs/REDESIGN_API_CONTRACT.md)

Goal: implement and deploy pulse-api to VPS reclabs3, expose it at api.pulse.rectorspace.com.

Implementation:
1) Create new package or repo
   Option A: Add packages/api to pnode-pulse monorepo (keeps everything in one place)
   Option B: New repo RECTOR-LABS/pulse-api (clean separation)
   - Recommended: Option A for now (refactor easier with shared types)

2) Setup Hono app
   $ cd packages/api    # or wherever you decide
   $ pnpm init -y
   $ pnpm add hono @hono/node-server prisma @prisma/client zod
   $ pnpm add -D @types/node typescript tsx

3) Share Prisma schema
   - pulse-api reuses the same prisma/ folder from the monolith repo
   - Or create a packages/db package with shared Prisma client

4) Implement endpoints per Phase 1 contract
   - Each endpoint: validates request (zod), queries Prisma, returns typed response
   - Use Vitest for endpoint tests

5) Auth middleware (per Phase 1 decision)
   - API key check OR JWT verify
   - Reject 401 if missing/invalid

6) Dockerize
   - Dockerfile for Hono app
   - docker-compose.yml entry on VPS (port 7004 internal, mapped to localhost only)

7) VPS deploy infrastructure
   - GitHub Actions workflow → GHCR → SSH appleboy/ssh-action → docker compose pull
   - Follow vps-deploy skill patterns (image prune, port binding to 127.0.0.1)

8) nginx + cert for api.pulse.rectorspace.com
   - DNS: add A record for api.pulse.rectorspace.com → 151.245.137.75
   - nginx site config: /etc/nginx/sites-available/api.pulse.rectorspace.com
   - certbot --nginx -d api.pulse.rectorspace.com
   - nginx upstream: proxy_pass http://localhost:7004

9) Smoke test from external
   $ curl -H "Authorization: Bearer <api-key>" https://api.pulse.rectorspace.com/api/nodes
   - Verify all endpoints return correct data
   - Compare a few responses against the monolith's pages (data should match exactly)

Success: pulse-api live at https://api.pulse.rectorspace.com, all endpoints functional, returning same data as the current monolith DB queries.

Reserve port: update ~/.ssh/vps-port-registry.md with "**7004** - pnode-pulse-api (Hono - api.pulse.rectorspace.com)".
```

---

## Phase 3 — Refactor FE to use API

### Starter Prompt

```
You are starting Phase 3 of the pnode-pulse redesign: refactor the Next.js FE to call pulse-api instead of Prisma directly.

Prerequisites:
- pulse-api is live at https://api.pulse.rectorspace.com (Phase 2 complete)
- API contract documented (Phase 1)
- Prisma audit shows all call sites (Phase 0)

Goal: replace all `prisma.X.Y(...)` calls in Next.js with `fetch(api/X)` calls. After this phase, the Next.js app no longer imports @prisma/client.

Approach:
1) Add an API client wrapper
   - src/lib/pulse-api.ts: typed fetch wrapper around the API endpoints
   - Use the API contract types from Phase 1 (shared types package OR generated client from OpenAPI)

2) Refactor by feature, not by file
   - Take one dashboard feature at a time (e.g., "Nodes list page")
   - Replace its Prisma calls with API client calls
   - Verify rendering matches old behavior
   - Commit per feature

3) Server Components vs Client Components decision
   - SC: still server-side fetched, but fetch from api.pulse.rectorspace.com instead of Prisma
   - CC: use SWR or React Query to fetch from API, hydrate
   - For live data: switch to CC + polling (or SSE)

4) Remove direct DB imports
   - Once all Prisma calls are gone, remove @prisma/client + prisma/ from FE package
   - Keep prisma/ in pulse-api package (it owns the schema now)

5) Local dev story
   - FE dev: needs api.pulse.rectorspace.com to be reachable (it is — public over HTTPS)
   - Or run pulse-api locally + point NEXT_PUBLIC_API_URL=http://localhost:7004 in .env.local

6) Update environment variables
   - Add NEXT_PUBLIC_API_URL=https://api.pulse.rectorspace.com (or appropriate env var name)
   - Add API_KEY (server-side only, used by Server Components/Route Handlers)

7) Run tests
   - Existing unit tests should pass (logic unchanged)
   - E2E tests need updated mocks for API instead of Prisma

Success: Next.js app fully refactored, no Prisma imports remaining in FE, all dashboard features work identically to before.

This is the longest phase. Multiple sessions expected. Commit incrementally per feature.
```

---

## Phase 4-7 — Combined: Deploy, Cutover, Decommission

### Starter Prompt

```
You are completing phases 4-7 of the pnode-pulse redesign: deploy refactored FE to Vercel, cutover production, decommission old monolith.

Prerequisites:
- pulse-api live and serving (Phase 2)
- FE fully refactored, no Prisma imports (Phase 3)
- All tests passing

==========================================================
PHASE 4 — Vercel project setup
==========================================================
1) $ git status && git pull --rebase
2) $ pnpm build (FE smoke test)
3) $ vercel link (in repo root or FE package depending on monorepo layout)
4) Set Root Directory in Vercel if FE lives in a sub-package
5) Configure env vars in Vercel (NEXT_PUBLIC_API_URL, API_KEY, etc.)
6) $ vercel — deploy preview
7) Smoke test preview URL — all features, live data updates

==========================================================
PHASE 5 — Production domain
==========================================================
1) Vercel → Domains → add pulse.rectorspace.com
2) Note required DNS records

==========================================================
PHASE 6 — DNS cutover (Cloudflare)
==========================================================
Current state:
- pulse.rectorspace.com → 151.245.137.75 (VPS, served by nginx + sip-app-blue-green)
- api.pulse.rectorspace.com → 151.245.137.75 (already set up in Phase 2, stays)
- staging.pulse.rectorspace.com → 151.245.137.75 (consider keeping on VPS for now)

Steps:
1) Lower TTL to 300 for pulse.rectorspace.com, wait 10 min
2) Update DNS: A → CNAME → cname.vercel-dns.com
3) Cloudflare: grey cloud during cutover
4) $ vercel --prod
5) Verify:
   $ dig pulse.rectorspace.com +short    # expect Vercel IPs
   $ curl -sI https://pulse.rectorspace.com
   - Browser test: full dashboard, live updates, chart rendering

==========================================================
PHASE 7 — Decommission monolith (AFTER 14-DAY BUFFER)
==========================================================
DO NOT do this immediately. Wait 14 days for monitoring stability.

ssh pnodepulse
  cd ~/<app-dir>
  # Stop ONLY the monolith Next.js (web-blue, web-green, web-staging)
  # KEEP RUNNING: pnode-pulse-postgres, pnode-pulse-redis, pnode-pulse-collector
  docker compose stop pnode-pulse-web-blue pnode-pulse-web-green pnode-pulse-web-staging
  docker compose rm pnode-pulse-web-blue pnode-pulse-web-green pnode-pulse-web-staging
  docker image prune -f

ssh reclabs3 (root)
  sudo rm /etc/nginx/sites-enabled/pulse.rectorspace.com
  sudo rm /etc/nginx/sites-available/pulse.rectorspace.com
  # KEEP nginx config for api.pulse.rectorspace.com — pulse-api still uses it
  # Consider also: sudo rm /etc/nginx/sites-enabled/staging.pulse.rectorspace.com (or keep if you still want VPS staging)
  sudo nginx -t && sudo systemctl reload nginx
  sudo certbot delete --cert-name pulse.rectorspace.com
  # KEEP cert for api.pulse.rectorspace.com — it's still in use

Update ~/.ssh/vps-port-registry.md:
  Remove: "**7000** - pnode-pulse-web-blue", "**7001** - pnode-pulse-web-green", "**7002** - pnode-pulse-web-staging"
  KEEP: "**5434** - pnode-pulse-postgres", "**6381** - pnode-pulse-redis", "**7004** - pulse-api"

==========================================================
ROLLBACK (at any phase)
==========================================================
- Revert DNS for pulse.rectorspace.com → 151.245.137.75
- VPS monolith still running until Phase 7 — full rollback available

==========================================================
GOTCHAS
==========================================================
- Collector worker still runs on VPS unchanged — it writes to the same TimescaleDB, no API needed for the writer side
- TimescaleDB-specific queries (continuous aggregates, hypertable functions) ALL stay on the API side — FE never sees raw SQL
- Real-time updates: confirm chosen approach (polling vs SSE) is performant under load
- Vercel function timeouts: default 300s now (per platform update), should be plenty for API calls

==========================================================
SUCCESS CRITERIA (overall redesign)
==========================================================
[ ] pulse-api live at api.pulse.rectorspace.com
[ ] FE fully refactored — zero Prisma imports
[ ] FE deployed to Vercel
[ ] DNS cutover successful for pulse.rectorspace.com
[ ] All features work identically to monolith version
[ ] Collector worker still healthy on VPS, data still ingesting
[ ] 14-day stability buffer elapsed
[ ] Monolith Next.js containers decommissioned (DB/Redis/collector preserved)
[ ] Port registry updated
[ ] Mark all 4 phases DONE in ~/local-dev/pnode-pulse/VERCEL_MIGRATION_HANDOFF.md
```

---

## Shared notes (pnode-pulse redesign)

- **Timeline**: This is multi-week work. No deadline. Tackle one phase per session, ship incrementally.
- **What stays on VPS forever** (unless TimescaleDB ever lands on a Vercel Marketplace): pnode-pulse-postgres, pnode-pulse-redis, pnode-pulse-collector, pulse-api.
- **What moves to Vercel**: Next.js FE only.
- **Security win**: DB stays on 127.0.0.1, API auth-protects access, FE never touches DB directly.
- **Maintenance win**: clean FE/API separation enables future FE redesigns without DB risk.
- **VPS user `pnodepulse`** stays — keeps DB, Redis, collector, and new pulse-api running.
- **DNS provider**: Cloudflare (rectorspace.com)
- **Audit context**: pnode-pulse is 1 of 11 total migrations in this round, but the only one chosen for full redesign rather than quick-migrate.
