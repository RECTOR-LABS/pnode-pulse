# Superteam Bounty Submission

**Bounty**: Build Analytics Platform for Xandeum pNodes
**Prize Pool**: $5,000 USDC
**Deadline**: December 26, 2025 @ 07:59 UTC

---

## Project Information

**Project Name**: pNode Pulse

**Live URL**: https://pulse.rectorspace.com

**GitHub URL**: https://github.com/RECTOR-LABS/pnode-pulse

---

## Short Description (1-2 sentences)

Real-time analytics platform for Xandeum's pNode network. Tracks 170+ nodes with storage metrics, health scoring, version distribution, and historical data using TimescaleDB.

---

## Long Description

### What We Built

pNode Pulse is a comprehensive analytics dashboard for monitoring Xandeum's distributed storage network. We went beyond basic node listing to create a production-grade platform with:

**Core Features:**
- **Real-time Network Overview**: Track 170+ pNodes with live CPU, RAM, storage, and uptime metrics
- **Full pRPC Integration**: Uses `get-pods-with-stats` (v0.7.0+) for complete network discovery
- **Storage Analytics**: Monitor 1.7+ PB of total network storage capacity
- **Version Tracking**: Visualize version distribution across the network
- **Node Leaderboard**: Rank nodes by performance metrics

**Advanced Features:**
- **IP Change Detection**: Track when nodes change IP addresses (pubkey-based correlation)
- **Node Graveyard**: Historical tracking of inactive/archived nodes
- **Health Scoring**: Multi-factor health grades (A-F) for each node
- **Capacity Projections**: Storage growth forecasting based on trends
- **Performance Comparison**: Side-by-side node analytics

**Technical Highlights:**
- **TimescaleDB**: Time-series database for efficient metrics storage
- **Background Collector**: Polls all public nodes every 30 seconds
- **Hybrid Collection**: Gets private node metrics via public nodes' gossip data
- **Zero-Downtime Deployment**: Blue/green deployment on Docker

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | tRPC, Node.js |
| Database | PostgreSQL + TimescaleDB |
| Cache | Redis |
| Deployment | Docker Compose, GitHub Actions |

### Innovation

1. **Pubkey-Based Node Identity**: Nodes are tracked by their cryptographic pubkey, not IP address, enabling accurate tracking even when IPs change

2. **Hybrid Collection Strategy**: We query public nodes to get comprehensive data about private nodes through the gossip network

3. **Production Infrastructure**: Full CI/CD pipeline, health checks, and blue/green deployments - not just a demo

---

## Judging Criteria Alignment

| Criteria | Our Approach |
|----------|--------------|
| **Functionality** | Full pRPC integration with `get-pods-with-stats`, live data for 170+ nodes |
| **Clarity** | Clean dashboard with intuitive widgets, proper labels, tooltips |
| **User Experience** | Loading states, error handling, responsive design, dark mode |
| **Innovation** | TimescaleDB analytics, IP tracking, health scoring, projections |

---

## Screenshots

> Note: Capture these from https://pulse.rectorspace.com

1. **Network Overview** - Main dashboard with key metrics
2. **Node List** - Filterable table with all nodes
3. **Node Detail** - Individual node metrics and history
4. **Version Distribution** - Pie chart of pNode versions
5. **Storage Overview** - Network storage capacity
6. **Mobile View** - Responsive mobile layout

---

## Demo Video Outline (2-3 minutes)

1. **Intro** (15s): Show live site URL and explain purpose
2. **Network Overview** (30s): Walk through main dashboard widgets
3. **Node List** (30s): Show filtering, sorting, search
4. **Node Detail** (30s): Click into a node, show metrics
5. **Analytics** (30s): Show version chart, storage overview
6. **Technical** (30s): Mention TimescaleDB, real-time collection
7. **Closing** (15s): GitHub link, thank judges

---

## Pre-Submission Checklist

- [x] Site is live at pulse.rectorspace.com
- [x] All pages load without errors
- [x] Data is fresh (< 1 minute old)
- [x] README is complete with badges
- [x] Documentation in /docs folder
- [x] 170+ nodes discovered
- [x] Mobile responsive
- [ ] Screenshots captured
- [ ] Video recorded
- [ ] Form submitted

---

## Links

- **Live Demo**: https://pulse.rectorspace.com
- **GitHub**: https://github.com/RECTOR-LABS/pnode-pulse
- **User Guide**: https://github.com/RECTOR-LABS/pnode-pulse/blob/main/docs/USER_GUIDE.md
- **Deployment Guide**: https://github.com/RECTOR-LABS/pnode-pulse/blob/main/docs/DEPLOYMENT.md
- **API Reference**: https://github.com/RECTOR-LABS/pnode-pulse/blob/main/docs/API.md
