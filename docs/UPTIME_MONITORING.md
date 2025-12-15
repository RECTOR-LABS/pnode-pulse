# Uptime Monitoring Setup Guide

**Status**: Ready for configuration
**Priority**: P1 - Important for production visibility
**Last Updated**: 2025-12-15

---

## Overview

Uptime monitoring provides external visibility into your application's availability. Unlike APM (Sentry) which tracks errors from inside the application, uptime monitors check from outside - detecting when your site is completely unreachable.

### Why External Monitoring?

**Without uptime monitoring**:

- No notification when site goes down
- Rely on users to report issues
- No historical uptime data
- Cannot measure SLA compliance

**With uptime monitoring**:

- Instant alerts when site unreachable
- Historical uptime tracking (99.9% SLA)
- Response time monitoring
- Status page for users

---

## Recommended Service: UptimeRobot

**Why UptimeRobot?**

- Free tier: 50 monitors, 5-minute intervals
- Simple setup (no code required)
- Multiple alert channels (email, Slack, Discord, Telegram)
- Public status page option
- Response time tracking

**Alternatives**:

- **Pingdom**: Industry standard ($10+/month)
- **Better Uptime**: Modern UI, incident management ($20+/month)
- **Freshping**: Free tier, 50 monitors
- **StatusCake**: Free tier, 10 monitors

---

## Setup Instructions

### Step 1: Create UptimeRobot Account

1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Sign up for free account
3. Verify email address

### Step 2: Configure Monitors

Create the following monitors for pNode Pulse:

#### Monitor 1: Homepage (HTTPS)

| Setting             | Value                           |
| ------------------- | ------------------------------- |
| Monitor Type        | HTTP(s)                         |
| Friendly Name       | pNode Pulse - Homepage          |
| URL                 | `https://pulse.rectorspace.com` |
| Monitoring Interval | 5 minutes                       |
| Monitor Timeout     | 30 seconds                      |

**Advanced Settings**:

- HTTP Method: GET
- Expected Status Codes: 200-299

#### Monitor 2: Health Endpoint (API)

| Setting             | Value                                      |
| ------------------- | ------------------------------------------ |
| Monitor Type        | HTTP(s)                                    |
| Friendly Name       | pNode Pulse - Health                       |
| URL                 | `https://pulse.rectorspace.com/api/health` |
| Monitoring Interval | 5 minutes                                  |
| Monitor Timeout     | 30 seconds                                 |

**Advanced Settings**:

- HTTP Method: GET
- Expected Status Codes: 200
- Keyword: `"status":"healthy"` (type: exists)

This monitor validates:

- Application is running
- Database connection is healthy
- Redis connection is healthy

#### Monitor 3: API Endpoint (tRPC)

| Setting             | Value                                              |
| ------------------- | -------------------------------------------------- |
| Monitor Type        | HTTP(s)                                            |
| Friendly Name       | pNode Pulse - API                                  |
| URL                 | `https://pulse.rectorspace.com/api/v1/leaderboard` |
| Monitoring Interval | 5 minutes                                          |
| Monitor Timeout     | 30 seconds                                         |

**Advanced Settings**:

- HTTP Method: GET
- Expected Status Codes: 200
- Keyword: `nodes` (type: exists)

#### Monitor 4: Staging Environment

| Setting             | Value                                              |
| ------------------- | -------------------------------------------------- |
| Monitor Type        | HTTP(s)                                            |
| Friendly Name       | pNode Pulse - Staging                              |
| URL                 | `https://staging.pulse.rectorspace.com/api/health` |
| Monitoring Interval | 15 minutes                                         |
| Monitor Timeout     | 30 seconds                                         |

**Note**: Longer interval for staging (less critical).

### Step 3: Configure Alert Contacts

Go to **My Settings** → **Alert Contacts** → **Add Alert Contact**

#### Email Alerts

| Setting            | Value               |
| ------------------ | ------------------- |
| Alert Contact Type | Email               |
| Friendly Name      | Team Email          |
| Email              | your-team@email.com |

#### Discord Alerts (Recommended)

1. In Discord server, create webhook:
   - Server Settings → Integrations → Webhooks
   - Create Webhook → Copy URL

2. In UptimeRobot:
   | Setting | Value |
   |---------|-------|
   | Alert Contact Type | Webhook |
   | Friendly Name | Discord Alerts |
   | URL to Notify | `https://discord.com/api/webhooks/...` |
   | POST Value | `{"content": "*monitorFriendlyName* is *alertTypeFriendlyName*"}` |

#### Telegram Alerts

1. Create Telegram bot via @BotFather
2. Get chat ID from @userinfobot
3. In UptimeRobot:
   | Setting | Value |
   |---------|-------|
   | Alert Contact Type | Telegram |
   | Friendly Name | Telegram Alerts |
   | Bot Token | Your bot token |
   | Chat ID | Your chat ID |

### Step 4: Assign Alerts to Monitors

For each monitor:

1. Edit monitor
2. Scroll to "Alert Contacts To Notify"
3. Select appropriate contacts
4. Save

---

## Health Endpoint Reference

pNode Pulse provides a comprehensive health endpoint:

**URL**: `GET /api/health`

**Response (Healthy)**:

```json
{
  "status": "healthy",
  "timestamp": "2025-12-15T10:00:00.000Z",
  "checks": {
    "database": true,
    "redis": true
  },
  "version": "1.0.0",
  "uptime": 3600
}
```

**Response (Degraded)**:

```json
{
  "status": "degraded",
  "timestamp": "2025-12-15T10:00:00.000Z",
  "checks": {
    "database": true,
    "redis": false
  },
  "version": "1.0.0",
  "uptime": 3600
}
```

**Response (Unhealthy)**:

```json
{
  "status": "unhealthy",
  "timestamp": "2025-12-15T10:00:00.000Z",
  "checks": {
    "database": false,
    "redis": false
  },
  "version": "1.0.0",
  "uptime": 0
}
```

**HTTP Status Codes**:

- `200 OK` - Healthy or Degraded
- `503 Service Unavailable` - Unhealthy

---

## Status Page (Optional)

UptimeRobot provides a free public status page:

### Setup

1. Go to **My Settings** → **Public Status Pages**
2. Click **Add Status Page**
3. Configure:
   | Setting | Value |
   |---------|-------|
   | Friendly Name | pNode Pulse Status |
   | Custom Domain | status.pulse.rectorspace.com (optional) |
   | Monitors | Select all production monitors |

4. Share the status page URL with users

### Custom Domain Setup

To use `status.pulse.rectorspace.com`:

1. In UptimeRobot, get the CNAME target
2. Add DNS record:
   ```
   Type: CNAME
   Name: status
   Value: stats.uptimerobot.com
   ```
3. Wait for DNS propagation (up to 24 hours)
4. Verify in UptimeRobot settings

---

## Monitoring Best Practices

### 1. Monitor What Matters

- **Homepage**: User-facing availability
- **Health endpoint**: Application + dependencies
- **Critical API**: Core functionality (leaderboard, nodes)
- **Staging**: Pre-production validation

### 2. Set Appropriate Intervals

| Environment         | Interval | Reason                   |
| ------------------- | -------- | ------------------------ |
| Production homepage | 5 min    | Critical user experience |
| Production health   | 5 min    | Early warning system     |
| Production API      | 5 min    | Core functionality       |
| Staging             | 15 min   | Less critical            |

### 3. Configure Escalation

Set up tiered alerting:

1. **First alert**: Email (immediate)
2. **After 5 min down**: Slack/Discord
3. **After 15 min down**: Phone/SMS

### 4. Avoid Alert Fatigue

- Don't monitor non-critical endpoints
- Use "confirmed down" setting (2+ failed checks)
- Set maintenance windows during deployments

---

## Incident Response

### When Alert Fires

1. **Acknowledge alert** in monitoring dashboard
2. **Check health endpoint** manually:
   ```bash
   curl -s https://pulse.rectorspace.com/api/health | jq
   ```
3. **SSH to VPS** if unreachable:
   ```bash
   ssh pnodepulse
   docker compose ps
   docker compose logs --tail=100 blue
   ```
4. **Restart if needed**:
   ```bash
   docker compose restart blue
   ```
5. **Document incident** in runbook/post-mortem

### Common Issues

| Alert            | Likely Cause      | Fix                            |
| ---------------- | ----------------- | ------------------------------ |
| Homepage down    | Container crashed | `docker compose up -d blue`    |
| Health degraded  | Redis down        | `docker compose restart redis` |
| Health unhealthy | Database down     | Check PostgreSQL logs          |
| API timeout      | High load         | Scale or optimize queries      |

---

## Integration with Sentry

For comprehensive monitoring, combine:

1. **UptimeRobot**: External availability checks
2. **Sentry**: Internal error tracking + performance

When UptimeRobot detects downtime:

- Check Sentry for related errors
- Look for error spikes before outage
- Identify root cause from stack traces

---

## Deployment Checklist

- [ ] Create UptimeRobot account
- [ ] Add homepage monitor (HTTPS)
- [ ] Add health endpoint monitor
- [ ] Add API endpoint monitor
- [ ] Add staging monitor
- [ ] Configure email alert contact
- [ ] Configure Discord/Slack webhook
- [ ] Test alerts (pause/resume monitor)
- [ ] (Optional) Create public status page
- [ ] Document in team runbook

---

## Free Tier Limits

**UptimeRobot Free**:

- 50 monitors maximum
- 5-minute minimum interval
- 2-month log history
- Email + webhook alerts
- 1 status page

**When to Upgrade** ($7/month Pro):

- Need 1-minute intervals
- Want SMS/phone alerts
- Need longer history (24 months)
- Multiple status pages

---

## References

- **UptimeRobot Docs**: https://uptimerobot.com/help/
- **Status Page Setup**: https://uptimerobot.com/help/public-status-page
- **Webhook Integration**: https://uptimerobot.com/help/integrations
- **pNode Pulse Runbook**: [RUNBOOK.md](./RUNBOOK.md)

---

**Last Updated**: 2025-12-15
**Owner**: DevOps Team
**Status**: Ready - configure monitors after deployment
