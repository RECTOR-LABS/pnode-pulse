# GitHub Actions Deployment Workflows

Automated push-to-deploy workflow for pNode Pulse using GitHub Container Registry (GHCR). Production uses a simple **single-container** deploy: build the image in CI, push to GHCR, then recreate the `green` web container on the VPS.

> SSH to the VPS goes through the Cloudflare Tunnel (`ssh.rectorspace.com` → VPS:22) as user `pnodepulse`; direct port 22 is firewalled. CI installs `cloudflared` and uses it as an SSH `ProxyCommand` with key auth (`VPS_SSH_KEY`).

## Overview

| Workflow                | Trigger        | Environment            | URL                   | Strategy         |
| ----------------------- | -------------- | ---------------------- | --------------------- | ---------------- |
| `deploy-production.yml` | Push to `main` | Production (port 7001) | pulse.rectorspace.com | Recreate `green` |

The deploy recreates **only** the `green` web container (`docker compose up -d --no-deps green`). `postgres`, `redis`, and the collector are **never** touched by a deploy — they are long-lived services managed out-of-band. nginx points at a fixed host port, so there is no upstream switching.

## Required GitHub Secrets

| Secret              | Value                                                                           |
| ------------------- | ------------------------------------------------------------------------------- |
| `VPS_SSH_KEY`       | Private SSH key whose public half is in `pnodepulse@VPS:~/.ssh/authorized_keys` |
| `POSTGRES_PASSWORD` | Database password (also present in `~/pnode-pulse/.env` on the VPS)             |

## Production Workflow (`deploy-production.yml`)

**Triggered by**: push to `main` (or manual `workflow_dispatch`).

1. Checkout, log in to GHCR, build & push the image (`:latest`, `:prod-<sha>`).
2. SSH to the VPS via the Cloudflare Tunnel.
3. On the VPS: `git pull origin main` → `docker login ghcr.io` → `bash scripts/deploy.sh`.
4. `scripts/deploy.sh`: `docker compose pull green` → `docker compose up -d --no-deps green` → wait for the `green` healthcheck (up to 120s). If it does not become healthy, the script exits non-zero and the workflow fails (alerting you to roll back).
5. `docker image prune -f`, then verify (`docker compose ps green` + recent logs).

**Deploy time**: ~3–5 min. **Downtime**: a brief restart blip (~5–15s) while the `green` container is recreated. Acceptable for this single low-traffic instance; CI builds the image before it ships, so broken images are rare and the health gate flags them.

## Rollback (Production)

Re-deploy a previous image. Image tags `:prod-<sha>` are pushed on every production build.

```bash
ssh pnodepulse
cd ~/pnode-pulse
docker pull ghcr.io/rector-labs/pnode-pulse:prod-<sha>     # a known-good build
docker tag ghcr.io/rector-labs/pnode-pulse:prod-<sha> ghcr.io/rector-labs/pnode-pulse:latest
SERVICE=green bash scripts/deploy.sh                        # recreates green from :latest
```

## Local development: exposing DB/redis host ports

`docker-compose.yml` deliberately does **not** publish postgres/redis on the host (they are reached inside the Docker network at `postgres:5432` / `redis:6379`). If you want to point a local tool (psql, a Redis GUI) at them during development, create an **untracked** `docker-compose.override.yml` (gitignored — it must never reach production):

```yaml
# docker-compose.override.yml (local only, gitignored)
services:
  postgres:
    ports: ["127.0.0.1:5434:5432"]
  redis:
    ports: ["127.0.0.1:6381:6379"]
```

`docker compose` auto-loads it locally. On the VPS, connect ad hoc instead: `docker exec -it pnode-pulse-postgres psql -U pnodepulse pnodepulse`.

## Monitoring

| Environment        | Local health URL                 |
| ------------------ | -------------------------------- |
| Production (green) | http://localhost:7001/api/health |

```bash
ssh pnodepulse
cd ~/pnode-pulse
docker compose ps                       # container status
docker compose logs -f green            # production logs
```

## Troubleshooting

**Workflow can't SSH** — verify `VPS_SSH_KEY` matches a public key in `pnodepulse@VPS:~/.ssh/authorized_keys`; the tunnel hostname is `ssh.rectorspace.com`.

**Health gate fails** — `docker compose logs --tail 50 green`; confirm `postgres`/`redis` are healthy (`docker compose ps`) and reachable from the web container; check app startup errors. Roll back if needed (above).

**Image pull denied** — re-auth on the VPS: `echo "$GITHUB_TOKEN" | docker login ghcr.io -u <user> --password-stdin`.

## Resources

- [GitHub Actions](https://docs.github.com/en/actions) · [GHCR](https://docs.github.com/en/packages) · [Docker Compose](https://docs.docker.com/compose/)
