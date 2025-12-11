# pNode Pulse Operations Runbook

**Last Updated**: 2025-12-09  
**Environment**: Production (pulse.rectorspace.com)  
**VPS**: 176.222.53.185 (pnodepulse user)

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
docker compose logs -f blue --tail 100

# Health check
curl http://localhost:7000/api/health

# Restart services
docker compose restart blue

# Database backup
./scripts/backup-db.sh

# Database restore
./scripts/restore-db.sh /backups/pnode-pulse/pnode-pulse_YYYYMMDD_HHMMSS.dump
```

### Service Ports

| Service | Port | URL |
|---------|------|-----|
| **Blue (Production)** | 7000 | http://pulse.rectorspace.com |
| **Green (Production)** | 7001 | (inactive, for blue/green) |
| **Staging** | 7002 | http://staging.pulse.rectorspace.com |
| **PostgreSQL** | 5434 | localhost only |
| **Redis** | 6381 | localhost only |

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
2. Push image to GHCR with `:latest` tag
3. SSH to VPS
4. Pull new image
5. Execute blue/green deployment (zero downtime)
6. Run health checks
7. Notify in Slack (if configured)

**Timeline**: ~10-15 minutes from merge to live

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

# Pull latest images
docker compose pull blue

# Deploy blue (production)
docker compose up -d blue

# Wait 10 seconds for health check
sleep 10

# Verify health
curl -f http://localhost:7000/api/health || echo "⚠️  Health check failed"

# Check logs
docker compose logs -f blue --tail 50
```

### Blue/Green Deployment

Zero-downtime deployment using blue/green strategy:

```bash
# SSH to VPS
ssh pnodepulse
cd ~/pnode-pulse

# Determine active environment
ACTIVE=$(docker compose ps --filter "status=running" | grep "7000" | grep -q "blue" && echo "blue" || echo "green")
INACTIVE=$([ "$ACTIVE" = "blue" ] && echo "green" || echo "blue")

echo "Active: $ACTIVE, Deploying to: $INACTIVE"

# Pull latest image
docker compose pull $INACTIVE

# Start inactive environment
docker compose up -d $INACTIVE

# Wait for health check
sleep 15
curl -f http://localhost:7001/api/health || exit 1

# Switch nginx upstream (manual step - update nginx config)
# sudo nano /etc/nginx/sites-available/pulse.rectorspace.com
# Change upstream from 7000 to 7001 (or vice versa)
# sudo nginx -t && sudo systemctl reload nginx

# Stop old environment
docker compose stop $ACTIVE

echo "✓ Deployment complete: $INACTIVE is now active"
```

### Database Migrations

**IMPORTANT**: Always run migrations before deploying code that depends on schema changes.

```bash
# SSH to VPS
ssh pnodepulse
cd ~/pnode-pulse

# View pending migrations
docker compose exec blue npx prisma migrate status

# Apply migrations (non-interactive)
docker compose exec blue npx prisma migrate deploy

# Verify
docker compose exec blue npx prisma migrate status
# Should show: "Database is up to date"
```

---

## Rollback Procedures

### Application Rollback

**Scenario**: New deployment causes errors or unexpected behavior

**Steps**:

```bash
# SSH to VPS
ssh pnodepulse
cd ~/pnode-pulse

# Option 1: Quick switch to inactive environment (if still running)
docker compose start green  # or blue
# Update nginx upstream back to previous port

# Option 2: Rollback to specific Docker image
# List recent image tags
docker images ghcr.io/rector-labs/pnode-pulse --format "table {{.Tag}}\t{{.CreatedAt}}"

# Pull specific version (use git SHA from GitHub)
docker pull ghcr.io/rector-labs/pnode-pulse:abc1234567890def

# Tag as latest locally
docker tag ghcr.io/rector-labs/pnode-pulse:abc1234567890def ghcr.io/rector-labs/pnode-pulse:latest

# Restart with old image
docker compose up -d blue

# Verify
curl -f http://localhost:7000/api/health
```

**Timeline**: 2-5 minutes

### Database Rollback

⚠️ **WARNING**: Database rollbacks can cause data loss. Only perform if absolutely necessary.

**Safe Rollback** (migration hasn't run long):
```bash
# If migration just ran and caused immediate issues
docker compose exec blue npx prisma migrate resolve --rolled-back 20251209_migration_name

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
docker compose logs blue --tail 100

# Check disk space
df -h

# Check memory
free -h

# Restart service
docker compose restart blue

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
docker compose logs blue --tail 200 | grep ERROR

# Check nginx logs (if applicable)
sudo tail -f /var/log/nginx/error.log

# Check resource usage
docker stats

# Check health endpoint
curl -v http://localhost:7000/api/health

# Restart application
docker compose restart blue
```

### High CPU/Memory Usage

```bash
# Check container resource usage
docker stats

# Check system resources
htop  # or top

# Check specific processes
docker compose exec blue ps aux | head -20

# Restart high-usage container
docker compose restart blue

# Check for memory leaks (if persistent)
docker compose logs blue | grep "out of memory"
```

### Disk Space Full

```bash
# Check disk usage
df -h

# Find large files
du -h / | sort -rh | head -20

# Clean up Docker images/containers
docker system prune -a --volumes

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
curl http://localhost:7000/api/health
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
docker compose logs -f blue --tail 100

# All services
docker compose logs -f --tail 50

# Specific time range
docker compose logs --since 30m blue
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

### Alerts (To be configured)

Recommended alerts:
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
   docker compose stop blue green staging
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
   curl http://localhost:7000/api/health
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
- [ ] Test restore procedure (staging)

### Quarterly

- [ ] Full restore test (production backup → staging)
- [ ] Disaster recovery drill
- [ ] Review and update runbook
- [ ] Performance optimization review

---

## Reference

- **GitHub Repository**: https://github.com/RECTOR-LABS/pnode-pulse
- **Database Backup**: [`docs/DATABASE_BACKUP.md`](./DATABASE_BACKUP.md)
- **CI/CD Workflows**: `.github/workflows/`
- **Docker Compose**: `docker-compose.yml`
- **Environment Config**: `.env.example`

---

**Document Owner**: DevOps Team  
**Review Schedule**: Quarterly  
**Incident Reports**: GitHub Issues (label: incident)
