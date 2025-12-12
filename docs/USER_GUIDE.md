# pNode Pulse User Guide

This guide walks you through all features of the pNode Pulse analytics platform.

---

## Table of Contents

1. [Dashboard Overview](#dashboard-overview)
2. [Network Statistics](#network-statistics)
3. [Node List](#node-list)
4. [Node Details](#node-details)
5. [Storage Analytics](#storage-analytics)
6. [Network Health](#network-health)
7. [Historical Data](#historical-data)

---

## Dashboard Overview

The main dashboard at [pulse.rectorspace.com](https://pulse.rectorspace.com) provides a comprehensive view of the Xandeum pNode network.

### Key Metrics Cards

| Metric | Description |
|--------|-------------|
| **Total Nodes** | Number of nodes discovered in the gossip network |
| **Network Storage** | Combined storage capacity across all nodes |
| **Avg CPU** | Average CPU utilization network-wide |
| **Avg Uptime** | Average node uptime |

### Dashboard Widgets

- **Network Health** - Visual gauge showing overall network status
- **Version Distribution** - Pie chart of pNode software versions
- **Network Growth** - Historical chart of node count over time
- **Node Leaderboard** - Top performing nodes by storage/uptime
- **Storage Projection** - Predicted network capacity growth
- **Performance Comparison** - Side-by-side node metrics
- **Graveyard Stats** - Inactive/archived nodes tracking
- **IP Changes** - Recent IP address changes detected

---

## Network Statistics

### Quick Stats Row

At the bottom of the dashboard, you'll find:

| Stat | Description |
|------|-------------|
| **Active Nodes** | Nodes responding to polls (green) |
| **Inactive Nodes** | Nodes not responding (orange) |
| **Avg RAM Usage** | Network-wide memory utilization |
| **Peer Connections** | Total gossip network connections |

### Collection Status

Shows when the last data collection occurred and recent collection history.

---

## Node List

Navigate to `/nodes` to see all discovered nodes.

### Filtering Options

- **Status**: Active, Inactive, All
- **Version**: Filter by specific pNode version
- **Public/Private**: Filter by RPC accessibility

### Sorting

Click column headers to sort by:
- Address
- Version
- Last Seen
- Uptime
- Storage

### Node Information

Each row displays:

| Column | Description |
|--------|-------------|
| **Address** | IP:Port of the node |
| **Version** | pNode software version |
| **Status** | Active/Inactive indicator |
| **Public** | Whether RPC port is accessible |
| **Last Seen** | Time since last successful poll |
| **Uptime** | Node uptime in human-readable format |

---

## Node Details

Click any node to view detailed information at `/nodes/[id]`.

### Overview Tab

- **Node Identity**: Address, pubkey, version
- **Status**: Current state (Active/Inactive/Archived)
- **Accessibility**: Public/Private RPC status

### Metrics Tab

Real-time and historical metrics:

| Metric | Description |
|--------|-------------|
| **CPU %** | Current processor utilization |
| **RAM Used/Total** | Memory consumption |
| **Storage Committed** | Allocated storage space |
| **Storage Used** | Actual data stored |
| **Uptime** | Time since node started |
| **Packets Sent/Received** | Network traffic |
| **Active Streams** | Current data streams |

### History Tab

Time-series charts showing:
- CPU usage over time
- RAM utilization trends
- Storage growth
- Uptime patterns

---

## Storage Analytics

### Network-Wide Storage

- **Total Committed**: Sum of all node storage allocations
- **Total Used**: Actual data stored across network
- **Utilization %**: Storage efficiency ratio

### Per-Node Storage

Each node with v0.7.0+ reports:
- `storage_committed`: Allocated capacity
- `storage_used`: Actual usage
- `storage_usage_percent`: Utilization rate

### Storage Projection

Based on historical data, the platform projects:
- 7-day growth forecast
- 30-day capacity estimate
- Network expansion trends

---

## Network Health

### Health Indicators

| Status | CPU | RAM | Description |
|--------|-----|-----|-------------|
| **Healthy** | < 50% | < 70% | Normal operation |
| **Warning** | 50-80% | 70-85% | Monitor closely |
| **Critical** | > 80% | > 85% | Attention needed |

### Version Health

The platform tracks version distribution:
- **Current**: Latest stable version
- **Outdated**: Older but functional versions
- **Unknown**: Nodes with version detection issues

---

## Historical Data

### Time Ranges

Select from predefined ranges:
- Last 1 hour
- Last 24 hours
- Last 7 days
- Last 30 days
- Custom range

### Data Retention

- **Metrics**: Stored indefinitely in TimescaleDB
- **Aggregates**: Daily/weekly rollups for efficiency
- **Node History**: Full lifecycle tracking

### Export

Data can be exported via the API for external analysis.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `/` | Focus search |
| `r` | Refresh data |
| `?` | Show help |

---

## Troubleshooting

### No Data Showing

1. Verify the collector is running
2. Check database connectivity
3. Ensure seed nodes are reachable

### Stale Data

- Check collector logs for errors
- Verify network connectivity to pNodes
- Review collection status widget

### Node Shows Inactive

- Node may have private RPC (expected for most nodes)
- Check if node IP has changed
- Verify node is still running

---

## FAQ

**Q: Why do most nodes show as inactive?**

A: Only ~6 nodes have public RPC ports. Private nodes are still healthy but can't be polled directly. We get their data via public nodes' `get-pods-with-stats`.

**Q: How often is data updated?**

A: The collector polls every 30 seconds for active nodes.

**Q: What's the difference between Active and Public?**

A: **Active** means the node is responding to polls. **Public** means its RPC port (6000) is accessible from the internet.

---

## Support

- [GitHub Issues](https://github.com/RECTOR-LABS/pnode-pulse/issues)
- [Xandeum Discord](https://discord.com/invite/mGAxAuwnR9)
