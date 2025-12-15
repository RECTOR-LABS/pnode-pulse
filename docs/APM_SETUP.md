# APM & Error Tracking Setup Guide

**Status**: ✅ Code Ready (activate by setting SENTRY_DSN)
**Priority**: P0 - Critical for production monitoring
**Last Updated**: 2025-12-15

---

## Overview

Application Performance Monitoring (APM) and error tracking provide critical visibility into production issues. This guide covers setting up Sentry for pNode Pulse.

### Why APM?

**Without APM** (current state):
- ❌ Errors only visible in console logs (requires SSH)
- ❌ No alerting when errors spike
- ❌ No stack traces or context
- ❌ Cannot track error trends over time
- ❌ Slow debugging (manual log inspection)

**With APM** (after setup):
- ✅ Real-time error notifications
- ✅ Full stack traces with source maps
- ✅ User context and breadcrumbs
- ✅ Error trend analysis and dashboards
- ✅ Performance monitoring (slow API calls)
- ✅ Release tracking and regression detection

---

## Recommended Service: Sentry

**Why Sentry?**
- Free tier (5K events/month)
- Excellent Next.js support (@sentry/nextjs)
- Source map support for readable stack traces
- Session replay for debugging
- Performance monitoring included

**Alternatives**:
- **Datadog**: Full observability platform (expensive, $$$)
- **New Relic**: Comprehensive APM (complex setup)
- **LogRocket**: Session replay focus (frontend-heavy)
- **Rollbar**: Error tracking only (simpler than Sentry)

---

## Setup Instructions

### Step 1: Create Sentry Account

1. Go to [sentry.io](https://sentry.io)
2. Sign up for free account
3. Create new project: **pNode Pulse**
4. Platform: **Next.js**
5. Alert settings: **Default (email on first error)**

### Step 2: Install Sentry

```bash
# SSH to development machine or VPS
cd ~/pnode-pulse

# Install Sentry SDK for Next.js
npm install @sentry/nextjs

# Run interactive wizard
npx @sentry/wizard@latest -i nextjs
```

**Wizard will prompt for**:
- DSN (from Sentry project settings)
- Upload source maps? **Yes**
- Create example page? **No** (we'll integrate manually)

### Step 3: Configure Environment Variables

Add to `.env` and `.env.example`:

```bash
# Sentry Error Tracking
SENTRY_DSN=https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@o<org-id>.ingest.sentry.io/<project-id>
NEXT_PUBLIC_SENTRY_DSN=https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@o<org-id>.ingest.sentry.io/<project-id>
SENTRY_AUTH_TOKEN=sntrys_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENTRY_ORG=rector-labs
SENTRY_PROJECT=pnode-pulse
```

**Where to find these**:
- **DSN**: Sentry project settings → Client Keys (DSN)
- **Auth Token**: Sentry account → Settings → Auth Tokens → Create New Token
  - Scopes needed: `project:releases`, `org:read`
- **Org/Project**: From your Sentry URL

### Step 4: Update Docker Configuration

Update `docker-compose.yml` to pass Sentry env vars:

```yaml
services:
  blue:
    environment:
      # Existing vars...
      SENTRY_DSN: ${SENTRY_DSN}
      NEXT_PUBLIC_SENTRY_DSN: ${NEXT_PUBLIC_SENTRY_DSN}
      SENTRY_ENVIRONMENT: production
      SENTRY_RELEASE: ${GIT_COMMIT_SHA:-latest}

  staging:
    environment:
      # Existing vars...
      SENTRY_DSN: ${SENTRY_DSN}
      NEXT_PUBLIC_SENTRY_DSN: ${NEXT_PUBLIC_SENTRY_DSN}
      SENTRY_ENVIRONMENT: staging
      SENTRY_RELEASE: ${GIT_COMMIT_SHA:-dev}
```

### Step 5: Verify Installation

The wizard creates these files (review them):
- `sentry.client.config.ts` - Client-side configuration
- `sentry.server.config.ts` - Server-side configuration
- `sentry.edge.config.ts` - Edge runtime configuration
- `next.config.js` - Updated with Sentry webpack plugin

**Check configuration**:
```typescript
// sentry.server.config.ts should have:
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  
  // Performance Monitoring
  tracesSampleRate: 0.1, // 10% of transactions
  
  // Session Replay (debugging)
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% when errors occur
});
```

---

## Integration Points

### 1. API Routes (tRPC)

Already have good error handling, just add Sentry capture:

```typescript
// src/server/api/routers/nodes.ts
import * as Sentry from "@sentry/nextjs";

try {
  // Existing code...
} catch (error) {
  // Add Sentry capture with context
  Sentry.captureException(error, {
    tags: {
      router: "nodes",
      operation: "getAll",
    },
    extra: {
      filters: input,
      userId: ctx.session?.user?.id,
    },
  });
  
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: error instanceof Error ? error.message : "Unknown error",
  });
}
```

### 2. Collector Worker

```typescript
// src/server/workers/collector.ts
import * as Sentry from "@sentry/nextjs";

export async function runCollection() {
  try {
    // Existing collection logic...
  } catch (error) {
    Sentry.captureException(error, {
      tags: { worker: "collector" },
      extra: { nodesPolled: addresses.length },
    });
    
    logger.error('Collection failed', error);
    throw error;
  }
}
```

### 3. Client-Side Errors

Sentry automatically captures unhandled errors, but you can add manual captures:

```typescript
// src/components/dashboard/network-overview.tsx
import * as Sentry from "@sentry/nextjs";

try {
  // Component logic...
} catch (error) {
  Sentry.captureException(error, {
    tags: { component: "NetworkOverview" },
  });
  // Show user-friendly error
}
```

### 4. Performance Monitoring

Track slow operations:

```typescript
import * as Sentry from "@sentry/nextjs";

const transaction = Sentry.startTransaction({
  name: "CollectFromAllNodes",
  op: "background-job",
});

try {
  // Slow operation...
  const results = await Promise.all(nodes.map(collect));
} finally {
  transaction.finish();
}
```

---

## Alert Configuration

### In Sentry Dashboard

1. **Project Settings** → **Alerts**
2. **Create Alert Rule**:

**Rule 1: Error Spike**
- Condition: >10 errors in 5 minutes
- Action: Email team
- Environment: production

**Rule 2: New Error Type**
- Condition: First seen error
- Action: Slack notification (if configured)
- Environment: production

**Rule 3: Performance Degradation**
- Condition: p95 latency >2 seconds
- Action: Email
- Environment: production

### Slack Integration (optional)

1. Sentry → **Settings** → **Integrations** → **Slack**
2. Connect Slack workspace
3. Choose channel: `#pnode-pulse-alerts`
4. Enable alert rules in Slack

---

## Source Maps

**Why?**: Makes stack traces readable (shows actual TypeScript code, not minified)

The Sentry wizard automatically configures source map upload via `next.config.js`:

```javascript
// next.config.js (already added by wizard)
const { withSentryConfig } = require("@sentry/nextjs");

module.exports = withSentryConfig(
  nextConfig,
  {
    silent: true, // Suppresses source map upload logs
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
  },
  {
    widenClientFileUpload: true,
    transpileClientSDK: true,
    hideSourceMaps: true, // Hides source maps from browser DevTools
    disableLogger: true,
  }
);
```

**Verification**:
1. Deploy to production
2. Trigger an error
3. Check Sentry issue - stack trace should show TypeScript code, not minified JS

---

## Testing

### Test Error Capture

```bash
# Add test endpoint
# pages/api/sentry-test.ts
import { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  throw new Error("Sentry test error from API route");
}
```

**Test**:
1. Deploy to staging
2. Visit `/api/sentry-test`
3. Check Sentry dashboard for error
4. Verify stack trace is readable
5. Check email for alert

### Test Performance Monitoring

Visit a slow page and check Sentry Performance tab for transaction data.

---

## Monitoring Best Practices

### 1. Use Breadcrumbs

```typescript
Sentry.addBreadcrumb({
  category: "collector",
  message: `Starting collection for ${nodeCount} nodes`,
  level: "info",
});
```

### 2. Tag Consistently

```typescript
Sentry.setTags({
  environment: process.env.NODE_ENV,
  version: process.env.NEXT_PUBLIC_VERSION,
  component: "collector",
});
```

### 3. Set User Context

```typescript
Sentry.setUser({
  id: userId,
  email: userEmail,
  subscription: "free", // or "pro"
});
```

### 4. Filter Sensitive Data

```typescript
// sentry.server.config.ts
Sentry.init({
  beforeSend(event, hint) {
    // Remove sensitive data
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers.Authorization;
    }
    return event;
  },
});
```

---

## Cost Management

**Free Tier Limits**:
- 5,000 errors/month
- 10,000 performance transactions/month

**Staying Within Free Tier**:
1. **Sample Performance**: Set `tracesSampleRate: 0.1` (10%)
2. **Filter Noisy Errors**: Ignore known issues in Sentry dashboard
3. **Monitor Usage**: Check Sentry → Stats → Usage
4. **Upgrade if needed**: Team plan ($26/month) for 50K errors

---

## Deployment Checklist

- [ ] Create Sentry account and project
- [ ] Install `@sentry/nextjs` package
- [ ] Run Sentry wizard (`npx @sentry/wizard`)
- [ ] Add environment variables to `.env`
- [ ] Update `docker-compose.yml` with Sentry env vars
- [ ] Deploy to staging and test
- [ ] Configure alert rules in Sentry
- [ ] (Optional) Setup Slack integration
- [ ] Deploy to production
- [ ] Monitor error dashboard for 24 hours
- [ ] Document in runbook

---

## Troubleshooting

**Errors not appearing in Sentry**:
- Check `SENTRY_DSN` is set correctly
- Verify Sentry init in both client and server configs
- Check browser console for Sentry errors
- Ensure source maps uploaded successfully

**Source maps not working**:
- Verify `SENTRY_AUTH_TOKEN` has correct scopes
- Check `next.config.js` Sentry configuration
- Look for source map upload errors in build logs

**Too many errors logged**:
- Add filters in Sentry (Settings → Inbound Filters)
- Ignore patterns: `/healthcheck/`, browser extensions
- Reduce sample rate if hitting free tier limit

---

## References

- **Sentry Next.js Docs**: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- **Sentry Configuration**: https://docs.sentry.io/platforms/javascript/configuration/
- **Source Maps**: https://docs.sentry.io/platforms/javascript/sourcemaps/
- **Alerts**: https://docs.sentry.io/product/alerts/

---

**Last Updated**: 2025-12-15
**Owner**: DevOps Team
**Status**: Code ready - activate with SENTRY_DSN environment variable
