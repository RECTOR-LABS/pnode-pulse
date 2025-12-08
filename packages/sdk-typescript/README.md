# @pnode-pulse/sdk

Official TypeScript SDK for the pNode Pulse API.

## Installation

```bash
npm install @pnode-pulse/sdk
# or
yarn add @pnode-pulse/sdk
# or
pnpm add @pnode-pulse/sdk
```

## Quick Start

```typescript
import { PnodePulse } from '@pnode-pulse/sdk';

// Anonymous access (30 req/min)
const client = new PnodePulse();

// Or with API key for higher rate limits
const client = new PnodePulse({ apiKey: 'pk_live_...' });

// Get network overview
const network = await client.network.getOverview();
console.log(`Active nodes: ${network.nodes.active}/${network.nodes.total}`);
console.log(`Total storage: ${network.metrics.totalStorageBytes} bytes`);

// List active nodes
const { nodes } = await client.nodes.list({ status: 'active', limit: 10 });
for (const node of nodes) {
  console.log(`${node.address} - v${node.version}`);
}

// Get specific node details
const node = await client.nodes.get(1);
if (node.metrics) {
  console.log(`CPU: ${node.metrics.cpuPercent}%`);
  console.log(`RAM: ${node.metrics.ramPercent}%`);
}

// Get historical metrics
const metrics = await client.nodes.getMetrics(1, { range: '7d', aggregation: 'daily' });
for (const point of metrics.data) {
  console.log(`${point.time}: CPU ${point.cpuPercent}%`);
}

// Get leaderboard
const leaders = await client.leaderboard.topUptime(10);
for (const entry of leaders.rankings) {
  console.log(`#${entry.rank} ${entry.address} - ${entry.metrics.uptimeSeconds}s uptime`);
}
```

## Configuration

```typescript
const client = new PnodePulse({
  // API key for authenticated requests (optional)
  apiKey: 'pk_live_...',

  // Custom base URL (default: https://pulse.rectorspace.com)
  baseUrl: 'https://custom-domain.com',

  // Request timeout in ms (default: 30000)
  timeout: 60000,

  // Custom fetch implementation (for Node.js or testing)
  fetch: customFetch,
});
```

## API Reference

### Network

- `client.network.getOverview()` - Network stats with node counts and versions
- `client.network.getStats()` - Detailed stats with percentiles (p50, p90, p99)

### Nodes

- `client.nodes.list(params?)` - List nodes with filtering and pagination
- `client.nodes.get(idOrAddress)` - Get node details by ID or address
- `client.nodes.getMetrics(nodeId, params?)` - Historical metrics

### Leaderboard

- `client.leaderboard.get(params?)` - Rankings by metric
- `client.leaderboard.topUptime(limit?)` - Top performers by uptime
- `client.leaderboard.topEfficiency(limit?)` - Most efficient (lowest CPU)
- `client.leaderboard.topStorage(limit?)` - Highest storage capacity

## Error Handling

```typescript
import { PnodePulse, PnodePulseError, RateLimitError } from '@pnode-pulse/sdk';

try {
  const node = await client.nodes.get(999);
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${error.retryAfter}s`);
  } else if (error instanceof PnodePulseError) {
    console.log(`API Error: ${error.code} - ${error.message}`);
  }
}
```

## Rate Limits

| Tier | Requests/min |
|------|-------------|
| Anonymous | 30 |
| Free | 100 |
| Pro | 1,000 |
| Enterprise | 10,000 |

Get an API key at [pulse.rectorspace.com/settings/api-keys](https://pulse.rectorspace.com/settings/api-keys)

## License

MIT
