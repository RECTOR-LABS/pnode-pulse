# GitHub Actions Deployment Workflows

Automated push-to-deploy workflows for pNode Pulse using GitHub Container Registry (GHCR) and blue/green deployment strategy.

## Overview

| Workflow | Trigger | Environment | Deployment Strategy |
|----------|---------|-------------|---------------------|
| `deploy-staging.yml` | Push to `dev` | Staging (port 7002) | Direct replacement |
| `deploy-production.yml` | Push to `main` | Production (ports 7000/7001) | Blue/Green zero-downtime |

## Setup Instructions

### 1. Configure GitHub Secrets

Navigate to: **Repository Settings → Secrets and variables → Actions → New repository secret**

Add the following secrets:

| Secret Name | Value | How to Get |
|-------------|-------|------------|
| `VPS_SSH_KEY` | Private SSH key | Generate: `ssh-keygen -t ed25519 -C "github-actions"` |
| `POSTGRES_PASSWORD` | Database password | Use existing or generate secure password |

#### Generating SSH Key for GitHub Actions

```bash
# On your local machine
ssh-keygen -t ed25519 -C "github-actions-pnodepulse" -f ~/.ssh/github-actions-pnodepulse

# Copy private key content (paste this into VPS_SSH_KEY secret)
cat ~/.ssh/github-actions-pnodepulse

# Copy public key to VPS
ssh-copy-id -i ~/.ssh/github-actions-pnodepulse.pub pnodepulse@176.222.53.185

# Or manually add to VPS
ssh pnodepulse@176.222.53.185
echo "your-public-key-content" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 2. Enable GitHub Container Registry

GHCR is automatically enabled for public repositories. For private repositories:

1. Go to **Repository Settings → Actions → General**
2. Under "Workflow permissions", select **Read and write permissions**
3. Check **Allow GitHub Actions to create and approve pull requests**

### 3. VPS Initial Setup

SSH into VPS as `pnodepulse` user:

```bash
ssh pnodepulse@176.222.53.185

# Clone repository
cd ~
git clone https://github.com/RECTOR-LABS/pnode-pulse.git
cd pnode-pulse

# Create .env file
cat > .env << 'EOF'
POSTGRES_PASSWORD=your_secure_password_here
EOF

# Start infrastructure services
docker compose up -d postgres redis

# Wait for healthy status
docker compose ps

# Run database migration
# (Use migration file from prisma/migrations/20251209060207_add_v070_fields/)
docker compose exec postgres psql -U pnodepulse -d pnodepulse < prisma/migrations/20251209060207_add_v070_fields/migration.sql
```

### 4. Test Deployment

#### Test Staging Deployment

```bash
# On local machine
git checkout dev
git commit --allow-empty -m "test: Trigger staging deployment"
git push origin dev

# Watch GitHub Actions
# Go to: https://github.com/RECTOR-LABS/pnode-pulse/actions

# Check deployment on VPS
ssh pnodepulse@176.222.53.185
cd ~/pnode-pulse
docker compose ps staging
docker compose logs --tail 50 staging

# Test health endpoint
curl http://localhost:7002/api/health
```

#### Test Production Deployment

```bash
# On local machine
git checkout main
git merge dev
git push origin main

# Watch GitHub Actions for blue/green deployment
# Check deployment on VPS
ssh pnodepulse@176.222.53.185
cd ~/pnode-pulse
docker compose ps blue green

# Test health endpoint
curl http://localhost:7000/api/health  # Blue
curl http://localhost:7001/api/health  # Green (if deployed)
```

## Workflow Details

### Staging Workflow (`deploy-staging.yml`)

**Triggered by**: Push to `dev` branch

**Steps**:
1. Checkout repository
2. Login to GHCR
3. Build Docker image
4. Push to GHCR with `:dev` tag
5. SSH to VPS
6. Pull latest image
7. Restart `staging` container
8. Verify deployment

**Deployment time**: ~3-5 minutes
**Downtime**: ~5-10 seconds (container restart)

### Production Workflow (`deploy-production.yml`)

**Triggered by**: Push to `main` branch

**Steps**:
1. Checkout repository
2. Login to GHCR
3. Build Docker image
4. Push to GHCR with `:latest` tag
5. SSH to VPS
6. Pull latest image
7. Run `scripts/blue-green-deploy.sh`:
   - Detect active environment (blue/green)
   - Start inactive environment with new image
   - Wait for health check to pass (max 60 seconds)
   - Switch to new environment
   - Stop old environment
8. Verify deployment

**Deployment time**: ~4-6 minutes
**Downtime**: Zero (blue/green switch)

## Blue/Green Deployment Script

Located at: `scripts/blue-green-deploy.sh`

**Key Features**:
- Automatic active/inactive environment detection
- Health check validation before traffic switch
- Configurable health check timeout
- Rollback capability (manual)
- Detailed logging

**Manual execution**:
```bash
ssh pnodepulse@176.222.53.185
cd ~/pnode-pulse
bash scripts/blue-green-deploy.sh
```

## Rollback Procedures

### Staging Rollback

```bash
ssh pnodepulse@176.222.53.185
cd ~/pnode-pulse

# Pull previous image version (find tag from GHCR)
docker pull ghcr.io/rector-labs/pnode-pulse:dev

# Restart staging
docker compose up -d staging
```

### Production Rollback

**Option 1: Switch back to previous environment**
```bash
# If green is active, switch to blue
docker compose up -d blue
docker compose stop green
```

**Option 2: Deploy previous image version**
```bash
# Pull previous image (find SHA tag from GHCR)
docker pull ghcr.io/rector-labs/pnode-pulse:prod-abc1234

# Tag as latest
docker tag ghcr.io/rector-labs/pnode-pulse:prod-abc1234 ghcr.io/rector-labs/pnode-pulse:latest

# Run blue/green deploy
bash scripts/blue-green-deploy.sh
```

## Monitoring

### Health Check Endpoints

| Environment | URL | Expected Response |
|-------------|-----|-------------------|
| Staging | http://localhost:7002/api/health | `{"status": "healthy"}` |
| Blue | http://localhost:7000/api/health | `{"status": "healthy"}` |
| Green | http://localhost:7001/api/health | `{"status": "healthy"}` |

### Logs

```bash
# View staging logs
docker compose logs -f staging

# View production logs
docker compose logs -f blue green

# View all logs
docker compose logs -f
```

### Container Status

```bash
# Check all running containers
docker compose ps

# Check resource usage
docker stats
```

## Troubleshooting

### Workflow Fails to SSH to VPS

**Symptom**: "Permission denied (publickey)" error in GitHub Actions

**Fix**:
1. Verify `VPS_SSH_KEY` secret contains the correct private key
2. Ensure public key is in `~/.ssh/authorized_keys` on VPS
3. Check SSH key permissions on VPS: `chmod 600 ~/.ssh/authorized_keys`

### Health Check Timeout

**Symptom**: Deployment fails with "Health check timeout"

**Fix**:
1. Check container logs: `docker compose logs staging` (or blue/green)
2. Verify DATABASE_URL and REDIS_URL in docker-compose.yml
3. Ensure postgres and redis are healthy: `docker compose ps`
4. Check application startup errors

### Image Pull Fails

**Symptom**: "Error response from daemon: pull access denied"

**Fix**:
1. Verify GHCR login in workflow
2. Check repository visibility (public/private)
3. Ensure workflow has package write permissions
4. Re-authenticate on VPS:
   ```bash
   echo "GITHUB_TOKEN" | docker login ghcr.io -u USERNAME --password-stdin
   ```

### Container Fails to Start

**Symptom**: Container starts then immediately exits

**Fix**:
1. Check environment variables in docker-compose.yml
2. Verify .env file exists on VPS
3. Check container logs for startup errors
4. Verify database migration was applied
5. Test locally with same environment

## Best Practices

1. **Always test in staging first**: Merge to `dev` → verify staging → merge to `main`
2. **Monitor deployments**: Watch GitHub Actions logs during deployment
3. **Verify health checks**: Always check health endpoints after deployment
4. **Keep environments in sync**: Run same migrations in staging and production
5. **Use semantic versioning**: Tag releases with version numbers
6. **Backup before major changes**: Snapshot VPS or backup database before risky deployments

## Next Steps

After completing setup:

1. Configure nginx reverse proxy for public domains
2. Setup SSL certificates with Certbot
3. Configure monitoring/alerting (optional)
4. Setup log aggregation (optional)
5. Configure automated backups (optional)

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Docker Compose](https://docs.docker.com/compose/)
- [Blue/Green Deployment Pattern](https://martinfowler.com/bliki/BlueGreenDeployment.html)
