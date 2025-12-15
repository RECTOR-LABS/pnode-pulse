# CODE ROAST REPORT

**Roast Date**: December 15, 2025 (Updated)
**Previous Roast**: December 8, 2024
**Repository**: pnode-pulse
**Roast Mode**: `--no-mercy`
**Verdict**: **NEEDS WORK** - Significantly improved, but SQL injection patterns must be fixed before production

---

## PROGRESS SINCE LAST ROAST

**Fixed Issues**:
- JWT secret consolidated to `src/lib/auth/jwt-config.ts` with proper validation
- Structured logger implemented (`src/lib/logger.ts`) - main app now uses it
- Test suite added: 9 test files, 279 passing tests
- Type `any` abuse removed from main src (0 occurrences found)
- Rate limiter has comprehensive tests now
- Analytics router split into sub-routers (health, version, pattern, forecast, etc.)

**Score Improvement**: 23/50 → 28/50

---

## CAREER ENDERS

### 1. SQL Injection via String Interpolation in Leaderboard API

**File**: `src/app/api/v1/leaderboard/route.ts:97-99`
**Sin**: Direct string interpolation in SQL query
**Evidence**:
```typescript
const timeFilter = fromTime
  ? `AND m.time >= '${fromTime.toISOString()}'`
  : "";
// ... later used in $queryRawUnsafe()
```
**Why it's bad**: While `fromTime` is a Date object from Zod parsing, the string interpolation pattern is a ticking time bomb. Future refactoring or a lapse in input validation could lead to SQL injection. This bypasses Prisma's parameterized queries entirely.
**The Fix**: Use Prisma's tagged template literal syntax with `$queryRaw` and parameterized values:
```typescript
const rankings = await db.$queryRaw`
  ...
  WHERE m.time >= ${fromTime}
  ...
`;
```

---

### 2. Dynamic Table Name in SQL Query

**File**: `src/server/api/routers/network.ts:350-354`
**Sin**: Variable table name passed to `$queryRawUnsafe`
**Evidence**:
```typescript
const tableName = useDaily ? "network_metrics_daily" : "network_metrics_hourly";
// ...
const result = await ctx.db.$queryRawUnsafe<...>(
  `SELECT bucket, node_count... FROM ${tableName} WHERE bucket >= $1...`,
  startTime
);
```
**Why it's bad**: While the `tableName` is derived from a controlled enum check (`range === "30d" || range === "90d"`), using `$queryRawUnsafe` with string concatenation sets a dangerous precedent. Copy-paste errors or future modifications could expose this to injection.
**The Fix**: Use conditional Prisma queries or write two separate queries with tagged templates.

---

### 3. Dynamic Column/Sort in Multiple Routers

**File**: `src/server/api/routers/nodes.ts:429-475`
**Sin**: Dynamic column selection passed to `$queryRawUnsafe`
**Evidence**:
```typescript
const metricColumn = {
  uptime: "lm.uptime",
  cpu: "lm.cpu_percent",
  ...
}[metric];
// ...
ORDER BY ${metricColumn} ${sortDirection} NULLS LAST
```
**Why it's bad**: Same pattern - hardcoded allowlist is good, but the `$queryRawUnsafe` + string interpolation pattern is dangerous. The `sortDirection` comes from a ternary based on input, which is safe TODAY but fragile.
**The Fix**: Use tagged template with conditional logic inside, not string concatenation.

---

## EMBARRASSING MOMENTS

### 4. JWT Build-Time Fallback Still Exists

**File**: `src/lib/auth/jwt-config.ts:13`
**Sin**: Fallback secret at module load time
**Evidence**:
```typescript
const secretValue = JWT_SECRET_ENV || "build-time-placeholder-only";
```
**Why it's bad**: While `ensureJWTSecret()` validation exists, it must be called explicitly. If a new route forgets to call it, JWTs could be signed with a known placeholder. The pattern is better than before (consolidated location, validation function) but still risky.
**The Fix**: Throw at module load in production:
```typescript
if (process.env.NODE_ENV === 'production' && !JWT_SECRET_ENV) {
  throw new Error("JWT_SECRET required in production");
}
```

---

### 5. Hardcoded Port 6381 in Multiple Files

**Files**: `src/lib/redis/index.ts:31`, `src/lib/redis/pubsub.ts:87`, `src/lib/queue/index.ts:39`
**Sin**: Magic number port fallback scattered
**Evidence**:
```typescript
port: parseInt(process.env.REDIS_PORT || "6381"),
```
**Why it's bad**: Port 6381 (non-standard) is hardcoded in 3 files. DRY violation waiting to cause environment mismatches.
**The Fix**: Centralize in a config module.

---

### 6. Naive Semver Comparison

**File**: `src/server/api/routers/comparison.ts:57-66`
**Sin**: DIY semver parsing that breaks on real pNode versions
**Evidence**:
```typescript
const aParts = a.split(".").map(Number);
// Breaks on: "0.7.0-trynet.20251208141952.3b3bb24"
```
**Why it's bad**: pNode versions include build metadata (see your own CLAUDE.md). This comparison will produce wrong results for the actual version strings in your database.
**The Fix**: Use the `semver` package.

---

### 7. Invalid X-Frame-Options Header Value

**File**: `next.config.ts:164`
**Sin**: Using non-standard header value
**Evidence**:
```typescript
{ key: "X-Frame-Options", value: "ALLOWALL" },
```
**Why it's bad**: `ALLOWALL` is not a valid X-Frame-Options value. Valid values are `DENY`, `SAMEORIGIN`, or deprecated `ALLOW-FROM`. Browsers will ignore this invalid header entirely. Only your `frame-ancestors *` CSP is working.
**The Fix**: Remove the invalid header, keep only CSP.

---

## EYE ROLL COLLECTION

### 8. 920-Line Collector Worker

**File**: `src/server/workers/collector.ts`
**Sin**: Worker doing collection, discovery, IP tracking, geolocation, metrics saving, and more
**Stats**: 920 lines, 18 exported/internal functions
**Why it's bad**: Testing is hard, changes are risky, cognitive load is high.
**The Fix**: Extract to focused modules (collector-core, node-discovery, metrics-saver).

---

### 9. Test Coverage Ratio: 9 Files for 195 Source Files

**Stats**:
- Source files: 195
- Test files: 9
- Tests: 279 (all passing)
- Coverage ratio: 4.6%

**Untested critical paths**:
- `alerts.ts` (934 lines) - 0 dedicated tests
- `export.ts` (739 lines) - 0 dedicated tests
- `portfolio.ts` (608 lines) - 0 dedicated tests
- `comparison.ts` (800 lines) - 0 dedicated tests

**Why it's bad**: The easy stuff is tested (rate limiter, JWT, statistics). Business logic is flying blind.

---

### 10. Console.log in Bot Packages

**Files**: `packages/telegram-bot/src/index.ts`, `packages/discord-bot/src/index.ts`
**Sin**: Production bots using console.log
**Evidence**:
```typescript
console.log("Starting pNode Pulse Telegram Bot...");
console.error("Bot error:", err);
```
**Why it's bad**: Main app has structured logging now, but bots don't use it. Inconsistent ops experience.
**The Fix**: Share the logger package or create a common logging utility.

---

### 11. Missing .env.example Variables

**File**: `.env.example` vs actual env vars used
**Missing**:
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `TELEGRAM_BOT_TOKEN`
- `LOG_LEVEL`
- `PRUNE_INACTIVE_THRESHOLD_HOURS`, `PRUNE_ARCHIVE_THRESHOLD_DAYS`
- `REDIS_HOST`, `REDIS_PORT`

**Why it's bad**: New developers hit runtime errors discovering these.

---

### 12. Dev Secrets Still Present in .env

**File**: `.env`
**Sin**: Weak development credentials
**Evidence**:
```
JWT_SECRET=dev-secret-key-for-local-testing-only
ADMIN_API_KEY=dev-admin-key
```
**Why it's bad**: `.env` is gitignored but physically present. If accidentally committed, these predictable values are security risks. The "dev-secret-key" pattern trains bad habits.
**The Fix**: Even dev secrets should be generated: `openssl rand -hex 32`

---

## MEH TIER (FIX WHEN YOU HAVE TIME)

### 13. Localhost Fallbacks in Redis Initialization
Silent localhost connections in production will fail mysteriously.

### 14. SELECT * Equivalent in Some Raw Queries
Some queries fetch all columns when only a few are needed.

### 15. No Rate Limiting on Admin Manual Collect Endpoint
API key is required, but unlimited attempts allowed.

---

## FIXED FROM PREVIOUS ROAST

| Issue | Status |
|-------|--------|
| Hardcoded JWT secret with different fallbacks in 3 files | FIXED - Consolidated |
| Zero unit tests | IMPROVED - 279 tests now |
| Type `any` abuse in mobile app | IMPROVED - Main app clean |
| Console.log in main workers | FIXED - Uses structured logger |
| Analytics router 1,643 lines | FIXED - Split into sub-routers |
| No test script in package.json | FIXED - `npm run test` works |
| Redis bypass rate limiting | NOT VERIFIED - Need to check |

---

## FINAL ROAST SCORE

| Category | Score | Previous | Change | Notes |
|----------|-------|----------|--------|-------|
| Security | 5/10 | 4/10 | +1 | JWT consolidated, but SQL injection patterns still exist |
| Scalability | 7/10 | 6/10 | +1 | Good caching, pagination present, but god objects remain |
| Code Quality | 6/10 | 5/10 | +1 | Clean TypeScript, Zod everywhere, but massive worker files |
| Testing | 4/10 | 1/10 | +3 | 279 tests! But critical routers still untested |
| Documentation | 6/10 | 7/10 | -1 | .env.example incomplete, CLAUDE.md still excellent |

**Overall**: 28/50 (was 23/50)

---

## PRIORITY FIX LIST FOR BOUNTY DEADLINE (Dec 26)

**MUST FIX (Before Production)**:
1. Replace all `$queryRawUnsafe` with string interpolation → use parameterized `$queryRaw`
2. Remove invalid `X-Frame-Options: ALLOWALL` header
3. Add missing env vars to `.env.example`

**SHOULD FIX (For Quality)**:
4. Extract collector.ts into focused modules
5. Add tests for alerts.ts mutations
6. Fix semver comparison to handle pNode version strings

**NICE TO HAVE**:
7. Centralize Redis port configuration
8. Add structured logging to bot packages

---

## ROASTER'S CLOSING STATEMENT

Alhamdulillah, significant progress since December 8th. The JWT consolidation, test suite addition, and structured logging show genuine effort to address technical debt. The analytics router refactoring was the right call.

**But those SQL injection patterns in $queryRawUnsafe?** That's the kind of thing that gets mentioned in breach disclosures. Yes, your inputs are validated by Zod. Yes, the dynamic values come from controlled enums. But the PATTERN is dangerous. One copy-paste mistake, one future refactor, and you're writing the postmortem.

The codebase is bounty-submission ready in terms of features. The pRPC integration, TimescaleDB analytics, storage stats - that's genuinely impressive work. Don't let a preventable SQL injection finding tank your submission in a security review.

You have 11 days. The career-enders are fixable in an afternoon. The rest can wait until after you ship.

Bismillah, ship with confidence, not crossed fingers. May your deployment be smooth and your database parameterized.

---

*Roast conducted with `--no-mercy` flag. Previous report preserved for historical comparison.*
