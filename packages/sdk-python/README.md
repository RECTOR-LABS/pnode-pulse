# pnode-pulse

Official Python SDK for the pNode Pulse API.

## Installation

```bash
pip install pnode-pulse
```

## Quick Start

```python
from pnode_pulse import PnodePulse

# Anonymous access (30 req/min)
client = PnodePulse()

# Or with API key for higher rate limits
client = PnodePulse(api_key="pk_live_...")

# Get network overview
network = client.network.get_overview()
print(f"Active nodes: {network.nodes.active}/{network.nodes.total}")
print(f"Total storage: {network.metrics.total_storage_bytes} bytes")

# List active nodes
nodes_list = client.nodes.list(status="active", limit=10)
for node in nodes_list.nodes:
    print(f"{node.address} - v{node.version}")

# Get specific node details
node = client.nodes.get(1)
if node.metrics:
    print(f"CPU: {node.metrics.cpu_percent}%")
    print(f"RAM: {node.metrics.ram_percent}%")

# Get historical metrics
metrics = client.nodes.get_metrics(1, range="7d", aggregation="daily")
for point in metrics.data:
    print(f"{point.time}: CPU {point.cpu_percent}%")

# Get leaderboard
leaders = client.leaderboard.top_uptime(10)
for entry in leaders.rankings:
    print(f"#{entry.rank} {entry.address} - {entry.metrics.uptime_seconds}s uptime")
```

## Async Usage

```python
import asyncio
from pnode_pulse import AsyncPnodePulse

async def main():
    async with AsyncPnodePulse(api_key="pk_live_...") as client:
        # All methods are async
        network = await client.network.get_overview()
        nodes = await client.nodes.list(status="active")

        # Concurrent requests
        tasks = [
            client.nodes.get(1),
            client.nodes.get(2),
            client.nodes.get(3),
        ]
        results = await asyncio.gather(*tasks)

asyncio.run(main())
```

## Configuration

```python
client = PnodePulse(
    # API key for authenticated requests (optional)
    api_key="pk_live_...",

    # Custom base URL (default: https://pulse.rectorspace.com)
    base_url="https://custom-domain.com",

    # Request timeout in seconds (default: 30.0)
    timeout=60.0,
)
```

## API Reference

### Network

- `client.network.get_overview()` - Network stats with node counts and versions
- `client.network.get_stats()` - Detailed stats with percentiles (p50, p90, p99)

### Nodes

- `client.nodes.list(...)` - List nodes with filtering and pagination
  - `status`: "all" | "active" | "inactive"
  - `version`: Filter by version
  - `search`: Search by address or pubkey
  - `limit`, `offset`: Pagination
  - `order_by`, `order`: Sorting
- `client.nodes.get(id_or_address)` - Get node details by ID or address
- `client.nodes.get_metrics(node_id, ...)` - Historical metrics
  - `range`: "1h" | "24h" | "7d" | "30d"
  - `aggregation`: "raw" | "hourly" | "daily"

### Leaderboard

- `client.leaderboard.get(...)` - Rankings by metric
- `client.leaderboard.top_uptime(limit)` - Top performers by uptime
- `client.leaderboard.top_efficiency(limit)` - Most efficient (lowest CPU)
- `client.leaderboard.top_storage(limit)` - Highest storage capacity

## Error Handling

```python
from pnode_pulse import PnodePulse, PnodePulseError, RateLimitError, NotFoundError

client = PnodePulse()

try:
    node = client.nodes.get(999)
except NotFoundError:
    print("Node not found")
except RateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after}s")
except PnodePulseError as e:
    print(f"API Error: {e.code} - {e.message}")
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
