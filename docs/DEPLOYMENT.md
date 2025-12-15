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

Access at `http://localhost:7000`

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

# Start web application
docker compose up -d blue
```

### 5. Verify Deployment

```bash
# Check all services are healthy
docker compose ps

# Test health endpoint
curl http://localhost:7000/api/health
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
docker compose logs blue --tail 50 | grep -i collect

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
        proxy_pass http://localhost:7000;
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

| Workflow                | Trigger        | Target                  |
| ----------------------- | -------------- | ----------------------- |
| `deploy-staging.yml`    | Push to `dev`  | Staging (port 7002)     |
| `deploy-production.yml` | Push to `main` | Production (blue/green) |

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
3. Pushes to GHCR with `:latest` tag
4. Runs blue/green deployment:
   - Starts inactive environment (blue or green)
   - Waits for health check
   - Switches traffic
   - Stops old environment

### Manual Deployment

```bash
# SSH to VPS
ssh pnodepulse@your-vps

# Pull latest changes
cd ~/pnode-pulse
git pull origin main

# Pull latest image
docker compose pull blue

# Restart service
docker compose up -d blue
```

### Blue/Green Switch

```bash
# Check current active environment
docker compose ps | grep healthy

# If blue is active, switch to green
docker compose --profile green up -d green

# Wait for health check
curl http://localhost:7001/api/health

# Update nginx to point to 7001
sudo vim /etc/nginx/sites-enabled/your-site
sudo nginx -t && sudo systemctl reload nginx

# Stop old blue
docker compose stop blue
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
docker inspect pnode-pulse-web-blue --format='{{.State.Health.Status}}'
```

### Log Monitoring

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f blue

# Collector only
docker logs -f pnode-pulse-collector
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs blue

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
docker exec pnode-pulse-web-blue printenv DATABASE_URL
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
docker compose restart blue
```

---

## Blue/Green Deployment

For zero-downtime updates:

```bash
# Deploy to green while blue is active
docker compose --profile green up -d green

# Wait for health check
sleep 30
curl http://localhost:7001/api/health

# Switch nginx to green (port 7001)
# Update nginx config and reload

# Stop blue
docker compose stop blue
```

---

## Updating

```bash
# Pull latest code
git pull origin main

# Pull latest image
docker compose pull

# Apply migrations
docker run --rm \
  --network pnode-pulse-network \
  -v "$(pwd)":/app \
  -w /app \
  --env-file .env.docker \
  node:20-alpine \
  sh -c "npx prisma migrate deploy"

# Restart services
docker compose up -d blue

# Restart collector
docker restart pnode-pulse-collector
```

---

## Support

- [GitHub Issues](https://github.com/RECTOR-LABS/pnode-pulse/issues)
- [Xandeum Discord](https://discord.com/invite/mGAxAuwnR9)
