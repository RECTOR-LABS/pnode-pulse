# pNode Pulse Grafana Datasource

A Grafana data source plugin for monitoring Xandeum pNode network metrics via the pNode Pulse API.

## Features

- **Network Overview**: Aggregate statistics for the entire pNode network
- **Nodes List**: View all nodes with filtering by status (active/inactive)
- **Node Metrics**: Historical time series data for individual nodes
- **Leaderboard**: Top performing nodes by various metrics
- **Alerting**: Set up alerts based on network or node metrics

## Installation

### From Grafana Plugin Catalog

1. Go to **Configuration > Plugins** in Grafana
2. Search for "pNode Pulse"
3. Click **Install**

### Manual Installation

1. Download the latest release from GitHub
2. Extract to your Grafana plugins directory:
   ```bash
   unzip pnode-pulse-grafana-datasource-1.0.0.zip -d /var/lib/grafana/plugins/
   ```
3. Restart Grafana

### Development Build

```bash
cd packages/grafana-plugin
npm install
npm run build
```

## Configuration

1. Go to **Configuration > Data Sources** in Grafana
2. Click **Add data source**
3. Search for "pNode Pulse"
4. Configure:
   - **URL**: `https://pulse.rectorspace.com` (default)
   - **API Key**: Optional, for higher rate limits

### Rate Limits

| Tier | Requests/min |
|------|-------------|
| Anonymous | 30 |
| Free | 100 |
| Pro | 1,000 |
| Enterprise | 10,000 |

Get an API key at [pulse.rectorspace.com/settings/api-keys](https://pulse.rectorspace.com/settings/api-keys)

## Query Types

### Network Overview

Returns aggregate network statistics:
- Total/Active/Inactive nodes
- Average CPU, RAM, Storage
- Version distribution

### Nodes List

List all nodes with optional filters:
- **Status**: all, active, inactive
- **Limit**: Number of nodes to return

### Node Metrics

Historical time series for a specific node:
- **Node ID or Address**: Identify the node
- **Metric**: cpu, ram, storage, uptime
- **Time Range**: 1h, 24h, 7d, 30d
- **Aggregation**: raw, hourly, daily

### Leaderboard

Top performing nodes:
- **Metric**: uptime, cpu, ram, storage
- **Limit**: Number of entries

## Example Dashboards

Import pre-built dashboards from the `dashboards/` directory:

1. **Network Overview Dashboard**: High-level network health
2. **Node Details Dashboard**: Deep dive into individual nodes
3. **Leaderboard Dashboard**: Top performers visualization

## Prometheus Integration

For Prometheus users, pNode Pulse also exposes a `/api/metrics` endpoint in Prometheus format. Add to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'pnode-pulse'
    static_configs:
      - targets: ['pulse.rectorspace.com']
    metrics_path: /api/metrics
    scheme: https
```

## Development

```bash
# Install dependencies
npm install

# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Lint
npm run lint
```

## Support

- [pNode Pulse Documentation](https://pulse.rectorspace.com/api/v1/docs)
- [GitHub Issues](https://github.com/RECTOR-LABS/pnode-pulse/issues)
- [Xandeum Discord](https://discord.com/invite/mGAxAuwnR9)

## License

Apache-2.0
