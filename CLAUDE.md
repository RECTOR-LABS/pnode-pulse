# CLAUDE.md - pNode Pulse

## Project Overview

**pNode Pulse** - Real-time analytics platform for Xandeum's pNode network.

**Repository**: [RECTOR-LABS/pnode-pulse](https://github.com/RECTOR-LABS/pnode-pulse)
**License**: MIT (Open Core)
**Phase**: Analytics Engine (Phase 5 - 90% complete)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | tRPC, Node.js |
| Database | PostgreSQL + TimescaleDB |
| Cache | Redis |
| Deployment | Docker Compose on VPS (pulse.rectorspace.com) |

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
192.190.136.37
192.190.136.38
192.190.136.28
192.190.136.29
207.244.255.1
```

### RPC Methods

#### get-version
```json
{"jsonrpc": "2.0", "method": "get-version", "id": 1}
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

| Port | Service | Access |
|------|---------|--------|
| 6000 | pRPC API | Configurable |
| 9001 | Gossip protocol | Public |
| 5000 | Atlas server | Internal |
| 3000 | XandMiner GUI | Localhost |

## Deployment

**VPS**: 176.222.53.185 (rectorspace.com)
**User**: pnodepulse
**Domain**: pulse.rectorspace.com

| Service | Port |
|---------|------|
| Web (Blue) | 7000 |
| Web (Green) | 7001 |
| Staging | 7002 |
| PostgreSQL | 5434 |
| Redis | 6381 |

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

## Xandeum API Intelligence (Discord #apps-developers, Dec 6-8, 2024)

### Network Statistics (from community analysis)

| Metric | Value | Source |
|--------|-------|--------|
| Total pNodes | ~134-138 | Ymetro (gossip + Atlas) |
| ATH (All-Time High) | 138 | pchednode tracker |
| Version v0.6.0 | 128 nodes (95%) | Ymetro |
| Version v0.5.1 | 5 nodes (4%) | Ymetro |
| Unknown version | 1 node | Ymetro |

### API Status

| Method | Status | Limitation |
|--------|--------|------------|
| `get-version` | ✅ Working | None |
| `get-stats` | ✅ Working | None |
| `get-pods` | ⚠️ Legacy | Returns ~22 nodes (subset), not all 134+ |
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

| Developer | Project | Approach |
|-----------|---------|----------|
| TANAY | xandeum-lattice.vercel.app | Public pRPC (Brad questioned data source) |
| Fortune | Counting 137 nodes | getProgramAccounts + gossip |
| Ymetro | 135 nodes counted | Gossip + Atlas combined, deduped |
| **pNode Pulse** | Full analytics platform | pRPC + TimescaleDB + predictive analytics |

### Key Quotes from Brad (Xandeum Team)

> "We will be adding a detailed call that give much more info for ALL pNodes..It didn't come to me yesterday so likely now not until Monday" - Dec 6, 23:11

> "This command is supposed to return all pods...but its only a small subset...but the data format will be right" - Dec 8, 00:00

> "The more detailed call will return much more data for each pnode connected" - Dec 8, 00:00

### Open Question (Bounty Scope)

From Fortune (Dec 8):
> "for the superteam bounty, should we focus on all pNodes ever created, or just the online/recently online ones gossip returns?"

**Unanswered** - May need clarification from bounty organizers.

### v0.7.0 Release (Dec 8, 2024)

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

### Community Libraries

**Skipp's pRPC Clients** (Released Dec 8, 2024):
- **JS/TS**: `pnpm install xandeum-prpc` ([GitHub](https://github.com/DavidNzube101/xandeum-prpc-js))
- **Go**: `go get github.com/DavidNzube101/xandeum-prpc-go`
- **Rust**: `cargo add xandeum-prpc`
- **Demo**: prpc-client-example.vercel.app

**Usage Example (JS/TS)**:
```typescript
import { PrpcClient } from 'xandeum-prpc';
const client = new PrpcClient('192.190.136.36');
const pods = await client.getPods();
console.log(pods);
```

### Implementation Status

- [x] Monitor Discord for new API release
- [x] New `get-pods-with-stats` API available (v0.7.0+)
- [ ] Extend pRPC client to support `get-pods-with-stats`
- [ ] Update data models for storage/uptime fields
- [ ] Test against live v0.7.0 pNodes
- [ ] Update analytics to classify private vs public nodes correctly
