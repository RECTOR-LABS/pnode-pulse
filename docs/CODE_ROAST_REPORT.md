# CODE ROAST REPORT

**Roast Date**: December 8, 2024
**Repository**: pnode-pulse
**Roaster**: CIPHER (No Mercy Mode)
**Verdict**: **NEEDS WORK** - Ship it if you dare, but sleep with one eye open

---

## CAREER ENDERS

### 1. JWT Secret Hardcoded with Fallback
**File**: `src/lib/auth/verify-token.ts:11-12` & `src/server/api/routers/auth.ts:17-18`
**Sin**: Hardcoded JWT secret with a default fallback that would make any security auditor faint

**Evidence**:
```typescript
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-secret-key-change-in-production"
);
```

```typescript
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "pnode-pulse-jwt-secret-change-in-production"
);
```

**Why it's bad**: If someone deploys without setting `JWT_SECRET`, congratulations - you've just given everyone the keys to your kingdom. The fallback should CRASH, not silently use a known default. Any attacker can Google this string and forge tokens.

**The Fix**: Remove the fallback. Crash hard on startup if `JWT_SECRET` is not set:
```typescript
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET environment variable is required");
```

---

### 2. .env File Committed to Repository
**File**: `.env` (committed!)
**Sin**: Environment file with database credentials is in the repo

**Evidence**:
```
POSTGRES_PASSWORD=devpassword
DATABASE_URL=postgresql://pnodepulse:devpassword@localhost:5434/pnodepulse
```

**Why it's bad**: While `.gitignore` has `.env*`, the file is still present in the repo. Anyone cloning gets your development credentials. The `devpassword` pattern trains developers to commit passwords.

**The Fix**: Delete `.env` from git history, add to `.gitignore` properly, use `.env.example` (which you have, good) with placeholder values.

---

### 3. ZERO Unit Tests in Source
**Files**: `src/**/*.test.ts` - **NONE FOUND**
**Sin**: Not a single unit test in the source directory

**Evidence**:
```bash
$ find src -name "*.test.ts" # Returns nothing
$ find tests -name "*.ts"    # Returns nothing
```

**Why it's bad**: This is a 33,107-line codebase with analytics, authentication, payments, alerts, and background workers. Not one test. You're flying blind, hoping nothing breaks. Every PR is a coin flip.

**The Fix**: Start with critical paths:
- Auth flow (JWT generation/verification)
- Rate limiter
- Analytics calculations
- Alert processor rules

---

### 4. Redis Fallback Allows All Requests
**File**: `src/lib/api/rate-limiter.ts:109-120`
**Sin**: When Redis is down, rate limiting is completely disabled

**Evidence**:
```typescript
if (!redisAvailable) {
  // Fallback: allow requests but log warning
  console.warn("[RateLimit] Redis unavailable, allowing request");
  return {
    allowed: true,  // <-- LOL
    limit,
    remaining: limit,
    ...
  };
}
```

**Why it's bad**: DDoS protection goes out the window the moment Redis has a hiccup. An attacker just needs to overwhelm your Redis instance first, then they have unlimited API access.

**The Fix**: Implement in-memory fallback rate limiting, or fail closed (deny requests when rate limiting is unavailable).

---

## EMBARRASSING MOMENTS

### 5. Type `any` Abuse in Mobile App
**Files**: `packages/mobile/src/screens/NodesScreen.tsx:41`, `DashboardScreen.tsx:23`, `NodeDetailsScreen.tsx:29`
**Sin**: Bypassing TypeScript with `(trpc as any)` throughout mobile app

**Evidence**:
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(trpc as any).nodes.list.query({
```

**Why it's bad**: You've got a full TypeScript monorepo but threw type safety out the window for the entire mobile app. Any refactoring of tRPC routes will silently break mobile. Runtime errors waiting to happen.

**The Fix**: Share types between packages properly. Create a shared types package or export router types from the main app.

---

### 6. Console.log Left in Production Code
**Files**: 50+ occurrences across production code
**Sin**: `console.log` debugging statements littered throughout

**Evidence** (partial):
```typescript
// src/server/workers/collector.ts
console.log(`[Collector] Discovered ${newNodes.length} new nodes`);
console.log("[Collector] Starting collection cycle...");
console.log(`[Collector] Failed: ${result.address} - ${result.error}`);

// src/server/workers/alert-processor.ts
console.log("Starting Alert Processor...");
console.log(`Found ${activeAlerts.length} active alerts with escalation policies`);
```

**Why it's bad**: Production noise, potential PII leakage, performance overhead, unprofessional logs that make debugging harder (everything is noise).

**The Fix**: Use a proper logger (pino is already in dependencies but not used properly). Implement log levels, structured logging.

---

### 7. Duplicate JWT Secret Definitions
**Files**: `src/lib/auth/verify-token.ts`, `src/server/api/routers/auth.ts`, `src/server/api/routers/apiKeys.ts`
**Sin**: JWT_SECRET defined THREE times with different fallback strings

**Evidence**:
```typescript
// verify-token.ts
process.env.JWT_SECRET || "your-secret-key-change-in-production"

// auth.ts
process.env.JWT_SECRET || "pnode-pulse-jwt-secret-change-in-production"

// apiKeys.ts
process.env.JWT_SECRET || "pnode-pulse-jwt-secret-change-in-production"
```

**Why it's bad**: If env var isn't set, `verify-token.ts` uses a DIFFERENT secret than `auth.ts` and `apiKeys.ts`. Tokens generated won't verify. This is a ticking time bomb.

**The Fix**: Single source of truth. Create `src/lib/config/jwt.ts` that exports the secret once.

---

### 8. `dangerouslySetInnerHTML` for Service Worker Registration
**File**: `src/app/[locale]/layout.tsx:107-121`
**Sin**: Using dangerouslySetInnerHTML when a proper script would work

**Evidence**:
```tsx
<Script
  dangerouslySetInnerHTML={{
    __html: `
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
          navigator.serviceWorker.register('/sw.js')
          ...
```

**Why it's bad**: It's called "dangerously" for a reason. This specific use isn't vulnerable (it's static), but it sets a bad pattern and makes XSS auditing harder.

**The Fix**: Use Next.js Script component properly or move to an actual `.js` file.

---

### 9. SELECT * in Raw SQL Queries
**File**: `src/server/workers/alert-processor.ts:68`, `src/server/api/routers/analytics.ts:1422`
**Sin**: Using `SELECT *` in production queries

**Evidence**:
```sql
SELECT * FROM node_metrics nm
WHERE nm.node_id = n.id
ORDER BY nm.time DESC
LIMIT 1
```

**Why it's bad**:
- Fetches columns you don't need (wasted bandwidth/memory)
- Schema changes can break code silently
- No explicit contract between query and code

**The Fix**: Explicitly list needed columns: `SELECT nm.cpu_percent, nm.ram_used, nm.time FROM ...`

---

### 10. .env.example Contains Real-Looking Credentials
**File**: `.env.example`
**Sin**: Example file has `devpassword` which developers will copy verbatim

**Evidence**:
```
POSTGRES_PASSWORD=devpassword
DATABASE_URL=postgresql://pnodepulse:devpassword@localhost:5434/pnodepulse
```

**Why it's bad**: Copy-paste culture means these "example" values end up in production. At minimum, someone will use `devpassword` on their dev database that's somehow exposed.

**The Fix**: Use obviously fake placeholders: `your_postgres_password_here`, `<CHANGE_ME>`, etc.

---

## EYE ROLL COLLECTION

### 11. No Test Script in package.json
**File**: `package.json`
**Sin**: `npm run test` doesn't exist

**Evidence**:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  // ... no "test" script
}
```

**Why it's bad**: No tests, and no way to even run them if someone adds them.

**The Fix**: Add `"test": "vitest"` or `"test": "jest"` and actually write tests.

---

### 12. Hardcoded localhost Fallbacks
**Files**: `src/lib/queue/index.ts:14`, `src/lib/redis/index.ts:12`, etc.
**Sin**: Localhost fallbacks that will cause mysterious failures in production

**Evidence**:
```typescript
host: process.env.REDIS_HOST || "localhost",
```

**Why it's bad**: Deploy to Kubernetes/Docker without setting env vars? Code silently tries to connect to localhost inside the container, which doesn't exist. Cryptic connection errors ensue.

**The Fix**: Crash on missing required env vars, or use proper service discovery.

---

### 13. Analytics Router is 1,643 Lines
**File**: `src/server/api/routers/analytics.ts` (1,643 lines!)
**Sin**: God file that does everything

**Why it's bad**:
- Impossible to find anything
- Multiple concerns jammed together
- Can't test individual pieces
- Merge conflicts guaranteed

**The Fix**: Split by domain:
- `analytics/health.ts`
- `analytics/version.ts`
- `analytics/pattern.ts`
- `analytics/forecast.ts`

---

### 14. eslint-disable Comments Instead of Fixing Issues
**Files**: Multiple in mobile app
**Sin**: Silencing linter instead of fixing type issues

**Evidence**:
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(trpc as any).nodes.list.query({
```

**Why it's bad**: "I'll fix it properly later" - you won't. The lint rule exists for a reason.

**The Fix**: Fix the underlying type issue (share tRPC types properly).

---

### 15. Magic Numbers Throughout
**Files**: Various
**Sin**: Numbers without context

**Evidence**:
```typescript
const CHALLENGE_VALIDITY_MS = 5 * 60 * 1000;  // Good - has name
const JWT_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000;  // Good - has name
// But then...
take: 1000, // Limit raw data - why 1000? Why not 999? Why not 1001?
```

**Why it's bad**: Future you won't remember why you picked that number.

**The Fix**: Extract to named constants with documentation.

---

### 16. No CORS Configuration Found
**Files**: Searched entire codebase
**Sin**: No explicit CORS handling

**Why it's bad**: Either relying on Next.js defaults (dangerous) or haven't thought about cross-origin requests at all. Your API routes need explicit CORS policies.

**The Fix**: Add proper CORS middleware with explicit origin whitelist.

---

### 17. Intervals Without Cleanup Verification
**File**: `src/server/workers/collector.ts:427`
**Sin**: setInterval in worker without guaranteed cleanup

**Evidence**:
```typescript
const interval = setInterval(() => {
  runCollection().catch(console.error);
}, COLLECTION_INTERVAL);
```

**Why it's bad**: If the process handling is wrong, you could have zombie intervals. The SIGINT/SIGTERM handlers look OK, but there's no verification the interval actually stops.

**The Fix**: Store interval ref, clear on cleanup, verify cleanup in tests.

---

### 18. No Input Sanitization on Search Parameters
**File**: `src/app/api/v1/nodes/[id]/metrics/route.ts:58-59`
**Sin**: Direct use of search params as type assertions

**Evidence**:
```typescript
const range = (searchParams.get("range") || "24h") as TimeRange;
const aggregation = (searchParams.get("aggregation") || "hourly") as Aggregation;
```

**Why it's bad**: While there's validation after, the type assertion happens first. Should be defensive from the start.

**The Fix**: Validate then cast, or use zod for query param validation.

---

## MEH (But Fix Before I See It Again)

### 19. Public pNode IPs Hardcoded
**File**: `src/lib/prpc/client.ts:224-234`
**Sin**: Network IPs hardcoded in source

**Evidence**:
```typescript
export const PUBLIC_PNODES = [
  "173.212.203.145",
  "173.212.220.65",
  ...
] as const;
```

**Why it's bad**: IPs change. This should be config or environment-based.

**The Fix**: Move to environment config or runtime discovery.

---

### 20. Docker Compose Missing Network Definition
**File**: `docker-compose.yml`
**Sin**: No explicit network, services use default bridge

**Why it's bad**: Less control over service communication, DNS might not work as expected.

**The Fix**: Define explicit network for the stack.

---

## FINAL ROAST SCORE

| Category | Score | Notes |
|----------|-------|-------|
| Security | 4/10 | Hardcoded secrets, fallback JWT, Redis bypass |
| Scalability | 6/10 | SELECT *, god files, but has rate limiting |
| Code Quality | 5/10 | Type `any` abuse, console.logs, no tests |
| Testing | 1/10 | ZERO tests. Literally zero. |
| Documentation | 7/10 | CLAUDE.md and ROADMAP are solid |

**Overall**: **23/50**

---

## Roaster's Closing Statement

Alhamdulillah, this codebase has solid bones - good architecture, proper separation of concerns (mostly), nice use of tRPC and Prisma, and documentation that actually exists. But wallahi, the security shortcuts would make me lose sleep.

The **zero tests** situation is unacceptable for a production system. You're running analytics, auth, alerts, and payments without a single unit test. That's not moving fast, that's playing Russian roulette with six bullets.

The **JWT secret fallback** is the kind of thing that ends up on HackerNews with "How I got access to 10,000 user accounts with one Google search." The Redis rate-limit bypass is the cherry on top - "Can't hack my rate limiter? Just DDoS my Redis first!"

**Before you ship**:
1. Remove ALL secret fallbacks - crash if not configured
2. Delete `.env` from git history
3. Add tests for auth flow AT MINIMUM
4. Fix the Redis fallback to fail closed
5. Consolidate JWT secret to one location

The codebase shows experience and thought - but the shortcuts taken are the kind that wake you up at 3 AM. Fix these before some script kiddie teaches you why security theater doesn't work.

Tawakkul ala Allah, but also please write tests.

---

*This roast was conducted with `--no-mercy` flag. May your deployments be stable and your on-call rotations peaceful.*
