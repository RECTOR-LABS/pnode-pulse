# pNode Pulse API Reference

Public API endpoints for accessing pNode network data.

---

## Base URL

```
https://pulse.rectorspace.com/api
```

---

## Endpoints

### Health Check

Check service health status.

```
GET /api/health
```

**Response**

```json
{
  "status": "healthy",
  "timestamp": "2024-12-10T10:00:00.000Z",
  "checks": {
    "database": true,
    "redis": true
  },
  "version": "1.0.0",
  "uptime": 3600
}
```

---

### Network Overview

Get network-wide statistics.

```
GET /api/trpc/network.overview
```

**Response**

```json
{
  "result": {
    "data": {
      "nodes": {
        "total": 146,
        "active": 27,
        "inactive": 119
      },
      "metrics": {
        "avgCpu": 1.99,
        "avgRam": 33.39,
        "totalStorage": 1703000000000000,
        "avgUptime": 129930,
        "totalPeers": 768
      },
      "versions": [
        { "version": "0.7.3", "count": 22 },
        { "version": "0.7.3-trynet", "count": 4 }
      ],
      "lastUpdated": "2024-12-10T10:00:00.000Z"
    }
  }
}
```

---

### Node List

Get paginated list of nodes.

```
GET /api/trpc/nodes.list?input={"limit":50,"offset":0}
```

**Query Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Results per page (max 100) |
| `offset` | number | Pagination offset |
| `status` | string | Filter: `active`, `inactive`, `all` |
| `version` | string | Filter by version |
| `isPublic` | boolean | Filter by public accessibility |

**Response**

```json
{
  "result": {
    "data": {
      "nodes": [
        {
          "id": 1,
          "address": "192.190.136.36:6000",
          "pubkey": "Aj6AqP7xvmBNuPF5v4zNB3SYxBe3yP6rsqK6KsaKVXKM",
          "version": "0.8.0-trynet",
          "isActive": true,
          "isPublic": true,
          "lastSeen": "2024-12-10T10:00:00.000Z",
          "uptime": 129930
        }
      ],
      "total": 146,
      "hasMore": true
    }
  }
}
```

---

### Node Details

Get detailed information for a specific node.

```
GET /api/trpc/nodes.byId?input={"id":1}
```

**Response**

```json
{
  "result": {
    "data": {
      "id": 1,
      "address": "192.190.136.36:6000",
      "gossipAddress": "192.190.136.36:9001",
      "pubkey": "Aj6AqP7xvmBNuPF5v4zNB3SYxBe3yP6rsqK6KsaKVXKM",
      "version": "0.8.0-trynet",
      "isActive": true,
      "isPublic": true,
      "rpcPort": 6000,
      "firstSeen": "2024-12-01T00:00:00.000Z",
      "lastSeen": "2024-12-10T10:00:00.000Z",
      "latestMetrics": {
        "cpuPercent": 2.5,
        "ramUsed": 4294967296,
        "ramTotal": 17179869184,
        "uptime": 129930,
        "storageCommitted": 500000000000,
        "storageUsed": 94633,
        "storageUsagePercent": 0.000018
      }
    }
  }
}
```

---

### Node Metrics History

Get historical metrics for a node.

```
GET /api/trpc/nodes.metrics?input={"nodeId":1,"hours":24}
```

**Query Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `nodeId` | number | Node ID |
| `hours` | number | Hours of history (max 720) |

**Response**

```json
{
  "result": {
    "data": [
      {
        "time": "2024-12-10T09:00:00.000Z",
        "cpuPercent": 2.3,
        "ramUsed": 4294967296,
        "ramTotal": 17179869184,
        "uptime": 129800
      },
      {
        "time": "2024-12-10T10:00:00.000Z",
        "cpuPercent": 2.5,
        "ramUsed": 4294967296,
        "ramTotal": 17179869184,
        "uptime": 129930
      }
    ]
  }
}
```

---

### Storage Analytics

Get storage statistics across the network.

```
GET /api/trpc/storage.overview
```

**Response**

```json
{
  "result": {
    "data": {
      "totalCommitted": 1703000000000000,
      "totalUsed": 94633000,
      "utilizationPercent": 0.0055,
      "nodeCount": 27,
      "publicNodes": 6,
      "privateNodes": 21
    }
  }
}
```

---

### Version Distribution

Get breakdown of pNode versions.

```
GET /api/trpc/network.versions
```

**Response**

```json
{
  "result": {
    "data": [
      { "version": "0.7.3", "count": 22, "percentage": 81.5 },
      { "version": "0.7.3-trynet", "count": 4, "percentage": 14.8 },
      { "version": "0.8.0-trynet", "count": 1, "percentage": 3.7 }
    ]
  }
}
```

---

### Collection Status

Get data collection job status.

```
GET /api/trpc/network.collectionStatus
```

**Response**

```json
{
  "result": {
    "data": {
      "latest": {
        "startedAt": "2024-12-10T10:00:00.000Z",
        "completedAt": "2024-12-10T10:00:30.000Z",
        "status": "COMPLETED",
        "nodesPolled": 146,
        "nodesSuccess": 27,
        "nodesFailed": 119
      },
      "recent": [
        {
          "startedAt": "2024-12-10T09:59:30.000Z",
          "status": "COMPLETED",
          "nodesSuccess": 27
        }
      ]
    }
  }
}
```

---

### IP Changes

Get recent IP address changes detected.

```
GET /api/trpc/network.ipChanges?input={"limit":10}
```

**Response**

```json
{
  "result": {
    "data": [
      {
        "nodeId": 5,
        "pubkey": "7T4zPNNDAT7rwkQ6Rf2QyMvLwowQ4KDSxKRXF9qEtYvR",
        "oldAddress": "192.168.1.100:6000",
        "newAddress": "192.168.1.101:6000",
        "detectedAt": "2024-12-10T08:00:00.000Z"
      }
    ]
  }
}
```

---

### Graveyard (Inactive Nodes)

Get list of inactive/archived nodes.

```
GET /api/trpc/network.graveyard?input={"limit":20}
```

**Response**

```json
{
  "result": {
    "data": {
      "nodes": [
        {
          "id": 45,
          "address": "192.168.1.50:6000",
          "version": "0.6.0",
          "status": "ARCHIVED",
          "lastSeen": "2024-12-01T00:00:00.000Z",
          "daysInactive": 9
        }
      ],
      "total": 119
    }
  }
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  }
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Invalid parameters |
| `INTERNAL_ERROR` | Server error |

---

## Rate Limiting

Currently no rate limits are enforced. Please be respectful with request frequency.

---

## CORS

API supports CORS for browser-based requests from any origin.

---

## Data Freshness

- Node metrics are updated every **30 seconds**
- Network overview is cached for **10 seconds**
- Historical data is stored indefinitely

---

## Support

For API issues or feature requests:
- [GitHub Issues](https://github.com/RECTOR-LABS/pnode-pulse/issues)
