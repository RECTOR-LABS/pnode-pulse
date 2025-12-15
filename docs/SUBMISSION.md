# Superteam Bounty Submission

## Build Analytics Platform for Xandeum pNodes

**Prize Pool**: $5,000 USDC ($2,500 / $1,500 / $1,000)
**Deadline**: December 26, 2025 @ 07:59 UTC
**Winner Announcement**: January 9, 2026

---

## Quick Links

| Resource              | URL                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------- |
| **Live Platform**     | https://pulse.rectorspace.com                                                                 |
| **GitHub Repository** | https://github.com/RECTOR-LABS/pnode-pulse                                                    |
| **User Guide**        | [docs/USER_GUIDE.md](https://github.com/RECTOR-LABS/pnode-pulse/blob/main/docs/USER_GUIDE.md) |
| **Deployment Guide**  | [docs/DEPLOYMENT.md](https://github.com/RECTOR-LABS/pnode-pulse/blob/main/docs/DEPLOYMENT.md) |
| **API Reference**     | [docs/API.md](https://github.com/RECTOR-LABS/pnode-pulse/blob/main/docs/API.md)               |

---

## Submission Summary

### Project Name

**pNode Pulse** - Real-time Analytics for Xandeum's pNode Network

### One-Line Description

Production-ready analytics platform tracking 200+ pNodes with real-time metrics, storage analytics, health scoring, and historical data powered by TimescaleDB.

### Current Network Stats (Live)

- **201 nodes** discovered in gossip network
- **51 active nodes** responding to polls
- **5.7 TB** total network storage
- **48+ hours** average node uptime

---

## Deliverables Checklist

| Requirement               | Status | Evidence                                   |
| ------------------------- | ------ | ------------------------------------------ |
| Live, functional website  | ✅     | https://pulse.rectorspace.com              |
| Retrieve pNodes via pRPC  | ✅     | Uses `get-pods-with-stats` (v0.7.0+)       |
| Display pNode information | ✅     | Dashboard, node list, detail views         |
| GitHub repository         | ✅     | https://github.com/RECTOR-LABS/pnode-pulse |
| Deployment documentation  | ✅     | [DEPLOYMENT.md](./DEPLOYMENT.md)           |
| Usage documentation       | ✅     | [USER_GUIDE.md](./USER_GUIDE.md)           |

---

## What We Built

### Core Features (Required)

1. **Full pRPC Integration**
   - Implements `get-pods-with-stats` for comprehensive node discovery
   - Collects from 8 public seed nodes every 30 seconds
   - Gets ALL nodes via gossip network (not just directly accessible ones)

2. **Clear Information Display**
   - Network overview with key metrics cards
   - Sortable/filterable node list (201 nodes)
   - Individual node detail pages with metrics history
   - Version distribution chart
   - Storage capacity visualization

3. **User-Friendly Experience**
   - Responsive design (mobile + desktop)
   - Loading states and error handling
   - Real-time data refresh
   - 4 language support (EN/ES/ZH/RU)

### Innovation Features (Bonus)

| Feature                  | Description                                                    |
| ------------------------ | -------------------------------------------------------------- |
| **TimescaleDB**          | Time-series database for efficient metrics storage and queries |
| **Health Scoring**       | Multi-factor A-F grades based on CPU, RAM, uptime              |
| **IP Change Detection**  | Tracks nodes by pubkey, detects IP migrations                  |
| **Node Graveyard**       | Historical archive of inactive/offline nodes                   |
| **Capacity Projections** | Growth forecasting based on historical trends                  |
| **Embeddable Badges**    | SVG badges for external sites (network.svg, storage.svg)       |
| **Public REST API**      | Full API access for third-party integrations                   |
| **Blue/Green Deploy**    | Zero-downtime production deployments                           |

---

## Tech Stack

| Layer      | Technology                                     |
| ---------- | ---------------------------------------------- |
| Frontend   | Next.js 14, TypeScript, Tailwind CSS, Recharts |
| Backend    | tRPC, Node.js                                  |
| Database   | PostgreSQL + TimescaleDB (time-series)         |
| Cache      | Redis                                          |
| Deployment | Docker Compose, GitHub Actions CI/CD           |
| Monitoring | Sentry APM, Health endpoints                   |

---

## Judging Criteria Alignment

### 1. Functionality ⭐⭐⭐⭐⭐

- Full pRPC integration with `get-pods-with-stats`
- Live data collection every 30 seconds
- 201 nodes tracked with comprehensive metrics
- Works with v0.7.0+ nodes AND legacy nodes

### 2. Clarity ⭐⭐⭐⭐⭐

- Clean, organized dashboard layout
- Intuitive metric cards with icons
- Proper formatting (bytes → TB, seconds → "2d 5h")
- Tooltips and help text where needed

### 3. User Experience ⭐⭐⭐⭐⭐

- Fast page loads (< 1s)
- Loading skeletons during data fetch
- Mobile-responsive design
- Error boundaries with friendly messages
- Multi-language support

### 4. Innovation ⭐⭐⭐⭐⭐

- TimescaleDB for time-series analytics
- Pubkey-based node identity (survives IP changes)
- Health scoring algorithm
- Capacity growth projections
- Production-grade infrastructure

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       pNode Pulse                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Next.js   │  │  Collector  │  │   TimescaleDB       │  │
│  │  Dashboard  │◄─┤   Worker    │─►│  (Time-series DB)   │  │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────┘  │
│         │                │                                   │
│         └───────────────►│◄──── Redis (Cache) ─────────────► │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Xandeum pNode Network                     │
├─────────────────────────────────────────────────────────────┤
│     pNode 1        pNode 2        pNode 3       pNode N      │
│      :6000          :6000          :6000         :6000       │
│         └─────────── Gossip Network (:9001) ────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Technical Decisions

1. **Pubkey as Primary Identity**
   - Nodes are identified by cryptographic pubkey, not IP
   - Enables accurate tracking when nodes change IPs
   - Suggested by Brad (Xandeum team) in Discord

2. **Hybrid Collection Strategy**
   - Direct polling for public nodes (port 6000 open)
   - Gossip data via `get-pods-with-stats` for private nodes
   - Results in complete network visibility

3. **TimescaleDB for Metrics**
   - Optimized for time-series data patterns
   - Efficient storage of historical metrics
   - Fast aggregation queries for charts

---

## Screenshots

| View        | Description                           |
| ----------- | ------------------------------------- |
| Dashboard   | Network overview with all key metrics |
| Node List   | Filterable table of 201 nodes         |
| Node Detail | Individual node metrics and history   |
| Leaderboard | Top nodes by uptime and storage       |
| Mobile      | Responsive mobile layout              |

> Screenshots available at: https://pulse.rectorspace.com

---

## Documentation

| Document                         | Lines | Description                  |
| -------------------------------- | ----- | ---------------------------- |
| [USER_GUIDE.md](./USER_GUIDE.md) | 372   | Complete feature walkthrough |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | 566   | Self-hosting instructions    |
| [API.md](./API.md)               | 400   | REST API reference           |
| [RUNBOOK.md](./RUNBOOK.md)       | 665   | Operations guide             |

---

## Submission Text (Copy/Paste)

```
Project: pNode Pulse
Live URL: https://pulse.rectorspace.com
GitHub: https://github.com/RECTOR-LABS/pnode-pulse

Real-time analytics platform for Xandeum's pNode network.
Tracks 200+ nodes with storage metrics, health scoring,
version distribution, and historical data using TimescaleDB.

Features:
- Full pRPC integration (get-pods-with-stats)
- 200+ nodes tracked in real-time
- Storage analytics (5+ TB network capacity)
- Health scoring (A-F grades)
- IP change detection
- Node graveyard for inactive nodes
- Embeddable SVG badges
- REST API for integrations
- Multi-language support (EN/ES/ZH/RU)

Tech: Next.js 14, TypeScript, tRPC, TimescaleDB, Redis, Docker

Documentation:
- User Guide: docs/USER_GUIDE.md
- Deployment: docs/DEPLOYMENT.md
- API Reference: docs/API.md
```

---

## Contact

- **GitHub**: [@RECTOR-LABS](https://github.com/RECTOR-LABS)
- **Discord**: RECTOR (in Xandeum server)

---

_Built with dedication for the Xandeum ecosystem_
