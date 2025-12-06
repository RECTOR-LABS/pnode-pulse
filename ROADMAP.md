# pNode Pulse - Development Roadmap

> **Vision**: To be the indispensable observatory of Xandeum's distributed storage universe — where every pNode's heartbeat is visible, every byte is accountable, and every operator is empowered.

**Repository**: [RECTOR-LABS/pnode-pulse](https://github.com/RECTOR-LABS/pnode-pulse)
**License**: MIT (Open Core model)
**Status**: Planning Phase
**Last Updated**: 2025-12-07

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Technical Foundation](#technical-foundation)
3. [Architecture Overview](#architecture-overview)
4. [Phase Breakdown](#phase-breakdown)
5. [Success Metrics](#success-metrics)
6. [Risk Assessment](#risk-assessment)

---

## Executive Summary

### What is pNode Pulse?

pNode Pulse is a real-time analytics platform for Xandeum's pNode network. It aggregates data from distributed storage nodes via the pRPC API and presents it through an intuitive dashboard, enabling operators to monitor performance, developers to build with confidence, and the community to trust in network health.

### Unique Value Proposition

**"The only platform that speaks pNode fluently."**

- **Storage-First**: Built specifically for storage node economics, not just transactions
- **Operator-Centric**: Designed for those running infrastructure, not just viewing it
- **Early Ecosystem Partner**: Growing with Xandeum from ground floor
- **Open API Philosophy**: Enable ecosystem innovation through open data

### Target Users

| User Type | Primary Needs |
|-----------|---------------|
| **pNode Operators** | Real-time monitoring, performance optimization, alerting |
| **Developers** | API access, integration tools, network statistics |
| **Community** | Network health visibility, trust verification |
| **Xandeum Team** | Ecosystem analytics, adoption metrics |

---

## Technical Foundation

### Data Source: pRPC API

**Protocol**: JSON-RPC 2.0 over HTTP POST
**Endpoint**: `http://<pnode-ip>:6000/rpc`
**Authentication**: None required
**Rate Limits**: None currently

### Available RPC Methods

#### 1. `get-version`

Returns pNode software version.

```json
// Request
{"jsonrpc": "2.0", "method": "get-version", "id": 1}

// Response
{
  "error": null,
  "id": 1,
  "jsonrpc": "2.0",
  "result": {
    "version": "0.6.0"
  }
}
```

#### 2. `get-stats`

Returns comprehensive system metrics. **Note**: Actual response structure is flat (differs from official docs).

```json
// Request
{"jsonrpc": "2.0", "method": "get-stats", "id": 1}

// Response
{
  "error": null,
  "id": 1,
  "jsonrpc": "2.0",
  "result": {
    "active_streams": 2,
    "cpu_percent": 6.633906841278076,
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

| Field | Type | Description |
|-------|------|-------------|
| `active_streams` | number | Active network streams |
| `cpu_percent` | number | CPU usage percentage |
| `current_index` | number | Current page index |
| `file_size` | number | Storage file size (bytes) |
| `last_updated` | number | Unix timestamp of last update |
| `packets_received` | number | Total packets received |
| `packets_sent` | number | Total packets sent |
| `ram_total` | number | Total RAM (bytes) |
| `ram_used` | number | RAM in use (bytes) |
| `total_bytes` | number | Total bytes processed |
| `total_pages` | number | Total pages in storage |
| `uptime` | number | Uptime in seconds |

#### 3. `get-pods`

Returns list of known peer pNodes. **Note**: Includes `pubkey` field not documented in official docs.

```json
// Request
{"jsonrpc": "2.0", "method": "get-pods", "id": 1}

// Response
{
  "error": null,
  "id": 1,
  "jsonrpc": "2.0",
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

| Field | Type | Description |
|-------|------|-------------|
| `address` | string | IP:port of peer pNode (gossip port 9001) |
| `last_seen_timestamp` | number | Unix timestamp of last contact |
| `pubkey` | string \| null | pNode public key (Solana format) |
| `version` | string | Software version ("unknown" if unavailable) |
| `total_count` | number | Total known pNodes |

### Known Public pNodes (pRPC Port 6000 Open)

As of 2025-12-07, these pNodes have public pRPC access:

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

### Network Ports Reference

| Port | Service | Access |
|------|---------|--------|
| 6000 | pRPC API | Configurable (localhost or public) |
| 9001 | Gossip Protocol | Public (peer discovery) |
| 5000 | Atlas Server | Internal |
| 3000 | XandMiner GUI | Localhost |
| 80 | Stats Dashboard | Localhost |

### Upcoming API Features

Per Xandeum team (Discord, 2025-12-07):
- **Detailed call for ALL pNodes** - Returns aggregated data for entire network
- **Paging statistics** - v0.7 Heidelberg release

---

## Architecture Overview

### Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend** | Next.js 14 (App Router) | SSR, API routes, modern React |
| **Styling** | Tailwind CSS | Utility-first, rapid development |
| **Charts** | Recharts / Tremor | React-native, accessible |
| **Backend** | Node.js + tRPC | Type-safe API, integrated with Next.js |
| **Database** | PostgreSQL | Relational data, reliability |
| **Time-Series** | TimescaleDB | Optimized for metrics storage |
| **Cache** | Redis | Real-time data, pub/sub |
| **Queue** | BullMQ | Background job processing |
| **Deployment** | Docker Compose | Reproducible, isolated |

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          pNode Pulse                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   Next.js    │    │   tRPC API   │    │   Workers    │          │
│  │   Frontend   │◄──►│   Backend    │◄──►│  (BullMQ)    │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│         │                   │                   │                   │
│         │                   ▼                   │                   │
│         │            ┌──────────────┐           │                   │
│         │            │    Redis     │◄──────────┤                   │
│         │            │  (Cache/PubSub)          │                   │
│         │            └──────────────┘           │                   │
│         │                   │                   │                   │
│         ▼                   ▼                   ▼                   │
│  ┌─────────────────────────────────────────────────────┐           │
│  │              PostgreSQL + TimescaleDB                │           │
│  │         (Nodes, Metrics, Historical Data)            │           │
│  └─────────────────────────────────────────────────────┘           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Xandeum pNode Network                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  pNode 1 │  │  pNode 2 │  │  pNode 3 │  │  pNode N │            │
│  │  :6000   │  │  :6000   │  │  :6000   │  │  :6000   │            │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │
│       │             │             │             │                   │
│       └─────────────┴─────────────┴─────────────┘                   │
│                     Gossip Protocol (:9001)                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Discovery**: Query known pNodes for `get-pods` to discover network topology
2. **Collection**: Parallel `get-stats` calls to all reachable pNodes
3. **Storage**: Time-series metrics stored in TimescaleDB
4. **Cache**: Latest data cached in Redis for real-time dashboard
5. **Presentation**: Next.js frontend with WebSocket updates

### Deployment Architecture

**Domain**: `pulse.rectorspace.com`
**VPS**: 176.222.53.185 (rectorspace.com)

| Service | Port | Container Name |
|---------|------|----------------|
| Web (Blue) | 7000 | pnode-pulse-web-blue |
| Web (Green) | 7001 | pnode-pulse-web-green |
| Staging | 7002 | pnode-pulse-staging |
| PostgreSQL | 5434 | pnode-pulse-postgres |
| Redis | 6381 | pnode-pulse-redis |

---

## Phase Breakdown

### Phase 1: Foundation (8-10 weeks)

**Theme**: "Single Node, Done Right"

**Objective**: Build bulletproof infrastructure for collecting, storing, and displaying pNode data.

#### Epic 1.1: Project Setup & Infrastructure

| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| 1.1.1 | Initialize Next.js 14 project with TypeScript | P0 | S |
| 1.1.2 | Configure Tailwind CSS and design tokens | P0 | S |
| 1.1.3 | Set up ESLint, Prettier, Husky | P0 | S |
| 1.1.4 | Create Docker Compose for local development | P0 | M |
| 1.1.5 | Set up PostgreSQL + TimescaleDB schema | P0 | M |
| 1.1.6 | Configure Redis for caching | P1 | S |
| 1.1.7 | Set up CI/CD pipeline (GitHub Actions) | P1 | M |

#### Epic 1.2: pRPC Client Library

| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| 1.2.1 | Create type-safe pRPC client | P0 | M |
| 1.2.2 | Implement `get-version` method | P0 | S |
| 1.2.3 | Implement `get-stats` method | P0 | S |
| 1.2.4 | Implement `get-pods` method | P0 | S |
| 1.2.5 | Add retry logic and error handling | P0 | M |
| 1.2.6 | Add request timeout configuration | P1 | S |
| 1.2.7 | Add connection pooling | P2 | M |
| 1.2.8 | Write comprehensive unit tests | P0 | M |

#### Epic 1.3: Data Collection Engine

| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| 1.3.1 | Create scheduled data collection worker | P0 | M |
| 1.3.2 | Implement node discovery via `get-pods` | P0 | M |
| 1.3.3 | Parallel data collection from multiple nodes | P0 | L |
| 1.3.4 | Data validation and normalization | P0 | M |
| 1.3.5 | Store metrics in TimescaleDB | P0 | M |
| 1.3.6 | Cache latest data in Redis | P1 | S |
| 1.3.7 | Handle node unavailability gracefully | P0 | M |
| 1.3.8 | Implement collection health monitoring | P1 | M |

#### Epic 1.4: Database Schema & Models

| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| 1.4.1 | Design node registry table | P0 | S |
| 1.4.2 | Design metrics hypertable (TimescaleDB) | P0 | M |
| 1.4.3 | Design network snapshots table | P1 | S |
| 1.4.4 | Create database migrations | P0 | M |
| 1.4.5 | Implement data retention policies | P1 | M |
| 1.4.6 | Create database indexes for queries | P1 | S |

#### Epic 1.5: API Layer

| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| 1.5.1 | Set up tRPC with Next.js | P0 | M |
| 1.5.2 | Create node list endpoint | P0 | S |
| 1.5.3 | Create node detail endpoint | P0 | S |
| 1.5.4 | Create network overview endpoint | P0 | M |
| 1.5.5 | Create metrics history endpoint | P0 | M |
| 1.5.6 | Add WebSocket support for real-time updates | P1 | L |
| 1.5.7 | Implement API rate limiting | P2 | M |

#### Epic 1.6: Basic Dashboard UI

| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| 1.6.1 | Create app layout and navigation | P0 | M |
| 1.6.2 | Build network overview page | P0 | L |
| 1.6.3 | Build node list page with sorting/filtering | P0 | L |
| 1.6.4 | Build node detail page | P0 | L |
| 1.6.5 | Create metric cards component | P0 | M |
| 1.6.6 | Create line chart component | P0 | M |
| 1.6.7 | Add real-time update indicators | P1 | M |
| 1.6.8 | Implement responsive design | P1 | M |
| 1.6.9 | Add loading states and skeletons | P1 | S |
| 1.6.10 | Add error boundaries | P1 | S |

#### Phase 1 Success Criteria

- [ ] Collect data from 9+ known public pNodes reliably for 7 days
- [ ] API responds in <100ms for cached data
- [ ] WebSocket updates every 30 seconds
- [ ] Zero data loss during collection failures
- [ ] Dashboard loads in <2 seconds (Lighthouse score >90)
- [ ] Test coverage >80% for critical paths
- [ ] Documentation complete for all APIs

---

### Phase 2: Network Intelligence (6-8 weeks)

**Theme**: "See The Forest, Not Just Trees"

**Objective**: Aggregate data from all pNodes to show network-wide health and trends.

#### Epic 2.1: Network-Wide Aggregation

| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| 2.1.1 | Calculate total network storage capacity | P0 | M |
| 2.1.2 | Calculate active vs. inactive nodes | P0 | M |
| 2.1.3 | Calculate network-wide uptime percentage | P0 | M |
| 2.1.4 | Track version distribution across network | P0 | M |
| 2.1.5 | Calculate average node metrics | P1 | S |

#### Epic 2.2: Historical Trends

| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| 2.2.1 | Implement 90-day data retention | P0 | M |
| 2.2.2 | Create hourly/daily/weekly aggregations | P0 | L |
| 2.2.3 | Build network growth trend visualization | P0 | M |
| 2.2.4 | Build capacity projection charts | P1 | M |
| 2.2.5 | Add performance comparison over time | P1 | M |

#### Epic 2.3: Enhanced Dashboard

| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| 2.3.1 | Network health score widget | P0 | M |
| 2.3.2 | Version distribution pie chart | P0 | S |
| 2.3.3 | Network growth trend chart | P0 | M |
| 2.3.4 | Top/bottom performing nodes | P1 | M |
| 2.3.5 | Network map visualization | P2 | L |

#### Epic 2.4: Search & Discovery

| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| 2.4.1 | Search nodes by IP address | P0 | M |
| 2.4.2 | Search nodes by public key | P0 | M |
| 2.4.3 | Filter by version | P1 | S |
| 2.4.4 | Filter by status (active/inactive) | P1 | S |
| 2.4.5 | Bookmark favorite nodes | P2 | M |

#### Phase 2 Success Criteria

- [ ] Track all discovered pNodes (27+ as of now)
- [ ] Network overview updates in <5 seconds
- [ ] 90-day historical data queryable in <2 seconds
- [ ] Trend projections within 10% accuracy
- [ ] Node search returns results in <500ms

---

### Phase 3: Operator Empowerment (6-8 weeks)

**Theme**: "Your Nodes, Your Way"

**Objective**: Build features that make operators depend on pNode Pulse for daily operations.

#### Epic 3.1: Alerting System

| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| 3.1.1 | Design alert rule engine | P0 | L |
| 3.1.2 | Implement configurable thresholds | P0 | M |
| 3.1.3 | Add email notification channel | P0 | M |
| 3.1.4 | Add Discord webhook integration | P0 | M |
| 3.1.5 | Add Telegram bot integration | P1 | M |
| 3.1.6 | Build alert history and acknowledgment | P1 | M |
| 3.1.7 | Implement alert escalation policies | P2 | L |

#### Epic 3.2: Operator Dashboard

| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| 3.2.1 | Personal node portfolio view | P0 | L |
| 3.2.2 | Performance benchmarking vs. network | P0 | M |
| 3.2.3 | Uptime tracking and SLA reporting | P1 | M |
| 3.2.4 | Resource utilization recommendations | P2 | L |

#### Epic 3.3: Comparison Tools

| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| 3.3.1 | Side-by-side node comparison | P0 | M |
| 3.3.2 | Identify underperforming nodes | P1 | M |
| 3.3.3 | Version upgrade tracking | P1 | S |
| 3.3.4 | Peer health analysis | P2 | M |

#### Epic 3.4: Export & Reports

| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| 3.4.1 | CSV data export | P0 | M |
| 3.4.2 | JSON API export | P0 | S |
| 3.4.3 | Scheduled email reports | P1 | M |
| 3.4.4 | Grafana dashboard templates | P2 | L |

#### Epic 3.5: User Accounts (Optional)

| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| 3.5.1 | Wallet-based authentication (Solana) | P1 | L |
| 3.5.2 | User preferences storage | P1 | M |
| 3.5.3 | Alert configuration persistence | P1 | M |
| 3.5.4 | Node ownership claims | P2 | L |

#### Phase 3 Success Criteria

- [ ] Alert delivery within 60 seconds of threshold breach
- [ ] 95% alert delivery success rate
- [ ] Operator can set up monitoring in <5 minutes
- [ ] Export generates in <10 seconds for 90-day data
- [ ] 50+ active operator accounts (if auth implemented)

---

### Phase 4: Ecosystem Platform (8-10 weeks)

**Theme**: "Build With Us"

**Objective**: Transform from dashboard to platform that others build upon.

#### Epic 4.1: Public API

| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| 4.1.1 | Design REST API specification (OpenAPI) | P0 | M |
| 4.1.2 | Implement versioned API endpoints | P0 | L |
| 4.1.3 | Add API key management | P0 | M |
| 4.1.4 | Implement usage tracking and quotas | P1 | M |
| 4.1.5 | Create API documentation portal | P0 | L |

#### Epic 4.2: Developer SDKs

| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| 4.2.1 | TypeScript/JavaScript SDK | P0 | L |
| 4.2.2 | Python SDK | P1 | L |
| 4.2.3 | SDK documentation and examples | P0 | M |
| 4.2.4 | Publish to npm/PyPI | P0 | S |

#### Epic 4.3: Integrations

| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| 4.3.1 | Discord notification bot | P0 | M |
| 4.3.2 | Telegram notification bot | P1 | M |
| 4.3.3 | Grafana data source plugin | P1 | L |
| 4.3.4 | Prometheus metrics exporter | P2 | L |

#### Epic 4.4: Embeddable Widgets

| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| 4.4.1 | Network status badge (SVG) | P1 | S |
| 4.4.2 | Node status widget (iframe) | P1 | M |
| 4.4.3 | Embeddable charts | P2 | M |

#### Epic 4.5: Community Features

| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| 4.5.1 | Node leaderboards | P1 | M |
| 4.5.2 | Operator profiles (opt-in) | P2 | M |
| 4.5.3 | Achievement badges | P2 | M |

#### Phase 4 Success Criteria

- [ ] API documentation 100% complete
- [ ] SDKs published to npm and PyPI
- [ ] 10+ third-party integrations in first month
- [ ] API handles 100k+ requests/day
- [ ] 3+ community-built tools using our API

---

### Phase 5: Intelligence Layer (6-8 weeks)

**Theme**: "Know Before It Happens"

**Objective**: Add predictive analytics and advanced insights.

#### Epic 5.1: Predictive Analytics

| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| 5.1.1 | Capacity forecasting model | P1 | L |
| 5.1.2 | Performance degradation prediction | P1 | L |
| 5.1.3 | Network growth modeling | P2 | L |

#### Epic 5.2: Anomaly Detection

| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| 5.2.1 | Automatic outlier identification | P1 | L |
| 5.2.2 | Pattern deviation alerts | P1 | M |
| 5.2.3 | Network health scoring algorithm | P1 | M |

#### Epic 5.3: Optimization Recommendations

| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| 5.3.1 | Resource tuning suggestions | P2 | M |
| 5.3.2 | Version upgrade advisories | P1 | S |
| 5.3.3 | Peer optimization recommendations | P2 | M |

#### Epic 5.4: v0.7 Heidelberg Integration

| ID | Story | Priority | Estimate |
|----|-------|----------|----------|
| 5.4.1 | Integrate paging statistics APIs | P0 | L |
| 5.4.2 | Extend data models for new metrics | P0 | M |
| 5.4.3 | Update dashboard for new features | P0 | M |

#### Phase 5 Success Criteria

- [ ] Prediction accuracy >85% for 24-hour forecasts
- [ ] Anomaly detection catches 90%+ of real issues
- [ ] Recommendations followed by 50%+ of operators
- [ ] Zero breaking changes from v0.7 integration

---

### Phase 6: Scale & Polish (Ongoing)

**Theme**: "Excellence in Every Pixel"

**Objective**: Refine, optimize, and scale.

#### Epic 6.1: Performance Optimization

- Sub-second page loads
- Real-time updates at scale
- Database query optimization
- CDN and edge caching

#### Epic 6.2: Mobile Experience

- Responsive improvements
- Progressive Web App (PWA)
- Native mobile app (React Native) - future

#### Epic 6.3: Internationalization

- Multi-language support
- Timezone handling
- Regional preferences

#### Epic 6.4: Accessibility

- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader support

---

## Success Metrics

### North Star Metric

> **"% of active pNode operators who check pNode Pulse at least weekly"**
>
> Target: 80% within 6 months of mainnet launch

### Key Performance Indicators

| Metric | Phase 1 Target | Phase 4 Target |
|--------|----------------|----------------|
| Weekly Active Users | 50 | 500+ |
| API Requests/Day | 1,000 | 100,000+ |
| Nodes Tracked | 27+ | All network nodes |
| Uptime SLA | 99% | 99.9% |
| Page Load Time | <3s | <1s |
| Alert Delivery Rate | N/A | 95%+ |

### Community Health

- GitHub stars
- Discord member growth
- Third-party integrations
- Community contributions

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| pNodes go private (close port 6000) | Medium | Critical | Partner with Xandeum for data access |
| Limited API surface (only 3 methods) | Known | Medium | Design for extensibility, prepare for v0.7 |
| Xandeum network doesn't grow | Medium | High | Build generic value, pivot capability |
| Competition enters market | Medium | Medium | First-mover advantage, community loyalty |
| v0.7 API breaks compatibility | Low | High | Modular architecture, versioned clients |

---

## Resources & Links

### Xandeum Official

- [Xandeum Documentation](https://docs.xandeum.network/)
- [pRPC API Reference](https://docs.xandeum.network/api/pnode-rpc-prpc-reference)
- [Xandeum GitHub](https://github.com/Xandeum)
- [Xandeum Discord](https://discord.com/invite/mGAxAuwnR9)

### pNode Pulse

- [GitHub Repository](https://github.com/RECTOR-LABS/pnode-pulse)
- [Private Strategy](~/.claude/pnode-pulse/STRATEGY.md)

---

*This roadmap is a living document. Updated as we learn more about the ecosystem and user needs.*

**Built with Ihsan (Excellence) by RECTOR**
