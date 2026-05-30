# pNode Pulse Operations Runbook

**Last Updated**: 2025-12-15  
**Environment**: Production (pulse.rectorspace.com)  
**VPS**: 151.245.137.75 (pnodepulse user)

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Deployment](#deployment)
3. [Rollback Procedures](#rollback-procedures)
4. [Database Operations](#database-operations)
5. [Troubleshooting](#troubleshooting)
6. [Monitoring & Health](#monitoring--health)
7. [Emergency Procedures](#emergency-procedures)
8. [Maintenance Tasks](#maintenance-tasks)

---

## Quick Reference

### Essential Commands

```bash
# SSH to VPS
ssh pnodepulse

# Check service status
docker compose ps

# View logs
docker compose logs -f green --tail 100

# Health check
curl http://localhost:7001/api/health

# Restart services
docker compose restart green

# Database backup
./scripts/backup-db.sh

# Database restore
./scripts/restore-db.sh /backups/pnode-pulse/pnode-pulse_YYYYMMDD_HHMMSS.dump
```

### Service Ports

| Service                | Port          | URL / Access                     |
| ---------------------- | ------------- | -------------------------------- |
| **Green (Production)** | 7001 (host)   | https://pulse.rectorspace.com    |
| **PostgreSQL**         | internal only | `postgres:5432` (Docker network) |
| **Redis**              | internal only | `redis:6379` (Docker network)    |

### Contact Information

- **On-Call**: [Set up PagerDuty/OpsGenie]
- **Team Slack**: #pnode-pulse-ops
- **Incident Log**: GitHub Issues (label: incident)

---

## Deployment

### Automated Deployment (Recommended)

Deployment is fully automated via GitHub Actions on merge to `main` branch.

**Process**:

1. **Create PR** from `dev` or feature branch to `main`
2. **CI Checks**: Wait for lint, typecheck, build to pass
3. **Code Review**: Get approval from team member
4. **Merge PR**: Triggers GitHub Actions workflow
5. **Monitor**: Watch deployment in [Actions tab](https://github.com/RECTOR-LABS/pnode-pulse/actions)
6. **Verify**: Check health endpoint and monitor logs

**Deployment Steps** (automated):

1. Build Docker image from `main` branch
2. Push image to GHCR with `:latest` + `:prod-<sha>` tags (the SHA tag enables rollback)
3. SSH to VPS (via Cloudflare Tunnel `ssh.rectorspace.com`)
4. `git pull origin main`, then `bash scripts/deploy.sh`
5. Run `scripts/deploy.sh` — single-container recreate of `green` (`docker compose pull green` → `docker compose up -d --no-deps green`), health-gated (up to 120s; the workflow fails if `green` never becomes healthy). Brief ~5–15s restart blip (NOT zero-downtime)
6. Post-deploy smoke test curls ~9 public endpoints to confirm the live site responds
7. `docker image prune -f`, then verify (`docker compose ps green` + recent logs)

**Timeline**: ~3-5 minutes from merge to live

### Manual Deployment

Use manual deployment when:

- Automated deployment fails
- Emergency hotfix needed
- Testing deployment process

```bash
# SSH to VPS
ssh pnodepulse

# Navigate to project directory
cd ~/pnode-pulse

# Pull the latest code (deploy.sh + compose definitions)
git pull origin main

# Run the single-container deploy (pulls the image, recreates ONLY green
# with --no-deps, then health-gates green for up to 120s)
bash scripts/deploy.sh

# Equivalent manual steps if you prefer to run them by hand:
#   docker compose pull green
#   docker compose up -d --no-deps green   # --no-deps leaves postgres/redis/collector untouched

# Verify health (deploy.sh already health-gates; this is a sanity check)
curl -f http://localhost:7001/api/health || echo "⚠️  Health check failed"

# Check logs
docker compose logs -f green --tail 50
```

### Single-Container Deploy

Production runs **one** web container named `green` on host port 7001 (container port 3000). nginx points **permanently** at `localhost:7001` — there is no upstream switching, no `blue` container, no port 7000. A deploy recreates only `green`; `postgres`, `redis`, and the `collector` worker are long-lived and never touched by a deploy.

```bash
# SSH to VPS
ssh pnodepulse
cd ~/pnode-pulse

# Pull the latest code, then run the deploy script
git pull origin main
bash scripts/deploy.sh
```

`scripts/deploy.sh` does the following:

1. `docker compose pull green` — fetch the new image.
2. `docker compose up -d --no-deps green` — recreate ONLY the `green` web container (`--no-deps` leaves `postgres`/`redis`/`collector` running).
3. Health-gate `green`: poll its container healthcheck for up to 120s. If it never reports `healthy`, the script exits non-zero (the deploy is considered failed — roll back).

Because the single container is recreated in place, expect a brief ~5–15s restart blip (this is NOT a zero-downtime deploy). nginx needs no changes — the upstream is fixed at `localhost:7001`.

### Database Migrations

**IMPORTANT**: Always run migrations before deploying code that depends on schema changes.

```bash
# SSH to VPS
ssh pnodepulse
cd ~/pnode-pulse

# View pending migrations
docker compose exec green npx prisma migrate status

# Apply migrations (non-interactive)
docker compose exec green npx prisma migrate deploy

# Verify
docker compose exec green npx prisma migrate status
# Should show: "Database is up to date"
```

---

## Rollback Procedures

### Application Rollback

**Scenario**: New deployment causes errors or unexpected behavior

**Steps**:

Rollback = re-deploy a known-good image. Every production build pushes a `:prod-<sha>` tag to GHCR specifically for this. There is no environment switch — you re-tag the good image as `:latest` and re-run the deploy.

```bash
# SSH to VPS
ssh pnodepulse
cd ~/pnode-pulse

# List recent image tags to pick a known-good build
docker images ghcr.io/rector-labs/pnode-pulse --format "table {{.Tag}}\t{{.CreatedAt}}"

# Pull the known-good production image (use its prod-<sha> tag)
docker pull ghcr.io/rector-labs/pnode-pulse:prod-<sha>

# Re-tag it as :latest locally (deploy.sh deploys whatever :latest points to)
docker tag ghcr.io/rector-labs/pnode-pulse:prod-<sha> ghcr.io/rector-labs/pnode-pulse:latest

# Recreate green from :latest (single-container, health-gated)
SERVICE=green bash scripts/deploy.sh
# (equivalently: docker compose up -d --no-deps green)

# Verify
curl -f http://localhost:7001/api/health
```

**Timeline**: 2-5 minutes

### Database Rollback

⚠️ **WARNING**: Database rollbacks can cause data loss. Only perform if absolutely necessary.

**Safe Rollback** (migration hasn't run long):

```bash
# If migration just ran and caused immediate issues
docker compose exec green npx prisma migrate resolve --rolled-back 20251209_migration_name

# Restore application to previous version (without migration)
```

**Full Restore** (data corruption or critical failure):

```bash
# See DATABASE_BACKUP.md for full restore procedure
./scripts/restore-db.sh /backups/pnode-pulse/pnode-pulse_YYYYMMDD_HHMMSS.dump
```

**Timeline**: 15-30 minutes (depending on database size)

---

## Database Operations

### Backups

**Automated**: Daily at 2:00 AM UTC (cron job)  
**Retention**: 30 days  
**Location**: `/backups/pnode-pulse/`

**Manual Backup**:

```bash
ssh pnodepulse
export POSTGRES_PASSWORD=<password>
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5434
./scripts/backup-db.sh
```

**Verify Latest Backup**:

```bash
ls -lh /backups/pnode-pulse/ | tail -1
```

### Restore

See full documentation: [`docs/DATABASE_BACKUP.md`](./DATABASE_BACKUP.md)

```bash
# Quick restore
./scripts/restore-db.sh /backups/pnode-pulse/pnode-pulse_YYYYMMDD_HHMMSS.dump
```

### Database Maintenance

**Vacuum (monthly)**:

```bash
docker compose exec postgres psql -U pnodepulse -c "VACUUM ANALYZE;"
```

**Check Database Size**:

```bash
docker compose exec postgres psql -U pnodepulse -c "
  SELECT pg_size_pretty(pg_database_size('pnodepulse')) AS size;
"
```

**Check Table Sizes**:

```bash
docker compose exec postgres psql -U pnodepulse -c "
  SELECT schemaname, tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
  LIMIT 10;
"
```

---

## Troubleshooting

### Service Won't Start

```bash
# Check container status
docker compose ps

# Check logs for errors
docker compose logs green --tail 100

# Check disk space
df -h

# Check memory
free -h

# Restart service
docker compose restart green

# Full restart (if needed)
docker compose down
docker compose up -d
```

### Database Connection Errors

**Symptoms**: "Connection refused", "Connection timeout", "Too many connections"

```bash
# Test database connectivity
docker compose exec postgres pg_isready -U pnodepulse

# Check active connections
docker compose exec postgres psql -U pnodepulse -c "
  SELECT COUNT(*) as connections FROM pg_stat_activity;
"

# Check for long-running queries
docker compose exec postgres psql -U pnodepulse -c "
  SELECT pid, now() - query_start AS duration, query
  FROM pg_stat_activity
  WHERE state = 'active'
  ORDER BY duration DESC
  LIMIT 10;
"

# Kill stuck connection (if needed)
docker compose exec postgres psql -U pnodepulse -c "
  SELECT pg_terminate_backend(12345);  -- Use PID from above
"

# Restart PostgreSQL
docker compose restart postgres
```

### Redis Connection Errors

```bash
# Test connectivity
docker compose exec redis redis-cli ping
# Should return: PONG

# Check memory usage
docker compose exec redis redis-cli info memory | grep used_memory_human

# Flush cache (if needed - DESTRUCTIVE)
docker compose exec redis redis-cli FLUSHALL

# Restart Redis
docker compose restart redis
```

### Application Errors (500, 502, 503)

```bash
# Check application logs
docker compose logs green --tail 200 | grep ERROR

# Check nginx logs (if applicable)
sudo tail -f /var/log/nginx/error.log

# Check resource usage
docker stats

# Check health endpoint
curl -v http://localhost:7001/api/health

# Restart application
docker compose restart green
```

### High CPU/Memory Usage

```bash
# Check container resource usage
docker stats

# Check system resources
htop  # or top

# Check specific processes
docker compose exec green ps aux | head -20

# Restart high-usage container
docker compose restart green

# Check for memory leaks (if persistent)
docker compose logs green | grep "out of memory"
```

### Disk Space Full

```bash
# Check disk usage
df -h

# Find large files
du -h / | sort -rh | head -20

# Clean up dangling Docker images + build cache
# (shared VPS: NEVER `docker system prune` — it would wipe other projects' images/volumes)
docker image prune -f
docker builder prune -f

# Clean up old backups (if needed)
find /backups/pnode-pulse/ -name "*.dump" -mtime +30 -delete

# Clean up logs
sudo journalctl --vacuum-time=7d
```

---

## Monitoring & Health

### Health Checks

**Application Health**:

```bash
curl http://localhost:7001/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

**Database Health**:

```bash
docker compose exec postgres pg_isready -U pnodepulse
# Expected: ... - accepting connections
```

**Redis Health**:

```bash
docker compose exec redis redis-cli ping
# Expected: PONG
```

### Metrics & Logs

**View Live Logs**:

```bash
# Application
docker compose logs -f green --tail 100

# All services
docker compose logs -f --tail 50

# Specific time range
docker compose logs --since 30m green
```

**System Metrics**:

```bash
# Container stats
docker stats

# Disk I/O
iostat -x 1

# Network
iftop

# Memory
free -h && cat /proc/meminfo | grep -i available
```

### External Uptime Monitoring

External monitoring checks your site from outside, detecting when it's completely unreachable.

**Service**: UptimeRobot (recommended) - Free tier with 50 monitors

**Monitors to Configure**:
| Monitor | URL | Check |
|---------|-----|-------|
| Homepage | https://pulse.rectorspace.com | HTTP 200 |
| Health | https://pulse.rectorspace.com/api/health | Keyword: `"status":"healthy"` |
| API | https://pulse.rectorspace.com/api/v1/leaderboard | Keyword: `nodes` |

**Full Setup Guide**: [`docs/UPTIME_MONITORING.md`](./UPTIME_MONITORING.md)

**When Alert Fires**:

1. Check health endpoint: `curl -s https://pulse.rectorspace.com/api/health`
2. SSH and check logs: `ssh pnodepulse && docker compose logs green --tail 100`
3. Restart if needed: `docker compose restart green`
4. Check Sentry for related errors

### APM & Error Tracking

Application Performance Monitoring tracks errors from inside the application.

**Service**: Sentry (recommended) - Free tier with 5K errors/month

**Configuration**: Set `SENTRY_DSN` in `.env` to activate
**Full Setup Guide**: [`docs/APM_SETUP.md`](./APM_SETUP.md)

**What Sentry Provides**:

- Real-time error notifications
- Full stack traces with source maps
- Performance monitoring (slow API calls)
- User context and session replay

### Alerts (To be configured)

Recommended alerts:

- **UptimeRobot**: Site unreachable (2+ failed checks)
- **Sentry**: New error type (first occurrence)
- **Sentry**: Error spike (>10 in 5 minutes)
- Application health check fails (3 consecutive failures)
- Database connection pool exhaustion (>80%)
- Disk space < 20%
- Memory usage > 90%
- High error rate (>1% of requests)
- Backup failure (no backup in 26 hours)

---

## Emergency Procedures

### Complete Service Outage

**Incident**: All services down, site unreachable

1. **Assess**:

   ```bash
   ssh pnodepulse
   docker compose ps
   systemctl status docker
   df -h
   ```

2. **Quick Recovery**:

   ```bash
   # Restart all services
   docker compose restart

   # If Docker is down
   sudo systemctl restart docker
   docker compose up -d
   ```

3. **If still failing**:
   - Check VPS dashboard for alerts
   - Check disk space (`df -h`)
   - Check system logs (`sudo journalctl -xe`)
   - Restore from backup if data corruption suspected

4. **Document**: Create incident report in GitHub Issues

### Data Corruption

**Incident**: Database errors, inconsistent data

1. **Stop writes immediately**:

   ```bash
   docker compose stop green
   ```

2. **Assess damage**:

   ```bash
   docker compose exec postgres psql -U pnodepulse -c "\dt"
   # Check table counts, verify critical tables exist
   ```

3. **Restore from backup**:

   ```bash
   ./scripts/restore-db.sh /backups/pnode-pulse/pnode-pulse_YYYYMMDD_HHMMSS.dump
   ```

4. **Verify restoration**:
   ```bash
   curl http://localhost:7001/api/health
   # Check critical data in UI
   ```

### Security Incident

**Incident**: Suspected breach, unauthorized access

1. **Isolate**: Block access, change credentials
2. **Assess**: Check logs, identify scope
3. **Contain**: Rotate API keys, database passwords
4. **Recover**: Restore from known-good backup if needed
5. **Document**: Full incident report, timeline
6. **Post-mortem**: Review access controls, update security

---

## Maintenance Tasks

### Weekly

- [ ] Review error logs for patterns
- [ ] Check disk usage trends
- [ ] Verify backup integrity (spot check)
- [ ] Review monitoring alerts

### Monthly

- [ ] Database VACUUM ANALYZE
- [ ] Review and rotate application logs
- [ ] Update dependencies (security patches)
- [ ] Test restore procedure (restore to a scratch DB)

### Quarterly

- [ ] Full restore test (production backup → scratch DB)
- [ ] Disaster recovery drill
- [ ] Review and update runbook
- [ ] Performance optimization review

---

## Reference

- **GitHub Repository**: https://github.com/RECTOR-LABS/pnode-pulse
- **Database Backup**: [`docs/DATABASE_BACKUP.md`](./DATABASE_BACKUP.md)
- **Uptime Monitoring**: [`docs/UPTIME_MONITORING.md`](./UPTIME_MONITORING.md)
- **APM Setup (Sentry)**: [`docs/APM_SETUP.md`](./APM_SETUP.md)
- **CI/CD Workflows**: `.github/workflows/`
- **Docker Compose**: `docker-compose.yml`
- **Environment Config**: `.env.example`

---

**Document Owner**: DevOps Team  
**Review Schedule**: Quarterly  
**Incident Reports**: GitHub Issues (label: incident)
