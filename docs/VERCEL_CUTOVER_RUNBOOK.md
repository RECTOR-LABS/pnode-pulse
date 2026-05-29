# Vercel Cutover Runbook — pnode-pulse

> Step-by-step deployment guide for the Vercel migration. Read this in order;
> every step is reversible and ordered to minimize blast radius.
>
> **Approach**: Tier 1 minimal migration. The Vercel-hosted FE proxies every
> `/api/*` request to the existing Next.js Docker container on the VPS,
> exposed at a new `api.pulse.rectorspace.com` domain. Database, Redis,
> collector, and workers stay on the VPS unchanged. Single DNS record
> rollback if anything misbehaves.
>
> **Time estimate**: 1–2 hours wall-clock, mostly waiting on DNS + Vercel build.
>
> **What changes on the user side**: nothing. URLs stay the same
> (`pulse.rectorspace.com`). All existing bookmarks, badges, SDK integrations
> continue working.

---

## Pre-flight (do these before the maintenance window)

### 1. Confirm Cloudflare access

DNS for `rectorspace.com` lives on RECTOR's personal Cloudflare account
(`rector@rectorspace.com`). You'll need it for two records:

- `api.pulse.rectorspace.com` (added now, proxied through Cloudflare)
- `pulse.rectorspace.com` (cutover later, points at Vercel)

Verify CF account is reachable:

```bash
cf-test() { curl -fsS -H "X-Auth-Email: rector@rectorspace.com" -H "X-Auth-Key: $CLOUDFLARE_API_KEY" \
  "https://api.cloudflare.com/client/v4/zones?name=rectorspace.com" | jq -r '.result[0].id'; }
cf-test
# Expect: a zone ID
```

### 2. Confirm Vercel access

```bash
npx vercel login        # if not already
npx vercel whoami       # confirm
```

If RECTOR doesn't yet have a Vercel project for this repo, plan to create one
during step 8.

### 3. Confirm VPS SSH

```bash
ssh reclabs3 'whoami && hostname'
# Expect: root reclabs3 (or matching user/host)
```

### 4. Reserve port 7004 in the registry

Edit `~/.ssh/vps-port-registry.md` and add the (future) entry; this prevents
clashes while the new vhost is being set up.

> **7004** — _reserved_ for pulse-api dedicated service (Tier 2 follow-on; not in use today)

Today's Tier 1 cutover proxies through nginx straight to the existing
`pnode-pulse-web-green` container on port 7001. No new container is needed.

---

## Phase A — Expose existing app at api.pulse.rectorspace.com (zero downtime)

### Step 1: Add Cloudflare DNS record

Cloudflare dashboard → `rectorspace.com` → DNS → Records → Add record.

| Field        | Value                                                                         |
| ------------ | ----------------------------------------------------------------------------- |
| Type         | A                                                                             |
| Name         | `api.pulse`                                                                   |
| IPv4 address | `151.245.137.75`                                                              |
| Proxy status | **DNS only** (grey cloud) for now — we'll turn it orange after the cert lands |
| TTL          | Auto                                                                          |

Or with the API:

```bash
curl -fsS -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "X-Auth-Email: rector@rectorspace.com" -H "X-Auth-Key: $CLOUDFLARE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"A","name":"api.pulse","content":"151.245.137.75","proxied":false,"ttl":1}'
```

Wait for propagation (~1 min):

```bash
dig +short api.pulse.rectorspace.com
# Expect: 151.245.137.75
```

### Step 2: nginx vhost on VPS

```bash
ssh reclabs3
```

Create `/etc/nginx/sites-available/api.pulse.rectorspace.com`:

```nginx
server {
    listen 80;
    server_name api.pulse.rectorspace.com;
    # Allow Let's Encrypt HTTP-01 challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name api.pulse.rectorspace.com;

    # certbot drops the cert here; configured in Step 3
    ssl_certificate     /etc/letsencrypt/live/api.pulse.rectorspace.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.pulse.rectorspace.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Logs
    access_log /var/log/nginx/api.pulse.access.log;
    error_log  /var/log/nginx/api.pulse.error.log;

    # Proxy buffers — accommodate large dashboards / batched tRPC payloads
    proxy_buffering on;
    proxy_buffer_size 16k;
    proxy_buffers 8 16k;
    client_max_body_size 4m;

    # Same upstream as pulse.rectorspace.com — the existing green container.
    # When we want isolation later, this becomes a dedicated pulse-api on :7004.
    location / {
        proxy_pass http://127.0.0.1:7001;
        proxy_http_version 1.1;
        proxy_set_header Host              api.pulse.rectorspace.com;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host  $host;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/api.pulse.rectorspace.com /etc/nginx/sites-enabled/
sudo nginx -t          # syntax check, expect "test is successful"
# Don't reload yet — Step 3 issues the cert first, otherwise the 443 server fails to start.
```

### Step 3: Obtain Let's Encrypt cert

Two paths. **Use the webroot path** because the 443 server is not yet running:

```bash
sudo mkdir -p /var/www/certbot
# Temporarily comment out the 443 server block in the vhost file (or use only the port-80 block initially)
sudo nginx -t && sudo systemctl reload nginx

sudo certbot certonly --webroot -w /var/www/certbot \
    -d api.pulse.rectorspace.com \
    --agree-tos -m rector@rectorspace.com -n
# Expect: "Successfully received certificate"
```

Then restore the full vhost and reload:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Verify TLS:

```bash
curl -fsSI https://api.pulse.rectorspace.com/api/health
# Expect: HTTP/2 200, JSON health payload
```

### Step 4: Flip Cloudflare to proxied (orange cloud)

Once the cert is verified working, turn proxying on so we get DDoS protection

- caching:

| Field                                    | Change                                |
| ---------------------------------------- | ------------------------------------- |
| `api.pulse.rectorspace.com` proxy status | DNS only → **Proxied** (orange cloud) |

Cloudflare SSL mode for the zone should already be **Full (strict)** — confirm.

Re-verify:

```bash
curl -fsSI https://api.pulse.rectorspace.com/api/health
# Expect: 200, with Cloudflare cf-ray header present
```

### Step 5: Smoke test from external

A few representative calls — these should return the same data as
`pulse.rectorspace.com/api/...`:

```bash
curl -fsS https://api.pulse.rectorspace.com/api/health | jq
curl -fsS 'https://api.pulse.rectorspace.com/api/v1/nodes?limit=3' | jq '.nodes | length'
curl -fsS 'https://api.pulse.rectorspace.com/api/v1/network/stats' | jq
curl -fsS https://api.pulse.rectorspace.com/api/badge/online -I
# tRPC GET (single procedure)
curl -fsS 'https://api.pulse.rectorspace.com/api/trpc/nodes.versions' | jq
```

**Checkpoint**: if any of these fail, fix nginx/cert/upstream before
proceeding. The Vercel side is not yet configured, so rolling back is just
removing the DNS record.

---

## Phase B — Set up the Vercel project (no traffic shift yet)

### Step 6: Create the Vercel project

From the repo root:

```bash
cd ~/local-dev/pnode-pulse
npx vercel link
# Prompts:
#   Set up "~/local-dev/pnode-pulse"?  Y
#   Which scope?                        rector's-projects (or org account)
#   Link to existing project?           N
#   Project name?                       pnode-pulse  (matches GitHub repo)
#   In which directory is your code?    ./
```

This writes `.vercel/project.json`. Add `.vercel/` to gitignore if not
already (it should be).

### Step 7: Set Vercel environment variables

In the Vercel dashboard → Settings → Environment Variables. Add to **all three
environments** (Production, Preview, Development) unless noted:

| Variable                       | Value                                        | Notes                                                                                                                         |
| ------------------------------ | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`          | `https://pulse.rectorspace.com`              | Production only                                                                                                               |
| `NEXT_PUBLIC_APP_URL`          | `$VERCEL_URL`                                | Preview / Development — auto-set per deploy                                                                                   |
| `DATABASE_URL`                 | `postgresql://stub:stub@127.0.0.1:5432/stub` | **Stub** — Vercel never connects. Needed only so `prisma generate` succeeds during build                                      |
| `JWT_SECRET`                   | `$(openssl rand -base64 32)`                 | Build-time module load needs SOME value; runtime auth happens on the VPS so the actual secret value doesn't matter for Vercel |
| `JWT_ISSUER`                   | `pnode-pulse`                                | Match VPS                                                                                                                     |
| `JWT_AUDIENCE`                 | `pnode-pulse`                                | Match VPS                                                                                                                     |
| `NEXT_PUBLIC_SENTRY_DSN`       | _(optional)_                                 | If using Sentry on FE                                                                                                         |
| `SENTRY_AUTH_TOKEN`            | _(optional)_                                 | For source-map upload during build                                                                                            |
| `SENTRY_ORG`, `SENTRY_PROJECT` | _(optional)_                                 |                                                                                                                               |

Or with the CLI (faster):

```bash
echo "postgresql://stub:stub@127.0.0.1:5432/stub" | npx vercel env add DATABASE_URL production
# … etc.
```

The rewrite target lives in `vercel.json` (committed). If it ever needs to
vary per environment, replace `vercel.json` with a `vercel.ts` that reads
`process.env.PULSE_API_URL` and add the variable here — but only then.

### Step 8: First preview deploy

```bash
npx vercel        # preview build
```

Watch the build log. Expected:

- `prisma generate` runs successfully (uses the stub DATABASE_URL — schema only)
- `next build` compiles all pages + API routes
- Deployment URL printed (e.g. `https://pnode-pulse-xxxx.vercel.app`)

Open the preview URL in a browser:

- Pages render
- The dashboard's tRPC calls succeed (they hit `<preview>.vercel.app/api/trpc`,
  which Vercel rewrites at the edge to `api.pulse.rectorspace.com/api/trpc`)
- Live data shows up (same data as production)

**Checkpoint**: if pages render but tRPC errors, check:

- `vercel.json` rewrites are present (check the Vercel build log "Detected rewrites")
- `api.pulse.rectorspace.com` is reachable from outside

### Step 9: First production deploy (not live yet — Vercel domain only)

```bash
npx vercel --prod
# Note the URL: pnode-pulse.vercel.app (or similar)
```

Test it again at the `.vercel.app` URL. It serves real data via the proxy.
Still not on `pulse.rectorspace.com` — that comes next.

---

## Phase C — DNS cutover for pulse.rectorspace.com

### Step 10: Add domain to Vercel project

Vercel dashboard → Project → Settings → Domains → Add → `pulse.rectorspace.com`

Vercel will display the DNS records required. For Cloudflare with proxy off:

- `A pulse.rectorspace.com → 76.76.21.21` (or current Vercel anycast IP — use Vercel's exact value)

Or for proxy-friendly setup (recommended):

- `CNAME pulse.rectorspace.com → cname.vercel-dns.com`

### Step 11: Lower TTL pre-cutover (do this 1 hour before)

```bash
# Reduces rollback time if needed
# Cloudflare → DNS → edit pulse.rectorspace.com record → TTL: 1 min (or Auto if proxied)
```

### Step 12: Cut over DNS

Replace the existing A record (currently pointing at `151.245.137.75`) with
the Vercel record per Step 10. Set Cloudflare proxy to:

- **DNS only (grey)** during initial verification — Vercel handles its own TLS
- Switch back to **Proxied (orange)** after verifying everything works

```bash
# After save:
dig +short pulse.rectorspace.com
# Expect: Vercel IP (76.76.21.21 or similar)
```

### Step 13: Verify production

```bash
curl -fsSI https://pulse.rectorspace.com
# Expect: HTTP/2 200, x-vercel-* headers present

# A few key endpoints (these go: browser → Vercel edge → rewritten → VPS)
curl -fsS 'https://pulse.rectorspace.com/api/health' | jq
curl -fsS 'https://pulse.rectorspace.com/api/v1/nodes?limit=1' | jq
```

Browser test:

- Open `https://pulse.rectorspace.com` — dashboard renders
- Click around: nodes list, leaderboard, analytics, node detail page
- Open browser DevTools network tab: `/api/trpc/*` requests should succeed
  (Vercel rewrites them to the VPS — you'll see the response time include the
  edge → VPS hop, typically +30–80 ms)
- If logged in: portfolio, alerts, settings pages load with user-specific data

### Step 14: Watch for 30 minutes

Monitor:

- `ssh reclabs3 'docker logs --tail 200 -f pnode-pulse-web-green'` — request volume should look normal
- Vercel dashboard → Project → Analytics — request count + errors
- Sentry (if configured) — error rate
- nginx access log on VPS: `tail -f /var/log/nginx/api.pulse.access.log`

---

## Rollback

**If anything goes wrong at any phase, this is the rollback procedure.**

### After Step 5 but before Step 12

Just remove the Cloudflare DNS record for `api.pulse.rectorspace.com`.
Everything else (Vercel project, env vars, vercel.json) is dormant.

### After Step 12 (DNS cutover)

**Revert pulse.rectorspace.com to the VPS IP**:

Cloudflare → DNS → edit `pulse.rectorspace.com` record:

- Type: `A`
- Content: `151.245.137.75`
- Proxy: as before

```bash
dig +short pulse.rectorspace.com
# Expect: 151.245.137.75 within the TTL window (~1 min if you lowered it in Step 11)
```

The single `green` container is still running on port 7001 and nginx still has
the original vhost — it will serve traffic again immediately.

---

## Tier 2 — pulse-api as a dedicated service (already lifted on this branch)

The `packages/pulse-api/` package on this branch is a **ready-to-deploy
Hono service** that hosts the lifted tRPC server. Tier 2 is OPTIONAL —
Tier 1 alone gets us to Vercel. Tier 2 splits the tRPC traffic onto a
separate process so the monolith can eventually be decommissioned.

**Scope of what was lifted into pulse-api**:

- `src/server/api/*` (trpc.ts, root.ts, all routers) → `packages/pulse-api/src/server/`
- `src/lib/{db,auth,redis,constants,logger,notifications,queue,analytics}/*` → `packages/pulse-api/src/lib/`
- New: tRPC fetch-adapter mount at `/api/trpc/*`, liveness at `/healthz`,
  readiness/dep-breakdown at `/readyz` (internal-only — keep behind nginx)
- The monolith files remain in place (additive lift) — Tier 2 cutover doesn't
  touch them. After cutover stabilizes, they can be deleted in a follow-up.

**What's STILL on the monolith (not lifted)**:

- REST routes (`/api/v1/*`, `/api/badge/*`, `/api/health`, `/api/metrics`,
  `/api/realtime`, `/api/admin/*`) — these stay on the existing Next.js
  container. nginx will path-split tRPC vs REST.
- All FE pages.
- Workers (collector, alert-processor, report-processor, pruner) — these
  run on the VPS as systemd or separate compose services today.

### Step T2.1: Build + push the pulse-api image

The GitHub Actions workflow `.github/workflows/deploy-pulse-api.yml`
auto-runs on push to `main` when anything under `packages/pulse-api/`,
`packages/pulse-types/`, or `prisma/schema.prisma` changes. To trigger it
manually:

```bash
gh workflow run deploy-pulse-api.yml
gh run watch
```

The workflow:

1. Builds `ghcr.io/rector-labs/pulse-api:latest`
2. SSHes to VPS as `pnodepulse`
3. `docker compose --profile pulse-api up -d pulse-api`
4. Health-polls `127.0.0.1:7004/healthz` until green
5. Runs `docker image prune -f`

The `pulse-api` service in `docker-compose.yml` is behind a profile so it
does NOT start by accident — only `--profile pulse-api` brings it up.

### Step T2.2: Add JWT_SECRET to VPS env

pulse-api needs `JWT_SECRET` matching whatever the monolith uses (so
tokens issued by the monolith are accepted by pulse-api during the
transition).

```bash
ssh pnodepulse
cd ~/pnode-pulse
# Reuse whatever JWT_SECRET the monolith was built with (check existing .env)
echo "JWT_SECRET=<paste from existing app .env>" >> .env
```

### Step T2.3: Verify pulse-api locally on VPS

```bash
ssh pnodepulse
# Liveness — minimal, public-safe; container healthcheck targets this.
curl -fsS http://127.0.0.1:7004/healthz | jq
# Expect: {"status":"ok"}

# Readiness — full dependency breakdown; keep internal.
curl -fsS http://127.0.0.1:7004/readyz | jq
# Expect: {"status":"ok","checks":{"database":true,"redis":true},...}
# (status is "degraded" if only Redis is down — DB unreachable returns 503.)

# tRPC smoke test — same procedure as `curl http://127.0.0.1:7001/api/trpc/nodes.versions`
curl -fsS 'http://127.0.0.1:7004/api/trpc/nodes.versions' | jq
```

If both succeed, pulse-api is serving the same data as the monolith — just
on a different port.

### Step T2.4: Path-split nginx vhost — route tRPC to pulse-api

Edit `/etc/nginx/sites-available/api.pulse.rectorspace.com` on the VPS:

```nginx
server {
    listen 443 ssl http2;
    server_name api.pulse.rectorspace.com;
    # … (ssl, logs, buffers — unchanged) …

    # tRPC traffic to the lean pulse-api on :7004
    location /api/trpc/ {
        proxy_pass http://127.0.0.1:7004;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 60s;
    }

    # Healthz on pulse-api for monitoring
    location /healthz {
        proxy_pass http://127.0.0.1:7004;
    }

    # Everything else (REST, badges, metrics, realtime) → monolith :7001
    location / {
        proxy_pass http://127.0.0.1:7001;
        proxy_http_version 1.1;
        proxy_set_header Host              api.pulse.rectorspace.com;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Step T2.5: Smoke test the split

```bash
# tRPC — should now hit pulse-api
curl -fsS 'https://api.pulse.rectorspace.com/api/trpc/nodes.versions' | jq

# REST — should still hit monolith
curl -fsS 'https://api.pulse.rectorspace.com/api/v1/nodes?limit=1' | jq

# Both should return the same data they did before T2.4.
```

In the FE (live at `pulse.rectorspace.com`):

- Open dev tools network tab
- Trigger a tRPC call (any dashboard page does this)
- Confirm the response arrives normally; latency should be similar or better

### Step T2.6: Watch + rollback if needed

Monitor for 1 hour:

```bash
ssh reclabs3
tail -f /var/log/nginx/api.pulse.access.log     # confirm tRPC routes hit pulse-api
docker logs --tail 200 -f pnode-pulse-api
```

**Rollback**: revert the `location /api/trpc/` block in nginx and reload.
All traffic returns to the monolith. The pulse-api container can keep
running idle.

### Step T2.7 (eventual): Decommission monolith server code

Only after pulse-api has been serving tRPC for 14+ days without issues:

1. Delete `src/server/api/`, `src/server/workers/`, `src/lib/db/`,
   `src/lib/auth/{verify-token,jwt-config,hash-token,index}.ts`,
   `src/lib/api/`, `src/lib/redis/`, `src/lib/queue/`,
   `src/lib/notifications/`, `src/lib/analytics/` from the monolith repo
2. Delete `src/app/api/trpc/[trpc]/route.ts` (no longer used — pulse-api owns tRPC)
3. Move workers (`scripts/start-collector.ts` etc.) to their own packages
   or run them out of `packages/pulse-api/` directly
4. Update the FE Vercel deploy — Prisma schema is no longer needed for the
   build; remove `npx prisma generate` from `vercel.json` buildCommand and
   drop `DATABASE_URL` / `JWT_SECRET` Vercel env vars
5. The monolith `green` Docker container can also be stopped once
   nothing depends on it (all paths in the nginx vhost would already
   point at pulse-api or a static handler by then)

---

## What lives where after Tier 1 cutover

| Component                                      | Location                                               | Talks to                  |
| ---------------------------------------------- | ------------------------------------------------------ | ------------------------- |
| FE pages                                       | Vercel (`pulse.rectorspace.com`)                       | rewritten `/api/*` → VPS  |
| tRPC server, REST API                          | VPS Docker `pnode-pulse-web-green:7001` (existing)     | local DB + Redis          |
| TimescaleDB                                    | VPS Docker `pnode-pulse-postgres` (existing, internal) | —                         |
| Redis                                          | VPS Docker `pnode-pulse-redis` (existing, internal)    | —                         |
| Collector worker                               | VPS systemd / docker (existing)                        | local DB                  |
| Alert processor                                | VPS (existing)                                         | local DB + Redis          |
| Report processor                               | VPS (existing)                                         | local DB + email channels |
| nginx vhost: `pulse.rectorspace.com`           | VPS — can be left in place as standby                  | —                         |
| nginx vhost: `api.pulse.rectorspace.com` (new) | VPS                                                    | `127.0.0.1:7001`          |

---

## Success criteria

- [ ] `dig pulse.rectorspace.com +short` returns a Vercel IP
- [ ] `dig api.pulse.rectorspace.com +short` returns the VPS IP
- [ ] Browser at `https://pulse.rectorspace.com` shows the full dashboard
- [ ] tRPC mutations work (e.g. add a portfolio node) — auth round-trips
- [ ] External REST consumers (SDKs, badges, Grafana) keep working without
      any URL change on their side
- [ ] Collector still ingesting metrics (check VPS logs)
- [ ] No error spike in Vercel dashboard or Sentry
