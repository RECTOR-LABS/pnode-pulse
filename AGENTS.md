<!-- Satellite context file — extends the global hub (~/.claude/CLAUDE.md | ~/.pi/agent/AGENTS.md). Host-neutral; project-specific only. Do not duplicate hub standards here. -->

# pNode Pulse

> Real-time analytics platform for Xandeum's pNode network. 🥉 3rd place — Superteam Bounty (Build Analytics Platform for Xandeum pNodes), $1,000 USDC. Submitted Dec 26, 2025; winners announced Jan 9, 2026. Live + maintained post-bounty at https://pulse.rectorspace.com.

## Tech Stack

| Layer      | Technology                                                       |
| ---------- | ---------------------------------------------------------------- |
| Frontend   | Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4  |
| Backend    | tRPC v11, Node.js 24, Prisma 6                                   |
| Database   | Neon Postgres (serverless) via Prisma 6 + `@prisma/adapter-neon` |
| Cache      | In-memory rate-limiter (Redis/Upstash optional, not provisioned) |
| Deployment | Vercel serverless (functions + daily Cron); no VPS               |

## Common Commands

```bash
npm run dev · npm run build · npm run lint · npm run typecheck · npm run test
npm run db:migrate · npm run db:seed
docker compose up -d · docker compose logs -f web
```

## Deployment (current — Vercel + Neon)

All-Vercel serverless: Next.js App Router + `/api` route handlers + **daily Vercel Cron** for the collector, on **Neon Postgres**. **No VPS.** Migrated off reclabs3 VPS 2026-07-03.

- **Deploy:** `vercel --prod` (manual). Git auto-deploy from `main` **intentionally disabled** (`vercel.json` → `git.deploymentEnabled.main=false`).
- **DB:** Neon (Frankfurt, Free), provisioned via Vercel–Neon integration; runtime uses `@prisma/adapter-neon`.
- **DB credential:** `src/lib/db/index.ts` reads `NEON_DATABASE_URL` (integration's auto-rotating pooled URL) with `DATABASE_URL` fallback for local dev. `NEON_*` vars are Sensitive.
- **⚠️ Rotating DB password:** do NOT use Neon console "Reset password" (doesn't propagate to compute on integration-managed DB — fresh passwords fail `28P01`). Rotate via **Vercel dashboard → Storage → pnode-pulse-db → Settings → "Secure This Resource → Rotate Secrets"**, then `vercel --prod`.
- **Data:** config-only (node registry); metrics repopulate via daily collector cron. Neon Free = 0.5 GB — no raw-history backfill.

## Data Source: pRPC API

JSON-RPC 2.0 over HTTP POST. URL `http://<pnode-ip>:6000/rpc`. No auth, no rate limits.

**Public pNodes (port 6000 open):** `173.212.203.145` · `173.212.220.65` · `161.97.97.41` · `192.190.136.{36,38,28,29}` · `207.244.255.1` (8 IPs — `192.190.136.37` removed Dec 13 2025, dead). Current version v0.7.3.

**Methods:**

- `get-version` → `{"result":{"version":"0.6.0"}}`
- `get-stats` → **FLAT structure** (differs from official docs): `active_streams`, `cpu_percent`, `current_index`, `file_size`, `last_updated`, `packets_received/sent`, `ram_total/used`, `total_bytes`, `total_pages`, `uptime`
- `get-pods` → includes `pubkey` (not in docs), `last_seen_timestamp` (unix, not human-readable `last_seen`); returns ~22 node subset (legacy)
- `get-pods-with-stats` (v0.7.0+ "Heidelberg") → ALL pNodes w/ rich stats: `address`, `is_public`, `last_seen_timestamp`, `pubkey`, `rpc_port`, `storage_committed`, `storage_usage_percent`, `storage_used`, `uptime`, `version`. Private nodes (`is_public: null`) included but not directly queryable.

**Network ports:** 6000 pRPC (configurable) · 9001 gossip (public) · 5000 Atlas (internal) · 3000 XandMiner GUI (localhost).

## Documentation Discrepancies (our implementation correct vs official docs)

1. `get-stats` is FLAT (official docs show nested `metadata.total_bytes`/`stats.cpu_percent`)
2. `get-pods` returns `pubkey` (not documented)
3. `get-pods-with-stats` not in official docs (v0.7.0 feature, Discord intelligence from Brad)
4. `get-pods` uses `last_seen_timestamp` (unix) not `last_seen` (human-readable string)

**Terminology (Brad):** pNode = hardware/server (storage provider); Pod = software running on the pNode.

## pRPC Best Practices (Brad)

1. **Multi-endpoint strategy** — query multiple public nodes for redundancy (our collector implements this ✅)
2. **No uptime guarantees** — any endpoint can go down anytime; handle failures gracefully ✅
3. **Public/private tagging** approved — `isPublic` field valid
4. **Use `pubkey` as primary identifier** (IPs can change); store historical data with pruning; "Node Graveyard" for inactive nodes

## Project Structure

```
src/{app,components,lib/{prpc,db,utils},server/{api,workers},types}/
prisma/   # schema + migrations
docker/ · tests/
```

## Key Docs

`ROADMAP.md` · `docs/DEPLOYMENT.md` · `docs/USER_GUIDE.md` · [Xandeum pRPC docs](https://docs.xandeum.network/api/pnode-rpc-prpc-reference) · [Xandeum Discord](https://discord.com/invite/mGAxAuwnR9) (#apps-developers)

## Community Libraries (Skipp)

JS/TS `xandeum-prpc` ([GitHub](https://github.com/DavidNzube101/xandeum-prpc-js)) · Go `github.com/DavidNzube101/xandeum-prpc-go` · Rust `xandeum-prpc`. Supports `get-pods-with-stats`. Demo: prpc-client-example.vercel.app.

## Network Intelligence

~100 pNodes discovered via `get-pods-with-stats` (16-17 public, ~83-84 private). ATH 138. Target: 1K pNodes. Staking not active yet. pNode License Shop closed (onboarding for incentivized DevNet only). "5K nodes" claim debunked (false).
