# pNode Pulse Deployment Guide

Complete guide for self-hosting pNode Pulse on your own infrastructure.

> **Live Instance**: [pulse.rectorspace.com](https://pulse.rectorspace.com) - See it in action before deploying your own.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Deploy with Docker](#quick-deploy-with-docker)
3. [Production Deployment](#production-deployment)
4. [Environment Configuration](#environment-configuration)
5. [Database Setup](#database-setup)
6. [Data Collection](#data-collection)
7. [Nginx Reverse Proxy](#nginx-reverse-proxy)
8. [SSL with Certbot](#ssl-with-certbot)
9. [CI/CD with GitHub Actions](#cicd-with-github-actions)
10. [Monitoring](#monitoring)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

| Component | Minimum       | Recommended                  |
| --------- | ------------- | ---------------------------- |
| CPU       | 1 core        | 2+ cores                     |
| RAM       | 2 GB          | 4+ GB                        |
| Storage   | 20 GB         | 50+ GB (for metrics history) |
| OS        | Ubuntu 20.04+ | Ubuntu 22.04 LTS             |

### Software Requirements

- Docker 24.0+
- Docker Compose 2.0+
- Git
- (Optional) Nginx for reverse proxy
- (Optional) Certbot for SSL

---

## Quick Deploy with Docker

The fastest way to get pNode Pulse running:

```bash
# Clone the repository
git clone https://github.com/RECTOR-LABS/pnode-pulse.git
cd pnode-pulse

# Create environment file
cat > .env << EOF
POSTGRES_PASSWORD=$(openssl rand -base64 32)
EOF

# Start all services
docker compose up -d

# Check status
docker compose ps
```

Access at `http://localhost:7001`

---

## Production Deployment

### 1. Create Dedicated User

```bash
# As root
adduser pnodepulse
usermod -aG docker pnodepulse
su - pnodepulse
```

### 2. Clone Repository

```bash
git clone https://github.com/RECTOR-LABS/pnode-pulse.git
cd pnode-pulse
```

### 3. Configure Environment

```bash
# Generate secure password
POSTGRES_PASSWORD=$(openssl rand -base64 32)

# Create .env file
cat > .env << EOF
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
EOF

# Secure the file
chmod 600 .env
```

### 4. Start Services

```bash
# Start database and cache first
docker compose up -d postgres redis

# Wait for health checks
docker compose ps

# Run database migrations
docker run --rm \
  --network pnode-pulse-network \
  -v "$(pwd)":/app \
  -w /app \
  -e DATABASE_URL="postgresql://pnodepulse:$POSTGRES_PASSWORD@postgres:5432/pnodepulse" \
  node:20-alpine \
  sh -c "npx prisma migrate deploy"

# Start web application (single always-on container)
docker compose up -d green
```

### 5. Verify Deployment

```bash
# Check all services are healthy
docker compose ps

# Test health endpoint
curl http://localhost:7001/api/health
```

---

## Environment Configuration

### Required Variables

| Variable            | Description       | Example          |
| ------------------- | ----------------- | ---------------- |
| `POSTGRES_PASSWORD` | Database password | Random 32+ chars |

### Optional Variables

| Variable          | Description            | Default             |
| ----------------- | ---------------------- | ------------------- |
| `DATABASE_URL`    | Full connection string | Auto-generated      |
| `REDIS_HOST`      | Redis hostname         | `redis` (in Docker) |
| `REDIS_PORT`      | Redis port             | `6379`              |
| `PRPC_SEED_NODES` | Custom seed nodes      | Built-in list       |
| `NODE_ENV`        | Environment mode       | `production`        |

### Example .env

```bash
# Required
POSTGRES_PASSWORD=your_secure_password_here

# Optional overrides
PRPC_SEED_NODES=192.190.136.36,173.212.203.145,207.244.255.1
```

---

## Database Setup

### TimescaleDB

pNode Pulse uses TimescaleDB for time-series metrics. It's included in the Docker image.

### Migrations

Run migrations when deploying new versions:

```bash
# Using Docker
docker run --rm \
  --network pnode-pulse-network \
  -v "$(pwd)":/app \
  -w /app \
  -e DATABASE_URL="postgresql://pnodepulse:PASSWORD@postgres:5432/pnodepulse" \
  node:20-alpine \
  sh -c "npx prisma migrate deploy"
```

### Backup

```bash
# Create backup
docker exec pnode-pulse-postgres \
  pg_dump -U pnodepulse pnodepulse > backup_$(date +%Y%m%d).sql

# Restore backup
docker exec -i pnode-pulse-postgres \
  psql -U pnodepulse pnodepulse < backup_20241210.sql
```

---

## Data Collection

pNode Pulse automatically collects data from the Xandeum pNode network. The collector runs as part of the main application.

### How It Works

1. **Seed Nodes**: The collector starts with a list of known public pNodes
2. **Discovery**: Uses `get-pods-with-stats` (v0.7.0+) to discover all nodes in the gossip network
3. **Polling**: Collects metrics from public nodes every 30 seconds
4. **Storage**: Metrics are stored in TimescaleDB for time-series analysis

### Seed Nodes Configuration

By default, the collector uses these public pNodes:

```
173.212.203.145, 173.212.220.65, 161.97.97.41
192.190.136.36, 192.190.136.38, 192.190.136.28
192.190.136.29, 207.244.255.1
```

Override with the `PRPC_SEED_NODES` environment variable:

```bash
PRPC_SEED_NODES=192.190.136.36,173.212.203.145
```

### Verify Collection

```bash
# Check application logs for collection activity
docker compose logs green --tail 50 | grep -i collect

# Check database for recent metrics
docker exec pnode-pulse-postgres psql -U pnodepulse -c \
  "SELECT COUNT(*) FROM node_metrics WHERE collected_at > NOW() - INTERVAL '5 minutes'"

# Check API for collection status
curl https://your-domain.com/api/trpc/network.collectionStatus
```

### Collection Status

The dashboard displays collection status including:

- Last successful collection time
- Nodes polled vs nodes responding
- Recent collection history

---

## Nginx Reverse Proxy

### Install Nginx

```bash
sudo apt update
sudo apt install nginx
```

### Configuration

```nginx
# /etc/nginx/sites-available/pnode-pulse
server {
    listen 80;
    server_name pulse.yourdomain.com;

    location / {
        proxy_pass http://localhost:7001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/pnode-pulse /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## SSL with Certbot

### Install Certbot

```bash
sudo apt install certbot python3-certbot-nginx
```

### Obtain Certificate

```bash
sudo certbot --nginx -d pulse.yourdomain.com
```

### Auto-Renewal

Certbot automatically sets up renewal. Test with:

```bash
sudo certbot renew --dry-run
```

---

## CI/CD with GitHub Actions

pNode Pulse includes automated deployment workflows.

### Workflows

| Workflow                | Trigger        | Target                                   |
| ----------------------- | -------------- | ---------------------------------------- |
| `deploy-staging.yml`    | Push to `dev`  | Staging (port 7002)                      |
| `deploy-production.yml` | Push to `main` | Production (single container, port 7001) |

### Required GitHub Secrets

Configure in repository Settings → Secrets:

| Secret              | Description                         |
| ------------------- | ----------------------------------- |
| `VPS_SSH_KEY`       | Private SSH key for deployment user |
| `POSTGRES_PASSWORD` | Database password                   |

### Staging Deployment Flow

1. Push to `dev` branch
2. GitHub Actions builds Docker image
3. Pushes to GitHub Container Registry (GHCR)
4. SSHs to VPS and pulls new image
5. Restarts staging container

### Production Deployment Flow

1. Push to `main` branch
2. GitHub Actions builds Docker image
3. Pushes to GHCR with `:latest` tag (production builds also push a `:prod-<sha>` tag for rollbacks)
4. SSHs to VPS and runs `scripts/deploy.sh`, which:
   - Pulls the new image (`docker compose pull green`)
   - Recreates only the web container (`docker compose up -d --no-deps green`)
   - Waits up to 120s for the `green` container's health check to pass (fails the deploy if it stays unhealthy)

The `--no-deps` flag ensures deploys recreate **only** the web container and never touch `postgres`, `redis`, or `collector`. Because there is a single web container, the deploy is not zero-downtime: expect a brief (~5-15s) restart blip while `green` is recreated. This is acceptable for a single low-traffic instance.

### Manual Deployment

```bash
# SSH to VPS (Cloudflare Tunnel alias; direct port 22 is firewalled)
ssh pnodepulse

# Pull latest changes
cd ~/pnode-pulse
git pull origin main

# Pull the new image and recreate only the web container
SERVICE=green bash scripts/deploy.sh
```

---

## Monitoring

### Health Endpoints

| Endpoint      | Description                           |
| ------------- | ------------------------------------- |
| `/api/health` | Full health check (DB, Redis, uptime) |

### Health Response

```json
{
  "status": "healthy",
  "timestamp": "2024-12-10T10:00:00.000Z",
  "checks": {
    "database": true,
    "redis": true
  },
  "version": "1.0.0",
  "uptime": 3600
}
```

### Docker Health Checks

All services have built-in health checks:

```bash
# View health status
docker compose ps

# Check specific container
docker inspect pnode-pulse-web-green --format='{{.State.Health.Status}}'
```

### Log Monitoring

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f green

# Collector only
docker logs -f pnode-pulse-collector
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs green

# Verify network
docker network ls | grep pnode-pulse

# Recreate network if needed
docker compose down
docker compose up -d
```

### Database Connection Failed

```bash
# Test connection
docker exec pnode-pulse-postgres pg_isready -U pnodepulse

# Check password
docker exec pnode-pulse-web-green printenv DATABASE_URL
```

### Collector Not Collecting

```bash
# Check collector status
docker ps | grep collector

# View recent logs
docker logs pnode-pulse-collector --tail 100

# Test pRPC manually
curl -X POST http://192.190.136.36:6000/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"get-version","id":1}'
```

### Migrations Failed

```bash
# Check migration status
docker run --rm \
  --network pnode-pulse-network \
  -v "$(pwd)":/app \
  -w /app \
  -e DATABASE_URL="..." \
  node:20-alpine \
  sh -c "npx prisma migrate status"

# Reset if needed (WARNING: destroys data)
npx prisma migrate reset
```

### High Memory Usage

```bash
# Check container stats
docker stats

# Restart containers
docker compose restart green
```

---

## Production Deployment Model

Production runs a single always-on web container:

| Property        | Value                                                       |
| --------------- | ----------------------------------------------------------- |
| Compose service | `green`                                                     |
| Container name  | `pnode-pulse-web-green`                                     |
| Host port       | `7001`                                                      |
| nginx upstream  | `http://localhost:7001` (permanent — no upstream switching) |

Deploys run `scripts/deploy.sh`, which pulls the new image, recreates only the web container with `--no-deps` (leaving `postgres`, `redis`, and `collector` untouched), and waits up to 120s for the container's health check before considering the deploy successful:

```bash
# On the VPS, as pnodepulse
cd ~/pnode-pulse
SERVICE=green bash scripts/deploy.sh

# Verify
curl http://localhost:7001/api/health
```

This is not zero-downtime: expect a brief (~5-15s) restart blip while `green` is recreated. Acceptable for a single low-traffic instance.

### Rollback

Production builds push a `:prod-<sha>` tag to GHCR for every commit on `main`. To roll back, re-deploy a previous image tag:

```bash
# On the VPS, as pnodepulse
cd ~/pnode-pulse

# Pull the known-good image (replace <sha> with the target commit)
docker pull ghcr.io/rector-labs/pnode-pulse:prod-<sha>

# Re-tag it as :latest so deploy.sh picks it up
docker tag ghcr.io/rector-labs/pnode-pulse:prod-<sha> ghcr.io/rector-labs/pnode-pulse:latest

# Recreate the web container with the rolled-back image
SERVICE=green bash scripts/deploy.sh
```

---

## Updating

```bash
# Pull latest code
git pull origin main

# Pull latest image
docker compose pull green

# Apply migrations
docker run --rm \
  --network pnode-pulse-network \
  -v "$(pwd)":/app \
  -w /app \
  --env-file .env.docker \
  node:20-alpine \
  sh -c "npx prisma migrate deploy"

# Recreate only the web container (postgres/redis/collector untouched)
SERVICE=green bash scripts/deploy.sh

# Restart collector (only if its image/config changed)
docker restart pnode-pulse-collector
```

---

## Support

- [GitHub Issues](https://github.com/RECTOR-LABS/pnode-pulse/issues)
- [Xandeum Discord](https://discord.com/invite/mGAxAuwnR9)
