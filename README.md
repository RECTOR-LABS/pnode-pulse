# pNode Pulse

**Real-time analytics platform for Xandeum's pNode network**

## What is This?

A public dashboard for monitoring and exploring Xandeum's distributed storage network (pNodes). Think Solscan/Filfox but for Xandeum's storage layer.

## The Problem

Xandeum is building a scalable storage layer for Solana with distributed pNodes, but there's **no public explorer** to monitor:
- Network health & total capacity
- Individual pNode performance
- Storage utilization & growth trends
- Peer connectivity & uptime

## The Solution

A comprehensive analytics platform that aggregates pNode data via pRPC and presents it in an intuitive dashboard.

## Technical Context

### Xandeum Overview
- **What**: Scalable storage layer for Solana programs
- **How**: Distributed pNodes store encrypted data pages with configurable redundancy
- **Why**: Solana accounts are expensive; Xandeum provides "disk" to Solana's "RAM"

### pRPC API (Data Source)
Base: `http://<pnode-ip>:6000/rpc` (JSON-RPC 2.0)

| Method | Returns |
|--------|---------|
| `get-version` | pNode software version |
| `get-stats` | CPU, RAM, uptime, packets, storage metrics |
| `get-pods` | Network peers (address, version, last seen) |

### Network Ports
| Port | Service |
|------|---------|
| 6000 | pRPC API |
| 9001 | Gossip protocol |
| 5000 | Atlas server |
| 80 | Stats dashboard (localhost) |

### Available Metrics
- **System**: CPU %, RAM used/total, uptime
- **Storage**: Total bytes, total pages, file size
- **Network**: Packets sent/received, active streams
- **Peers**: Address, version, last seen, total count

## Competitors

| Platform | Network | Focus |
|----------|---------|-------|
| Filfox | Filecoin | Storage provider rankings, deals |
| Filscan | Filecoin | SP analytics, rewards calculator |
| beaconcha.in | Ethereum | Validator monitoring |
| Solana Beach | Solana | Validator stats, stake distribution |

## Development

### Prerequisites
- Node.js 18+
- npm
- Docker & Docker Compose

### Quick Start
```bash
# Start database services
cp .env.example .env
docker compose up -d

# Install dependencies and run
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Services
| Service | Port | Description |
|---------|------|-------------|
| Next.js | 3000 | Web application |
| PostgreSQL | 5434 | Database (TimescaleDB) |
| Redis | 6381 | Cache |

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL + TimescaleDB
- **API**: tRPC

### Project Structure
```
src/
├── app/              # Next.js App Router pages
├── components/       # React components
├── lib/
│   ├── prpc/         # pRPC client library
│   ├── db/           # Database models and queries
│   └── utils/        # Utilities
├── server/
│   ├── api/          # tRPC routers
│   └── workers/      # Background jobs
└── types/            # TypeScript types
```

## Resources

- [Xandeum Docs](https://www.xandeum.network/docs)
- [pRPC Reference](https://docs.xandeum.network/api/pnode-rpc-prpc-reference)
- [Discord](https://discord.com/invite/mGAxAuwnR9)
- [GitHub](https://github.com/Xandeum)

## Status

**Phase: Foundation (Phase 1)**
