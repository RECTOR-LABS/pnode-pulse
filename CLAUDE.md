# CLAUDE.md - pNode Pulse

## ✅ Superteam Bounty - READY TO SUBMIT

**Competition**: Build Analytics Platform for Xandeum pNodes
**Prize Pool**: $5,000 USDC ($2,500 first / $1,500 second / $1,000 third)
**Submission Deadline**: **December 26, 2025 @ 07:59 UTC** (11 days remaining)
**Winner Announcement**: January 9, 2026

**Bounty Page**: https://earn.superteam.fun/listing/build-analytics-platform-for-xandeum-pnodes/

### Required Deliverables - ALL COMPLETE ✅

- ✅ Retrieve all pNodes via pRPC (`get-pods-with-stats`)
- ✅ Display pNode information clearly
- ✅ **Live website**: https://pulse.rectorspace.com
- ✅ Documentation: [DEPLOYMENT.md](docs/DEPLOYMENT.md) + [USER_GUIDE.md](docs/USER_GUIDE.md)

### Judging Criteria (Priority Order)

1. **Functionality** - pRPC retrieval working
2. **Clarity** - Information understandable
3. **User Experience** - Intuitive platform
4. **Innovation** (Optional) - Additional features = competitive edge

### Our Competitive Advantages

- ✨ TimescaleDB time-series analytics
- ✨ v0.7.0 "Heidelberg" storage stats integration
- ✨ Real-time network health monitoring
- ✨ Historical tracking + predictive analytics

**Action Plan**: See [Issue #170](https://github.com/RECTOR-LABS/pnode-pulse/issues/170)

---

## Project Overview

**pNode Pulse** - Real-time analytics platform for Xandeum's pNode network.

**Repository**: [RECTOR-LABS/pnode-pulse](https://github.com/RECTOR-LABS/pnode-pulse)
**License**: MIT (Open Core)
**Phase**: Pre-Launch (Code 90% complete, Deployment 0%)

## Tech Stack

| Layer      | Technology                                        |
| ---------- | ------------------------------------------------- |
| Frontend   | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend    | tRPC, Node.js                                     |
| Database   | PostgreSQL + TimescaleDB                          |
| Cache      | Redis                                             |
| Deployment | Docker Compose on VPS (pulse.rectorspace.com)     |

## Commands

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript checks
npm run test         # Run tests

# Database
npm run db:migrate   # Run migrations
npm run db:seed      # Seed database

# Docker
docker compose up -d           # Start all services
docker compose logs -f web     # View logs
```

## Data Source: pRPC API

### Endpoint

- **Protocol**: JSON-RPC 2.0 over HTTP POST
- **URL**: `http://<pnode-ip>:6000/rpc`
- **Auth**: None required
- **Rate Limits**: None currently

### Public pNodes (Port 6000 Open)

```
173.212.203.145
173.212.220.65
161.97.97.41
192.190.136.36
192.190.136.38
192.190.136.28
192.190.136.29
207.244.255.1
```

**Note**: 192.190.136.37 removed (Dec 13, 2025) - not responding to pRPC calls.
Current version: v0.7.3 (as of Dec 13, 2025)

### RPC Methods

#### get-version

```json
{ "jsonrpc": "2.0", "method": "get-version", "id": 1 }
// Response: {"result": {"version": "0.6.0"}}
```

#### get-stats

```json
{"jsonrpc": "2.0", "method": "get-stats", "id": 1}
// Response (FLAT structure - differs from docs):
{
  "result": {
    "active_streams": 2,
    "cpu_percent": 6.63,
    "current_index": 14,
    "file_size": 558000000000,
    "last_updated": 1764953798,
    "packets_received": 7218,
    "packets_sent": 5965,
    "ram_total": 12567232512,
    "ram_used": 5399207936,
    "total_bytes": 94633,
    "total_pages": 0,
    "uptime": 154484
  }
}
```

#### get-pods

```json
{"jsonrpc": "2.0", "method": "get-pods", "id": 1}
// Response (includes pubkey - not in docs):
{
  "result": {
    "pods": [
      {
        "address": "62.84.180.240:9001",
        "last_seen_timestamp": 1765057753,
        "pubkey": "7T4zPNNDAT7rwkQ6Rf2QyMvLwowQ4KDSxKRXF9qEtYvR",
        "version": "0.5.1"
      }
    ],
    "total_count": 27
  }
}
```

#### get-pods-with-stats (v0.7.0+)

**Available since**: December 8, 2024
**Requirement**: pNode running v0.7.0 or later

```bash
curl -X POST http://<ip-address>:6000/rpc \
  -H "Content-Type: application/json" \
  -d '{
  "jsonrpc": "2.0",
  "method": "get-pods-with-stats",
  "id": 1
}'
```

**Response Format**:

```json
{
  "result": {
    "pods": [
      {
        "address": "192.190.136.37:9001",
        "is_public": true,
        "last_seen_timestamp": 1765209387,
        "pubkey": "Aj6AqP7xvmBNuPF5v4zNB3SYxBe3yP6rsqK6KsaKVXKM",
        "rpc_port": 6000,
        "storage_committed": 183000000000,
        "storage_usage_percent": 0.000051712021857923493,
        "storage_used": 94633,
        "uptime": 1461,
        "version": "0.7.0-trynet.20251208141952.3b3bb24"
      }
    ],
    "total_count": 5
  }
}
```

**New Fields**:

- `is_public` (boolean | null): Whether RPC port is publicly accessible
- `rpc_port` (number | null): RPC service port (typically 6000)
- `storage_committed` (number): Total storage allocated in bytes
- `storage_usage_percent` (number): Storage utilization percentage
- `storage_used` (number): Actual storage used in bytes
- `uptime` (number): Node uptime in seconds

**Important Notes**:

- Returns data for ALL pNodes in gossip network (not just subset)
- Nodes with `is_public: null` have private RPC ports (not publicly queryable)
- Private nodes are still active and serving the network
- Only v0.7.0+ nodes return full stats; older versions show minimal data

### Network Ports

| Port | Service         | Access       |
| ---- | --------------- | ------------ |
| 6000 | pRPC API        | Configurable |
| 9001 | Gossip protocol | Public       |
| 5000 | Atlas server    | Internal     |
| 3000 | XandMiner GUI   | Localhost    |

## Deployment

**VPS**: 176.222.53.185 (rectorspace.com)
**User**: pnodepulse
**Domain**: pulse.rectorspace.com

| Service     | Port |
| ----------- | ---- |
| Web (Blue)  | 7000 |
| Web (Green) | 7001 |
| Staging     | 7002 |
| PostgreSQL  | 5434 |
| Redis       | 6381 |

### Push-to-Deploy Workflow

**Automated deployment** triggers on every push to main/dev branches:

| Branch | Environment             | Port      | URL                           |
| ------ | ----------------------- | --------- | ----------------------------- |
| `dev`  | Staging                 | 7002      | staging.pulse.rectorspace.com |
| `main` | Production (Blue/Green) | 7000/7001 | pulse.rectorspace.com         |

#### Deployment Flow

**Staging (dev branch)**:

1. Push to `dev` branch
2. GitHub Actions builds Docker image
3. Pushes image to GHCR with `:dev` tag
4. SSH to VPS, pulls new image
5. Restarts `staging` container on port 7002
6. Immediate deployment (no downtime concerns)

**Production (main branch)**:

1. Push to `main` branch
2. GitHub Actions builds Docker image
3. Pushes image to GHCR with `:latest` tag
4. SSH to VPS, pulls new image
5. Runs blue/green deployment script:
   - Detects active environment (blue/green)
   - Starts inactive environment with new image
   - Waits for healthcheck to pass
   - Manual/automated switch to new environment
   - Stops old environment
6. Zero-downtime deployment

#### Required GitHub Secrets

Configure these in repository settings (Settings → Secrets and variables → Actions):

| Secret              | Value             | Description                           |
| ------------------- | ----------------- | ------------------------------------- |
| `VPS_SSH_KEY`       | Private SSH key   | SSH key for pnodepulse@176.222.53.185 |
| `POSTGRES_PASSWORD` | Database password | PostgreSQL password for production    |

#### Deployment Commands

```bash
# Manual staging deployment
ssh pnodepulse
cd ~/pnode-pulse
docker compose pull staging
docker compose up -d staging

# Manual blue/green deployment
ssh pnodepulse
cd ~/pnode-pulse
bash scripts/blue-green-deploy.sh

# Check deployment status
docker compose ps
docker compose logs -f blue green staging

# Rollback (if needed)
# Simply switch back to previous environment
docker compose up -d blue  # or green
```

#### Health Checks

All services have health endpoints for monitoring:

| Endpoint | URL                              | Checks            |
| -------- | -------------------------------- | ----------------- |
| Staging  | http://localhost:7002/api/health | DB, Redis, uptime |
| Blue     | http://localhost:7000/api/health | DB, Redis, uptime |
| Green    | http://localhost:7001/api/health | DB, Redis, uptime |

Health check response:

```json
{
  "status": "healthy",
  "timestamp": "2024-12-09T10:00:00.000Z",
  "checks": {
    "database": true,
    "redis": true
  },
  "version": "1.0.0",
  "uptime": 3600
}
```

#### Nginx Configuration

Configure reverse proxy to route traffic:

```nginx
# Staging
server {
  server_name staging.pulse.rectorspace.com;
  location / {
    proxy_pass http://localhost:7002;
  }
}

# Production (point to active blue/green port)
server {
  server_name pulse.rectorspace.com;
  location / {
    proxy_pass http://localhost:7000;  # or 7001 for green
  }
}
```

#### First-Time Setup

On VPS as `pnodepulse` user:

```bash
# Clone repository
git clone https://github.com/RECTOR-LABS/pnode-pulse.git
cd pnode-pulse

# Create .env file
cat > .env << EOF
POSTGRES_PASSWORD=your_secure_password_here
EOF

# Start infrastructure services
docker compose up -d postgres redis

# Wait for services to be healthy
docker compose ps

# Run database migrations
docker compose exec postgres psql -U pnodepulse -d pnodepulse -f /path/to/migration.sql

# Start initial deployment (blue)
docker compose up -d blue
```

## Project Structure

```
pnode-pulse/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   ├── lib/
│   │   ├── prpc/         # pRPC client library
│   │   ├── db/           # Database models and queries
│   │   └── utils/        # Utilities
│   ├── server/
│   │   ├── api/          # tRPC routers
│   │   └── workers/      # Background jobs
│   └── types/            # TypeScript types
├── prisma/               # Database schema and migrations
├── docker/               # Docker configurations
└── tests/                # Test files
```

## Key Documentation

- [ROADMAP.md](./ROADMAP.md) - Development phases and epics
- [Xandeum pRPC Docs](https://docs.xandeum.network/api/pnode-rpc-prpc-reference)
- [Xandeum Discord](https://discord.com/invite/mGAxAuwnR9) - #apps-developers channel

## Current Sprint

See GitHub Issues and Milestones for current work.

## Notes

- Response structure from `get-stats` is FLAT (differs from official docs)
- `get-pods` includes `pubkey` field not documented officially

## Official Documentation Review (#168 - Dec 13, 2025)

### Documentation Sources

| URL                                                       | Content                       | Status      |
| --------------------------------------------------------- | ----------------------------- | ----------- |
| https://docs.xandeum.network/api/pnode-rpc-prpc-reference | pRPC API Reference            | ✅ Reviewed |
| https://docs.xandeum.network/xandeum-pnode-setup-guide    | Setup Guide (v0.7 Heidelberg) | ✅ Reviewed |
| https://docs.xandeum.network                              | Main docs index               | ✅ Reviewed |

### Discrepancies Found

**1. get-stats Response Structure**

- **Official Docs**: NESTED structure (`metadata.total_bytes`, `stats.cpu_percent`)
- **Actual API**: FLAT structure (`total_bytes`, `cpu_percent` at root)
- **Our Implementation**: ✅ Correctly uses FLAT structure based on actual responses

**2. get-pods pubkey Field**

- **Official Docs**: NOT documented
- **Actual API**: Returns `pubkey` (string | null) for each pod
- **Our Implementation**: ✅ Correctly handles as nullable

**3. get-pods-with-stats Method**

- **Official Docs**: NOT documented (v0.7.0 feature)
- **Source**: Discord intelligence from Brad (Dec 8-10, 2025)
- **Our Implementation**: ✅ Based on actual API responses, fully typed

**4. get-pods last_seen Field**

- **Official Docs**: Shows `last_seen` (human-readable string)
- **Actual API**: Uses `last_seen_timestamp` (unix number)
- **Our Implementation**: ✅ Uses timestamp version

### Conclusion

Our implementation is **correct** - based on actual API behavior rather than outdated docs.
Official documentation appears to be behind the actual API implementation.
Discord intelligence from Brad/Xandeum team has been accurate source of truth.

## Xandeum API Intelligence (Discord #apps-developers, Dec 6-8, 2024)

### Network Statistics (from community analysis)

| Metric              | Value           | Source                  |
| ------------------- | --------------- | ----------------------- |
| Total pNodes        | ~134-138        | Ymetro (gossip + Atlas) |
| ATH (All-Time High) | 138             | pchednode tracker       |
| Version v0.6.0      | 128 nodes (95%) | Ymetro                  |
| Version v0.5.1      | 5 nodes (4%)    | Ymetro                  |
| Unknown version     | 1 node          | Ymetro                  |

### API Status

| Method                | Status            | Limitation                                                |
| --------------------- | ----------------- | --------------------------------------------------------- |
| `get-version`         | ✅ Working        | None                                                      |
| `get-stats`           | ✅ Working        | None                                                      |
| `get-pods`            | ⚠️ Legacy         | Returns ~22 nodes (subset), not all 134+                  |
| `get-pods-with-stats` | ✅ Live (v0.7.0+) | Requires pNode v0.7.0+, returns ALL nodes with rich stats |

### Data Sources Available

1. **pRPC endpoints** (9 public IPs) - `get-stats`, `get-pods`, `get-version`
2. **Atlas server** - Additional node discovery (port 5000, internal)
3. **Gossip network** - Peer discovery via port 9001
4. **getProgramAccounts (devnet)** - Returns registered pNodes only
5. **seenodes.xandeum.network** - Shows registered nodes only

### Registered vs Unregistered Nodes

- **Registered**: On-chain, has license, appears on seenodes.xandeum.network
- **Unregistered**: Has keypair but no license, still appears in gossip/Atlas
- Both types can be online and serving the network

### Bounty Competition Status (Dec 8, 2024)

| Developer       | Project                    | Approach                                  |
| --------------- | -------------------------- | ----------------------------------------- |
| TANAY           | xandeum-lattice.vercel.app | Public pRPC (Brad questioned data source) |
| Fortune         | Counting 137 nodes         | getProgramAccounts + gossip               |
| Ymetro          | 135 nodes counted          | Gossip + Atlas combined, deduped          |
| **pNode Pulse** | Full analytics platform    | pRPC + TimescaleDB + predictive analytics |

### Key Quotes from Brad (Xandeum Team)

> "We will be adding a detailed call that give much more info for ALL pNodes..It didn't come to me yesterday so likely now not until Monday" - Dec 6, 23:11

> "This command is supposed to return all pods...but its only a small subset...but the data format will be right" - Dec 8, 00:00

> "The more detailed call will return much more data for each pnode connected" - Dec 8, 00:00

### Open Question (Bounty Scope)

From Fortune (Dec 8):

> "for the superteam bounty, should we focus on all pNodes ever created, or just the online/recently online ones gossip returns?"

**Unanswered** - May need clarification from bounty organizers.

### v0.7.0 "Heidelberg" Release (Dec 8-10, 2024)

**Official Release**: December 10, 2025 (Announcement by Blockchain Bernie)
**Codename**: "Heidelberg"
**Docs**: https://xandeum.network/docs
**Mainnet Timeline**: Alpha on Mainnet by year end (Dec 2025)

**Gossip Protocol Enhancements**:

- **Frequency**: Changed from every 120 seconds → every 1 second
- **Batch Size**: 10 nodes per gossip message
- **Propagation Time**: Full network propagation < 5 minutes (target < 2 min)
- **Bug Fixes**: Resolved packet size issues causing outbound message failures

**API Improvements**:

- New `get-pods-with-stats` method with comprehensive node metrics
- Returns ALL pNodes in gossip network (not just subset like `get-pods`)
- Includes storage stats, uptime, public/private status

**Migration Notes**:

- `get-pods` is now legacy (use `get-pods-with-stats` instead)
- Older pNodes (<v0.7.0) still appear in results with limited stats
- Private nodes (`is_public: null`) are not queryable directly but included in results

**Rollout Issues (Dec 9)**:

- Bug discovered after 70 nodes upgraded
- Network instability during transition period
- Fixed same day with new patch release
- Expect mixed responses during transition (some nodes return all null fields)

### Latest Intelligence (Dec 9-11, 2025)

**Network Composition** (Brown, Dec 10-11):

- **Total pNodes**: ~100 discovered via get-pods-with-stats
- **Public (RPC accessible)**: 16-17 nodes
- **Private**: ~83-84 nodes
- Only public nodes can be queried directly via pRPC

**Port 6000 Accessibility** (Skipp + Ymetro):

- Gossip network shows ~16 registered pods currently
- **Very few** nodes have port 6000 publicly accessible
- Most nodes have private RPC ports (`is_public: null`)
- We rely on public nodes' `get-pods-with-stats` for network-wide data (federation)

**Terminology Clarification** (Brad, Dec 10):

> "The pNode is the Storage Provider Node/Server. Pod is a software that runs on the pNode."

- **pNode** = Hardware/server (storage provider)
- **Pod** = Software application running on the pNode

**Critical pRPC Best Practices** (Brad, Dec 10):

1. **Multi-Endpoint Strategy**:

   > "program a function that uses multiple endpoints and run a version where the syntax matches your expectation"
   - Don't rely on single endpoint
   - Query multiple public nodes for redundancy
   - Our collector already implements this ✅

2. **No Uptime Guarantees**:

   > "None of them come with any guarantee of uptime or version"
   - Any endpoint can go down anytime
   - Collector must handle failures gracefully ✅
   - Version checking required before trusting response

3. **Public/Private Tagging**: ✅ Approved
   - Brad didn't object to tagging nodes as public/private
   - Our `isPublic` field is valid

**Database Strategy Guidance** (Brad, Dec 9):

> "as long as you have a prune function somewhere not a problem...and likely correlate it to pubkey which should stay the same if the IP changes."

> "maybe you have a desire to have a function that shows old nodes that are no longer active...like a graveyard or so lol"

**Key Insights**:

- **Use `pubkey` as primary identifier** (IPs can change)
- Store historical data with pruning function
- "Node Graveyard" feature suggested for inactive nodes

**Documentation Update** (redcali, Dec 11):

- ❌ **Old (dead)**: https://pnodes.xandeum.network/
- ✅ **New**: https://docs.xandeum.network/xandeum-pnode-setup-guide

**Action Items** (Dec 9-11):

- ✅ [Issue #164](https://github.com/RECTOR-LABS/pnode-pulse/issues/164) - Use pubkey for correlation - CLOSED
- ✅ [Issue #165](https://github.com/RECTOR-LABS/pnode-pulse/issues/165) - Implement pruning strategy - CLOSED
- ✅ [Issue #166](https://github.com/RECTOR-LABS/pnode-pulse/issues/166) - Verify null handling - CLOSED
- ✅ [Issue #167](https://github.com/RECTOR-LABS/pnode-pulse/issues/167) - Node Graveyard feature - CLOSED
- ✅ [Issue #168](https://github.com/RECTOR-LABS/pnode-pulse/issues/168) - Review official docs - CLOSED
- ✅ [Issue #169](https://github.com/RECTOR-LABS/pnode-pulse/issues/169) - IP change tracking - CLOSED

### Discord Intelligence (Dec 11-12, 2025)

**False 5K Node Claim Debunked**:

- Someone (inw6) claimed 5k pNodes exist - **FALSE**
- mrhcon: "I can tell you with certainty, there are not 5k nodes"
- Actual count remains ~100-138 nodes

**Staking Status**:

- mrhcon confirmed: "Staking is not active yet"

**API Data Completeness Issue** (Brown, Dec 11):

> "Although I noticed the details that come with `get-pods-with-stats` are not complete as compared to the `get-stats` call"

⚠️ **Implication**: May need to call BOTH endpoints for complete node data:

- `get-pods-with-stats` for network-wide discovery
- `get-stats` on individual nodes for complete metrics

**Network Goals** (Ymetro):

- Xandeum target: **1K pNodes** in near future
- Solana comparison: needs 5K validators for future growth

**Validator vs pNode Confusion** (Yang incident):

- Yang got all zeros from API - was querying **validator network** (v2.2.0)
- pNode network uses different versions (0.5.x - 0.7.x)
- Important distinction to document

**pNode License Shop**: CLOSED

- Brad confirmed onboarding is for incentivized DevNet only
- Submissions closed unless you have existing pNode license

**Bounty Submission Confirmed Valid** (Skipp to saloni):

> Q: "I'm not running a pNode myself. I'm only building an analytics dashboard using public DevNet data (via pRPC)... is this correct for submission?"
> A: "checks ✅ the 'retrieving a list of pnodes appearing in a gossip using pNode RPC calls' part of the scope"

✅ Our approach (using public pRPC without running own pNode) is valid for bounty.

**Skipp's Client Updates** (Dec 12):

- Configurable timeouts for longer queries
- Default seed IPs pre-shipped in clients
- New helper: queries all seeds concurrently (~8x faster)

**Skipp's Default Seed IPs**:

```
173.212.220.65, 161.97.97.41, 192.190.136.36, 192.190.136.38,
207.244.255.1, 192.190.136.28, 192.190.136.29, 173.212.203.145
```

**Seed IP Comparison**:
| IP | Our List | Skipp's List | Status |
|----|----------|--------------|--------|
| 173.212.203.145 | ✅ | ✅ | v0.7.3 |
| 173.212.220.65 | ✅ | ✅ | v0.7.3 |
| 161.97.97.41 | ✅ | ✅ | v0.7.3 |
| 192.190.136.36 | ✅ | ✅ | v0.7.3 |
| 192.190.136.37 | ~~✅~~ | ❌ | ❌ DEAD (Dec 13) |
| 192.190.136.38 | ✅ | ✅ | v0.7.3 |
| 192.190.136.28 | ✅ | ✅ | v0.7.3 |
| 192.190.136.29 | ✅ | ✅ | v0.7.3 |
| 207.244.255.1 | ✅ | ✅ | v0.7.3 |

Updated to 8 IPs (removed dead 192.190.136.37). Skipp's list was accurate.

**Action Items** (Dec 12-13):

- ✅ [Issue #175](https://github.com/RECTOR-LABS/pnode-pulse/issues/175) - Hybrid collection for private nodes - CLOSED
- ✅ Verify 192.190.136.37 - CONFIRMED DEAD, removed from list

### Community Libraries

**Skipp's pRPC Clients** (Released Dec 8, 2024, Updated Dec 11):

- **JS/TS**: `pnpm install xandeum-prpc` ([GitHub](https://github.com/DavidNzube101/xandeum-prpc-js))
- **Go**: `go get github.com/DavidNzube101/xandeum-prpc-go`
- **Rust**: `cargo add xandeum-prpc`
- **Demo**: prpc-client-example.vercel.app
- **Update**: Now supports `get-pods-with-stats` method

**Usage Example (JS/TS)**:

```typescript
import { PrpcClient } from "xandeum-prpc";
const client = new PrpcClient("192.190.136.36");
const pods = await client.getPods();
console.log(pods);
```

### Implementation Status

**Phase 1: v0.7.0 Heidelberg Integration** ✅ COMPLETE

- [x] Monitor Discord for new API release
- [x] New `get-pods-with-stats` API available (v0.7.0+)
- [x] Extend pRPC client to support `get-pods-with-stats`
- [x] Update data models for storage/uptime fields (migration created)
- [x] Update collector worker to use new API
- [x] Create tRPC endpoints for storage stats and node accessibility
- [x] Create dashboard widgets (StorageOverview, NodeAccessibility)
- [x] Test against live v0.7.0 pNodes
- [x] Update analytics to classify private vs public nodes correctly

**Deployment Infrastructure** ✅ COMPLETE

- [x] GitHub Actions workflow for staging (dev branch)
- [x] GitHub Actions workflow for production (main branch with blue/green)
- [x] Docker Compose configuration with multi-environment support
- [x] Blue/green deployment script with zero-downtime
- [x] Health check endpoints for all services
- [x] VPS setup complete (user, ports, SSH config)

**Phase 4: Quick Tech Debt Wins** ✅ COMPLETE (2025-12-09)

- [x] Environment-aware configuration (Redis, mobile client)
- [x] Centralized constants in `src/lib/constants/limits.ts`
- [x] Graceful shutdown with promise tracking
- [x] Zod validation for API parameters
- [x] Configurable pNode seed IPs via environment
- [x] Fixed ESLint violations and type errors

**Phase 5: Database & v0.7.0 Schema** ✅ COMPLETE (2025-12-09)

- [x] Schema updated with v0.7.0 fields (nodes.isPublic, nodes.rpcPort, node_metrics.storageCommitted, node_metrics.storageUsagePercent)
- [x] Migration created: `20251209060207_add_v070_fields`
- [x] Rollback procedure documented
- [x] All fields nullable for backward compatibility
- [x] Index on `nodes.is_public` for efficient filtering
- [x] Collector worker using new fields
- [x] Storage analytics router using new metrics
- [x] CHANGELOG.md created with migration details

**Phase 6: Infrastructure & Operations** ✅ COMPLETE (2025-12-09)

- [x] Docker networking: Explicit network definitions for all services
- [x] Database backup strategy: Automated scripts with rollback procedures
- [x] Deployment runbook: Comprehensive operations guide (500+ lines)
- [x] APM setup guide: Sentry integration documentation

**Phase 7: Legal & Compliance** ✅ COMPLETE (2025-12-09)

- [x] Privacy policy: GDPR/CCPA compliant documentation

**Bounty Submission Track** ✅ COMPLETE (2025-12-15):

- [x] **Dec 11-12**: Setup GitHub secrets + Deploy to VPS
- [x] **Dec 13**: Go live at pulse.rectorspace.com
- [x] **Dec 15**: Documentation finalized + Screenshots captured
- [x] **Dec 15**: Submission document prepared (docs/SUBMISSION.md)
- [ ] **Dec 26**: Submit before 07:59 UTC deadline (READY TO SUBMIT)

**Post-Launch Improvements** (Technical Debt - Defer to after bounty):

- [ ] Implement pubkey-based correlation (#164)
- [ ] Add pruning strategy (#165)
- [ ] Verify null handling (#166)
- [ ] Review official Xandeum docs (#168)
- [ ] Setup Sentry APM
- [ ] Node Graveyard feature (#167)
- [ ] IP change tracking (#169)
