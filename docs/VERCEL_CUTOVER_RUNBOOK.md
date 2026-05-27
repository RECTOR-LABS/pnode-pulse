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
`pnode-pulse-web-blue` container on port 7000. No new container is needed.

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

    # Same upstream as pulse.rectorspace.com — the existing blue container.
    # When we want isolation later, this becomes a dedicated pulse-api on :7004.
    location / {
        proxy_pass http://127.0.0.1:7000;
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
| `PULSE_API_URL`                | `https://api.pulse.rectorspace.com`          | All; rewrite target per `vercel.ts`                                                                                           |
| `DATABASE_URL`                 | `postgresql://stub:stub@127.0.0.1:5432/stub` | **Stub** — Vercel never connects. Needed only so `prisma generate` succeeds during build                                      |
| `JWT_SECRET`                   | `$(openssl rand -base64 32)`                 | Build-time module load needs SOME value; runtime auth happens on the VPS so the actual secret value doesn't matter for Vercel |
| `JWT_ISSUER`                   | `pnode-pulse`                                | Match VPS                                                                                                                     |
| `JWT_AUDIENCE`                 | `pnode-pulse`                                | Match VPS                                                                                                                     |
| `NEXT_PUBLIC_SENTRY_DSN`       | _(optional)_                                 | If using Sentry on FE                                                                                                         |
| `SENTRY_AUTH_TOKEN`            | _(optional)_                                 | For source-map upload during build                                                                                            |
| `SENTRY_ORG`, `SENTRY_PROJECT` | _(optional)_                                 |                                                                                                                               |

Or with the CLI (faster):

```bash
echo "https://api.pulse.rectorspace.com" | npx vercel env add PULSE_API_URL production
echo "https://api.pulse.rectorspace.com" | npx vercel env add PULSE_API_URL preview
echo "postgresql://stub:stub@127.0.0.1:5432/stub" | npx vercel env add DATABASE_URL production
# … etc.
```

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

- `PULSE_API_URL` is set correctly in Vercel
- `vercel.json` / `vercel.ts` rewrites are present (check the Vercel build log "Detected rewrites")
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

- `ssh reclabs3 'docker logs --tail 200 -f pnode-pulse-web-blue'` — request volume should look normal
- Vercel dashboard → Project → Analytics — request count + errors
- Sentry (if configured) — error rate
- nginx access log on VPS: `tail -f /var/log/nginx/api.pulse.access.log`

---

## Rollback

**If anything goes wrong at any phase, this is the rollback procedure.**

### After Step 5 but before Step 12

Just remove the Cloudflare DNS record for `api.pulse.rectorspace.com`.
Everything else (Vercel project, env vars, vercel.ts) is dormant.

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

Existing VPS containers (blue/green) are still running on port 7000/7001 and
nginx still has the original vhost — they will serve traffic again immediately.

---

## Tier 2 follow-on (NOT part of this runbook)

The `packages/pulse-api/` and `packages/pulse-types/` packages on this branch
are scaffolding for a future dedicated API service that:

- Replaces the Next.js-as-API-host pattern with a lean Hono service
- Lets the Vercel build skip Prisma generation entirely
- Enables clean REST contract for external SDKs

That is a multi-session follow-on (see `VERCEL_MIGRATION_HANDOFF.md` Phase
2+). It is NOT required for today's Vercel migration — Tier 1 above is the
shipping path.

If/when proceeding with Tier 2:

1. Move `src/server/api/*`, `src/lib/db`, `src/lib/auth` (server-only files),
   `src/lib/api`, `src/lib/redis`, `src/lib/constants`, `src/lib/logger.ts`,
   `src/lib/queue`, `src/lib/notifications` into `packages/pulse-api/src/`
2. Mount the tRPC server in pulse-api using `@trpc/server/adapters/fetch` +
   Hono adapter
3. Add `pulse-api` service to `docker-compose.yml` on port 7004
4. Update the nginx `proxy_pass` from `127.0.0.1:7000` to `127.0.0.1:7004`
5. Remove the lifted server code from the Next.js project (FE becomes lean)
6. Re-test Vercel deploy — bundle is much smaller, no DB-related env vars
   needed

---

## What lives where after Tier 1 cutover

| Component                                      | Location                                          | Talks to                  |
| ---------------------------------------------- | ------------------------------------------------- | ------------------------- |
| FE pages                                       | Vercel (`pulse.rectorspace.com`)                  | rewritten `/api/*` → VPS  |
| tRPC server, REST API                          | VPS Docker `pnode-pulse-web-blue:7000` (existing) | local DB + Redis          |
| TimescaleDB                                    | VPS Docker `pnode-pulse-postgres:5434` (existing) | —                         |
| Redis                                          | VPS Docker `pnode-pulse-redis:6381` (existing)    | —                         |
| Collector worker                               | VPS systemd / docker (existing)                   | local DB                  |
| Alert processor                                | VPS (existing)                                    | local DB + Redis          |
| Report processor                               | VPS (existing)                                    | local DB + email channels |
| nginx vhost: `pulse.rectorspace.com`           | VPS — can be left in place as standby             | —                         |
| nginx vhost: `api.pulse.rectorspace.com` (new) | VPS                                               | `127.0.0.1:7000`          |

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
