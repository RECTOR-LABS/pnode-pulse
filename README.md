# pNode Pulse

[![Live Demo](https://img.shields.io/badge/demo-pulse.rectorspace.com-blue?style=for-the-badge)](https://pulse.rectorspace.com)
[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)

**Real-time analytics platform for Xandeum's pNode network**

> Built for the [Superteam Bounty: Build Analytics Platform for Xandeum pNodes](https://earn.superteam.fun/listing/build-analytics-platform-for-xandeum-pnodes/)

---

## Live Demo

**[pulse.rectorspace.com](https://pulse.rectorspace.com)**

![pNode Pulse Dashboard](docs/assets/dashboard-preview.png)

---

## Features

### Network Overview
- **Real-time node discovery** via pRPC `get-pods-with-stats` (v0.7.0+)
- **146+ nodes tracked** with automatic IP change detection
- **Network health metrics**: CPU, RAM, storage, uptime
- **Version distribution** across the network

### Storage Analytics
- **1.7+ PB total network storage** capacity tracking
- **Storage utilization** per node and network-wide
- **Capacity projections** based on growth trends
- **Public vs Private node** classification

### Node Monitoring
- **Individual node details** with full metrics history
- **Performance comparison** across nodes
- **Node leaderboard** by storage/uptime
- **Graveyard tracker** for inactive nodes

### Advanced Features
- **IP change tracking** with historical logs
- **TimescaleDB** for time-series analytics
- **Auto-discovery** via gossip network
- **Blue/green deployment** for zero downtime

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | tRPC, Node.js |
| Database | PostgreSQL + TimescaleDB |
| Cache | Redis |
| Deployment | Docker Compose, GitHub Actions |

---

## Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- npm or yarn

### Development Setup

```bash
# Clone the repository
git clone https://github.com/RECTOR-LABS/pnode-pulse.git
cd pnode-pulse

# Start database services
cp .env.example .env
docker compose up -d postgres redis

# Install dependencies
npm install

# Run database migrations
npx prisma migrate deploy
npx prisma generate

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Start Data Collector

```bash
# In a separate terminal
npm run collector
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      pNode Pulse                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Next.js   │  │  Collector  │  │   TimescaleDB       │ │
│  │  Dashboard  │◄─┤   Worker    │─►│  (Time-series DB)   │ │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────┘ │
│         │                │                                  │
│         │                ▼                                  │
│         │         ┌─────────────┐                          │
│         └────────►│    Redis    │ (Cache)                  │
│                   └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    pNode Network                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │ pNode 1 │  │ pNode 2 │  │ pNode 3 │  │ pNode N │ ...   │
│  │ :6000   │  │ :6000   │  │ :6000   │  │ :6000   │       │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │
│                                                             │
│  Gossip Network (:9001) ◄───────────────────────────────►  │
└─────────────────────────────────────────────────────────────┘
```

---

## pRPC API Integration

pNode Pulse uses the pRPC JSON-RPC 2.0 API to collect data:

| Method | Description | Version |
|--------|-------------|---------|
| `get-version` | Node software version | All |
| `get-stats` | CPU, RAM, uptime, storage metrics | All |
| `get-pods` | Peer list (legacy) | < v0.7.0 |
| `get-pods-with-stats` | Full network with storage stats | v0.7.0+ |

### Example Request

```bash
curl -X POST http://192.190.136.36:6000/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"get-pods-with-stats","id":1}'
```

---

## Documentation

- **[User Guide](docs/USER_GUIDE.md)** - How to use each feature
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Self-hosting instructions
- **[API Reference](docs/API.md)** - Public endpoints documentation

---

## Project Structure

```
pnode-pulse/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   │   ├── dashboard/    # Dashboard widgets
│   │   ├── nodes/        # Node-related components
│   │   └── ui/           # Shared UI components
│   ├── lib/
│   │   ├── prpc/         # pRPC client library
│   │   ├── db/           # Prisma client & queries
│   │   └── utils/        # Formatting utilities
│   ├── server/
│   │   ├── api/          # tRPC routers
│   │   └── workers/      # Data collector
│   └── types/            # TypeScript types
├── prisma/               # Database schema & migrations
├── docs/                 # Documentation
└── docker/               # Docker configurations
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `REDIS_HOST` | Redis hostname | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `PRPC_SEED_NODES` | Comma-separated seed IPs | Built-in list |

---

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Resources

- [Xandeum Network](https://xandeum.network)
- [Xandeum Docs](https://docs.xandeum.network)
- [pRPC Reference](https://docs.xandeum.network/xandeum-pnode-setup-guide)
- [Discord](https://discord.com/invite/mGAxAuwnR9)

---

**Built with tawakkul for the Xandeum ecosystem**
