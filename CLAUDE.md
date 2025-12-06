# CLAUDE.md - pNode Pulse

## Project Overview

**pNode Pulse** - Real-time analytics platform for Xandeum's pNode network.

**Repository**: [RECTOR-LABS/pnode-pulse](https://github.com/RECTOR-LABS/pnode-pulse)
**License**: MIT (Open Core)
**Phase**: Foundation (Phase 1)

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
- Xandeum team is adding detailed API call for ALL pNodes (coming soon)
- v0.7 Heidelberg will add paging statistics APIs
